import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Download, 
  Save, 
  RefreshCw,
  UploadCloud,
  Printer,
  FileText,
  Archive,
  ChevronLeft,
  ChevronRight,
  Search,
  Minimize2,
  Maximize2,
  Sparkles,
  Trash2,
  Send,
  Users,
  Calendar,
  Wallet,
  CreditCard,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import './PayrollCreator.css';
import { StatCard, EmptyState, PageHeader } from './components/Shared';
import { SlideOverDrawer } from './components/SlideOverDrawer';
import { PayrollSmartImporter } from './components/PayrollSmartImporter';
import { PayrollSlipEditor } from './components/PayrollSlipEditor';
import {
  escapeHtml,
  numberToVietnameseWords,
  parseSmartCurrency,
  removeVietnameseAccents,
} from './utils/numberUtils';
import {
  type PayrollEmployee,
  buildSlipRenderRows,
  computeDynamicEmployeeTotals,
  createSlipItemId,
  normalizeEmployeeSlip,
} from './utils/payrollParser';

const THEMES = {
  blue: '#0369a1',
  lightBlue: '#e0f2fe',
  red: '#dc2626',
  slate: '#475569'
};

type Employee = PayrollEmployee;

interface Deduction {
  id: string;
  label: string;
  amount: number;
}

interface SavedPayrollMonth {
  month: string;
  updatedTime: string;
  operator: string;
}

interface CustomPrintPreset {
  id: string;
  name: string;
  selectedFont: string;
  fontSizeTitle: number;
  fontSizeContent: number;
  fontSizeTable: number;
  titleWeight: string;
  visibility: {
    showLogo: boolean;
    showUnitInfo: boolean;
    showTitle: boolean;
    showMetaInfo: boolean;
    showEmpName: boolean;
    showEmpRole: boolean;
    showEmpDept: boolean;
    showEmpBank: boolean;
    showBaseSalary: boolean;
    showTime: boolean;
    showAdvance: boolean;
    showDeductions: boolean;
    showSignatures: boolean;
    showNotes: boolean;
  };
  currencySymbol: 'đ' | 'VNĐ' | 'none';
  currencySeparator: '.' | ',';
  roundMode: 'none' | 'hundred' | 'thousand';
  activeTemplate: 'standard' | 'k80' | 'modern';
  paperSize: 'a4' | 'k80';
  thermalOptions: {
    splitEachSlip: boolean;
    compactCut: boolean;
    bottomFeedMm: number;
    hideSignature: boolean;
    hideEmptyNotes: boolean;
    hideEmptyRows: boolean;
    showCutLine: boolean;
  };
}

interface PayrollCreatorProps {
  gasUrl: string;
  spreadsheetId: string;
  operatorName: string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const AVAILABLE_FONTS = [
  'Be Vietnam Pro',
  'Inter',
  'Roboto',
  'Noto Sans',
  'Noto Serif',
  'Montserrat',
  'Nunito',
  'Manrope',
  'Mulish',
  'Source Serif 4',
];

type SalaryMode = 'monthly' | 'hourly' | 'restaurant';
type RoundMode = 'none' | 'hundred' | 'thousand';
type PrintScope = 'current' | 'all' | 'selected';
type VisibilityConfig = CustomPrintPreset['visibility'];
type ThermalOptionsConfig = CustomPrintPreset['thermalOptions'];

const DEFAULT_VISIBILITY: VisibilityConfig = {
  showLogo: true,
  showUnitInfo: true,
  showTitle: true,
  showMetaInfo: true,
  showEmpName: true,
  showEmpRole: true,
  showEmpDept: true,
  showEmpBank: true,
  showBaseSalary: true,
  showTime: true,
  showAdvance: true,
  showDeductions: true,
  showSignatures: true,
  showNotes: true,
};

const DEFAULT_THERMAL_OPTIONS: ThermalOptionsConfig = {
  splitEachSlip: true,
  compactCut: true,
  bottomFeedMm: 6,
  hideSignature: true,
  hideEmptyNotes: true,
  hideEmptyRows: true,
  showCutLine: false,
};

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Roboto:wght@400;500;700&family=Noto+Sans:wght@400;700&family=Noto+Serif:wght@400;700&family=Manrope:wght@400;500;700&family=Mulish:wght@400;700&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@400;700;800;900&display=swap';

function createPayrollId(prefix = ''): string {
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return prefix ? `${prefix}-${base}` : base;
}

function roundSalaryByMode(n: number, mode: RoundMode): number {
  if (mode === 'thousand') return Math.round(n / 1000) * 1000;
  if (mode === 'hundred') return Math.round(n / 100) * 100;
  return Math.round(n);
}

function calculateRestaurantDetails(emp: Employee) {
  const salary = emp.salary || 0;
  const workedDays = emp.workedDays !== undefined ? emp.workedDays : emp.days;
  const addedDays = emp.addedDays !== undefined ? emp.addedDays : 0;

  const quyDoi = Math.round(salary / 240);
  const luongTheoGio = Math.round((salary * (workedDays + addedDays)) / 30);
  const tienCom = emp.lunchPay !== undefined ? emp.lunchPay : workedDays * 20000;
  const thuong = emp.bonus || 0;
  const tangCa = emp.overtimePay || 0;
  const doBe = emp.deduction || 0;
  const tamUng = emp.advance || 0;
  const tongNhan = luongTheoGio + tienCom + thuong + tangCa - doBe - tamUng;

  return {
    quyDoi,
    luongTheoGio,
    tienCom,
    thuong,
    tangCa,
    doBe,
    tamUng,
    tongNhan,
  };
}

function computeEmployeeAmount(
  emp: Employee,
  mode: SalaryMode,
  stdDays: number,
  rMode: RoundMode
): number {
  return computeDynamicEmployeeTotals(emp, mode, stdDays, rMode).netPay;
}

interface InitialPayrollDraft {
  salaryMode: SalaryMode;
  payMonth: string;
  voucherDate: string;
  standardDays: number;
  defaultPosition: string;
  defaultDept: string;
  advance: number;
  employees: Employee[];
  deductions: Deduction[];
  activeTemplate: 'standard' | 'k80' | 'modern';
}

function loadInitialPayrollDraft(): InitialPayrollDraft {
  const fallback: InitialPayrollDraft = {
    salaryMode: 'restaurant',
    payMonth: '2026-06',
    voucherDate: '2026-06-12',
    standardDays: 30,
    defaultPosition: 'Nhân viên',
    defaultDept: 'Nhân sự',
    advance: 0,
    employees: [],
    deductions: [],
    activeTemplate: 'standard',
  };

  try {
    const saved = localStorage.getItem('kg_tool_payroll_state');
    if (!saved) return fallback;
    const data = JSON.parse(saved) as Partial<InitialPayrollDraft>;
    return {
      salaryMode: data.salaryMode || 'monthly',
      payMonth: data.payMonth || '2026-06',
      voucherDate: data.voucherDate || '2026-06-12',
      standardDays: Number(data.standardDays) || 30,
      defaultPosition: data.defaultPosition || 'Nhân viên',
      defaultDept: data.defaultDept || 'Nhân sự',
      advance: Number(data.advance) || 0,
      employees: Array.isArray(data.employees) ? data.employees : [],
      deductions: Array.isArray(data.deductions) ? data.deductions : [],
      activeTemplate: data.activeTemplate || 'standard',
    };
  } catch (e) {
    console.error(e);
    return fallback;
  }
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface MoneyInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  formatMoney: (n: number) => string;
}

const MoneyInput: React.FC<MoneyInputProps> = ({ value, onChange, className, placeholder, formatMoney }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState('');

  const handleFocus = () => {
    setIsFocused(true);
    setLocalValue(value === 0 ? '' : String(value));
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = Math.round(parseSmartCurrency(localValue));
    onChange(parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cleanVal = val.replace(/[^0-9]/g, '');
    setLocalValue(cleanVal);
  };

  return (
    <input
      type="text"
      className={className}
      placeholder={placeholder}
      value={isFocused ? localValue : formatMoney(value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
    />
  );
};

const pad2 = (n: number) => String(n).padStart(2, '0');

function monthLabel(value: string) {
  if (!value) return 'THÁNG 06/2026';
  const [y, m] = value.split('-');
  return `THÁNG ${m}/${y}`;
}

function formatDate(value: string) {
  if (!value) return '';
  const d = new Date(value + 'T00:00:00');
  return `Ngày ${pad2(d.getDate())} tháng ${pad2(d.getMonth() + 1)} năm ${d.getFullYear()}`;
}

function numberToVietnamese(num: number): string {
  const rounded = Math.round(Number(num) || 0);
  if (rounded === 0) return 'Không đồng chẵn';
  const words = numberToVietnameseWords(rounded);
  return words.charAt(0).toUpperCase() + words.slice(1) + ' đồng chẵn';
}

export default function PayrollCreator({ gasUrl, spreadsheetId, operatorName, showToast }: PayrollCreatorProps) {
  const [initialDraft] = useState<InitialPayrollDraft>(() => loadInitialPayrollDraft());

  // Main form states (initialized lazily from draft to avoid cascading setState on mount)
  const [salaryMode, setSalaryMode] = useState<SalaryMode>(() => initialDraft.salaryMode);
  const [payMonth, setPayMonth] = useState(() => initialDraft.payMonth);
  const [voucherDate, setVoucherDate] = useState(() => initialDraft.voucherDate);
  const [standardDays, setStandardDays] = useState(() => initialDraft.standardDays);
  const [defaultPosition, setDefaultPosition] = useState(() => initialDraft.defaultPosition);
  const [defaultDept, setDefaultDept] = useState(() => initialDraft.defaultDept);

  const [advance, setAdvance] = useState(() => initialDraft.advance);
  const [employees, setEmployees] = useState<Employee[]>(() => initialDraft.employees);
  const [deductions, setDeductions] = useState<Deduction[]>(() => initialDraft.deductions);

  // UI Preview configs
  const [activeTemplate, setActiveTemplate] = useState<'standard' | 'k80' | 'modern'>(() => initialDraft.activeTemplate);
  const [activeView, setActiveView] = useState<'receipt' | 'summary'>('receipt');

  // Sync history states
  const [historyMonths, setHistoryMonths] = useState<SavedPayrollMonth[]>([]);
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'loading'>('offline');

  // Drag-drop state
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // New Upgraded UI Configurations
  const [selectedFont, setSelectedFont] = useState(() => localStorage.getItem('kg_tool_selected_font') || 'Be Vietnam Pro');
  const [fontSizeTitle, setFontSizeTitle] = useState(() => Number(localStorage.getItem('kg_tool_font_size_title')) || 28);
  const [fontSizeContent, setFontSizeContent] = useState(() => Number(localStorage.getItem('kg_tool_font_size_content')) || 14);
  const [fontSizeTable, setFontSizeTable] = useState(() => Number(localStorage.getItem('kg_tool_font_size_table')) || 13);
  const [titleWeight, setTitleWeight] = useState(() => localStorage.getItem('kg_tool_title_weight') || '700');

  const [visibility, setVisibility] = useState<VisibilityConfig>(() =>
    safeParseJson<VisibilityConfig>(localStorage.getItem('kg_tool_payroll_visibility'), DEFAULT_VISIBILITY)
  );

  const [currencySymbol, setCurrencySymbol] = useState<'đ' | 'VNĐ' | 'none'>(() => (localStorage.getItem('kg_tool_currency_symbol') as 'đ' | 'VNĐ' | 'none') || 'đ');
  const [currencySeparator, setCurrencySeparator] = useState<'.' | ','>(() => (localStorage.getItem('kg_tool_currency_separator') as '.' | ',') || '.');
  const [roundMode, setRoundMode] = useState<RoundMode>(() => (localStorage.getItem('kg_tool_round_mode') as RoundMode) || 'thousand');

  const [currentEmployeeIndex, setCurrentEmployeeIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<'single' | 'list' | 'thumbnail'>(() => (localStorage.getItem('kg_tool_preview_mode') as 'single' | 'list' | 'thumbnail') || 'single');
  const [zoomLevel, setZoomLevel] = useState<string | number>('fit');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set(initialDraft.employees.map(e => e.id))
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');
  const [navigatorFilter, setNavigatorFilter] = useState<'all' | 'valid' | 'invalid' | 'deduction' | 'advance'>('all');
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(() => {
    if (localStorage.getItem('kg_tool_pending_open_payroll_config') === '1') {
      localStorage.removeItem('kg_tool_pending_open_payroll_config');
      return true;
    }
    return false;
  });
  const [configDrawerTab, setConfigDrawerTab] = useState<'salary' | 'print' | 'sync' | 'warnings'>('salary');

  useEffect(() => {
    const handleOpenConfig = () => {
      localStorage.removeItem('kg_tool_pending_open_payroll_config');
      setIsConfigDrawerOpen(true);
    };
    window.addEventListener('kg_open_payroll_config', handleOpenConfig);
    return () => window.removeEventListener('kg_open_payroll_config', handleOpenConfig);
  }, []);

  const [printScope, setPrintScope] = useState<PrintScope>(() => (localStorage.getItem('kg_tool_print_scope') as PrintScope) || 'current');
  const [paperSize, setPaperSize] = useState<'a4' | 'k80'>(() => {
    if (initialDraft.activeTemplate === 'k80') return 'k80';
    return (localStorage.getItem('kg_tool_paper_size') as 'a4' | 'k80') || 'a4';
  });
  const [activeQuickPreset, setActiveQuickPreset] = useState<'full' | 'compact' | 'internal' | 'k80'>(() => (localStorage.getItem('kg_tool_quick_preset') as 'full' | 'compact' | 'internal' | 'k80') || 'full');
  const [activeTypoPreset, setActiveTypoPreset] = useState<'modern' | 'admin' | 'minimalist' | 'luxury' | 'k80'>(() => (localStorage.getItem('kg_tool_typo_preset') as 'modern' | 'admin' | 'minimalist' | 'luxury' | 'k80') || 'admin');

  const [thermalOptions, setThermalOptions] = useState<ThermalOptionsConfig>(() =>
    safeParseJson<ThermalOptionsConfig>(localStorage.getItem('kg_tool_thermal_options'), DEFAULT_THERMAL_OPTIONS)
  );

  useEffect(() => {
    localStorage.setItem('kg_tool_thermal_options', JSON.stringify(thermalOptions));
  }, [thermalOptions]);

  const [customPresets, setCustomPresets] = useState<CustomPrintPreset[]>(() =>
    safeParseJson<CustomPrintPreset[]>(localStorage.getItem('kg_tool_custom_print_presets'), [])
  );

  const [containerWidth, setContainerWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  const containerResizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (containerResizeObserverRef.current) {
      containerResizeObserverRef.current.disconnect();
      containerResizeObserverRef.current = null;
    }
    if (node) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      observer.observe(node);
      containerResizeObserverRef.current = observer;
    }
  }, []);

  const previewViewportRef = useCallback((node: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (node) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setViewportWidth(entry.contentRect.width);
        }
      });
      observer.observe(node);
      resizeObserverRef.current = observer;
    }
  }, []);

  const layoutMode = useMemo(() => {
    if (containerWidth === 0) {
      const w = window.innerWidth;
      if (w >= 1100) return 'wide';
      if (w >= 800) return 'compact';
      if (w >= 600) return 'narrow';
      return 'mobile';
    }
    if (containerWidth >= 1100) return 'wide';
    if (containerWidth >= 800) return 'compact';
    if (containerWidth >= 600) return 'narrow';
    return 'mobile';
  }, [containerWidth]);

  const isMobileScreen = layoutMode === 'mobile';
  const [mobileActiveTab, setMobileActiveTab] = useState<'data' | 'settings' | 'preview' | 'export'>('preview');

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('print-k80-mode');
      document.body.classList.remove('print-k80-no-split');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Save changes to local draft on state adjustment
  useEffect(() => {
    const stateObj = {
      salaryMode,
      payMonth,
      voucherDate,
      standardDays,
      defaultPosition,
      defaultDept,
      advance,
      employees,
      deductions,
      activeTemplate
    };
    localStorage.setItem('kg_tool_payroll_state', JSON.stringify(stateObj));
  }, [salaryMode, payMonth, voucherDate, standardDays, defaultPosition, defaultDept, advance, employees, deductions, activeTemplate]);

  // Save visibility and typography
  useEffect(() => {
    localStorage.setItem('kg_tool_selected_font', selectedFont);
    localStorage.setItem('kg_tool_font_size_title', String(fontSizeTitle));
    localStorage.setItem('kg_tool_font_size_content', String(fontSizeContent));
    localStorage.setItem('kg_tool_font_size_table', String(fontSizeTable));
    localStorage.setItem('kg_tool_title_weight', titleWeight);
    localStorage.setItem('kg_tool_payroll_visibility', JSON.stringify(visibility));
    localStorage.setItem('kg_tool_currency_symbol', currencySymbol);
    localStorage.setItem('kg_tool_currency_separator', currencySeparator);
    localStorage.setItem('kg_tool_round_mode', roundMode);
    localStorage.setItem('kg_tool_preview_mode', previewMode);
    localStorage.setItem('kg_tool_print_scope', printScope);
    localStorage.setItem('kg_tool_paper_size', paperSize);
    localStorage.setItem('kg_tool_quick_preset', activeQuickPreset);
    localStorage.setItem('kg_tool_typo_preset', activeTypoPreset);
  }, [selectedFont, fontSizeTitle, fontSizeContent, fontSizeTable, titleWeight, visibility, currencySymbol, currencySeparator, roundMode, previewMode, printScope, paperSize, activeQuickPreset, activeTypoPreset]);

  // Load Google Fonts once in document.head via <link> (avoids duplicate @import parsing inside every SVG)
  useEffect(() => {
    const linkId = 'google-fonts-payroll-link';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = GOOGLE_FONTS_HREF;
      document.head.appendChild(link);
    }
  }, []);

  // Dynamic Page Margin Injection for OS Print Setup Dialog
  useEffect(() => {
    const styleId = 'print-page-style';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    if (paperSize === 'k80') {
      style.innerHTML = `
        @media print {
          @page {
            size: 80mm auto !important;
            margin: 0 !important;
          }
          body {
            background: #fff !important;
            color: #000 !important;
          }
        }
      `;
    } else {
      style.innerHTML = `
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 10mm !important;
          }
          body {
            background: #fff !important;
            color: #000 !important;
          }
        }
      `;
    }
  }, [paperSize]);

  // Google Apps Script REST API connections
  const fetchHistoryMonths = useCallback(async () => {
    if (!gasUrl) return;
    setSyncStatus('loading');
    try {
      const url = `${gasUrl}?action=getMonths&ssId=${encodeURIComponent(spreadsheetId)}`;
      const res = await fetch(url);
      const result = await res.json() as { success?: boolean; data?: SavedPayrollMonth[]; error?: string };
      if (result.success) {
        setHistoryMonths(result.data || []);
        setSyncStatus('online');
      } else {
        console.error(result.error);
        setSyncStatus('offline');
      }
    } catch (e) {
      console.error(e);
      setSyncStatus('offline');
    }
  }, [gasUrl, spreadsheetId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (gasUrl) {
        void fetchHistoryMonths();
      } else {
        setSyncStatus('offline');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [gasUrl, fetchHistoryMonths]);

  // Round salary helper based on configuration
  const roundSalary = useCallback((n: number) => {
    return roundSalaryByMode(n, roundMode);
  }, [roundMode]);

  const getEmployeeNet = useCallback((emp: Employee) => {
    return computeDynamicEmployeeTotals(emp, salaryMode, standardDays, roundMode).netPay;
  }, [salaryMode, standardDays, roundMode]);

  const recalculateAllEmployees = useCallback((mode: SalaryMode, stdDays: number, rMode: RoundMode) => {
    setEmployees(prev => prev.map(e => ({
      ...e,
      amount: computeEmployeeAmount(e, mode, stdDays, rMode),
    })));
  }, []);

  const handleSalaryModeChange = (nextMode: SalaryMode) => {
    setSalaryMode(nextMode);
    recalculateAllEmployees(nextMode, standardDays, roundMode);
  };

  const handleStandardDaysChange = (nextDays: number) => {
    const safeDays = nextDays > 0 ? nextDays : 26;
    setStandardDays(safeDays);
    recalculateAllEmployees(salaryMode, safeDays, roundMode);
  };

  const handleRoundModeChange = (nextRoundMode: RoundMode) => {
    setRoundMode(nextRoundMode);
    recalculateAllEmployees(salaryMode, standardDays, nextRoundMode);
  };

  const importFromAttendanceSummary = useCallback(() => {
    const raw = localStorage.getItem('kg_tool_attendance_summary');
    if (!raw) {
      showToast('Chưa có dữ liệu tổng hợp từ phân hệ Chấm công.', 'info');
      return;
    }
    try {
      const summaries = JSON.parse(raw) as Array<{
        name: string;
        workedDays: number;
        totalHours: number;
        range: string;
        month: string;
      }>;
      if (!Array.isArray(summaries) || summaries.length === 0) return;

      if (summaries[0]?.month) {
        setPayMonth(summaries[0].month);
      }

      setEmployees(prev => {
        const next: Employee[] = summaries.map((s, idx) => {
          const existing = prev.find(
            e => e.name.trim().toLowerCase() === s.name.trim().toLowerCase()
          );
          const baseSalary = existing?.salary || (salaryMode === 'hourly' ? 35000 : 6500000);
          const daysVal = salaryMode === 'hourly' ? (s.totalHours || s.workedDays * 8) : s.workedDays;

          const tempEmp: Employee = {
            id: existing?.id || createPayrollId(`att-${idx}`),
            name: s.name,
            days: daysVal,
            workedDays: s.workedDays,
            totalHours: s.totalHours || s.workedDays * 8,
            addedDays: existing?.addedDays ?? 0,
            lunchPay: existing?.lunchPay ?? s.workedDays * 20000,
            bonus: existing?.bonus ?? 0,
            overtimePay: existing?.overtimePay ?? 0,
            deduction: existing?.deduction ?? 0,
            advance: existing?.advance ?? 0,
            range: s.range || existing?.range || '',
            salary: baseSalary,
            amount: 0
          };

          tempEmp.amount = computeEmployeeAmount(tempEmp, salaryMode, standardDays, roundMode);
          return tempEmp;
        });

        setSelectedEmployeeIds(new Set(next.map(e => e.id)));
        return next;
      });

      showToast(`Đã đồng bộ ${summaries.length} nhân viên từ Bảng Chấm Công sang Tính Lương!`, 'success');
    } catch (e) {
      console.error(e);
    }
  }, [roundMode, salaryMode, showToast, standardDays]);

  const handlePipeToTransferTool = () => {
    if (employees.length === 0) {
      showToast('Chưa có dữ liệu nhân viên để chuyển sang Lập lệnh chuyển khoản.', 'error');
      return;
    }
    const stateToSave = {
      salaryMode,
      payMonth,
      voucherDate,
      standardDays,
      defaultPosition,
      defaultDept,
      roundMode,
      advance,
      employees,
      deductions
    };
    localStorage.setItem('kg_tool_payroll_state', JSON.stringify(stateToSave));
    localStorage.setItem('kg_tool_pending_payroll_transfer', '1');
    window.dispatchEvent(new CustomEvent('kg-navigate-tab', { detail: 'transfer' }));
    window.dispatchEvent(new CustomEvent('kg-import-payroll-to-transfer'));
  };

  useEffect(() => {
    const onPresetK80 = () => {
      localStorage.removeItem('kg_tool_pending_preset_k80');
      setPaperSize('k80');
      setActiveTemplate('k80');
      setActiveQuickPreset('k80');
      showToast('Đã chuyển sang chế độ In nhiệt K80 (80mm)!', 'success');
    };
    const timer = window.setTimeout(() => {
      if (localStorage.getItem('kg_tool_pending_attendance_payroll') === '1') {
        localStorage.removeItem('kg_tool_pending_attendance_payroll');
        importFromAttendanceSummary();
      }
      if (localStorage.getItem('kg_tool_pending_preset_k80') === '1') {
        localStorage.removeItem('kg_tool_pending_preset_k80');
        onPresetK80();
      }
    }, 0);
    const onImportAtt = () => {
      localStorage.removeItem('kg_tool_pending_attendance_payroll');
      importFromAttendanceSummary();
    };
    window.addEventListener('kg-import-attendance-to-payroll', onImportAtt);
    window.addEventListener('kg-preset-k80', onPresetK80);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('kg-import-attendance-to-payroll', onImportAtt);
      window.removeEventListener('kg-preset-k80', onPresetK80);
    };
  }, [importFromAttendanceSummary, showToast]);

  // Smart Multi-Source Importer state
  const [isSmartImporterOpen, setIsSmartImporterOpen] = useState(false);
  const [importerInitialTab, setImporterInitialTab] = useState<'excel' | 'image' | 'text'>('excel');
  const [droppedImportFile, setDroppedImportFile] = useState<File | null>(null);

  const openSmartImporter = (tab: 'excel' | 'image' | 'text' = 'excel') => {
    setImporterInitialTab(tab);
    setIsSmartImporterOpen(true);
  };

  const handleApplyImportedEmployees = (
    imported: Employee[],
    mode: 'replace' | 'append',
    detectedMode?: SalaryMode
  ) => {
    if (detectedMode && detectedMode !== salaryMode) {
      setSalaryMode(detectedMode);
    }
    if (mode === 'replace') {
      setEmployees(imported);
      setSelectedEmployeeIds(new Set(imported.map(e => e.id)));
      setCurrentEmployeeIndex(0);
    } else {
      setEmployees(prev => {
        const next = [...prev, ...imported];
        return next;
      });
      setSelectedEmployeeIds(prev => {
        const next = new Set(prev);
        imported.forEach(e => next.add(e.id));
        return next;
      });
    }
    showToast(`Đã áp dụng ${imported.length} phiếu lương chuẩn hóa vào Bảng lương!`, 'success');
  };

  const handleUpdateEmployeeFull = (updated: Employee) => {
    setEmployees(prev => prev.map(e => (e.id === updated.id ? updated : e)));
  };

  const handleNormalizeSingleSlip = (empId: string) => {
    setEmployees(prev => prev.map(e =>
      e.id === empId
        ? normalizeEmployeeSlip(e, salaryMode, standardDays, roundMode, { removeZeroRows: true })
        : e
    ));
    showToast('Đã chuẩn hóa phiếu lương (ẩn dòng 0 đ & sắp xếp Cộng/Trừ rõ ràng)!', 'success');
  };

  const handleNormalizeAllSlips = () => {
    if (employees.length === 0) return;
    setEmployees(prev => prev.map(e =>
      normalizeEmployeeSlip(e, salaryMode, standardDays, roundMode, { removeZeroRows: true })
    ));
    showToast(`Đã chuẩn hóa toàn bộ ${employees.length} phiếu lương theo đúng khoản riêng của từng nhân viên!`, 'success');
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.toLowerCase().split('.').pop();
      if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
        setImporterInitialTab('image');
        setDroppedImportFile(file);
        setIsSmartImporterOpen(true);
        return;
      }
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'tsv') {
        setImporterInitialTab('excel');
        setDroppedImportFile(file);
        setIsSmartImporterOpen(true);
        return;
      }
      showToast('Vui lòng kéo thả tệp Excel (.xlsx, .xls, .csv) hoặc Ảnh phiếu lương (.png, .jpg)', 'error');
    }
  }, [showToast]);

  const loadSampleData = () => {
    const sampleList: Employee[] = [
      normalizeEmployeeSlip({
        id: createSlipItemId('smp'),
        name: 'Nguyễn Minh Anh',
        role: 'Bếp trưởng',
        dept: 'Bếp nướng',
        days: 26,
        workedDays: 26,
        addedDays: 2,
        totalHours: 232,
        range: '01/11 - 30/11',
        salary: 9000000,
        amount: 0,
        useCustomSlipItems: true,
        slipItems: [
          { id: createSlipItemId('s'), label: 'Tiền cơm', type: 'add', amount: 520000, visible: true },
          { id: createSlipItemId('s'), label: 'Thưởng KPI bếp', type: 'add', amount: 600000, note: 'Đạt chuẩn 100%', visible: true },
          { id: createSlipItemId('s'), label: 'Tăng ca lễ', type: 'add', amount: 450000, visible: true },
          { id: createSlipItemId('s'), label: 'Tạm ứng lương', type: 'deduct', amount: 1000000, note: 'Đợt 15/11', visible: true },
        ],
        sourceType: 'manual',
      }, salaryMode, standardDays, roundMode),
      normalizeEmployeeSlip({
        id: createSlipItemId('smp'),
        name: 'Trần Thu Hà',
        role: 'Thu ngân ca tối',
        dept: 'Quầy thu ngân',
        days: 25.5,
        workedDays: 25.5,
        addedDays: 0,
        totalHours: 204,
        range: '01/11 - 30/11',
        salary: 7800000,
        amount: 0,
        useCustomSlipItems: true,
        slipItems: [
          { id: createSlipItemId('s'), label: 'Tiền cơm', type: 'add', amount: 510000, visible: true },
          { id: createSlipItemId('s'), label: 'Phụ cấp gửi xe', type: 'add', amount: 200000, visible: true },
          { id: createSlipItemId('s'), label: 'Phạt đi trễ', type: 'deduct', amount: 100000, note: '2 buổi', visible: true },
        ],
        sourceType: 'manual',
      }, salaryMode, standardDays, roundMode),
      normalizeEmployeeSlip({
        id: createSlipItemId('smp'),
        name: 'Lê Hoàng Nam',
        role: 'Phục vụ bàn',
        dept: 'Sảnh Q1',
        days: 24,
        workedDays: 24,
        addedDays: 0,
        totalHours: 192,
        range: '01/11 - 30/11',
        salary: 7000000,
        amount: 0,
        useCustomSlipItems: true,
        slipItems: [
          { id: createSlipItemId('s'), label: 'Tiền cơm', type: 'add', amount: 480000, visible: true },
          { id: createSlipItemId('s'), label: 'Đổ bể ly', type: 'deduct', amount: 120000, note: '2 ly rượu', visible: true },
          { id: createSlipItemId('s'), label: 'Đồng phục', type: 'deduct', amount: 150000, visible: true },
          { id: createSlipItemId('s'), label: 'Tạm ứng lương', type: 'deduct', amount: 500000, visible: true },
        ],
        sourceType: 'manual',
      }, salaryMode, standardDays, roundMode),
    ];
    setEmployees(sampleList);
    setDeductions([]);
    setSelectedEmployeeIds(new Set(sampleList.map(e => e.id)));
    setCurrentEmployeeIndex(0);
    showToast('Đã nạp 3 phiếu mẫu có số dòng cộng/trừ khác nhau để bạn trải nghiệm!', 'success');
  };

  const addEmployee = () => {
    const id = createPayrollId('emp');
    const isHourly = salaryMode === 'hourly';
    const isRestaurant = salaryMode === 'restaurant';

    let initialSalary = 10000000;
    let initialDays = 26;
    let initialAmount = 0;

    if (isHourly) {
      initialSalary = 35000;
      initialDays = 160;
      initialAmount = roundSalary(35000 * 160);
    } else if (isRestaurant) {
      initialSalary = 6500000;
      initialDays = 26;
      const details = calculateRestaurantDetails({
        id,
        name: `Nhân viên mới ${employees.length + 1}`,
        days: 26,
        workedDays: 26,
        addedDays: 0,
        totalHours: 208,
        salary: 6500000,
        amount: 0,
        range: ''
      });
      initialAmount = details.tongNhan;
    } else {
      initialAmount = roundSalary(initialSalary * initialDays / standardDays);
    }

    setEmployees(prev => [
      ...prev,
      {
        id,
        name: `Nhân viên mới ${prev.length + 1}`,
        days: initialDays,
        range: '',
        salary: initialSalary,
        amount: initialAmount,
        addedDays: isRestaurant ? 0 : undefined,
        totalHours: isRestaurant ? 208 : undefined,
        workedDays: isRestaurant ? 26 : undefined,
        lunchPay: isRestaurant ? 520000 : undefined,
        bonus: isRestaurant ? 0 : undefined,
        overtimePay: isRestaurant ? 0 : undefined,
        deduction: isRestaurant ? 0 : undefined,
      }
    ]);
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const deleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const addDeduction = () => {
    const id = createPayrollId('ded');
    setDeductions(prev => [...prev, { id, label: '', amount: 0 }]);
  };

  const deleteDeduction = (id: string) => {
    setDeductions(prev => prev.filter(d => d.id !== id));
  };

  const updateDeduction = <K extends keyof Deduction>(id: string, field: K, val: Deduction[K]) => {
    setDeductions(prev => prev.map(d => d.id === id ? { ...d, [field]: val } : d));
  };

  const clearAllForms = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ form và bắt đầu lại? Dữ liệu nháp trên trình duyệt sẽ bị xóa.')) {
      setEmployees([]);
      setDeductions([]);
      setAdvance(0);
      setSelectedEmployeeIds(new Set());
      showToast('Đã xóa trắng form dữ liệu!', 'info');
    }
  };

  const loadHistoryMonth = async (month: string) => {
    if (!gasUrl) {
      showToast('Vui lòng cấu hình URL Google Apps Script trong Cài đặt trước!', 'error');
      return;
    }
    showToast(`Đang tải dữ liệu lương tháng ${month}...`, 'info');
    setSyncStatus('loading');
    try {
      const url = `${gasUrl}?action=getPayroll&month=${month}&ssId=${encodeURIComponent(spreadsheetId)}`;
      const res = await fetch(url);
      const result = await res.json() as {
        success?: boolean;
        data?: Partial<InitialPayrollDraft>;
        error?: string;
      };
      if (result.success && result.data) {
        const data = result.data;
        setSalaryMode(data.salaryMode || 'monthly');
        setPayMonth(data.payMonth || month);
        setVoucherDate(data.voucherDate || '');
        setStandardDays(Number(data.standardDays) || 30);
        setDefaultPosition(data.defaultPosition || '');
        setDefaultDept(data.defaultDept || '');
        setAdvance(Number(data.advance) || 0);
        const loadedEmps = Array.isArray(data.employees) ? data.employees : [];
        setEmployees(loadedEmps);
        setSelectedEmployeeIds(new Set(loadedEmps.map(e => e.id)));
        setDeductions(Array.isArray(data.deductions) ? data.deductions : []);

        showToast(`Đã tải thành công dữ liệu tháng ${month}!`, 'success');
        setSyncStatus('online');
      } else {
        showToast(`Lỗi: ${result.error || 'Không tìm thấy dữ liệu'}`, 'error');
        setSyncStatus('online');
      }
    } catch (e) {
      console.error(e);
      showToast('Lỗi kết nối tới Google Apps Script.', 'error');
      setSyncStatus('offline');
    }
  };

  const deleteHistoryMonth = async (month: string) => {
    if (!gasUrl) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn dữ liệu lương tháng ${month} trên Google Sheets?`)) return;

    showToast(`Đang xóa tháng ${month}...`, 'info');
    setSyncStatus('loading');
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deletePayroll',
          ssId: spreadsheetId,
          month,
          operator: operatorName
        })
      });
      const result = await res.json() as { success?: boolean; error?: string };
      if (result.success) {
        showToast(`Đã xóa thành công tháng ${month}!`, 'success');
        void fetchHistoryMonths();
      } else {
        showToast(`Lỗi: ${result.error}`, 'error');
        setSyncStatus('online');
      }
    } catch (e) {
      console.error(e);
      showToast('Lỗi xóa dữ liệu.', 'error');
      setSyncStatus('offline');
    }
  };

  const savePayrollToGAS = async () => {
    if (!gasUrl) {
      showToast('Cấu hình Google Apps Script Web App URL trước khi lưu.', 'error');
      return;
    }
    showToast('Đang lưu dữ liệu lên Google Sheets...', 'info');
    setSyncStatus('loading');

    const payload = {
      action: 'savePayroll',
      ssId: spreadsheetId,
      month: payMonth,
      operator: operatorName || 'Kế toán viên',
      data: JSON.stringify({
        salaryMode,
        payMonth,
        voucherDate,
        standardDays,
        defaultPosition,
        defaultDept,
        roundMode,
        advance,
        employees,
        deductions
      })
    };

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const result = await res.json() as { success?: boolean; error?: string };
      if (result.success) {
        showToast('Lưu phiếu lương thành công lên Google Sheets!', 'success');
        void fetchHistoryMonths();
      } else {
        showToast(`Lỗi lưu: ${result.error}`, 'error');
        setSyncStatus('online');
      }
    } catch (e) {
      console.error(e);
      showToast('Lỗi lưu trữ dữ liệu.', 'error');
      setSyncStatus('offline');
    }
  };

  // Money Formatting custom utility
  const formatMoney = (n: number) => {
    const rounded = roundSalaryByMode(n, roundMode);

    let formatted = rounded.toLocaleString('vi-VN');
    if (currencySeparator === ',') {
      formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    if (currencySymbol === 'đ') return `${formatted}đ`;
    if (currencySymbol === 'VNĐ') return `${formatted} VNĐ`;
    return formatted;
  };

  // Accents-agnostic search helper
  const stripAccents = (str: string): string => {
    return removeVietnameseAccents(str || '').toLowerCase();
  };

  // Dynamic Validation maps (individual employee net validation)
  const validationMap = useMemo(() => {
    const map: Record<string, { type: 'error' | 'warning'; message: string }[]> = {};

    employees.forEach(emp => {
      const msgs: { type: 'error' | 'warning'; message: string }[] = [];
      if (!emp.name.trim()) {
        msgs.push({ type: 'error', message: 'Thiếu họ tên nhân viên' });
      }
      if (Number(emp.days || 0) <= 0) {
        msgs.push({ type: 'warning', message: 'Thiếu số công/giờ làm (bằng 0)' });
      }
      if (Number(emp.salary || 0) <= 0) {
        msgs.push({ type: 'error', message: 'Mức lương cơ bản chưa hợp lệ' });
      }
      const netAmount = getEmployeeNet(emp);
      if (netAmount < 0) {
        msgs.push({ type: 'error', message: 'Khấu trừ & tạm ứng vượt quá thu nhập (Thực nhận âm)' });
      }
      if (msgs.length > 0) {
        map[emp.id] = msgs;
      }
    });
    return map;
  }, [employees, getEmployeeNet]);

  // Filtered employees list for navigation and search
  const filteredNavigatorEmployees = useMemo(() => {
    const query = stripAccents(searchEmployeeQuery).trim();
    const totalDeduct = deductions.reduce((a, b) => a + Number(b.amount || 0), 0);

    return employees.filter(emp => {
      const matchQuery = stripAccents(emp.name).includes(query);
      if (!matchQuery) return false;

      const msgs = validationMap[emp.id] || [];

      if (navigatorFilter === 'invalid') return msgs.length > 0;
      if (navigatorFilter === 'valid') return msgs.length === 0;
      if (navigatorFilter === 'deduction') return Number(emp.deduction || 0) > 0 || totalDeduct > 0;
      if (navigatorFilter === 'advance') return Number(emp.advance || 0) > 0 || advance > 0;
      return true;
    });
  }, [employees, searchEmployeeQuery, navigatorFilter, validationMap, deductions, advance]);

  const activeEmployee = employees[currentEmployeeIndex] || employees[0];

  // Preset apply helpers
  const applyPreset = (preset: 'full' | 'compact' | 'internal' | 'k80') => {
    setActiveQuickPreset(preset);
    if (preset === 'full') {
      setVisibility({
        showLogo: true,
        showUnitInfo: true,
        showTitle: true,
        showMetaInfo: true,
        showEmpName: true,
        showEmpRole: true,
        showEmpDept: true,
        showEmpBank: true,
        showBaseSalary: true,
        showTime: true,
        showAdvance: true,
        showDeductions: true,
        showSignatures: true,
        showNotes: true
      });
    } else if (preset === 'compact') {
      setVisibility({
        showLogo: false,
        showUnitInfo: false,
        showTitle: true,
        showMetaInfo: true,
        showEmpName: true,
        showEmpRole: true,
        showEmpDept: true,
        showEmpBank: false,
        showBaseSalary: true,
        showTime: true,
        showAdvance: true,
        showDeductions: true,
        showSignatures: false,
        showNotes: false
      });
    } else if (preset === 'internal') {
      setVisibility({
        showLogo: false,
        showUnitInfo: true,
        showTitle: true,
        showMetaInfo: false,
        showEmpName: true,
        showEmpRole: false,
        showEmpDept: true,
        showEmpBank: false,
        showBaseSalary: true,
        showTime: true,
        showAdvance: true,
        showDeductions: true,
        showSignatures: true,
        showNotes: true
      });
    } else if (preset === 'k80') {
      setPaperSize('k80');
      setActiveTemplate('k80');
      setVisibility({
        showLogo: false,
        showUnitInfo: false,
        showTitle: true,
        showMetaInfo: true,
        showEmpName: true,
        showEmpRole: true,
        showEmpDept: true,
        showEmpBank: false,
        showBaseSalary: true,
        showTime: true,
        showAdvance: true,
        showDeductions: true,
        showSignatures: false,
        showNotes: false
      });
    }
  };

  const applyTypographyPreset = (preset: 'modern' | 'admin' | 'minimalist' | 'luxury' | 'k80') => {
    setActiveTypoPreset(preset);
    if (preset === 'modern') {
      setSelectedFont('Inter');
      setFontSizeTitle(28);
      setFontSizeContent(14);
      setFontSizeTable(13);
      setTitleWeight('800');
    } else if (preset === 'admin') {
      setSelectedFont('Be Vietnam Pro');
      setFontSizeTitle(26);
      setFontSizeContent(13);
      setFontSizeTable(12);
      setTitleWeight('700');
    } else if (preset === 'minimalist') {
      setSelectedFont('Manrope');
      setFontSizeTitle(24);
      setFontSizeContent(13);
      setFontSizeTable(13);
      setTitleWeight('500');
    } else if (preset === 'luxury') {
      setSelectedFont('Source Serif 4');
      setFontSizeTitle(30);
      setFontSizeContent(14);
      setFontSizeTable(13);
      setTitleWeight('600');
    } else if (preset === 'k80') {
      setSelectedFont('Inter');
      setFontSizeTitle(16);
      setFontSizeContent(10);
      setFontSizeTable(10);
      setTitleWeight('700');
    }
  };

  const saveCurrentAsPreset = () => {
    const name = window.prompt('Nhập tên mẫu cấu hình in ấn:');
    if (!name || !name.trim()) return;

    const newPreset: CustomPrintPreset = {
      id: createPayrollId('preset'),
      name: name.trim(),
      selectedFont,
      fontSizeTitle,
      fontSizeContent,
      fontSizeTable,
      titleWeight,
      visibility,
      currencySymbol,
      currencySeparator,
      roundMode,
      activeTemplate,
      paperSize,
      thermalOptions
    };

    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem('kg_tool_custom_print_presets', JSON.stringify(updated));
    showToast(`Đã lưu mẫu cấu hình "${name.trim()}" thành công!`, 'success');
  };

  const applyCustomPreset = (preset: CustomPrintPreset) => {
    setSelectedFont(preset.selectedFont);
    setFontSizeTitle(preset.fontSizeTitle);
    setFontSizeContent(preset.fontSizeContent);
    setFontSizeTable(preset.fontSizeTable);
    setTitleWeight(preset.titleWeight);
    setVisibility(preset.visibility);
    setCurrencySymbol(preset.currencySymbol);
    setCurrencySeparator(preset.currencySeparator);
    setRoundMode(preset.roundMode);
    recalculateAllEmployees(salaryMode, standardDays, preset.roundMode);
    setActiveTemplate(preset.activeTemplate);
    setPaperSize(preset.paperSize);
    if (preset.thermalOptions) {
      setThermalOptions(preset.thermalOptions);
    }
    showToast(`Đã áp dụng mẫu cấu hình "${preset.name}"!`, 'success');
  };

  const deleteCustomPreset = (id: string) => {
    const preset = customPresets.find(p => p.id === id);
    if (!preset) return;
    if (window.confirm(`Bạn có chắc chắn muốn xóa mẫu cấu hình "${preset.name}"?`)) {
      const updated = customPresets.filter(p => p.id !== id);
      setCustomPresets(updated);
      localStorage.setItem('kg_tool_custom_print_presets', JSON.stringify(updated));
      showToast(`Đã xóa mẫu cấu hình "${preset.name}"!`, 'info');
    }
  };

  // SVG Receipt Templates (Dynamic Per-Employee Rows via buildSlipRenderRows)
  const slipSvgStandard = (emp: Employee) => {
    if (!emp) return '';
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const { rows: slipRows, totals } = buildSlipRenderRows(
      emp,
      salaryMode,
      standardDays,
      roundMode,
      formatMoney,
      {
        showTime: visibility.showTime,
        showBaseSalary: visibility.showBaseSalary,
        showAdvance: visibility.showAdvance,
        showDeductions: visibility.showDeductions,
      },
      thermalOptions.hideEmptyRows
    );
    const words = numberToVietnamese(totals.netPay);
    const empRole = emp.role?.trim() || defaultPosition;
    const empDept = emp.dept?.trim() || defaultDept;

    const rowHeight = 48;
    const rowLines = slipRows.map((r, i) => {
      const y = 532 + i * rowHeight;
      const valColor = r.kind === 'deduct' ? THEMES.red : r.kind === 'add' ? '#15803d' : '#0f172a';
      return `
        <line x1="45" y1="${y - 34}" x2="955" y2="${y - 34}" stroke="${THEMES.blue}" stroke-width="1"/>
        <text x="92" y="${y - 10}" text-anchor="middle" class="table-cell">${i + 1}</text>
        <text x="165" y="${y - 10}" class="${r.isBold ? 'table-cell-bold' : 'table-cell'}">${escapeHtml(r.label)}</text>
        <text x="928" y="${y - 10}" text-anchor="end" class="table-cell-bold" fill="${valColor}">${escapeHtml(r.valueText)}</text>
      `;
    }).join('');

    const tableHeight = 76 + Math.max(slipRows.length, 1) * rowHeight;
    const tableBottom = 420 + tableHeight;
    const totalHeight = Math.max(1220, tableBottom + 390);

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${totalHeight}" role="img" aria-label="Phiếu lương chuẩn ${escapeHtml(emp.name)}">
      <rect x="16" y="16" width="968" height="${totalHeight - 32}" rx="0" fill="#fff" stroke="${THEMES.blue}" stroke-width="4"/>
      <rect x="26" y="26" width="948" height="${totalHeight - 52}" rx="0" fill="none" stroke="${THEMES.blue}" stroke-width="1.5" opacity=".85"/>
      
      <style>
        .title-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTitle}px; font-weight: ${titleWeight}; fill: ${THEMES.blue}; text-anchor: middle; }
        .sub-title-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent + 4}px; font-weight: 700; fill: ${THEMES.blue}; text-anchor: middle; }
        .normal-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent}px; fill: #0f172a; }
        .bold-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent}px; font-weight: 700; fill: #0f172a; }
        .table-header { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTable}px; font-weight: 700; fill: ${THEMES.blue}; text-anchor: middle; }
        .table-cell { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTable}px; fill: #334155; }
        .table-cell-bold { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTable}px; font-weight: 700; fill: #0f172a; }
        .total-pay-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent + 8}px; font-weight: 900; fill: ${THEMES.red}; text-anchor: end; }
      </style>
      
      ${visibility.showUnitInfo ? `
        <text x="70" y="85" class="bold-text">NHÀ HÀNG KINGS GRILL</text>
        <text x="70" y="108" class="normal-text" style="font-size: ${fontSizeContent - 2}px; fill: #64748b;">Số 40 Nguyễn Thị Minh Khai, Quận 1, TP. HCM</text>
      ` : ''}
      
      ${visibility.showTitle ? `
        <text x="500" y="155" class="title-text">PHIẾU LƯƠNG NHÂN VIÊN</text>
      ` : ''}
      
      ${visibility.showMetaInfo ? `
        <text x="500" y="198" class="sub-title-text">${mLabel}</text>
      ` : ''}

      ${visibility.showEmpName ? `
        <text x="70" y="270" class="bold-text">Họ và tên</text>
        <text x="245" y="270" class="bold-text">:</text>
        <text x="285" y="270" class="normal-text" style="font-size: ${fontSizeContent + 2}px; font-weight: 700;">${escapeHtml(emp.name)}</text>
      ` : ''}
      
      ${visibility.showEmpRole ? `
        <text x="70" y="318" class="bold-text">Chức vụ</text>
        <text x="245" y="318" class="bold-text">:</text>
        <text x="285" y="318" class="normal-text">${escapeHtml(empRole)}</text>
      ` : ''}
      
      ${visibility.showEmpDept ? `
        <text x="70" y="366" class="bold-text">Bộ phận</text>
        <text x="245" y="366" class="bold-text">:</text>
        <text x="285" y="366" class="normal-text">${escapeHtml(empDept)}</text>
      ` : ''}

      <rect x="45" y="420" width="910" height="${tableHeight}" fill="#fff" stroke="${THEMES.blue}" stroke-width="2"/>
      <rect x="45" y="420" width="910" height="76" fill="${THEMES.lightBlue}" opacity=".8"/>
      <line x1="140" y1="420" x2="140" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="740" y1="420" x2="740" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      
      <text x="92" y="466" class="table-header">STT</text>
      <text x="440" y="466" class="table-header">NỘI DUNG THANH TOÁN (${slipRows.length} DÒNG)</text>
      <text x="848" y="466" class="table-header">SỐ TIỀN</text>

      ${rowLines}

      <rect x="45" y="${tableBottom + 28}" width="910" height="104" fill="${THEMES.lightBlue}" opacity=".85" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="650" y1="${tableBottom + 28}" x2="650" y2="${tableBottom + 132}" stroke="${THEMES.blue}" stroke-width="2"/>
      <text x="70" y="${tableBottom + 90}" font-family="'${selectedFont}', sans-serif" font-size="26" font-weight="900" fill="${THEMES.blue}">TỔNG TIỀN THỰC NHẬN</text>
      <text x="930" y="${tableBottom + 93}" class="total-pay-text">${formatMoney(totals.netPay)}</text>
      
      ${visibility.showNotes ? `
        <text x="500" y="${tableBottom + 175}" text-anchor="middle" class="normal-text" style="font-size: ${fontSizeContent - 1}px; font-style: italic; fill: #64748b;">(Bằng chữ: ${escapeHtml(words)})</text>
      ` : ''}
      
      <text x="70" y="${tableBottom + 240}" class="normal-text" style="fill: #64748b;">${escapeHtml(vDate)}</text>
      
      ${visibility.showSignatures ? `
        <text x="250" y="${tableBottom + 282}" text-anchor="middle" class="bold-text" style="font-size: ${fontSizeContent + 2}px;">Người nhận lương</text>
        <text x="250" y="${tableBottom + 308}" text-anchor="middle" class="normal-text" style="font-size: ${fontSizeContent - 2}px; font-style: italic; fill: #64748b;">(Ký và ghi rõ họ tên)</text>
        
        <text x="750" y="${tableBottom + 282}" text-anchor="middle" class="bold-text" style="font-size: ${fontSizeContent + 2}px;">Người lập phiếu</text>
        <text x="750" y="${tableBottom + 308}" text-anchor="middle" class="normal-text" style="font-size: ${fontSizeContent - 2}px; font-style: italic; fill: #64748b;">(Ký và ghi rõ họ tên)</text>
      ` : ''}
    </svg>`;
  };

  const summarySvgStandard = () => {
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const resolveEmpDays = (e: Employee) => (salaryMode === 'restaurant' ? Number(e.workedDays ?? e.days ?? 0) : Number(e.days || 0));
    const totalDays = employees.reduce((a, b) => a + resolveEmpDays(b), 0);
    const totalSalary = employees.reduce((a, b) => a + getEmployeeNet(b), 0);
    const totalDeduct = deductions.reduce((a, b) => a + Number(b.amount || 0), 0);
    const net = totalSalary - advance - totalDeduct;
    const words = numberToVietnamese(net);
    const isHourly = salaryMode === 'hourly';

    const rows = employees.map((e, i) => {
      const y = 382 + i * 66;
      const empDays = resolveEmpDays(e);
      return `
        <text x="75" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="20">${i + 1}</text>
        <text x="125" y="${y}" font-family="'${selectedFont}', sans-serif" font-size="20">${escapeHtml(e.name)}</text>
        <text x="462" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="20">${empDays}${isHourly ? 'g' : ''}</text>
        <text x="590" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18">${escapeHtml(e.range || '-')}</text>
        <text x="738" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18">${formatMoney(e.salary)}</text>
        <text x="890" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18">${formatMoney(getEmployeeNet(e))}</text>`;
    }).join('');

    const tableBottom = 330 + Math.max(employees.length, 5) * 66;
    const summaryTop = tableBottom + 28;
    
    const deductionRows = deductions.map((d, i) => {
      const y = summaryTop + 225 + i * 58;
      return `
        <line x1="45" y1="${y - 40}" x2="955" y2="${y - 40}" stroke="${THEMES.blue}" stroke-width="2"/>
        <text x="70" y="${y}" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700">${escapeHtml(d.label)}</text>
        <text x="928" y="${y}" text-anchor="end" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700" fill="${THEMES.red}">${formatMoney(d.amount)}</text>`;
    }).join('');
    
    const netTop = summaryTop + 245 + deductions.length * 58;
    const bottomTotalLabel = isHourly ? "TỔNG SỐ GIỜ LÀM CỦA NHÂN VIÊN" : "TỔNG SỐ CÔNG CỦA NHÂN VIÊN";
    const bottomTotalVal = isHourly ? `${totalDays} giờ` : `${totalDays} công`;
    
    const col3Header = isHourly ? "SỐ GIỜ" : "SỐ CÔNG";
    const col3SubHeader = isHourly ? "LÀM VIỆC" : "THỰC TẾ";
    const col5Header = isHourly ? "LƯƠNG GIỜ" : "MỨC LƯƠNG";
    const col5SubHeader = isHourly ? "(ĐƠN GIÁ)" : `(${standardDays} CÔNG)`;

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${netTop + 400}" fill="none" role="img" aria-label="Phiếu tổng hợp lương">
      <rect x="16" y="16" width="968" height="${netTop + 368}" rx="0" fill="#fff" stroke="${THEMES.blue}" stroke-width="4"/>
      <rect x="26" y="26" width="948" height="${netTop + 348}" rx="0" fill="none" stroke="${THEMES.blue}" stroke-width="2" opacity=".9"/>

      <text x="500" y="105" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="50" font-weight="700" fill="${THEMES.blue}">PHIẾU TỔNG HỢP LƯƠNG</text>
      <text x="500" y="165" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="30" font-weight="700" fill="${THEMES.blue}">${mLabel}</text>

      <rect x="45" y="220" width="910" height="${tableBottom - 220}" fill="#fff" stroke="${THEMES.blue}" stroke-width="2"/>
      <rect x="45" y="220" width="910" height="78" fill="${THEMES.lightBlue}" opacity=".75"/>
      <line x1="105" y1="220" x2="105" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="390" y1="220" x2="390" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="530" y1="220" x2="530" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="650" y1="220" x2="650" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="825" y1="220" x2="825" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      
      ${Array.from({ length: Math.max(employees.length, 5) + 1 }, (_, i) => 298 + i * 66).map(y => `<line x1="45" y1="${y}" x2="955" y2="${y}" stroke="${THEMES.blue}" stroke-width="2"/>`).join('')}
      
      <text x="75" y="270" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700" fill="${THEMES.blue}">STT</text>
      <text x="245" y="270" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700" fill="${THEMES.blue}">HỌ VÀ TÊN</text>
      <text x="462" y="255" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18" font-weight="700" fill="${THEMES.blue}">${col3Header}</text>
      <text x="462" y="285" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18" font-weight="700" fill="${THEMES.blue}">${col3SubHeader}</text>
      <text x="590" y="255" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18" font-weight="700" fill="${THEMES.blue}">THỜI GIAN</text>
      <text x="590" y="285" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18" font-weight="700" fill="${THEMES.blue}">LÀM VIỆC</text>
      <text x="738" y="255" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18" font-weight="700" fill="${THEMES.blue}">${col5Header}</text>
      <text x="738" y="285" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18" font-weight="700" fill="${THEMES.blue}">${col5SubHeader}</text>
      <text x="890" y="255" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18" font-weight="700" fill="${THEMES.blue}">TIỀN LƯƠNG</text>
      <text x="890" y="285" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18" font-weight="700" fill="${THEMES.blue}">THỰC NHẬN</text>
      
      ${rows}

      <rect x="45" y="${summaryTop}" width="910" height="${245 + deductions.length * 58}" fill="#fff" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="650" y1="${summaryTop}" x2="650" y2="${summaryTop + 245 + deductions.length * 58}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="45" y1="${summaryTop + 62}" x2="955" y2="${summaryTop + 62}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="45" y1="${summaryTop + 124}" x2="955" y2="${summaryTop + 124}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="45" y1="${summaryTop + 186}" x2="955" y2="${summaryTop + 186}" stroke="${THEMES.blue}" stroke-width="2"/>
      
      <text x="70" y="${summaryTop + 42}" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700">${bottomTotalLabel}</text>
      <text x="928" y="${summaryTop + 42}" text-anchor="end" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700">${bottomTotalVal}</text>
      
      <text x="70" y="${summaryTop + 104}" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700">TỔNG TIỀN LƯƠNG TRƯỚC KHẤU TRỪ</text>
      <text x="928" y="${summaryTop + 104}" text-anchor="end" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700">${formatMoney(totalSalary)}</text>
      
      <text x="70" y="${summaryTop + 166}" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700">TẠM ỨNG LƯƠNG</text>
      <text x="928" y="${summaryTop + 166}" text-anchor="end" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700">${formatMoney(advance)}</text>
      
      ${deductionRows}

      <rect x="45" y="${netTop}" width="910" height="108" fill="${THEMES.lightBlue}" opacity=".8" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="650" y1="${netTop}" x2="650" y2="${netTop + 108}" stroke="${THEMES.blue}" stroke-width="2"/>
      <text x="70" y="${netTop + 68}" font-family="'${selectedFont}', sans-serif" font-size="34" font-weight="700" fill="${THEMES.blue}">THANH TOÁN THỰC NHẬN</text>
      <text x="930" y="${netTop + 68}" text-anchor="end" font-family="'${selectedFont}', sans-serif" font-size="40" font-weight="700" fill="${THEMES.red}">${formatMoney(net)}</text>
      
      <text x="500" y="${netTop + 160}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="22" font-style="italic">(Bằng chữ: ${escapeHtml(words)})</text>
      <text x="70" y="${netTop + 250}" font-family="'${selectedFont}', sans-serif" font-size="22">${escapeHtml(vDate)}</text>
      
      <text x="350" y="${netTop + 250}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700">Người lập phiếu</text>
      <text x="350" y="${netTop + 290}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="20" font-style="italic">(Ký, ghi rõ họ tên)</text>
      
      <text x="750" y="${netTop + 250}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="22" font-weight="700">Kế toán trưởng</text>
      <text x="750" y="${netTop + 290}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="20" font-style="italic">(Ký, ghi rõ họ tên)</text>
    </svg>`;
  };

  const slipSvgK80 = (emp: Employee) => {
    if (!emp) return '';
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const empRole = emp.role?.trim() || defaultPosition;
    const empDept = emp.dept?.trim() || defaultDept;

    const { rows: slipRows, totals } = buildSlipRenderRows(
      emp,
      salaryMode,
      standardDays,
      roundMode,
      formatMoney,
      {
        showTime: visibility.showTime,
        showBaseSalary: visibility.showBaseSalary,
        showAdvance: visibility.showAdvance,
        showDeductions: visibility.showDeductions,
      },
      thermalOptions.hideEmptyRows
    );

    const elements: string[] = [];
    let currentY = 8;

    if (visibility.showUnitInfo) {
      elements.push(`
        <text x="160" y="${currentY + 12}" font-family="'JetBrains Mono', '${selectedFont}', monospace" font-size="11.5" font-weight="800" fill="#000000" text-anchor="middle">*** KINGS GRILL F&amp;B ***</text>
        <text x="160" y="${currentY + 24}" font-family="'${selectedFont}', sans-serif" font-size="8.2" font-weight="600" fill="#475569" text-anchor="middle">HỆ THỐNG NƯỚNG &amp; LẨU CAO CẤP TP.HCM</text>
      `);
      currentY += 30;
    }

    if (visibility.showTitle) {
      const bannerHeight = visibility.showMetaInfo ? 40 : 32;
      elements.push(`
        <rect x="8" y="${currentY}" width="304" height="${bannerHeight}" fill="${THEMES.blue}" rx="4" stroke="#075985" stroke-width="1"/>
        <text x="160" y="${currentY + (visibility.showMetaInfo ? 17 : 20)}" font-family="'${selectedFont}', sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">PHIẾU LƯƠNG NHÂN VIÊN</text>
        ${visibility.showMetaInfo ? `<text x="160" y="${currentY + 32}" font-family="'${selectedFont}', sans-serif" font-size="9.5" font-weight="600" fill="#e0f2fe" text-anchor="middle">${escapeHtml(mLabel)}</text>` : ''}
      `);
      currentY += bannerHeight + 8;
    }

    if (visibility.showEmpName) {
      elements.push(`
        <text x="8" y="${currentY + 12}" font-family="'${selectedFont}', sans-serif" font-size="10.5" font-weight="bold" fill="#000000">Họ và tên NV:</text>
        <text x="312" y="${currentY + 12}" font-family="'${selectedFont}', sans-serif" font-size="11.5" font-weight="bold" fill="#dc2626" text-anchor="end">${escapeHtml(emp.name)}</text>
      `);
      currentY += 18;
    }

    if (visibility.showEmpRole || visibility.showEmpDept) {
      const metaLine = [visibility.showEmpRole ? empRole : '', visibility.showEmpDept ? empDept : ''].filter(Boolean).join(' · ');
      elements.push(`
        <text x="8" y="${currentY + 10}" font-family="'${selectedFont}', sans-serif" font-size="9.2" fill="#475569">${escapeHtml(metaLine)}</text>
      `);
      currentY += 15;
    }

    elements.push(`
      <line x1="8" y1="${currentY}" x2="312" y2="${currentY}" stroke="#000000" stroke-width="1" stroke-dasharray="4, 3" />
    `);
    currentY += 8;

    const tableRows = [
      ...slipRows.map(r => ({
        label: r.label,
        val: r.valueText,
        isBold: r.isBold,
        kind: r.kind,
      })),
      { label: 'TỔNG THỰC NHẬN', val: formatMoney(totals.netPay), isBold: true, kind: 'total' as const }
    ];

    const tableStartY = currentY;
    const rowHeight = 24;

    tableRows.forEach((r, idx) => {
      const rowY = tableStartY + idx * rowHeight;
      if (r.kind === 'total') {
        elements.push(`<rect x="8" y="${rowY}" width="304" height="${rowHeight}" fill="#e0f2fe" />`);
      } else if (r.isBold) {
        elements.push(`<rect x="8" y="${rowY}" width="304" height="${rowHeight}" fill="#f8fafc" />`);
      }

      elements.push(`<line x1="8" y1="${rowY}" x2="312" y2="${rowY}" stroke="#000000" stroke-width="0.8" />`);
      const fontW = r.isBold ? 'bold' : '600';
      const labelTrunc = r.label.length > 31 ? `${r.label.slice(0, 30)}…` : r.label;
      const valColor = r.kind === 'total' || r.kind === 'deduct' ? '#dc2626' : r.kind === 'add' ? '#15803d' : '#000000';

      elements.push(`
        <text x="13" y="${rowY + 16}" font-family="'${selectedFont}', sans-serif" font-size="${r.kind === 'total' ? '10.6' : '9.8'}" font-weight="${fontW}" fill="#0f172a">${escapeHtml(labelTrunc)}</text>
        <text x="307" y="${rowY + 16}" font-family="'${selectedFont}', sans-serif" font-size="${r.kind === 'total' ? '11.5' : '10.4'}" font-weight="bold" fill="${valColor}" text-anchor="end">${escapeHtml(r.val)}</text>
      `);
    });

    const tableEndY = tableStartY + tableRows.length * rowHeight;
    elements.push(`<line x1="8" y1="${tableEndY}" x2="312" y2="${tableEndY}" stroke="#000000" stroke-width="0.9" />`);
    elements.push(`<line x1="8" y1="${tableStartY}" x2="8" y2="${tableEndY}" stroke="#000000" stroke-width="0.9" />`);
    elements.push(`<line x1="212" y1="${tableStartY}" x2="212" y2="${tableEndY}" stroke="#000000" stroke-width="0.7" />`);
    elements.push(`<line x1="312" y1="${tableStartY}" x2="312" y2="${tableEndY}" stroke="#000000" stroke-width="0.9" />`);

    currentY = tableEndY + 12;

    const wordsText = numberToVietnamese(totals.netPay);
    const hasNotes = visibility.showNotes && (!thermalOptions.hideEmptyNotes || wordsText.trim().length > 0);
    if (hasNotes) {
      elements.push(`
        <text x="8" y="${currentY + 10}" font-family="'${selectedFont}', sans-serif" font-size="9.5" font-style="italic" fill="#000000">Bằng chữ:</text>
        <rect x="8" y="${currentY + 16}" width="304" height="36" fill="#f8fafc" rx="4" stroke="#cbd5e1" stroke-width="0.8"/>
        <text x="13" y="${currentY + 29}" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#334155">${escapeHtml(wordsText.substring(0, 48))}</text>
        <text x="13" y="${currentY + 42}" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#334155">${escapeHtml(wordsText.substring(48))}</text>
      `);
      currentY += 58;
    }

    const showSignatures = visibility.showSignatures && !thermalOptions.hideSignature;
    if (showSignatures) {
      elements.push(`
        <text x="160" y="${currentY + 10}" text-anchor="middle" font-size="9.5" font-family="'${selectedFont}', sans-serif" fill="#475569">${escapeHtml(vDate)}</text>
        <text x="80" y="${currentY + 28}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="10.5" font-weight="bold" fill="#000">Người nhận</text>
        <text x="80" y="${currentY + 41}" text-anchor="middle" font-size="9" font-style="italic" fill="#475569">(Ký tên)</text>
        <text x="240" y="${currentY + 28}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="10.5" font-weight="bold" fill="#000">Người lập</text>
        <text x="240" y="${currentY + 41}" text-anchor="middle" font-size="9" font-style="italic" fill="#475569">(Ký tên)</text>
      `);
      currentY += 62;
    } else if (visibility.showSignatures && thermalOptions.hideSignature) {
      elements.push(`
        <text x="8" y="${currentY + 12}" font-family="'${selectedFont}', sans-serif" font-size="10.5" font-weight="bold" fill="#000">Người nhận: ________________________</text>
      `);
      currentY += 20;
    }

    if (thermalOptions.showCutLine) {
      elements.push(`
        <line x1="8" y1="${currentY + 8}" x2="312" y2="${currentY + 8}" stroke="#64748b" stroke-width="1" stroke-dasharray="6, 4" />
        <text x="160" y="${currentY + 20}" font-size="8.5" font-family="sans-serif" fill="#64748b" text-anchor="middle">--- Đường cắt ---</text>
      `);
      currentY += 26;
    }

    if (!thermalOptions.compactCut) {
      currentY += 32;
    }
    currentY += (thermalOptions.bottomFeedMm || 4) * 3;

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 ${currentY}" fill="none" role="img" aria-label="Phiếu lương K80 ${escapeHtml(emp.name)}">
      <rect width="320" height="${currentY}" fill="#fff"/>
      ${elements.join('\n')}
    </svg>`;
  };

  const summarySvgK80 = () => {
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const resolveEmpDays = (e: Employee) => (salaryMode === 'restaurant' ? Number(e.workedDays ?? e.days ?? 0) : Number(e.days || 0));
    const totalDays = employees.reduce((a, b) => a + resolveEmpDays(b), 0);
    const totalSalary = employees.reduce((a, b) => a + getEmployeeNet(b), 0);
    const totalDeduct = deductions.reduce((a, b) => a + Number(b.amount || 0), 0);
    const net = totalSalary - advance - totalDeduct;
    const isHourly = salaryMode === 'hourly';

    let currentY = 15;
    const elements: string[] = [];

    // Header Title
    elements.push(`<text x="160" y="${currentY + 15}" class="k80-title">BẢNG TỔNG HỢP LƯƠNG</text>`);
    currentY += 20;

    elements.push(`<text x="160" y="${currentY + 15}" class="k80-subtitle">${mLabel}</text>`);
    currentY += 25;

    // Divider
    elements.push(`<line x1="15" y1="${currentY}" x2="305" y2="${currentY}" class="k80-divider" />`);
    currentY += 10;

    const col2Header = isHourly ? "Giờ" : "Công";
    elements.push(`
      <text x="20" y="${currentY + 10}" class="k80-bold">Nhân viên</text>
      <text x="175" y="${currentY + 10}" class="k80-bold" text-anchor="middle">${col2Header}</text>
      <text x="300" y="${currentY + 10}" class="k80-bold" text-anchor="end">Thực nhận</text>
      <line x1="15" y1="${currentY + 20}" x2="305" y2="${currentY + 20}" stroke="#000" stroke-width="1"/>
    `);
    currentY += 30;

    // Employee rows
    employees.forEach((e, i) => {
      const empDays = resolveEmpDays(e);
      elements.push(`
        <text x="20" y="${currentY + 10}" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#000">${i + 1}. ${escapeHtml(e.name.substring(0, 16))}</text>
        <text x="175" y="${currentY + 10}" font-size="9" font-family="'${selectedFont}', sans-serif" text-anchor="middle" fill="#000">${empDays}${isHourly ? 'g' : ''}</text>
        <text x="300" y="${currentY + 10}" font-size="9" font-family="'${selectedFont}', sans-serif" text-anchor="end" fill="#000">${formatMoney(getEmployeeNet(e))}</text>
      `);
      currentY += 22;
    });

    // Divider after table
    elements.push(`<line x1="15" y1="${currentY}" x2="305" y2="${currentY}" class="k80-divider" />`);
    currentY += 15;

    const bottomTotalLabel = isHourly ? "Tổng giờ làm việc" : "Tổng công nhân viên";
    elements.push(`
      <text x="20" y="${currentY + 10}" font-size="10" font-family="'${selectedFont}', sans-serif" fill="#000">${bottomTotalLabel}</text>
      <text x="300" y="${currentY + 10}" font-size="10" font-family="'${selectedFont}', sans-serif" text-anchor="end" fill="#000">${totalDays}</text>
    `);
    currentY += 20;

    elements.push(`
      <text x="20" y="${currentY + 10}" font-size="10" font-family="'${selectedFont}', sans-serif" fill="#000">Tổng tiền lương</text>
      <text x="300" y="${currentY + 10}" font-size="10" font-family="'${selectedFont}', sans-serif" text-anchor="end" fill="#000">${formatMoney(totalSalary)}</text>
    `);
    currentY += 20;

    // Advance
    if (advance > 0 || !thermalOptions.hideEmptyRows) {
      elements.push(`
        <text x="20" y="${currentY + 10}" font-size="10" font-family="'${selectedFont}', sans-serif" fill="#000">Tạm ứng</text>
        <text x="300" y="${currentY + 10}" font-size="10" font-family="'${selectedFont}', sans-serif" text-anchor="end" fill="#000">${formatMoney(advance)}</text>
      `);
      currentY += 20;
    }

    // Deductions
    deductions.forEach(d => {
      if (d.amount > 0 || !thermalOptions.hideEmptyRows) {
        elements.push(`
          <text x="20" y="${currentY + 10}" font-size="10" font-family="'${selectedFont}', sans-serif" fill="#000">${escapeHtml(d.label)}</text>
          <text x="300" y="${currentY + 10}" font-size="10" font-family="'${selectedFont}', sans-serif" text-anchor="end" fill="#dc2626">${formatMoney(d.amount)}</text>
        `);
        currentY += 20;
      }
    });

    // Divider before Net
    elements.push(`<line x1="15" y1="${currentY + 5}" x2="305" y2="${currentY + 5}" class="k80-divider" />`);
    currentY += 15;

    // Net Pay
    elements.push(`
      <text x="20" y="${currentY + 15}" font-size="12" font-family="'${selectedFont}', sans-serif" font-weight="700" fill="#000">THANH TOÁN THỰC NHẬN</text>
      <text x="300" y="${currentY + 15}" font-size="14" font-family="'${selectedFont}', sans-serif" font-weight="700" text-anchor="end" fill="#dc2626">${formatMoney(net)}</text>
    `);
    currentY += 30;

    // Signatures
    const showSignatures = visibility.showSignatures && !thermalOptions.hideSignature;
    if (showSignatures) {
      elements.push(`
        <text x="160" y="${currentY + 15}" text-anchor="middle" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#64748b">${escapeHtml(vDate)}</text>
        <text x="80" y="${currentY + 45}" text-anchor="middle" class="k80-bold">Người lập</text>
        <text x="240" y="${currentY + 45}" text-anchor="middle" class="k80-bold">Kế toán trưởng</text>
      `);
      currentY += 65;
    }

    // Cut Line indicator
    if (thermalOptions.showCutLine) {
      elements.push(`
        <line x1="10" y1="${currentY + 10}" x2="310" y2="${currentY + 10}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="8, 5" />
        <text x="160" y="${currentY + 22}" font-size="8" font-family="sans-serif" fill="#94a3b8" text-anchor="middle">✂--- Đường cắt ---✂</text>
      `);
      currentY += 30;
    }

    // Bottom feed margin padding
    if (!thermalOptions.compactCut) {
      currentY += 40;
    }
    currentY += (thermalOptions.bottomFeedMm || 6) * 4;

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 ${currentY}" fill="none" role="img" aria-label="Phiếu tổng hợp lương">
      <rect width="320" height="${currentY}" fill="#fff"/>
      <style>
        .k80-title { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTitle - 8}px; font-weight: ${titleWeight}; fill: #000; text-anchor: middle; }
        .k80-subtitle { font-family: '${selectedFont}', system-ui, sans-serif; font-size: 10px; fill: #000; text-anchor: middle; }
        .k80-divider { stroke: #000; stroke-width: 1; stroke-dasharray: 4, 3; }
        .k80-bold { font-family: '${selectedFont}', system-ui, sans-serif; font-size: 10px; font-weight: bold; fill: #000; }
      </style>
      
      ${elements.join('\n')}
    </svg>`;
  };

  const slipSvgModern = (emp: Employee) => {
    if (!emp) return '';
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const empRole = emp.role?.trim() || defaultPosition;
    const empDept = emp.dept?.trim() || defaultDept;

    const { rows: slipRows, totals } = buildSlipRenderRows(
      emp,
      salaryMode,
      standardDays,
      roundMode,
      formatMoney,
      {
        showTime: visibility.showTime,
        showBaseSalary: visibility.showBaseSalary,
        showAdvance: visibility.showAdvance,
        showDeductions: visibility.showDeductions,
      },
      thermalOptions.hideEmptyRows
    );
    const words = numberToVietnamese(totals.netPay);

    const rowStep = 50;
    const rowLines = slipRows.map((r, i) => {
      const y = 465 + i * rowStep;
      const valColor = r.kind === 'deduct' ? '#dc2626' : r.kind === 'add' ? '#15803d' : '#0f172a';
      return `
        <text x="90" y="${y}" class="modern-text" font-size="${fontSizeTable}" font-weight="${r.isBold ? '700' : '600'}" fill="${r.isBold ? '#0f172a' : '#475569'}">${escapeHtml(r.label)}</text>
        <text x="910" y="${y}" text-anchor="end" class="modern-text" font-size="${fontSizeTable + 2}" font-weight="700" fill="${valColor}">${escapeHtml(r.valueText)}</text>
        <line x1="60" y1="${y + 24}" x2="940" y2="${y + 24}" stroke="#f1f5f9" stroke-width="1"/>
      `;
    }).join('');

    const boxHeight = Math.max(80, 35 + slipRows.length * rowStep);
    const totalBoxY = 415 + boxHeight + 35;
    const totalHeight = totalBoxY + 430;

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${totalHeight}" role="img" aria-label="Phiếu lương Modern ${escapeHtml(emp.name)}">
      <defs>
        <linearGradient id="blueGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#075985" />
          <stop offset="100%" stop-color="#0284c7" />
        </linearGradient>
        <linearGradient id="headerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f0f9ff" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      
      <style>
        .modern-text { font-family: '${selectedFont}', system-ui, sans-serif; }
      </style>
      
      <rect x="0" y="0" width="1000" height="${totalHeight}" fill="#f8fafc"/>
      <rect x="25" y="25" width="950" height="${totalHeight - 50}" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
      
      <path d="M25 45 C 25 35, 35 25, 45 25 L 955 25 C 965 25, 975 35, 975 45 L 975 140 L 25 140 Z" fill="url(#blueGrad)"/>
      <text x="75" y="85" class="modern-text" font-size="${fontSizeTitle}" font-weight="${titleWeight}" fill="#ffffff">PHIẾU CHI LƯƠNG CHI TIẾT</text>
      <text x="75" y="115" class="modern-text" font-size="16" font-weight="600" fill="#bae6fd" letter-spacing="1">${mLabel.toUpperCase()}</text>
      
      ${visibility.showUnitInfo ? `
        <rect x="730" y="55" width="195" height="50" rx="8" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
        <text x="827" y="85" text-anchor="middle" class="modern-text" font-size="11" font-weight="700" fill="#ffffff">KINGS GRILL OFFICE</text>
      ` : ''}
      
      <rect x="60" y="175" width="880" height="145" rx="12" fill="url(#headerGrad)" stroke="#bae6fd" stroke-width="1"/>
      
      ${visibility.showEmpName ? `
        <text x="90" y="218" class="modern-text" font-size="13" font-weight="700" fill="#64748b">HỌ VÀ TÊN NHÂN VIÊN</text>
        <text x="90" y="254" class="modern-text" font-size="27" font-weight="800" fill="#0f172a">${escapeHtml(emp.name)}</text>
      ` : ''}
      
      ${visibility.showEmpRole ? `
        <text x="90" y="290" class="modern-text" font-size="15" font-weight="600" fill="#0369a1">${escapeHtml(empRole)}</text>
      ` : ''}
      
      ${visibility.showEmpDept ? `
        <text x="600" y="218" class="modern-text" font-size="13" font-weight="700" fill="#64748b">PHÒNG BAN / BỘ PHẬN</text>
        <text x="600" y="254" class="modern-text" font-size="23" font-weight="700" fill="#0f172a">${escapeHtml(empDept)}</text>
      ` : ''}
      
      <text x="90" y="385" class="modern-text" font-size="18" font-weight="800" fill="#0369a1">CHI TIẾT CÁC KHOẢN LƯƠNG (${slipRows.length} DÒNG)</text>
      
      <rect x="60" y="415" width="880" height="${boxHeight}" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      ${rowLines}
      
      <rect x="60" y="${totalBoxY}" width="880" height="145" rx="16" fill="#f0f9ff" stroke="#7dd3fc" stroke-width="2"/>
      <text x="100" y="${totalBoxY + 56}" class="modern-text" font-size="18" font-weight="800" fill="#0369a1">THANH TOÁN THỰC NHẬN</text>
      
      ${visibility.showNotes ? `
        <text x="100" y="${totalBoxY + 88}" class="modern-text" font-size="14" font-weight="600" fill="#475569" font-style="italic">Bằng chữ: ${escapeHtml(words)}</text>
      ` : ''}
      <text x="900" y="${totalBoxY + 84}" text-anchor="end" class="modern-text" font-size="42" font-weight="900" fill="#dc2626">${formatMoney(totals.netPay)}</text>
      
      <text x="90" y="${totalBoxY + 215}" class="modern-text" font-size="15" font-weight="600" fill="#64748b">${escapeHtml(vDate)}</text>
      <line x1="60" y1="${totalBoxY + 250}" x2="940" y2="${totalBoxY + 250}" stroke="#f1f5f9" stroke-width="1"/>
      
      ${visibility.showSignatures ? `
        <text x="200" y="${totalBoxY + 295}" text-anchor="middle" class="modern-text" font-size="18" font-weight="700" fill="#0f172a">Người Nhận Lương</text>
        <text x="200" y="${totalBoxY + 322}" text-anchor="middle" class="modern-text" font-size="14" font-style="italic" fill="#64748b">(Ký tên xác nhận)</text>
        
        <text x="800" y="${totalBoxY + 295}" text-anchor="middle" class="modern-text" font-size="18" font-weight="700" fill="#0369a1">Bộ Phận Kế Toán</text>
        <text x="800" y="${totalBoxY + 322}" text-anchor="middle" class="modern-text" font-size="14" font-style="italic" fill="#64748b">(Ký và ghi rõ họ tên)</text>
      ` : ''}
    </svg>`;
  };

  const summarySvgModern = () => {
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const resolveEmpDays = (e: Employee) => (salaryMode === 'restaurant' ? Number(e.workedDays ?? e.days ?? 0) : Number(e.days || 0));
    const totalDays = employees.reduce((a, b) => a + resolveEmpDays(b), 0);
    const totalSalary = employees.reduce((a, b) => a + getEmployeeNet(b), 0);
    const totalDeduct = deductions.reduce((a, b) => a + Number(b.amount || 0), 0);
    const net = totalSalary - advance - totalDeduct;
    const words = numberToVietnamese(net);
    const isHourly = salaryMode === 'hourly';

    const rows = employees.map((e, i) => {
      const y = 390 + i * 58;
      const empDays = resolveEmpDays(e);
      return `
        <text x="90" y="${y}" font-family="'${selectedFont}', sans-serif" font-size="15" fill="#334155">${i + 1}</text>
        <text x="150" y="${y}" font-family="'${selectedFont}', sans-serif" font-size="15" font-weight="700" fill="#0f172a">${escapeHtml(e.name)}</text>
        <text x="440" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="15" fill="#334155">${empDays}${isHourly ? 'g' : ''}</text>
        <text x="560" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="14" fill="#64748b">${escapeHtml(e.range || '-')}</text>
        <text x="710" y="${y}" text-anchor="end" font-family="'${selectedFont}', sans-serif" font-size="14" fill="#334155">${formatMoney(e.salary)}</text>
        <text x="900" y="${y}" text-anchor="end" font-family="'${selectedFont}', sans-serif" font-size="15" font-weight="700" fill="#0f172a">${formatMoney(getEmployeeNet(e))}</text>
        <line x1="60" y1="${y + 18}" x2="940" y2="${y + 18}" stroke="#f8fafc" stroke-width="1"/>
      `;
    }).join('');

    const tableBottom = 330 + Math.max(employees.length, 5) * 58;
    const summaryTop = tableBottom + 25;
    const netTop = summaryTop + 230 + deductions.length * 50;

    const deductionRows = deductions.map((d, i) => {
      const y = summaryTop + 185 + i * 50;
      return `
        <text x="90" y="${y}" font-family="'${selectedFont}', sans-serif" font-size="16" font-weight="600" fill="#64748b">${escapeHtml(d.label)}</text>
        <text x="910" y="${y}" text-anchor="end" font-family="'${selectedFont}', sans-serif" font-size="18" font-weight="700" fill="#dc2626">${formatMoney(d.amount)}</text>
        <line x1="60" y1="${y + 15}" x2="940" y2="${y + 15}" stroke="#f1f5f9" stroke-width="1"/>
      `;
    }).join('');

    const col3Header = isHourly ? "SỐ GIỜ" : "SỐ CÔNG";
    const col5Header = isHourly ? "LƯƠNG GIỜ" : "MỨC LƯƠNG";
    const bottomTotalLabel = isHourly ? "Tổng số giờ làm" : "Tổng số công nhân viên";
    const bottomTotalVal = isHourly ? `${totalDays} giờ` : `${totalDays} công`;

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${netTop + 330}" role="img" aria-label="Modern Payroll Summary">
      <defs>
        <linearGradient id="blueGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e3a8a" />
          <stop offset="100%" stop-color="#2563eb" />
        </linearGradient>
        <linearGradient id="subGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f8fafc" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      
      <style>
        .modern-text { font-family: '${selectedFont}', system-ui, sans-serif; }
      </style>
      
      <rect x="0" y="0" width="1000" height="${netTop + 330}" fill="#f8fafc"/>
      <rect x="25" y="25" width="950" height="${netTop + 280}" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
      
      <path d="M25 45 C 25 35, 35 25, 45 25 L 955 25 C 965 25, 975 35, 975 45 L 975 140 L 25 140 Z" fill="url(#blueGrad)"/>
      <text x="75" y="85" class="modern-text" font-size="32" font-weight="800" fill="#ffffff">BẢNG TỔNG HỢP LƯƠNG DOANH NGHIỆP</text>
      <text x="75" y="115" class="modern-text" font-size="16" font-weight="600" fill="#93c5fd" letter-spacing="1">${mLabel.toUpperCase()}</text>
      
      <rect x="60" y="180" width="880" height="${tableBottom - 180}" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      
      <rect x="61" y="181" width="878" height="50" rx="11" fill="#f1f5f9"/>
      <text x="90" y="212" class="modern-text" font-size="14" font-weight="800" fill="#475569">STT</text>
      <text x="150" y="212" class="modern-text" font-size="14" font-weight="800" fill="#475569">HỌ VÀ TÊN</text>
      <text x="440" y="212" text-anchor="middle" class="modern-text" font-size="14" font-weight="800" fill="#475569">${col3Header}</text>
      <text x="560" y="212" text-anchor="middle" class="modern-text" font-size="14" font-weight="800" fill="#475569">THỜI GIAN</text>
      <text x="710" y="212" text-anchor="end" class="modern-text" font-size="14" font-weight="800" fill="#475569">${col5Header}</text>
      <text x="900" y="212" text-anchor="end" class="modern-text" font-size="14" font-weight="800" fill="#475569">THỰC NHẬN</text>
      
      ${rows}
      
      <rect x="60" y="${summaryTop}" width="880" height="${210 + deductions.length * 50}" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      
      <text x="90" y="${summaryTop + 35}" class="modern-text" font-size="16" font-weight="600" fill="#64748b">${bottomTotalLabel}</text>
      <text x="910" y="${summaryTop + 35}" text-anchor="end" class="modern-text" font-size="18" font-weight="700" fill="#0f172a">${bottomTotalVal}</text>
      <line x1="60" y1="${summaryTop + 55}" x2="940" y2="${summaryTop + 55}" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="${summaryTop + 85}" class="modern-text" font-size="16" font-weight="600" fill="#64748b">Tổng quỹ lương thực tế</text>
      <text x="910" y="${summaryTop + 85}" text-anchor="end" class="modern-text" font-size="18" font-weight="700" fill="#0f172a">${formatMoney(totalSalary)}</text>
      <line x1="60" y1="${summaryTop + 105}" x2="940" y2="${summaryTop + 105}" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="${summaryTop + 135}" class="modern-text" font-size="16" font-weight="600" fill="#64748b">Khấu trừ tạm ứng lương</text>
      <text x="910" y="${summaryTop + 135}" text-anchor="end" class="modern-text" font-size="18" font-weight="700" fill="#0f172a">${formatMoney(advance)}</text>
      <line x1="60" y1="${summaryTop + 155}" x2="940" y2="${summaryTop + 155}" stroke="#f1f5f9" stroke-width="1"/>
      
      ${deductionRows}
      
      <rect x="60" y="${netTop}" width="880" height="110" rx="12" fill="#eff6ff" stroke="#bfdbfe" stroke-width="2"/>
      <text x="90" y="${netTop + 45}" class="modern-text" font-size="18" font-weight="800" fill="#1e3a8a">THANH TOÁN THỰC NHẬN SAU KHẤU TRỪ</text>
      <text x="90" y="${netTop + 75}" class="modern-text" font-size="14" font-style="italic" fill="#64748b">Bằng chữ: ${escapeHtml(words)}</text>
      <text x="910" y="${netTop + 65}" text-anchor="end" class="modern-text" font-size="34" font-weight="900" fill="#dc2626">${formatMoney(net)}</text>
      
      <text x="90" y="${netTop + 175}" class="modern-text" font-size="15" fill="#64748b">${escapeHtml(vDate)}</text>
      <line x1="60" y1="${netTop + 205}" x2="940" y2="${netTop + 205}" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="250" y="${netTop + 245}" text-anchor="middle" class="modern-text" font-size="18" font-weight="700" fill="#0f172a">Người Lập Báo Cáo</text>
      <text x="250" y="${netTop + 270}" text-anchor="middle" class="modern-text" font-size="14" font-style="italic" fill="#64748b">(Ký và ghi rõ họ tên)</text>
      
      <text x="750" y="${netTop + 245}" text-anchor="middle" class="modern-text" font-size="18" font-weight="700" fill="#1e3a8a">Kế Toán Trưởng</text>
      <text x="750" y="${netTop + 270}" text-anchor="middle" class="modern-text" font-size="14" font-style="italic" fill="#64748b">(Ký và ghi rõ họ tên)</text>
    </svg>`;
  };

  const getActiveSvgText = (emp?: Employee) => {
    if (activeView === 'receipt') {
      const targetEmp = emp || activeEmployee;
      if (!targetEmp) return '';
      if (activeTemplate === 'k80') return slipSvgK80(targetEmp);
      if (activeTemplate === 'modern') return slipSvgModern(targetEmp);
      return slipSvgStandard(targetEmp);
    } else {
      if (activeTemplate === 'k80') return summarySvgK80();
      if (activeTemplate === 'modern') return summarySvgModern();
      return summarySvgStandard();
    }
  };

  const renderSvgToCanvas = async (
    svgText: string,
    isK80: boolean
  ): Promise<{ canvas: HTMLCanvasElement; baseWidth: number; baseHeight: number }> => {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }
    return new Promise((resolve, reject) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgEl = doc.documentElement;
      const baseWidth = isK80 ? 320 : 1000;
      const baseHeight = parseInt(
        svgEl.getAttribute('viewBox')?.split(' ')[3] || (isK80 ? '540' : '1400'),
        10
      );

      const canvas = document.createElement('canvas');
      canvas.width = baseWidth * 2;
      canvas.height = baseHeight * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.scale(2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, baseWidth, baseHeight);

      const img = new Image();
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0, baseWidth, baseHeight);
        URL.revokeObjectURL(url);
        resolve({ canvas, baseWidth, baseHeight });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG into Image object'));
      };
      img.src = url;
    });
  };

  // Convert SVG string to PNG image download link
  const svgToPng = async (svgText: string, filename: string, isK80: boolean) => {
    const { canvas } = await renderSvgToCanvas(svgText, isK80);
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = filename;
    a.href = pngUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPng = async (emp?: Employee) => {
    const targetEmp = emp || activeEmployee;
    if (!targetEmp && activeView === 'receipt') {
      showToast('Không có dữ liệu phiếu để xuất ảnh', 'error');
      return;
    }
    const text = getActiveSvgText(targetEmp);
    if (!text) return;
    
    const nameStr = activeView === 'receipt' ? (targetEmp?.name || 'Phieu_Luong') : 'Bang_Tong_Hop_Luong';
    const filename = `${nameStr.toLowerCase().replace(/\s+/g, '-')}_${activeTemplate.toUpperCase()}.png`;
    
    try {
      showToast('Đang tạo hình ảnh chất lượng cao...', 'info');
      await svgToPng(text, filename, activeTemplate === 'k80');
      showToast('Xuất ảnh PNG thành công!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Xuất ảnh thất bại. Dùng tính năng In để thay thế.', 'error');
    }
  };

  // ZIP bulk downloads
  const handleDownloadZip = async () => {
    if (employees.length === 0) {
      showToast('Không có nhân viên để xuất hàng loạt!', 'error');
      return;
    }
    setIsExporting(true);
    setExportProgress(0);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();

      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];
        setExportProgress(Math.round(((i + 1) / employees.length) * 100));
        await new Promise<void>(r => window.setTimeout(r, 0));

        const svgText = getActiveSvgText(emp);
        const isK80 = activeTemplate === 'k80';
        const suffix = isK80 ? '-k80' : '';
        const filename = `phieu-luong-${emp.name.toLowerCase().replace(/\s+/g, '-')}-${payMonth}${suffix}.png`;

        const { canvas } = await renderSvgToCanvas(svgText, isK80);
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((outBlob) => {
            if (outBlob) {
              resolve(outBlob);
            } else {
              reject(new Error('Canvas conversion to blob failed'));
            }
          }, 'image/png');
        });
        zip.file(filename, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.download = `phieu-luong-thang-${payMonth}.zip`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Tải file ZIP thành công!', 'success');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Không xác định';
      showToast(`Lỗi xuất ZIP: ${msg}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // PDF Download Trigger
  const handleDownloadPdf = async (emp?: Employee) => {
    const targetEmp = emp || activeEmployee;
    if (!targetEmp && activeView === 'receipt') {
      showToast('Không có nhân viên để xuất PDF!', 'error');
      return;
    }
    setIsExporting(true);
    setExportProgress(0);
    try {
      const [{ jsPDF }, { canvas, baseWidth, baseHeight }] = await Promise.all([
        import('jspdf'),
        renderSvgToCanvas(getActiveSvgText(targetEmp), activeTemplate === 'k80'),
      ]);
      const isK80 = activeTemplate === 'k80';
      const dataUrl = canvas.toDataURL('image/png');

      const format: 'a4' | [number, number] = isK80 ? [80, (baseHeight / baseWidth) * 80] : 'a4';
      const pdfDoc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format,
      });

      const pdfWidth = isK80 ? 80 : 210;
      const pdfHeight = isK80 ? (baseHeight / baseWidth) * 80 : 297;

      pdfDoc.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

      const nameStr = activeView === 'receipt' ? (targetEmp?.name || 'Phieu_Luong') : 'Bang_Tong_Hop_Luong';
      pdfDoc.save(`phieu-luong-${nameStr.toLowerCase().replace(/\s+/g, '-')}-${payMonth}.pdf`);
      showToast('Xuất PDF thành công!', 'success');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Không xác định';
      showToast(`Lỗi xuất PDF: ${msg}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (employees.length === 0) {
      showToast('Chưa có dữ liệu nhân viên để in phiếu!', 'error');
      return;
    }
    if (activeTemplate === 'k80' || paperSize === 'k80') {
      document.body.classList.add('print-k80-mode');
      if (!thermalOptions.splitEachSlip) {
        document.body.classList.add('print-k80-no-split');
      } else {
        document.body.classList.remove('print-k80-no-split');
      }
    } else {
      document.body.classList.remove('print-k80-mode');
      document.body.classList.remove('print-k80-no-split');
    }
    window.print();
  };

  const handlePrevEmployee = () => {
    if (currentEmployeeIndex > 0) {
      setCurrentEmployeeIndex(prev => prev - 1);
    }
  };

  const handleNextEmployee = () => {
    if (currentEmployeeIndex < employees.length - 1) {
      setCurrentEmployeeIndex(prev => prev + 1);
    }
  };

  const handleToggleEmployeeSelection = (id: string) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const resetAllConfigurations = () => {
    if (window.confirm('Reset toàn bộ tùy chỉnh hiển thị và kiểu chữ về mặc định?')) {
      setSelectedFont('Be Vietnam Pro');
      setFontSizeTitle(28);
      setFontSizeContent(14);
      setFontSizeTable(13);
      setTitleWeight('700');
      setVisibility(DEFAULT_VISIBILITY);
      setCurrencySymbol('đ');
      setCurrencySeparator('.');
      setRoundMode('thousand');
      recalculateAllEmployees(salaryMode, standardDays, 'thousand');
      setZoomLevel(100);
      showToast('Đã khôi phục cài đặt mặc định!', 'info');
    }
  };

  const totalDays = employees.reduce(
    (a, b) => a + (salaryMode === 'restaurant' ? Number(b.workedDays ?? b.days ?? 0) : Number(b.days || 0)),
    0
  );
  const totalSalary = employees.reduce((a, b) => a + getEmployeeNet(b), 0);
  const totalDeduct = deductions.reduce((a, b) => a + Number(b.amount || 0), 0);
  const net = totalSalary - advance - totalDeduct;

  const isHourly = salaryMode === 'hourly';

  const paperBaseWidthPx = activeTemplate === 'k80' ? 380 : 1000;
  const getZoomWidthStyle = () => {
    if (zoomLevel === 'fit') {
      const avail = viewportWidth ? Math.max(280, viewportWidth - (activeTemplate === 'k80' ? 16 : 32)) : paperBaseWidthPx;
      const effectiveWidth = Math.min(paperBaseWidthPx, avail);
      return { 
        width: `${effectiveWidth}px`, 
        maxWidth: '100%', 
        margin: '0 auto',
        transform: 'none',
        boxSizing: 'border-box' as const
      };
    }
    const zoomVal = Number(zoomLevel) || 100;
    const scaleVal = zoomVal / 100;
    const computedPx = Math.round(paperBaseWidthPx * scaleVal);
    const minPx = activeTemplate === 'k80' ? Math.max(300, computedPx) : computedPx;
    return { 
      width: `${minPx}px`, 
      minWidth: `${minPx}px`,
      maxWidth: 'none', 
      margin: '0 auto',
      transform: 'none',
      boxSizing: 'border-box' as const
    };
  };

  const warningsList = useMemo(() => {
    return Object.values(validationMap).flat();
  }, [validationMap]);

  return (
    <div
      ref={containerRef}
      className={`payroll-creator mode-${layoutMode} ${isFullscreenPreview ? 'fullscreen-preview-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {/* Drag & Drop Multi-Format Overlay (Excel + Images) */}
      {isDraggingFile && (
        <div className="payroll-drop-overlay">
          <UploadCloud size={44} style={{ color: 'var(--accent-primary)' }} />
          <strong>Thả File Excel (.xlsx, .xls, .csv) hoặc Ảnh phiếu lương (.png, .jpg) vào đây</strong>
          <span>Hệ thống sẽ tự động phân tích và dựng bảng cấu hình riêng cho từng phiếu lương</span>
        </div>
      )}

      {/* Hidden Print-Only Container (K80 / A4 Thermal Isolation) */}
      <div className="print-only-container">
        {activeView === 'summary' ? (
          <div className="print-page" dangerouslySetInnerHTML={{ __html: getActiveSvgText() }} />
        ) : (
          (printScope === 'all'
            ? employees
            : printScope === 'selected'
              ? (selectedEmployeeIds.size > 0
                  ? employees.filter(emp => selectedEmployeeIds.has(emp.id))
                  : (activeEmployee ? [activeEmployee] : employees))
              : (activeEmployee ? [activeEmployee] : [])
          ).map(emp => (
            <div key={emp.id} className="print-page" dangerouslySetInnerHTML={{ __html: getActiveSvgText(emp) }} />
          ))
        )}
      </div>

      {/* Exporting Progress Overlay */}
      {isExporting && (
        <div className="export-progress-overlay">
          <div className="export-progress-card">
            <RefreshCw size={24} className="spinner" style={{ color: 'var(--accent-primary)', margin: '0 auto' }} />
            <strong>Đang xuất tệp phiếu lương...</strong>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${exportProgress}%` }} />
            </div>
            <span>Hoàn thành {exportProgress}%</span>
          </div>
        </div>
      )}

      {/* 1. Clean Header & 4 KPI Cards */}
      <div className="head">
        <PageHeader
          icon={<CreditCard size={22} />}
          title="Bảng Lương & Chuẩn Hóa Phiếu Lương"
          subtitle="Nhập từ Ảnh, File Excel hoặc nội dung nhanh để tự động dựng bảng cấu hình — tùy biến linh hoạt số dòng cộng/trừ riêng cho từng phiếu K80/A4."
          badgeText="Payroll Studio v4.0"
          badgeVariant="info"
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-outline"
                onClick={handlePipeToTransferTool}
                title="Chuyển danh sách thực nhận sang Lệnh chuyển khoản MyVIB / VCB"
              >
                <Send size={15} />
                <span>Đẩy sang Lệnh CK</span>
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setIsConfigDrawerOpen(true)}
                title="Cấu hình mẫu in K80/A4, khấu trừ chung & lịch sử Google Sheets"
              >
                <Sliders size={15} />
                <span>Cài đặt &amp; Cloud</span>
              </button>
              <button
                type="button"
                className="primary"
                onClick={handlePrint}
                disabled={employees.length === 0}
                title="In phiếu lương ngay"
              >
                <Printer size={15} />
                <span>In phiếu ({printScope === 'all' ? employees.length : printScope === 'selected' ? selectedEmployeeIds.size : 1})</span>
              </button>
            </div>
          }
        />

        <div className="kpis">
          <StatCard
            icon={<Users size={18} />}
            label="Tổng nhân sự"
            value={employees.length.toLocaleString('vi-VN')}
            subtext={`${selectedEmployeeIds.size} phiếu đang chọn in`}
            hasData={employees.length > 0}
          />
          <StatCard
            icon={<Calendar size={18} />}
            label={isHourly ? 'Tổng giờ công' : 'Tổng ngày công'}
            value={totalDays.toLocaleString('vi-VN')}
            subtext={salaryMode === 'restaurant' ? 'Chế độ F&B Nhà hàng' : isHourly ? 'Tính theo giờ' : `Định mức ${standardDays} công`}
            hasData={employees.length > 0}
          />
          <StatCard
            icon={<Wallet size={18} />}
            label="Tổng thực nhận NV"
            value={formatMoney(totalSalary)}
            subtext="Đã cộng/trừ từng phiếu riêng"
            hasData={employees.length > 0}
          />
          <StatCard
            icon={<CreditCard size={18} />}
            label="Tổng chi kỳ lương"
            value={formatMoney(net)}
            subtext={warningsList.length > 0 ? `${warningsList.length} cảnh báo cần xem` : 'Dữ liệu khớp chuẩn'}
            hasData={employees.length > 0}
            accentColor={warningsList.length > 0 ? 'var(--status-warning)' : 'var(--status-success)'}
          />
        </div>
      </div>

      {/* 2. Single-Row Compact Studio Action Bar */}
      <div className="payroll-studio-bar">
        <div className="payroll-studio-bar-left">
          <label className="payroll-bar-inline-control" title="Kỳ thanh toán lương">
            <span>Kỳ lương</span>
            <input
              type="month"
              value={payMonth}
              onChange={(e) => setPayMonth(e.target.value)}
            />
          </label>

          <div className="payroll-seg-control" role="group" aria-label="Chế độ tính lương">
            {([
              { id: 'restaurant', label: 'F&B Nhà hàng' },
              { id: 'monthly', label: 'Lương tháng' },
              { id: 'hourly', label: 'Lương giờ' }
            ] as const).map(m => (
              <button
                key={m.id}
                type="button"
                className={salaryMode === m.id ? 'active' : ''}
                onClick={() => handleSalaryModeChange(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="payroll-studio-bar-right">
          <button
            type="button"
            className={isSmartImporterOpen ? 'primary' : 'btn-outline'}
            onClick={() => setIsSmartImporterOpen(prev => !prev)}
          >
            <UploadCloud size={15} />
            <span>Nhập Ảnh / Excel / Nội dung</span>
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={addEmployee}
          >
            <Plus size={15} />
            <span>Thêm NV</span>
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={handleNormalizeAllSlips}
            disabled={employees.length === 0}
            title="Tự động ẩn các dòng 0đ và sắp xếp Cộng/Trừ cho toàn bộ phiếu"
          >
            <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
            <span>Chuẩn hóa tất cả</span>
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={savePayrollToGAS}
            disabled={employees.length === 0 || syncStatus === 'loading'}
            title="Lưu kỳ lương hiện tại lên Google Sheets"
          >
            <Save size={15} />
            <span>Lưu Cloud</span>
          </button>
        </div>
      </div>

      {/* 3. Inline Smart Multi-Source Importer (Image OCR / Excel / Smart Text -> Staging Table) */}
      <PayrollSmartImporter
        isOpen={isSmartImporterOpen}
        onClose={() => setIsSmartImporterOpen(false)}
        salaryMode={salaryMode}
        standardDays={standardDays}
        roundMode={roundMode}
        payMonth={payMonth}
        formatMoney={formatMoney}
        onApplyEmployees={handleApplyImportedEmployees}
        showToast={showToast}
        initialTab={importerInitialTab}
        droppedFile={droppedImportFile}
        onClearDroppedFile={() => setDroppedImportFile(null)}
      />

      {/* Mobile 2-Tab Clean Switcher */}
      {isMobileScreen && (
        <div className="payroll-mobile-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mobileActiveTab !== 'preview'}
            className={mobileActiveTab !== 'preview' ? 'active' : ''}
            onClick={() => setMobileActiveTab('data')}
          >
            Bảng &amp; Chuẩn hóa ({employees.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileActiveTab === 'preview'}
            className={mobileActiveTab === 'preview' ? 'active' : ''}
            onClick={() => setMobileActiveTab('preview')}
          >
            Xem trước &amp; In phiếu
          </button>
        </div>
      )}

      {/* 4. Clean 2-Column Studio Workspace (Master Table + Per-Slip Normalizer | Live Slip Preview) */}
      <div className={`payroll-studio-grid ${isLeftPanelCollapsed ? 'is-preview-expanded' : ''}`}>
        {/* LEFT PANE: Master Table + Active Employee Dynamic Line-Item Editor */}
        {(!isMobileScreen || mobileActiveTab !== 'preview') && !isLeftPanelCollapsed && (
          <div className="payroll-studio-left">
            {/* Master Configurable Table Card */}
            <div className="payroll-master-card">
              <div className="payroll-master-toolbar">
                <div className="payroll-master-search">
                  <Search size={15} className="payroll-search-ic" />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Tìm nhanh nhân viên..."
                    value={searchEmployeeQuery}
                    onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                  />
                </div>

                <div className="payroll-master-filters">
                  <button
                    type="button"
                    className={`filter-tag ${navigatorFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setNavigatorFilter('all')}
                  >
                    Tất cả ({employees.length})
                  </button>
                  {Object.keys(validationMap).length > 0 && (
                    <button
                      type="button"
                      className={`filter-tag ${navigatorFilter === 'invalid' ? 'active' : ''}`}
                      onClick={() => setNavigatorFilter('invalid')}
                    >
                      Cảnh báo ({Object.keys(validationMap).length})
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ height: '32px', fontSize: '12px' }}
                    onClick={loadSampleData}
                    title="Nạp 3 nhân viên mẫu có số dòng cộng/trừ khác nhau"
                  >
                    Mẫu 3 phiếu
                  </button>
                  {employees.length > 0 && (
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ height: '32px', padding: '0 8px', color: 'var(--status-danger)' }}
                      onClick={clearAllForms}
                      title="Xóa trắng danh sách"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {employees.length === 0 ? (
                <div style={{ padding: '1.25rem' }}>
                  <EmptyState
                    icon={<FileText size={28} />}
                    title="Chưa có phiếu lương nào trong kỳ này"
                    description="Bạn có thể nhập trực tiếp từ Ảnh phiếu lương (OCR), File Excel (.xlsx/.csv), dán nội dung nhanh hoặc nạp 3 phiếu mẫu để xem thử."
                    actionLabel="Mở khung Nhập Ảnh / Excel / Nội dung"
                    onAction={() => openSmartImporter('excel')}
                  />
                </div>
              ) : (
                <div className="payroll-master-table-wrap">
                  <table className="payroll-master-table">
                    <thead>
                      <tr>
                        <th style={{ width: '36px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={employees.length > 0 && selectedEmployeeIds.size === employees.length}
                            onChange={() => {
                              if (selectedEmployeeIds.size === employees.length) {
                                setSelectedEmployeeIds(new Set());
                              } else {
                                setSelectedEmployeeIds(new Set(employees.map(e => e.id)));
                              }
                            }}
                            aria-label="Chọn tất cả nhân viên để in"
                          />
                        </th>
                        <th>Nhân viên</th>
                        <th style={{ width: '78px', textAlign: 'right' }}>{isHourly ? 'Giờ' : 'Công'}</th>
                        <th style={{ width: '115px', textAlign: 'right' }}>Lương CB</th>
                        <th>Cấu trúc khoản riêng</th>
                        <th style={{ width: '126px', textAlign: 'right' }}>Thực nhận</th>
                        <th style={{ width: '38px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNavigatorEmployees.map((emp) => {
                        const realIdx = employees.findIndex(e => e.id === emp.id);
                        const isActive = currentEmployeeIndex === realIdx;
                        const totals = computeDynamicEmployeeTotals(emp, salaryMode, standardDays, roundMode);
                        const hasWarning = Boolean(validationMap[emp.id]);

                        return (
                          <tr
                            key={emp.id}
                            className={`${isActive ? 'is-active' : ''} ${hasWarning ? 'has-warning' : ''}`}
                            onClick={() => {
                              setCurrentEmployeeIndex(realIdx);
                              setPreviewMode('single');
                            }}
                          >
                            <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedEmployeeIds.has(emp.id)}
                                onChange={() => handleToggleEmployeeSelection(emp.id)}
                                aria-label={`Chọn in phiếu ${emp.name}`}
                              />
                            </td>
                            <td>
                              <div className="payroll-emp-cell">
                                <div className="payroll-emp-name-row">
                                  <strong>{emp.name || '(Chưa đặt tên)'}</strong>
                                  {hasWarning && <AlertTriangle size={13} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />}
                                </div>
                                <span className="payroll-emp-meta">{emp.role || defaultPosition}</span>
                              </div>
                            </td>
                            <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600 }}>
                              {salaryMode === 'restaurant' ? (emp.workedDays ?? emp.days) : emp.days}
                            </td>
                            <td className="tabular-nums" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {formatMoney(emp.salary)}
                            </td>
                            <td>
                              <div className="payroll-row-badges">
                                {totals.visibleAddCount > 0 && (
                                  <span className="payroll-mini-badge is-add">+{totals.visibleAddCount} cộng</span>
                                )}
                                {totals.visibleDeductCount > 0 && (
                                  <span className="payroll-mini-badge is-deduct">−{totals.visibleDeductCount} trừ</span>
                                )}
                                {totals.visibleAddCount === 0 && totals.visibleDeductCount === 0 && (
                                  <span className="payroll-mini-badge is-neutral">Lương cơ bản</span>
                                )}
                              </div>
                            </td>
                            <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, color: totals.netPay < 0 ? 'var(--status-danger)' : 'var(--accent-primary)' }}>
                              {formatMoney(totals.netPay)}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="btn-ghost"
                                style={{ width: '30px', height: '30px', padding: 0, color: 'var(--status-danger)' }}
                                onClick={() => deleteEmployee(emp.id)}
                                title={`Xóa ${emp.name}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredNavigatorEmployees.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)' }}>
                            Không tìm thấy nhân viên phù hợp từ khóa.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Active Employee Per-Slip Line-Item Customizer */}
            {activeEmployee && (
              <PayrollSlipEditor
                employee={activeEmployee}
                salaryMode={salaryMode}
                standardDays={standardDays}
                roundMode={roundMode}
                defaultPosition={defaultPosition}
                defaultDept={defaultDept}
                formatMoney={formatMoney}
                onUpdateEmployee={handleUpdateEmployeeFull}
                onNormalizeSlip={() => handleNormalizeSingleSlip(activeEmployee.id)}
              />
            )}
          </div>
        )}

        {/* RIGHT PANE: Sticky Live Slip Preview & Clean Export Controls */}
        {(!isMobileScreen || mobileActiveTab === 'preview') && (
          <div className="preview-pane payroll-studio-right">
            {/* Compact Single-Row Preview Controls */}
            <div className="payroll-preview-toolbar">
              <div className="payroll-seg-control">
                <button
                  type="button"
                  className={activeView === 'receipt' ? 'active' : ''}
                  onClick={() => { setActiveView('receipt'); setPreviewMode('single'); }}
                >
                  Phiếu cá nhân
                </button>
                <button
                  type="button"
                  className={activeView === 'summary' ? 'active' : ''}
                  onClick={() => { setActiveView('summary'); setPreviewMode('single'); }}
                >
                  Tổng hợp
                </button>
              </div>

              <div className="payroll-seg-control">
                {([
                  { id: 'k80', label: 'K80 Nhiệt' },
                  { id: 'standard', label: 'A4 Chuẩn' },
                  { id: 'modern', label: 'Modern' }
                ] as const).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={activeTemplate === t.id ? 'active' : ''}
                    onClick={() => {
                      setActiveTemplate(t.id);
                      if (t.id === 'k80') {
                        setPaperSize('k80');
                        setActiveQuickPreset('k80');
                      } else {
                        setPaperSize('a4');
                        if (activeQuickPreset === 'k80') setActiveQuickPreset('full');
                      }
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {activeView === 'receipt' && employees.length > 0 && (
                <div className="payroll-nav-pager">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handlePrevEmployee}
                    disabled={currentEmployeeIndex === 0}
                    style={{ width: '30px', height: '30px', padding: 0 }}
                    aria-label="Phiếu trước"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="tabular-nums">{currentEmployeeIndex + 1} / {employees.length}</span>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleNextEmployee}
                    disabled={currentEmployeeIndex >= employees.length - 1}
                    style={{ width: '30px', height: '30px', padding: 0 }}
                    aria-label="Phiếu sau"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                <select
                  className="form-control select-compact"
                  style={{ width: '96px' }}
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(e.target.value)}
                  aria-label="Thu phóng phiếu"
                >
                  <option value="fit">Vừa khít</option>
                  <option value="75">75%</option>
                  <option value="100">100%</option>
                  <option value="125">125%</option>
                </select>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setIsFullscreenPreview(!isFullscreenPreview)}
                  style={{ width: '32px', height: '32px', padding: 0 }}
                  title="Phóng to toàn màn hình"
                >
                  {isFullscreenPreview ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
                {!isMobileScreen && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
                    style={{ height: '32px', padding: '0 8px', fontSize: '12px' }}
                    title="Ẩn/hiện bảng bên trái"
                  >
                    {isLeftPanelCollapsed ? 'Hiện bảng' : 'Mở rộng'}
                  </button>
                )}
              </div>
            </div>

            {/* Live SVG Preview Viewport */}
            <div className="preview-scroll-container PayrollPreviewViewport" ref={previewViewportRef}>
              {employees.length === 0 ? (
                <EmptyState
                  icon={<Printer size={28} />}
                  title="Bản xem trước phiếu lương"
                  description="Khi có dữ liệu nhân viên, phiếu in K80 hoặc A4 sẽ hiển thị trực tiếp tại đây và tự động thay đổi số dòng theo từng nhân viên."
                />
              ) : (
                <div className="sheet-canvas-wrapper" style={getZoomWidthStyle()}>
                  <div className="preview-receipt-card" style={{ width: '100%', margin: '0 auto' }}>
                    <div className="receipt-card-header print-hidden">
                      <span style={{ fontSize: '12.5px', fontWeight: 700 }}>
                        {activeView === 'receipt' && activeEmployee
                          ? `Phiếu #${currentEmployeeIndex + 1} · ${activeEmployee.name}`
                          : `Bảng Tổng Hợp Lương (${payMonth})`}
                      </span>
                      {activeView === 'receipt' && activeEmployee && (
                        <span className="payroll-slip-row-count-pill">
                          {buildSlipRenderRows(
                            activeEmployee,
                            salaryMode,
                            standardDays,
                            roundMode,
                            formatMoney,
                            {
                              showTime: visibility.showTime,
                              showBaseSalary: visibility.showBaseSalary,
                              showAdvance: visibility.showAdvance,
                              showDeductions: visibility.showDeductions,
                            },
                            thermalOptions.hideEmptyRows
                          ).rows.length} dòng trên phiếu
                        </span>
                      )}
                    </div>
                    {activeTemplate === 'k80' && <div className="receipt-edge top-edge print-hidden" />}
                    <div
                      className="receipt-svg-holder"
                      dangerouslySetInnerHTML={{ __html: getActiveSvgText(activeView === 'receipt' ? activeEmployee : undefined) }}
                    />
                    {activeTemplate === 'k80' && <div className="receipt-edge bottom-edge print-hidden" />}
                  </div>
                </div>
              )}
            </div>

            {/* Clean 1-Row Export Footer under Preview */}
            <div className="payroll-export-bar print-hidden">
              <button
                type="button"
                className="primary"
                onClick={handlePrint}
                disabled={employees.length === 0}
              >
                <Printer size={15} />
                <span>In phiếu</span>
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => handleDownloadPng()}
                disabled={employees.length === 0}
              >
                <Download size={15} />
                <span>Tải PNG</span>
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => handleDownloadPdf()}
                disabled={employees.length === 0}
              >
                <FileText size={15} />
                <span>Tải PDF</span>
              </button>
              {activeView === 'receipt' && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleDownloadZip}
                  disabled={isExporting || employees.length === 0}
                  title="Tải toàn bộ phiếu lương dạng file nén ZIP"
                >
                  <Archive size={15} />
                  <span>ZIP tất cả</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>


      {/* Slide-over Drawer for Deep Configuration & Customization */}
      <SlideOverDrawer
        isOpen={isConfigDrawerOpen}
        onClose={() => setIsConfigDrawerOpen(false)}
        title="Cấu hình & Tùy chỉnh Bảng Lương"
        subtitle="Thiết lập tham số lương, khấu trừ, mẫu in K80/A4 và đồng bộ Google Sheets"
        badgeText={salaryMode === 'restaurant' ? 'F&B Nhà Hàng' : salaryMode === 'monthly' ? 'Lương Tháng' : 'Lương Giờ'}
        width="540px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Nhấn <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>ESC</kbd> để đóng
            </span>
            <button
              type="button"
              className="primary"
              onClick={() => setIsConfigDrawerOpen(false)}
              style={{ height: '36px', padding: '0 18px', fontSize: '13px' }}
            >
              Áp dụng & Đóng
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-default)', marginBottom: '12px' }}>
          <button
            type="button"
            className={`tab-btn ${configDrawerTab === 'salary' ? 'active' : ''}`}
            onClick={() => setConfigDrawerTab('salary')}
            style={{
              flex: 1,
              padding: '8px 6px',
              fontSize: '12px',
              fontWeight: 600,
              border: 0,
              borderRadius: '6px',
              background: configDrawerTab === 'salary' ? 'var(--accent-primary-subtle)' : 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <span>⚙️</span>
            <span>Lương & Công</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${configDrawerTab === 'print' ? 'active' : ''}`}
            onClick={() => setConfigDrawerTab('print')}
            style={{
              flex: 1,
              padding: '8px 6px',
              fontSize: '12px',
              fontWeight: 600,
              border: 0,
              borderRadius: '6px',
              background: configDrawerTab === 'print' ? 'var(--accent-primary-subtle)' : 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <span>🎨</span>
            <span>Mẫu & In ấn</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${configDrawerTab === 'sync' ? 'active' : ''}`}
            onClick={() => setConfigDrawerTab('sync')}
            style={{
              flex: 1,
              padding: '8px 6px',
              fontSize: '12px',
              fontWeight: 600,
              border: 0,
              borderRadius: '6px',
              background: configDrawerTab === 'sync' ? 'var(--accent-primary-subtle)' : 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <span>☁️</span>
            <span>Cloud & Lưu</span>
          </button>
          {warningsList.length > 0 && (
            <button
              type="button"
              className={`tab-btn ${configDrawerTab === 'warnings' ? 'active' : ''}`}
              onClick={() => setConfigDrawerTab('warnings')}
              style={{
                flex: 1,
                padding: '8px 6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 0,
                borderRadius: '6px',
                background: configDrawerTab === 'warnings' ? 'var(--status-danger-bg)' : 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <span>⚠️</span>
              <span>Lỗi ({warningsList.length})</span>
            </button>
          )}
        </div>

        {/* Tab 1: Lương & Công */}
        {configDrawerTab === 'salary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Chế độ tính lương</span>
                <span style={{ fontSize: '11px', color: 'var(--cyan)', fontWeight: 600 }}>
                  {salaryMode === 'restaurant' ? 'Chuẩn F&B Nhà Hàng' : salaryMode === 'monthly' ? 'Lương Tháng' : 'Theo Giờ'}
                </span>
              </label>
              <div className="segmented-control" style={{ width: '100%' }}>
                <button 
                  type="button" 
                  className={`segmented-item ${salaryMode === 'restaurant' ? 'active' : ''}`}
                  onClick={() => handleSalaryModeChange('restaurant')}
                  style={{ flex: 1, padding: '7px 8px', fontSize: '12px' }}
                >
                  🍽️ F&B Nhà Hàng
                </button>
                <button 
                  type="button" 
                  className={`segmented-item ${salaryMode === 'monthly' ? 'active' : ''}`}
                  onClick={() => handleSalaryModeChange('monthly')}
                  style={{ flex: 1, padding: '7px 8px', fontSize: '12px' }}
                >
                  📅 Theo Tháng
                </button>
                <button 
                  type="button" 
                  className={`segmented-item ${salaryMode === 'hourly' ? 'active' : ''}`}
                  onClick={() => handleSalaryModeChange('hourly')}
                  style={{ flex: 1, padding: '7px 8px', fontSize: '12px' }}
                >
                  ⏰ Theo Giờ
                </button>
              </div>
            </div>

            <div className="grid2">
              <div className="form-group">
                <label className="form-label">Tháng thanh toán</label>
                <input type="month" className="form-control" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Ngày lập chứng từ</label>
                <input type="date" className="form-control" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
              </div>
            </div>

            <div className="grid2">
              <div className="form-group" style={{ display: isHourly ? 'none' : 'block' }}>
                <label className="form-label">Số ngày công định mức</label>
                <input type="number" className="form-control" value={standardDays} onChange={(e) => handleStandardDaysChange(Number(e.target.value) || 26)} />
              </div>
              <div className="form-group">
                <label className="form-label">Làm tròn số tiền</label>
                <select className="form-control" value={roundMode} onChange={(e) => handleRoundModeChange(e.target.value as RoundMode)}>
                  <option value="none">Không làm tròn</option>
                  <option value="hundred">Làm tròn hàng trăm (100đ)</option>
                  <option value="thousand">Làm tròn hàng nghìn (1.000đ)</option>
                </select>
              </div>
            </div>

            <div className="grid2">
              <div className="form-group">
                <label className="form-label">Chức vụ mặc định</label>
                <input type="text" className="form-control" value={defaultPosition} onChange={(e) => setDefaultPosition(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Bộ phận mặc định</label>
                <input type="text" className="form-control" value={defaultDept} onChange={(e) => setDefaultDept(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Khấu trừ tạm ứng chung (đ)</label>
              <MoneyInput 
                className="form-control" 
                value={advance} 
                onChange={(val) => setAdvance(val)}
                formatMoney={formatMoney}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="form-label" style={{ margin: 0 }}>Khấu trừ chung toàn kỳ ({deductions.length})</label>
                <button type="button" className="btn-outline" style={{ height: '30px', fontSize: '12px' }} onClick={addDeduction}>
                  <Plus size={13} />
                  <span>Thêm khoản</span>
                </button>
              </div>
              {deductions.map(d => (
                <div key={d.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-control input-compact"
                    placeholder="Tên khoản (VD: Quỹ chung)"
                    value={d.label}
                    onChange={(e) => updateDeduction(d.id, 'label', e.target.value)}
                  />
                  <MoneyInput
                    className="form-control input-compact"
                    value={d.amount}
                    onChange={(val) => updateDeduction(d.id, 'amount', val)}
                    formatMoney={formatMoney}
                  />
                  <button type="button" className="btn-ghost" style={{ width: '32px', height: '32px', padding: 0, color: 'var(--status-danger)' }} onClick={() => deleteDeduction(d.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Mẫu in & Bố cục */}
        {configDrawerTab === 'print' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Khổ giấy xuất bản</label>
              <div className="paper-size-grid">
                <button
                  type="button"
                  className={`paper-size-btn ${paperSize === 'a4' && activeTemplate !== 'k80' ? 'active' : ''}`}
                  onClick={() => {
                    setPaperSize('a4');
                    if (activeTemplate === 'k80') setActiveTemplate('standard');
                    if (activeQuickPreset === 'k80') setActiveQuickPreset('full');
                  }}
                >
                  <span>📄 Khổ chuẩn A4 / A5</span>
                </button>
                <button
                  type="button"
                  className={`paper-size-btn ${paperSize === 'k80' || activeTemplate === 'k80' ? 'active' : ''}`}
                  onClick={() => {
                    setPaperSize('k80');
                    setActiveTemplate('k80');
                    setActiveQuickPreset('k80');
                  }}
                >
                  <span>🧾 Cuộn in nhiệt K80</span>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Chọn Preset nhanh</label>
              <div className="preset-toggle-container">
                {([
                  { id: 'full', label: 'Đầy đủ' },
                  { id: 'compact', label: 'Rút gọn' },
                  { id: 'internal', label: 'Nội bộ' },
                  { id: 'k80', label: 'In nhiệt' }
                ] as const).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`preset-chip ${activeQuickPreset === p.id ? 'active' : ''}`}
                    onClick={() => applyPreset(p.id)}
                  >
                    {activeQuickPreset === p.id && <span>✓</span>}
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Phạm vi in ấn</label>
              <select className="form-control" value={printScope} onChange={e => setPrintScope(e.target.value as PrintScope)}>
                <option value="current">Chỉ phiếu đang xem (1 NV)</option>
                <option value="all">In tất cả nhân viên ({employees.length} NV)</option>
                <option value="selected">In nhân viên được chọn ({selectedEmployeeIds.size}/{employees.length} NV)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Phong cách chữ nhanh</label>
              <div className="preset-toggle-container">
                {([
                  { id: 'modern', label: 'Hiện đại' },
                  { id: 'admin', label: 'Hành chính' },
                  { id: 'minimalist', label: 'Tối giản' },
                  { id: 'luxury', label: 'Trang trọng' },
                  { id: 'k80', label: 'Nhiệt K80' }
                ] as const).map(tp => (
                  <button
                    key={tp.id}
                    type="button"
                    className={`preset-chip ${activeTypoPreset === tp.id ? 'active' : ''}`}
                    onClick={() => applyTypographyPreset(tp.id)}
                  >
                    {activeTypoPreset === tp.id && <span>✓</span>}
                    <span>{tp.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Font chữ tiếng Việt</label>
              <select className="form-control" value={selectedFont} onChange={e => setSelectedFont(e.target.value)}>
                {AVAILABLE_FONTS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--cyan)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                HIỂN THỊ PHẦN TỬ PHIẾU
              </span>
              <div className="checkbox-grid">
                <label className="checkbox-label">
                  <input type="checkbox" checked={visibility.showLogo} onChange={e => setVisibility(prev => ({ ...prev, showLogo: e.target.checked }))} />
                  <span>Logo đơn vị</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={visibility.showTitle} onChange={e => setVisibility(prev => ({ ...prev, showTitle: e.target.checked }))} />
                  <span>Tiêu đề phiếu</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={visibility.showBaseSalary} onChange={e => setVisibility(prev => ({ ...prev, showBaseSalary: e.target.checked }))} />
                  <span>Mức lương cơ bản</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={visibility.showTime} onChange={e => setVisibility(prev => ({ ...prev, showTime: e.target.checked }))} />
                  <span>Số công/giờ làm</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={visibility.showSignatures} onChange={e => setVisibility(prev => ({ ...prev, showSignatures: e.target.checked }))} />
                  <span>Chữ ký xác nhận</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={visibility.showNotes} onChange={e => setVisibility(prev => ({ ...prev, showNotes: e.target.checked }))} />
                  <span>Ghi chú bằng chữ</span>
                </label>
              </div>
            </div>

            {(paperSize === 'k80' || activeTemplate === 'k80') && (
              <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                  ⚙️ TÙY CHỌN MÁY IN NHIỆT K80
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={thermalOptions.splitEachSlip} onChange={e => setThermalOptions(prev => ({ ...prev, splitEachSlip: e.target.checked }))} />
                    <span>Tách từng phiếu khi in hàng loạt (Auto-cut)</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={thermalOptions.compactCut} onChange={e => setThermalOptions(prev => ({ ...prev, compactCut: e.target.checked }))} />
                    <span>Cắt gọn cuối phiếu (co sát theo nội dung)</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={thermalOptions.hideSignature} onChange={e => setThermalOptions(prev => ({ ...prev, hideSignature: e.target.checked }))} />
                    <span>Ẩn phần ký tên trên phiếu nhiệt</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={thermalOptions.showCutLine} onChange={e => setThermalOptions(prev => ({ ...prev, showCutLine: e.target.checked }))} />
                    <span>Hiện đường kẻ cắt giấy cuối phiếu</span>
                  </label>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="form-label" style={{ margin: 0 }}>Mẫu cấu hình in đã lưu ({customPresets.length})</span>
                <button type="button" className="btn-ghost" style={{ height: '28px', fontSize: '11.5px' }} onClick={resetAllConfigurations}>
                  Khôi phục mặc định
                </button>
              </div>
              {customPresets.map(preset => (
                <div key={preset.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-subtle)', border: '1px solid var(--border-default)' }}>
                  <button type="button" className="btn-ghost" style={{ height: '28px', padding: 0, flex: 1, justifyContent: 'flex-start', fontSize: '12px' }} onClick={() => applyCustomPreset(preset)}>
                    {preset.name}
                  </button>
                  <button type="button" className="btn-ghost" style={{ width: '28px', height: '28px', padding: 0, color: 'var(--status-danger)' }} onClick={() => deleteCustomPreset(preset.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-outline" style={{ width: '100%', height: '34px', fontSize: '12px' }} onClick={saveCurrentAsPreset}>
                Lưu cấu hình in hiện tại thành mẫu
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Google Sheets Cloud */}
        {configDrawerTab === 'sync' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="sync-status">
              <span className={`sync-dot ${syncStatus}`}></span>
              <span>Google Sheets Sync: </span>
              <strong>{syncStatus === 'online' ? 'Sẵn sàng' : syncStatus === 'loading' ? 'Đang đồng bộ...' : 'Chưa kết nối'}</strong>
            </div>

            <div className="bulk-import-row">
              <button type="button" className="primary" style={{ flexGrow: 1, height: '40px', fontSize: '13px' }} onClick={savePayrollToGAS} disabled={syncStatus === 'loading'}>
                <Save size={14} />
                Lưu Bảng Lương Lên Cloud
              </button>
              <button type="button" className="btn-ghost" onClick={fetchHistoryMonths} disabled={syncStatus === 'loading'} title="Tải lại lịch sử">
                <RefreshCw size={14} className={syncStatus === 'loading' ? 'spinner' : ''} />
              </button>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginTop: '6px' }}>Lịch sử tháng lương đã lưu:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
              {historyMonths.map(h => (
                <div key={h.month} onClick={() => loadHistoryMonth(h.month)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-subtle)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', border: '1px solid var(--border-default)' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Tháng {h.month.split('-')[1]}/{h.month.split('-')[0]}</span>
                    <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block' }}>Ghi bởi: {h.operator} - {h.updatedTime}</span>
                  </div>
                  <button 
                    type="button"
                    className="btn-danger small-btn" 
                    style={{ padding: '3px 8px', fontSize: '10px' }} 
                    onClick={(e) => { e.stopPropagation(); deleteHistoryMonth(h.month); }}
                  >
                    Xóa
                  </button>
                </div>
              ))}
              {historyMonths.length === 0 && (
                <div style={{ padding: '1rem', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>Chưa có dữ liệu nào lưu trữ đám mây.</div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Cảnh báo */}
        {configDrawerTab === 'warnings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
            {employees.map(emp => {
              const msgs = validationMap[emp.id] || [];
              if (msgs.length === 0) return null;
              return (
                <div key={emp.id} style={{ fontSize: '0.8rem', background: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.3)', padding: '8px 12px', borderRadius: '6px' }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>{emp.name || '(Trống)'}</strong>
                  {msgs.map((m, i) => (
                    <div key={i} style={{ color: m.type === 'error' ? '#ff5c7a' : '#ffc107', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <span>•</span>
                      <span>{m.message}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </SlideOverDrawer>

    </div>
  );
}
