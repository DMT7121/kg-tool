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
  Maximize2
} from 'lucide-react';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import './PayrollCreator.css';
import { StatCard, EmptyState, GuidePanel } from './components/Shared';
import ExcelJS from 'exceljs';

const THEMES = {
  blue: '#1e3a8a',
  lightBlue: '#eff6ff',
  red: '#dc2626',
  slate: '#475569'
};

interface Employee {
  id: string;
  name: string;
  days: number;
  range: string;
  salary: number;
  amount: number;
  advance?: number;
  addedDays?: number;
  totalHours?: number;
  workedDays?: number;
  lunchPay?: number;
  bonus?: number;
  overtimePay?: number;
  deduction?: number;
}

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

// Format Utilities
const escapeHtml = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c] || ''));
const onlyNumber = (v: any) => Number(String(v ?? '').replace(/\./g, '').replace(/[^0-9-]/g, '')) || 0;
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
  num = Math.round(Number(num) || 0);
  if (num === 0) return 'Không đồng chẵn';
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  function readTriple(n: number, full: boolean) {
    const tr = Math.floor(n / 100);
    const ch = Math.floor((n % 100) / 10);
    const dv = n % 10;
    let out = [];
    if (tr > 0 || full) out.push(digits[tr], 'trăm');
    if (ch > 1) {
      out.push(digits[ch], 'mươi');
      if (dv === 1) out.push('mốt');
      else if (dv === 5) out.push('lăm');
      else if (dv > 0) out.push(digits[dv]);
    } else if (ch === 1) {
      out.push('mười');
      if (dv === 5) out.push('lăm');
      else if (dv > 0) out.push(digits[dv]);
    } else if (dv > 0) {
      if (tr > 0 || full) out.push('lẻ');
      out.push(digits[dv]);
    }
    return out.join(' ');
  }

  let parts = [];
  let groups = [];
  let sign = num < 0 ? 'Âm ' : '';
  num = Math.abs(num);

  while (num > 0) {
    groups.push(num % 1000);
    num = Math.floor(num / 1000);
  }

  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const full = i < groups.length - 1 && groups[i] < 100;
    const text = readTriple(groups[i], full);
    parts.push(text + (units[i] ? ' ' + units[i] : ''));
  }

  let result = parts.join(' ').replace(/\s+/g, ' ').trim();
  return sign + result.charAt(0).toUpperCase() + result.slice(1) + ' đồng chẵn';
}

export default function PayrollCreator({ gasUrl, spreadsheetId, operatorName, showToast }: PayrollCreatorProps) {
  // Main form states
  const [salaryMode, setSalaryMode] = useState<'monthly' | 'hourly' | 'restaurant'>('restaurant');
  const [payMonth, setPayMonth] = useState('2026-06');
  const [voucherDate, setVoucherDate] = useState('2026-06-12');
  const [standardDays, setStandardDays] = useState(30);
  const [defaultPosition, setDefaultPosition] = useState('Nhân viên');
  const [defaultDept, setDefaultDept] = useState('Nhân sự');
  
  const [advance, setAdvance] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  
  // UI Preview configs
  const [activeTemplate, setActiveTemplate] = useState<'standard' | 'k80' | 'modern'>('standard');
  const [activeView, setActiveView] = useState<'receipt' | 'summary'>('receipt');
  
  // Sync history states
  const [historyMonths, setHistoryMonths] = useState<SavedPayrollMonth[]>([]);
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'loading'>('offline');
  
  // File inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // New Upgraded UI Configurations
  const [selectedFont, setSelectedFont] = useState(() => localStorage.getItem('kg_tool_selected_font') || 'Be Vietnam Pro');
  const [fontSizeTitle, setFontSizeTitle] = useState(() => Number(localStorage.getItem('kg_tool_font_size_title')) || 28);
  const [fontSizeContent, setFontSizeContent] = useState(() => Number(localStorage.getItem('kg_tool_font_size_content')) || 14);
  const [fontSizeTable, setFontSizeTable] = useState(() => Number(localStorage.getItem('kg_tool_font_size_table')) || 13);
  const [titleWeight, setTitleWeight] = useState(() => localStorage.getItem('kg_tool_title_weight') || '700');

  const [visibility, setVisibility] = useState(() => {
    const saved = localStorage.getItem('kg_tool_payroll_visibility');
    return saved ? JSON.parse(saved) : {
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
    };
  });
  
  const [currencySymbol, setCurrencySymbol] = useState<'đ' | 'VNĐ' | 'none'>(() => (localStorage.getItem('kg_tool_currency_symbol') as 'đ' | 'VNĐ' | 'none') || 'đ');
  const [currencySeparator, setCurrencySeparator] = useState<'.' | ','>(() => (localStorage.getItem('kg_tool_currency_separator') as '.' | ',') || '.');
  const [roundMode, setRoundMode] = useState<'none' | 'hundred' | 'thousand'>(() => (localStorage.getItem('kg_tool_round_mode') as 'none' | 'hundred' | 'thousand') || 'thousand');
  
  const [currentEmployeeIndex, setCurrentEmployeeIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<'single' | 'list' | 'thumbnail'>(() => (localStorage.getItem('kg_tool_preview_mode') as 'single' | 'list' | 'thumbnail') || 'single');
  const [zoomLevel, setZoomLevel] = useState<string | number>(() => {
    return window.innerWidth < 768 ? 'fit' : 100;
  });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');
  const [navigatorFilter, setNavigatorFilter] = useState<'all' | 'valid' | 'invalid' | 'deduction' | 'advance'>('all');
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  
  const [printScope, setPrintScope] = useState<'current' | 'all' | 'selected'>('current');
  const [paperSize, setPaperSize] = useState<'a4' | 'k80'>('a4');

  const [thermalOptions, setThermalOptions] = useState(() => {
    const saved = localStorage.getItem('kg_tool_thermal_options');
    return saved ? JSON.parse(saved) : {
      splitEachSlip: true,
      compactCut: true,
      bottomFeedMm: 6,
      hideSignature: true,
      hideEmptyNotes: true,
      hideEmptyRows: true,
      showCutLine: false
    };
  });

  useEffect(() => {
    localStorage.setItem('kg_tool_thermal_options', JSON.stringify(thermalOptions));
  }, [thermalOptions]);

  const [containerWidth, setContainerWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [showToolbarOptions, setShowToolbarOptions] = useState(false);

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

  // Load state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('kg_tool_payroll_state');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setSalaryMode(data.salaryMode || 'monthly');
        setPayMonth(data.payMonth || '2026-06');
        setVoucherDate(data.voucherDate || '2026-06-12');
        setStandardDays(Number(data.standardDays) || 30);
        setDefaultPosition(data.defaultPosition || 'Nhân viên');
        setDefaultDept(data.defaultDept || 'Nhân sự');
        setAdvance(Number(data.advance) || 0);
        setEmployees(data.employees || []);
        setDeductions(data.deductions || []);
        setActiveTemplate(data.activeTemplate || 'standard');
      } catch (e) {
        console.error(e);
        setEmployees([]);
        setDeductions([]);
      }
    }
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
  }, [selectedFont, fontSizeTitle, fontSizeContent, fontSizeTable, titleWeight, visibility, currencySymbol, currencySeparator, roundMode, previewMode]);

  // Dynamic Google Font Injection in the Browser Head
  const getGoogleFontsImport = () => {
    return `@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Roboto:wght@400;500;700&family=Noto+Sans:wght@400;700&family=Noto+Serif:wght@400;700&family=Manrope:wght@400;500;700&family=Mulish:wght@400;700&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@400;700;800;900&display=swap');`;
  };

  useEffect(() => {
    const styleId = 'google-fonts-payroll';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = getGoogleFontsImport();
      document.head.appendChild(style);
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

  // Load sync months history list if gasUrl is set
  useEffect(() => {
    if (gasUrl) {
      fetchHistoryMonths();
    } else {
      setSyncStatus('offline');
    }
  }, [gasUrl, spreadsheetId]);

  // Round salary helper based on configuration
  const roundSalary = (n: number) => {
    if (roundMode === 'thousand') return Math.round(n / 1000) * 1000;
    if (roundMode === 'hundred') return Math.round(n / 100) * 100;
    return Math.round(n);
  };

  const getRestaurantDetails = (emp: Employee) => {
    const salary = emp.salary || 0;
    const workedDays = emp.workedDays !== undefined ? emp.workedDays : emp.days;
    const addedDays = emp.addedDays !== undefined ? emp.addedDays : 0;
    
    // Quy đổi
    const quyDoi = Math.round(salary / 240);
    
    // Lương theo giờ
    const luongTheoGio = Math.round(salary * (workedDays + addedDays) / 30);
    
    // Tiền cơm
    const tienCom = emp.lunchPay !== undefined ? emp.lunchPay : workedDays * 20000;
    
    // Thưởng
    const thuong = emp.bonus || 0;
    
    // Tăng ca
    const tangCa = emp.overtimePay || 0;
    
    // Đổ bể
    const doBe = emp.deduction || 0;

    // Tạm ứng
    const tamUng = emp.advance || 0;
    
    // Tổng nhận
    const tongNhan = luongTheoGio + tienCom + thuong + tangCa - doBe - tamUng;
    
    return {
      quyDoi,
      luongTheoGio,
      tienCom,
      thuong,
      tangCa,
      doBe,
      tamUng,
      tongNhan
    };
  };

  const updateEmployeeRestaurantField = (id: string, field: keyof Employee, value: any) => {
    setEmployees(prev => prev.map(e => {
      if (e.id === id) {
        const updatedEmp = { ...e, [field]: value };
        if (field === 'workedDays') {
          updatedEmp.days = Number(value) || 0;
        }
        const details = getRestaurantDetails(updatedEmp);
        updatedEmp.amount = details.tongNhan;
        return updatedEmp;
      }
      return e;
    }));
  };

  const importPayrollFromExcel = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const buffer = evt.target?.result as ArrayBuffer;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);
          
          const worksheet = workbook.worksheets[0];
          if (!worksheet) {
            showToast("Không tìm thấy bảng tính nào trong file Excel.", "error");
            return;
          }

          const parsedEmployees: Employee[] = [];
          const rowCount = worksheet.rowCount;
          const colCount = worksheet.columnCount;
          
          const getCellValue = (cell: any): any => {
            if (!cell) return null;
            const val = cell.value;
            if (val !== null && typeof val === 'object') {
              if ('result' in val) return val.result;
              if ('text' in val) return val.text;
            }
            return val;
          };

          const parseNumberValue = (val: any): number => {
            if (val === null || val === undefined) return 0;
            if (typeof val === 'number') return val;
            const cleaned = String(val).replace(/[^0-9.-]/g, '');
            const num = Number(cleaned);
            return isNaN(num) ? 0 : num;
          };

          // Scan all cells in the sheet to find block starters
          for (let r = 1; r <= rowCount; r++) {
            const row = worksheet.getRow(r);
            for (let c = 1; c <= colCount; c++) {
              const cellVal = getCellValue(row.getCell(c));
              if (cellVal && typeof cellVal === 'string' && cellVal.toUpperCase().includes("PHIẾU LƯƠNG NHÂN VIÊN")) {
                let name = '';
                let addedDays = 0;
                let totalHours = 0;
                let workedDays = 26;
                let salary = 0;
                let lunchPay = 0;
                let bonus = 0;
                let overtimePay = 0;
                let deduction = 0;
                let advance = 0;
                
                // Scan the block rows (up to 20 rows below the header)
                for (let br = r + 1; br <= Math.min(r + 20, rowCount); br++) {
                  const blockRow = worksheet.getRow(br);
                  const labelCell = blockRow.getCell(c);
                  const label = getCellValue(labelCell);
                  
                  if (!label || typeof label !== 'string') continue;
                  const normLabel = label.toLowerCase().trim();
                  
                  if (normLabel.includes("phiếu lương nhân viên")) {
                    break;
                  }
                  
                  const val1 = getCellValue(blockRow.getCell(c + 1));
                  const val2 = getCellValue(blockRow.getCell(c + 2));
                  const rawValue = val2 !== null && val2 !== undefined && val2 !== '' ? val2 : val1;
                  
                  if (normLabel.includes("họ và tên") || normLabel.includes("họ tên") || normLabel.includes("nhân viên")) {
                    const nameVal = val1 && typeof val1 === 'string' && val1.trim() !== '' ? val1 : val2;
                    if (nameVal) {
                      name = String(nameVal).trim();
                    }
                  } else if (normLabel.includes("ngày cộng thêm") || normLabel.includes("bù ngày")) {
                    addedDays = Math.round(parseNumberValue(rawValue));
                  } else if (normLabel.includes("tổng giờ làm") || normLabel.includes("giờ làm/tháng")) {
                    totalHours = Math.round(parseNumberValue(rawValue));
                  } else if (normLabel.includes("số ngày làm") || normLabel.includes("ngày làm/tháng")) {
                    workedDays = Math.round(parseNumberValue(rawValue));
                  } else if (normLabel.includes("mức lương") || normLabel.includes("lương hiện tại")) {
                    salary = Math.round(parseNumberValue(rawValue));
                  } else if (normLabel.includes("tiền cơm")) {
                    lunchPay = Math.round(parseNumberValue(rawValue));
                  } else if (normLabel.includes("thưởng")) {
                    bonus = Math.round(parseNumberValue(rawValue));
                  } else if (normLabel.includes("tăng ca")) {
                    overtimePay = Math.round(parseNumberValue(rawValue));
                  } else if (normLabel.includes("đổ bể") || normLabel.includes("đồ bể")) {
                    deduction += Math.round(Math.abs(parseNumberValue(rawValue)));
                  } else if (normLabel.includes("phạt")) {
                    deduction += Math.round(Math.abs(parseNumberValue(rawValue)));
                  } else if (normLabel.includes("ứng lương") || normLabel.includes("tạm ứng")) {
                    advance = Math.round(Math.abs(parseNumberValue(rawValue)));
                  }
                }
                
                if (name) {
                  const empId = Date.now().toString() + Math.random().toString(36).substr(2, 4);
                   const tempEmp: Employee = {
                    id: empId,
                    name,
                    days: workedDays,
                    workedDays,
                    addedDays,
                    totalHours,
                    salary,
                    range: `${payMonth.split('-')[1]}/${payMonth.split('-')[0]}`,
                    lunchPay,
                    bonus,
                    overtimePay,
                    deduction,
                    advance,
                    amount: 0
                  };
                  
                  const details = getRestaurantDetails(tempEmp);
                  tempEmp.amount = details.tongNhan;
                  parsedEmployees.push(tempEmp);
                }
              }
            }
          }
          
          if (parsedEmployees.length > 0) {
            setEmployees(parsedEmployees);
            setSalaryMode('restaurant');
            setSelectedEmployeeIds(new Set(parsedEmployees.map(e => e.id)));
            showToast(`Đã nạp thành công ${parsedEmployees.length} phiếu lương từ file Excel!`, "success");
          } else {
            showToast("Không tìm thấy phiếu lương hợp lệ nào theo cấu trúc Nhà hàng F&B.", "info");
          }
        } catch (err: any) {
          console.error(err);
          showToast(`Lỗi phân tích file Excel: ${err.message}`, "error");
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      showToast(`Không thể đọc file: ${error.message}`, "error");
    }
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
      if (ext !== 'xlsx' && ext !== 'xls') {
        showToast("Vui lòng kéo thả tệp Excel hợp lệ (.xlsx, .xls)", "error");
        return;
      }
      importPayrollFromExcel(file);
    }
  }, [payMonth]);

  // Recalculate employee payout amount when basic salary or days changes
  const updateEmployeeSalary = (id: string, salaryVal: string) => {
    const rawSal = onlyNumber(salaryVal);
    setEmployees(prev => prev.map(e => {
      if (e.id === id) {
        let amount = 0;
        if (salaryMode === 'restaurant') {
          const details = getRestaurantDetails({ ...e, salary: rawSal });
          amount = details.tongNhan;
        } else if (salaryMode === 'hourly') {
          amount = roundSalary(rawSal * e.days);
        } else {
          amount = roundSalary(rawSal * e.days / standardDays);
        }
        return { ...e, salary: rawSal, amount };
      }
      return e;
    }));
  };

  const updateEmployeeDays = (id: string, daysVal: number) => {
    setEmployees(prev => prev.map(e => {
      if (e.id === id) {
        let amount = 0;
        if (salaryMode === 'restaurant') {
          const details = getRestaurantDetails({ ...e, workedDays: daysVal, days: daysVal });
          amount = details.tongNhan;
        } else if (salaryMode === 'hourly') {
          amount = roundSalary(e.salary * daysVal);
        } else {
          amount = roundSalary(e.salary * daysVal / standardDays);
        }
        return { ...e, days: daysVal, workedDays: daysVal, amount };
      }
      return e;
    }));
  };

  const updateEmployeeDetails = (id: string, field: 'name' | 'range', val: string) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e));
  };

  // Trigger recalculation on all employees when global parameters change
  useEffect(() => {
    setEmployees(prev => prev.map(e => {
      let amount = 0;
      if (salaryMode === 'restaurant') {
        const details = getRestaurantDetails(e);
        amount = details.tongNhan;
      } else if (salaryMode === 'hourly') {
        amount = roundSalary(e.salary * e.days);
      } else {
        amount = roundSalary(e.salary * e.days / standardDays);
      }
      return { ...e, amount };
    }));
  }, [salaryMode, standardDays, roundMode]);

  const loadSampleData = () => {
    if (salaryMode === 'restaurant') {
      setEmployees([
        { 
          id: '1', 
          name: 'Đào Thị Thiên Thanh (TV)', 
          days: 28, 
          range: '01/06 - 30/06', 
          salary: 6500000, 
          amount: 7530000,
          addedDays: 2,
          totalHours: 244,
          workedDays: 28,
          lunchPay: 560000,
          bonus: 0,
          overtimePay: 500000,
          deduction: 30000
        },
        { 
          id: '2', 
          name: 'Quách Thị Bảo Trang (TV)', 
          days: 29, 
          range: '01/06 - 30/06', 
          salary: 6500000, 
          amount: 9033750,
          addedDays: 2,
          totalHours: 279,
          workedDays: 29,
          lunchPay: 580000,
          bonus: 600000,
          overtimePay: 1167083,
          deduction: 30000
        }
      ]);
      setDeductions([]);
      setSelectedEmployeeIds(new Set(['1', '2']));
    } else {
      setEmployees([
        { id: '1', name: 'Nguyễn Văn A', days: 26, range: '01/06 - 30/06', salary: 12000000, amount: 10400000 },
        { id: '2', name: 'Trần Thị B', days: 24, range: '01/06 - 30/06', salary: 15000000, amount: 12000000 },
        { id: '3', name: 'Lê Văn C', days: 27.5, range: '01/06 - 30/06', salary: 10500000, amount: 9625000 }
      ]);
      setDeductions([
        { id: '1', label: 'Bảo hiểm xã hội', amount: 500000 },
        { id: '2', label: 'Đồng phục', amount: 200000 }
      ]);
      setSelectedEmployeeIds(new Set(['1', '2', '3']));
    }
  };

  const addEmployee = () => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 4);
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
      const details = getRestaurantDetails({
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
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 4);
    setDeductions(prev => [...prev, { id, label: '', amount: 0 }]);
  };

  const deleteDeduction = (id: string) => {
    setDeductions(prev => prev.filter(d => d.id !== id));
  };

  const updateDeduction = (id: string, field: 'label' | 'amount', val: any) => {
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

  // CSV importer
  const triggerCsvSelect = () => {
    fileInputRef.current?.click();
  };

  const triggerExcelSelect = () => {
    excelInputRef.current?.click();
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importPayrollFromExcel(file);
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      const newEmps: Employee[] = [];
      const isHourly = salaryMode === 'hourly';

      lines.forEach((line, idx) => {
        if (idx === 0 || !line.trim()) return; // skip header
        const cols = line.includes(';') ? line.split(';') : line.split(',');
        if (cols.length < 2) return;

        const name = cols[0]?.trim();
        const days = Number(cols[1]) || 0;
        const range = cols[2]?.trim() || '';
        const salary = onlyNumber(cols[3] || (isHourly ? '35.000' : '10.000.000'));
        
        let amount = 0;
        if (isHourly) {
          amount = roundSalary(salary * days);
        } else {
          amount = roundSalary(salary * days / standardDays);
        }

        newEmps.push({
          id: Date.now().toString() + idx,
          name,
          days,
          range,
          salary,
          amount
        });
      });

      if (newEmps.length > 0) {
        setEmployees(newEmps);
        setSelectedEmployeeIds(new Set(newEmps.map(emp => emp.id)));
        showToast(`Đã nhập bulk thành công ${newEmps.length} nhân viên từ CSV!`, 'success');
      } else {
        showToast('Không đọc được dữ liệu phù hợp từ CSV. Kiểm tra lại định dạng file.', 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Google Apps Script REST API connections
  const fetchHistoryMonths = async () => {
    if (!gasUrl) return;
    setSyncStatus('loading');
    try {
      const url = `${gasUrl}?action=getMonths&ssId=${encodeURIComponent(spreadsheetId)}`;
      const res = await fetch(url);
      const result = await res.json();
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
      const result = await res.json();
      if (result.success && result.data) {
        const data = result.data;
        setSalaryMode(data.salaryMode || 'monthly');
        setPayMonth(data.payMonth || month);
        setVoucherDate(data.voucherDate || '');
        setStandardDays(Number(data.standardDays) || 30);
        setDefaultPosition(data.defaultPosition || '');
        setDefaultDept(data.defaultDept || '');
        setAdvance(Number(data.advance) || 0);
        setEmployees(data.employees || []);
        setDeductions(data.deductions || []);
        
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
      const result = await res.json();
      if (result.success) {
        showToast(`Đã xóa thành công tháng ${month}!`, 'success');
        fetchHistoryMonths();
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
      const result = await res.json();
      if (result.success) {
        showToast('Lưu phiếu lương thành công lên Google Sheets!', 'success');
        fetchHistoryMonths();
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
    let rounded = Math.round(n);
    if (roundMode === 'thousand') {
      rounded = Math.round(n / 1000) * 1000;
    } else if (roundMode === 'hundred') {
      rounded = Math.round(n / 100) * 100;
    }
    
    let formatted = rounded.toLocaleString('vi-VN');
    if (currencySeparator === ',') {
      formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    if (currencySymbol === 'đ') return `${formatted}đ`;
    if (currencySymbol === 'VNĐ') return `${formatted} VNĐ`;
    return formatted;
  };

  //Accents-agnostic search helper
  const stripAccents = (str: string): string => {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  };

  // Dynamic Validation maps
  const validationMap = useMemo(() => {
    const map: Record<string, { type: 'error' | 'warning', message: string }[]> = {};
    const totalDeduct = deductions.reduce((a, b) => a + Number(b.amount || 0), 0);
    
    employees.forEach(emp => {
      const msgs: { type: 'error' | 'warning', message: string }[] = [];
      if (!emp.name.trim()) {
        msgs.push({ type: 'error', message: 'Thiếu họ tên nhân viên' });
      }
      if (Number(emp.days || 0) <= 0) {
        msgs.push({ type: 'warning', message: 'Thiếu số công/giờ làm (bằng 0)' });
      }
      if (Number(emp.salary || 0) <= 0) {
        msgs.push({ type: 'error', message: 'Mức lương cơ bản chưa hợp lệ' });
      }
      const netAmount = salaryMode === 'restaurant'
        ? Number(emp.amount || 0)
        : Number(emp.amount || 0) - advance - totalDeduct;
      if (netAmount < 0) {
        msgs.push({ type: 'error', message: `Khấu trừ & tạm ứng vượt quá thu nhập (Thực nhận âm)` });
      }
      if (msgs.length > 0) {
        map[emp.id] = msgs;
      }
    });
    return map;
  }, [employees, deductions, advance]);

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
      if (navigatorFilter === 'deduction') return totalDeduct > 0;
      if (navigatorFilter === 'advance') return advance > 0;
      return true;
    });
  }, [employees, searchEmployeeQuery, navigatorFilter, validationMap, deductions, advance]);

  const activeEmployee = employees[currentEmployeeIndex] || employees[0];

  // Preset apply helpers
  const applyPreset = (preset: 'full' | 'compact' | 'internal' | 'k80') => {
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

  // SVG Receipt Templates
  const slipSvgStandard = (emp: Employee) => {
    if (!emp) return '';
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const isHourly = salaryMode === 'hourly';
    
    if (salaryMode === 'restaurant') {
      const details = getRestaurantDetails(emp);
      const words = numberToVietnamese(details.tongNhan);
      
      const tableRows: { label: string; val: string; isBold?: boolean }[] = [
        { label: "Ngày cộng thêm (lễ, bù ngày off)", val: String(emp.addedDays !== undefined ? emp.addedDays : 0) },
        { label: "Tổng giờ làm/tháng", val: String(emp.totalHours !== undefined ? emp.totalHours : 0) },
        { label: "Số ngày làm/tháng", val: String(emp.workedDays !== undefined ? emp.workedDays : emp.days) },
        { label: "Mức lương hiện tại", val: formatMoney(emp.salary) },
        { label: "QUY ĐỔI (LƯƠNG/GIỜ)", val: formatMoney(details.quyDoi) },
        { label: "LƯƠNG  THEO GIỜ", val: formatMoney(details.luongTheoGio) },
        { label: "TIỀN CƠM (  + )", val: formatMoney(details.tienCom) }
      ];
      if (details.thuong > 0) {
        tableRows.push({ label: "THƯỞNG ( + )", val: formatMoney(details.thuong) });
      }
      tableRows.push({ label: "TĂNG CA ( +)", val: formatMoney(details.tangCa) });
      if (details.tamUng > 0) {
        tableRows.push({ label: "TẠM ỨNG ( - )", val: `-${formatMoney(details.tamUng)}` });
      }
      tableRows.push({ label: "ĐỔ BỂ ( - )", val: details.doBe > 0 ? `-${formatMoney(details.doBe)}` : '0' });

      const rowLines = tableRows.map((r, i) => {
        const y = 542 + i * 45;
        return `
          <line x1="45" y1="${y - 32}" x2="955" y2="${y - 32}" stroke="${THEMES.blue}" stroke-width="1"/>
          <text x="92" y="${y - 10}" text-anchor="middle" class="table-cell">${i + 1}</text>
          <text x="165" y="${y - 10}" class="table-cell">${escapeHtml(r.label)}</text>
          <text x="928" y="${y - 10}" text-anchor="end" class="table-cell-bold">${escapeHtml(r.val)}</text>
        `;
      }).join('');

      const tableHeight = 78 + tableRows.length * 45;
      const tableBottom = 420 + tableHeight;

      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" role="img" aria-label="Standard Slip">
        <rect x="16" y="16" width="968" height="1368" rx="0" fill="#fff" stroke="${THEMES.blue}" stroke-width="4"/>
        <rect x="26" y="26" width="948" height="1348" rx="0" fill="none" stroke="${THEMES.blue}" stroke-width="2" opacity=".9"/>
        
        <style>
          ${getGoogleFontsImport()}
          .title-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTitle}px; font-weight: ${titleWeight}; fill: ${THEMES.blue}; text-anchor: middle; }
          .sub-title-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent + 4}px; font-weight: 700; fill: ${THEMES.blue}; text-anchor: middle; }
          .normal-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent}px; fill: #0f172a; }
          .bold-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent}px; font-weight: 700; fill: #0f172a; }
          .table-header { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTable}px; font-weight: 700; fill: ${THEMES.blue}; text-anchor: middle; }
          .table-cell { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTable}px; fill: #334155; }
          .table-cell-bold { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTable}px; font-weight: 700; fill: #0f172a; }
          .total-pay-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent + 6}px; font-weight: 900; fill: ${THEMES.red}; text-anchor: end; }
        </style>
        
        ${visibility.showUnitInfo ? `
          <text x="70" y="85" class="bold-text">NHÀ HÀNG KINGS GRILL</text>
          <text x="70" y="105" class="normal-text" style="font-size: ${fontSizeContent - 2}px; fill: #64748b;">Số 40 Nguyễn Thị Minh Khai, Quận 1, TP. HCM</text>
        ` : ''}
        
        ${visibility.showTitle ? `
          <text x="500" y="150" class="title-text">PHIẾU LƯƠNG NHÂN VIÊN</text>
        ` : ''}
        
        ${visibility.showMetaInfo ? `
          <text x="500" y="195" class="sub-title-text">${mLabel}</text>
        ` : ''}
  
        ${visibility.showEmpName ? `
          <text x="70" y="270" class="bold-text">Họ và tên</text>
          <text x="245" y="270" class="bold-text">:</text>
          <text x="285" y="270" class="normal-text" style="font-size: ${fontSizeContent + 2}px; font-weight: 600;">${escapeHtml(emp.name)}</text>
        ` : ''}
        
        ${visibility.showEmpRole ? `
          <text x="70" y="320" class="bold-text">Chức vụ</text>
          <text x="245" y="320" class="bold-text">:</text>
          <text x="285" y="320" class="normal-text">${escapeHtml(defaultPosition)}</text>
        ` : ''}
        
        ${visibility.showEmpDept ? `
          <text x="70" y="370" class="bold-text">Bộ phận</text>
          <text x="245" y="370" class="bold-text">:</text>
          <text x="285" y="370" class="normal-text">${escapeHtml(defaultDept)}</text>
        ` : ''}
  
        <rect x="45" y="420" width="910" height="${tableHeight}" fill="#fff" stroke="${THEMES.blue}" stroke-width="2"/>
        <rect x="45" y="420" width="910" height="76" fill="${THEMES.lightBlue}" opacity=".75"/>
        <line x1="140" y1="420" x2="140" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
        <line x1="770" y1="420" x2="770" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
        
        <text x="92" y="468" class="table-header">STT</text>
        <text x="455" y="468" class="table-header">NỘI DUNG THANH TOÁN</text>
        <text x="862" y="468" class="table-header">SỐ TIỀN</text>
  
        ${rowLines}
  
        <rect x="45" y="${tableBottom + 30}" width="910" height="108" fill="${THEMES.lightBlue}" opacity=".8" stroke="${THEMES.blue}" stroke-width="2"/>
        <line x1="690" y1="${tableBottom + 30}" x2="690" y2="${tableBottom + 138}" stroke="${THEMES.blue}" stroke-width="2"/>
        <text x="70" y="${tableBottom + 95}" font-family="'${selectedFont}', sans-serif" font-size="28" font-weight="900" fill="${THEMES.blue}">TỔNG TIỀN THỰC NHẬN</text>
        <text x="930" y="${tableBottom + 98}" class="total-pay-text">${formatMoney(details.tongNhan)}</text>
        
        ${visibility.showNotes ? `
          <text x="500" y="${tableBottom + 180}" text-anchor="middle" class="normal-text" style="font-size: ${fontSizeContent - 1}px; font-style: italic; fill: #64748b;">(Bằng chữ: ${escapeHtml(words)})</text>
        ` : ''}
        
        <text x="70" y="${tableBottom + 250}" class="normal-text" style="fill: #64748b;">${escapeHtml(vDate)}</text>
        
        ${visibility.showSignatures ? `
          <text x="250" y="${tableBottom + 290}" text-anchor="middle" class="bold-text" style="font-size: ${fontSizeContent + 2}px;">Người nhận lương</text>
          <text x="250" y="${tableBottom + 315}" text-anchor="middle" class="normal-text" style="font-size: ${fontSizeContent - 2}px; font-style: italic; fill: #64748b;">(Ký và ghi rõ họ tên)</text>
          
          <text x="750" y="${tableBottom + 290}" text-anchor="middle" class="bold-text" style="font-size: ${fontSizeContent + 2}px;">Người lập phiếu</text>
          <text x="750" y="${tableBottom + 315}" text-anchor="middle" class="normal-text" style="font-size: ${fontSizeContent - 2}px; font-style: italic; fill: #64748b;">(Ký và ghi rõ họ tên)</text>
        ` : ''}
      </svg>`;
    }

    const infoDays = isHourly ? (emp.range ? `${emp.days} giờ (${emp.range})` : `${emp.days} giờ`) : (emp.range ? `${emp.days} công (${emp.range})` : `${emp.days} công`);
    const words = numberToVietnamese(emp.amount);
    
    const row1Label = isHourly ? "Lương cơ bản theo giờ" : "Mức lương cơ bản";
    const row1Val = isHourly ? `${formatMoney(emp.salary)} / giờ` : `${formatMoney(emp.salary)}`;
    const row2Label = isHourly ? "Tổng số giờ làm việc" : "Số công định mức";
    const row2Val = isHourly ? `${emp.days} giờ` : `${standardDays} công`;
    const row3Label = isHourly ? "Thời gian làm việc" : "Số công thực tế";
    const row3Val = infoDays;
    const row4Label = isHourly ? "Hệ số hoàn thành" : "Hệ số tính lương";
    const row4Val = isHourly ? "1.00" : `${emp.days} / ${standardDays}`;
    const row5Label = isHourly ? "Tiền lương thực nhận" : "Lương thực nhận";
    const row5Formula = isHourly ? `${formatMoney(emp.salary)} × ${emp.days} giờ` : `${formatMoney(emp.salary)} × ${emp.days}/${standardDays}`;
    
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" role="img" aria-label="Standard Slip">
      <rect x="16" y="16" width="968" height="1368" rx="0" fill="#fff" stroke="${THEMES.blue}" stroke-width="4"/>
      <rect x="26" y="26" width="948" height="1348" rx="0" fill="none" stroke="${THEMES.blue}" stroke-width="2" opacity=".9"/>
      
      <style>
        ${getGoogleFontsImport()}
        .title-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTitle}px; font-weight: ${titleWeight}; fill: ${THEMES.blue}; text-anchor: middle; }
        .sub-title-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent + 4}px; font-weight: 700; fill: ${THEMES.blue}; text-anchor: middle; }
        .normal-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent}px; fill: #0f172a; }
        .bold-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent}px; font-weight: 700; fill: #0f172a; }
        .table-header { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTable}px; font-weight: 700; fill: ${THEMES.blue}; text-anchor: middle; }
        .table-cell { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTable}px; fill: #334155; }
        .table-cell-bold { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTable}px; font-weight: 700; fill: #0f172a; }
        .total-pay-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent + 6}px; font-weight: 900; fill: ${THEMES.red}; text-anchor: end; }
      </style>
      
      ${visibility.showUnitInfo ? `
        <text x="70" y="85" class="bold-text">NHÀ HÀNG KINGS GRILL</text>
        <text x="70" y="105" class="normal-text" style="font-size: ${fontSizeContent - 2}px; fill: #64748b;">Số 40 Nguyễn Thị Minh Khai, Quận 1, TP. HCM</text>
      ` : ''}
      
      ${visibility.showTitle ? `
        <text x="500" y="150" class="title-text">PHIẾU LƯƠNG NHÂN VIÊN</text>
      ` : ''}
      
      ${visibility.showMetaInfo ? `
        <text x="500" y="195" class="sub-title-text">${mLabel}</text>
      ` : ''}

      ${visibility.showEmpName ? `
        <text x="70" y="270" class="bold-text">Họ và tên</text>
        <text x="245" y="270" class="bold-text">:</text>
        <text x="285" y="270" class="normal-text" style="font-size: ${fontSizeContent + 2}px; font-weight: 600;">${escapeHtml(emp.name)}</text>
      ` : ''}
      
      ${visibility.showEmpRole ? `
        <text x="70" y="320" class="bold-text">Chức vụ</text>
        <text x="245" y="320" class="bold-text">:</text>
        <text x="285" y="320" class="normal-text">${escapeHtml(defaultPosition)}</text>
      ` : ''}
      
      ${visibility.showEmpDept ? `
        <text x="70" y="370" class="bold-text">Bộ phận</text>
        <text x="245" y="370" class="bold-text">:</text>
        <text x="285" y="370" class="normal-text">${escapeHtml(defaultDept)}</text>
      ` : ''}

      <rect x="45" y="420" width="910" height="510" fill="#fff" stroke="${THEMES.blue}" stroke-width="2"/>
      <rect x="45" y="420" width="910" height="76" fill="${THEMES.lightBlue}" opacity=".75"/>
      <line x1="140" y1="420" x2="140" y2="930" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="455" y1="420" x2="455" y2="930" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="770" y1="420" x2="770" y2="930" stroke="${THEMES.blue}" stroke-width="2"/>
      
      ${[496, 577, 658, 739, 820, 930].map(y => `<line x1="45" y1="${y}" x2="955" y2="${y}" stroke="${THEMES.blue}" stroke-width="2"/>`).join('')}
      
      <text x="92" y="468" class="table-header">STT</text>
      <text x="300" y="468" class="table-header">NỘI DUNG THANH TOÁN</text>
      <text x="612" y="468" class="table-header">THÔNG TIN</text>
      <text x="862" y="468" class="table-header">SỐ TIỀN</text>

      ${[1, 2, 3, 4, 5].map((n, i) => `<text x="92" y="${542 + i * 81}" text-anchor="middle" class="table-cell">${n}</text>`).join('')}
      
      <text x="165" y="542" class="table-cell">${row1Label}</text>
      <text x="928" y="542" text-anchor="end" class="table-cell">${visibility.showBaseSalary ? row1Val : '***'}</text>
      
      <text x="165" y="623" class="table-cell">${row2Label}</text>
      <text x="505" y="623" class="table-cell">${row2Val}</text>
      
      <text x="165" y="704" class="table-cell">${row3Label}</text>
      <text x="505" y="704" class="table-cell">${escapeHtml(row3Val)}</text>
      
      <text x="165" y="785" class="table-cell">${row4Label}</text>
      <text x="505" y="785" class="table-cell">${row4Val}</text>
      
      <text x="165" y="866" class="table-cell-bold">${row5Label}</text>
      <text x="505" y="866" class="table-cell">${row5Formula}</text>
      <text x="928" y="866" text-anchor="end" class="table-cell-bold">${formatMoney(emp.amount)}</text>

      <rect x="45" y="960" width="910" height="108" fill="${THEMES.lightBlue}" opacity=".8" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="690" y1="960" x2="690" y2="1068" stroke="${THEMES.blue}" stroke-width="2"/>
      <text x="70" y="1025" font-family="'${selectedFont}', sans-serif" font-size="28" font-weight="900" fill="${THEMES.blue}">TỔNG TIỀN THỰC NHẬN</text>
      <text x="930" y="1028" class="total-pay-text">${formatMoney(emp.amount)}</text>
      
      ${visibility.showNotes ? `
        <text x="500" y="1120" text-anchor="middle" class="normal-text" style="font-size: ${fontSizeContent - 1}px; font-style: italic; fill: #64748b;">(Bằng chữ: ${escapeHtml(words)})</text>
      ` : ''}
      
      <text x="70" y="1215" class="normal-text" style="fill: #64748b;">${escapeHtml(vDate)}</text>
      
      ${visibility.showSignatures ? `
        <text x="250" y="1260" text-anchor="middle" class="bold-text" style="font-size: ${fontSizeContent + 2}px;">Người nhận lương</text>
        <text x="250" y="1285" text-anchor="middle" class="normal-text" style="font-size: ${fontSizeContent - 2}px; font-style: italic; fill: #64748b;">(Ký và ghi rõ họ tên)</text>
        
        <text x="750" y="1260" text-anchor="middle" class="bold-text" style="font-size: ${fontSizeContent + 2}px;">Người lập phiếu</text>
        <text x="750" y="1285" text-anchor="middle" class="normal-text" style="font-size: ${fontSizeContent - 2}px; font-style: italic; fill: #64748b;">(Ký và ghi rõ họ tên)</text>
      ` : ''}
    </svg>`;
  };

  const summarySvgStandard = () => {
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const totalDays = employees.reduce((a, b) => a + Number(b.days || 0), 0);
    const totalSalary = employees.reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalDeduct = deductions.reduce((a, b) => a + Number(b.amount || 0), 0);
    const net = totalSalary - advance - totalDeduct;
    const words = numberToVietnamese(net);
    const isHourly = salaryMode === 'hourly';

    const rows = employees.slice(0, 15).map((e, i) => {
      const y = 382 + i * 66;
      return `
        <text x="75" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="20">${i + 1}</text>
        <text x="125" y="${y}" font-family="'${selectedFont}', sans-serif" font-size="20">${escapeHtml(e.name)}</text>
        <text x="462" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="20">${e.days}${isHourly ? 'g' : ''}</text>
        <text x="590" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18">${escapeHtml(e.range || '-')}</text>
        <text x="738" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18">${formatMoney(e.salary)}</text>
        <text x="890" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="18">${formatMoney(e.amount)}</text>`;
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
      
      <style>
        ${getGoogleFontsImport()}
      </style>

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
    const isHourly = salaryMode === 'hourly';

    if (salaryMode === 'restaurant') {
      const details = getRestaurantDetails(emp);
      const elements: string[] = [];
      let currentY = 10;

      // Header Banner
      elements.push(`
        <rect x="10" y="${currentY}" width="300" height="35" fill="#3b82f6" rx="4"/>
        <text x="160" y="${currentY + 22}" font-family="'${selectedFont}', sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">PHIẾU LƯƠNG NHÂN VIÊN</text>
      `);
      currentY += 45;

      // Employee Info Row
      elements.push(`
        <text x="10" y="${currentY + 12}" font-family="'${selectedFont}', sans-serif" font-size="11.5" font-weight="bold" fill="#000000">Họ và tên nhân viên:</text>
        <text x="310" y="${currentY + 12}" font-family="'${selectedFont}', sans-serif" font-size="11.5" font-weight="bold" fill="#dc2626" text-anchor="end">${escapeHtml(emp.name)}</text>
      `);
      currentY += 22;

      // Dashed Line
      elements.push(`
        <line x1="10" y1="${currentY}" x2="310" y2="${currentY}" stroke="#000000" stroke-width="1" stroke-dasharray="4, 3" />
      `);
      currentY += 10;

      // Table Rows
      const tableRows: { label: string; val: string; isBold?: boolean }[] = [
        { label: "Ngày cộng thêm (lễ, bù ngày off)", val: String(emp.addedDays !== undefined ? emp.addedDays : 0) },
        { label: "Tổng giờ làm/tháng", val: String(emp.totalHours !== undefined ? emp.totalHours : 0) },
        { label: "Số ngày làm/tháng", val: String(emp.workedDays !== undefined ? emp.workedDays : emp.days) },
        { label: "Mức lương hiện tại", val: formatMoney(emp.salary) },
        { label: "QUY ĐỔI (LƯƠNG/GIỜ)", val: formatMoney(details.quyDoi) },
        { label: "LƯƠNG  THEO GIỜ", val: formatMoney(details.luongTheoGio) },
        { label: "TIỀN CƠM (  + )", val: formatMoney(details.tienCom) }
      ];

      // Add optional THƯỞNG
      if (details.thuong > 0) {
        tableRows.push({ label: "THƯỞNG ( + )", val: formatMoney(details.thuong) });
      }

      // Add TĂNG CA, ĐỔ BỂ, TỔNG NHẬN
      tableRows.push({ label: "TĂNG CA ( +)", val: formatMoney(details.tangCa) });
      if (details.tamUng > 0) {
        tableRows.push({ label: "TẠM ỨNG ( - )", val: `-${formatMoney(details.tamUng)}` });
      }
      tableRows.push({ label: "ĐỔ BỂ ( - )", val: details.doBe > 0 ? `-${formatMoney(details.doBe)}` : '0' });
      tableRows.push({ label: "TỔNG NHẬN", val: formatMoney(details.tongNhan), isBold: true });

      const tableStartY = currentY;
      const rowHeight = 25;
      
      tableRows.forEach((r, idx) => {
        const rowY = tableStartY + idx * rowHeight;
        
        // top line of cell
        elements.push(`<line x1="10" y1="${rowY}" x2="310" y2="${rowY}" stroke="#000000" stroke-width="0.8" />`);
        
        // Label
        const fontW = r.isBold ? "bold" : "normal";
        const textCol = r.isBold ? "#000000" : "#334155";
        elements.push(`
          <text x="16" y="${rowY + 16}" font-family="'${selectedFont}', sans-serif" font-size="10.5" font-weight="${fontW}" fill="${textCol}">${escapeHtml(r.label)}</text>
        `);
        
        // Value
        elements.push(`
          <text x="304" y="${rowY + 16}" font-family="'${selectedFont}', sans-serif" font-size="11" font-weight="${fontW}" fill="#000000" text-anchor="end">${escapeHtml(r.val)}</text>
        `);
      });

      const tableEndY = tableStartY + tableRows.length * rowHeight;
      // bottom line of table
      elements.push(`<line x1="10" y1="${tableEndY}" x2="310" y2="${tableEndY}" stroke="#000000" stroke-width="0.8" />`);

      // Vertical lines
      elements.push(`<line x1="10" y1="${tableStartY}" x2="10" y2="${tableEndY}" stroke="#000000" stroke-width="0.8" />`);
      elements.push(`<line x1="235" y1="${tableStartY}" x2="235" y2="${tableEndY}" stroke="#000000" stroke-width="0.8" />`);
      elements.push(`<line x1="310" y1="${tableStartY}" x2="310" y2="${tableEndY}" stroke="#000000" stroke-width="0.8" />`);

      currentY = tableEndY + 15;

      // Optional signatures/notes
      const wordsText = numberToVietnamese(details.tongNhan);
      const hasNotes = visibility.showNotes && (!thermalOptions.hideEmptyNotes || wordsText.trim().length > 0);
      if (hasNotes) {
        elements.push(`
          <text x="10" y="${currentY + 10}" font-family="'${selectedFont}', sans-serif" font-size="10" font-style="italic" fill="#000000">Bằng chữ:</text>
          <rect x="10" y="${currentY + 18}" width="300" height="38" fill="#f8fafc" rx="4" stroke="#e2e8f0" stroke-width="1"/>
          <text x="15" y="${currentY + 31}" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#475569">
            ${escapeHtml(wordsText.substring(0, 48))}
          </text>
          <text x="15" y="${currentY + 44}" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#475569">
            ${escapeHtml(wordsText.substring(48))}
          </text>
        `);
        currentY += 65;
      }

      const showSignatures = visibility.showSignatures && !thermalOptions.hideSignature;
      if (showSignatures) {
        elements.push(`
          <text x="160" y="${currentY + 12}" text-anchor="middle" font-size="9.5" font-family="'${selectedFont}', sans-serif" fill="#64748b">${escapeHtml(vDate)}</text>
          
          <text x="80" y="${currentY + 32}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="10.5" font-weight="bold" fill="#000">Người nhận</text>
          <text x="80" y="${currentY + 45}" text-anchor="middle" font-size="9" font-style="italic" fill="#64748b">(Ký tên)</text>
          
          <text x="240" y="${currentY + 32}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="10.5" font-weight="bold" fill="#000">Người lập</text>
          <text x="240" y="${currentY + 45}" text-anchor="middle" font-size="9" font-style="italic" fill="#64748b">(Ký tên)</text>
        `);
        currentY += 65;
      } else if (visibility.showSignatures && thermalOptions.hideSignature) {
        elements.push(`
          <text x="10" y="${currentY + 12}" font-family="'${selectedFont}', sans-serif" font-size="11" font-weight="bold" fill="#000">Người nhận: ________________________</text>
        `);
        currentY += 22;
      }

      // Cut line
      if (thermalOptions.showCutLine) {
        elements.push(`
          <line x1="10" y1="${currentY + 8}" x2="310" y2="${currentY + 8}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="8, 5" />
          <text x="160" y="${currentY + 20}" font-size="8.5" font-family="sans-serif" fill="#94a3b8" text-anchor="middle">✂--- Đường cắt ---✂</text>
        `);
        currentY += 28;
      }

      currentY += (thermalOptions.bottomFeedMm || 6) * 4;

      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 ${currentY}" fill="none" role="img" aria-label="Phiếu lương ${escapeHtml(emp.name)}">
        <rect width="320" height="${currentY}" fill="#fff"/>
        <style>
          ${getGoogleFontsImport()}
        </style>
        ${elements.join('\n')}
      </svg>`;
    }

    const infoDays = isHourly ? (emp.range ? `${emp.days} giờ (${emp.range})` : `${emp.days} giờ`) : (emp.range ? `${emp.days} công (${emp.range})` : `${emp.days} công`);
    
    const row1Label = isHourly ? "Lương giờ (đ)" : "Mức lương cơ bản";
    const row2Label = isHourly ? "Tổng số giờ" : "Công định mức / Thực tế";
    const row2Val = isHourly ? `${emp.days} giờ` : `${standardDays} / ${infoDays}`;
    const row3Label = isHourly ? "Công thức tính" : "Hệ số tính lương";
    const row3Val = isHourly ? "Lương giờ × Số giờ" : `${emp.days}/${standardDays}`;

    // Dynamic Y calculation
    let currentY = 15;
    const elements: string[] = [];

    // Header Title
    elements.push(`<text x="160" y="${currentY + 15}" class="k80-title">PHIẾU LƯƠNG</text>`);
    currentY += 20;

    elements.push(`<text x="160" y="${currentY + 15}" class="k80-subtitle">${mLabel}</text>`);
    currentY += 25;

    // Divider
    elements.push(`<line x1="15" y1="${currentY}" x2="305" y2="${currentY}" class="k80-divider" />`);
    currentY += 10;

    // Employee details
    let hasEmpInfo = false;
    if (visibility.showEmpName) {
      elements.push(`
        <text x="20" y="${currentY + 12}" class="k80-bold">Họ và tên:</text>
        <text x="110" y="${currentY + 12}" class="k80-text">${escapeHtml(emp.name)}</text>
      `);
      currentY += 20;
      hasEmpInfo = true;
    }
    
    if (visibility.showEmpRole) {
      elements.push(`
        <text x="20" y="${currentY + 12}" class="k80-bold">Chức vụ:</text>
        <text x="110" y="${currentY + 12}" class="k80-text">${escapeHtml(defaultPosition)}</text>
      `);
      currentY += 20;
      hasEmpInfo = true;
    }
    
    if (visibility.showEmpDept) {
      elements.push(`
        <text x="20" y="${currentY + 12}" class="k80-bold">Bộ phận:</text>
        <text x="110" y="${currentY + 12}" class="k80-text">${escapeHtml(defaultDept)}</text>
      `);
      currentY += 20;
      hasEmpInfo = true;
    }

    if (hasEmpInfo) {
      // Divider after employee info
      elements.push(`<line x1="15" y1="${currentY + 5}" x2="305" y2="${currentY + 5}" class="k80-divider" />`);
      currentY += 15;
    }

    // Salary rows
    if (!thermalOptions.hideEmptyRows || visibility.showBaseSalary) {
      elements.push(`
        <text x="20" y="${currentY + 12}" class="k80-text">${row1Label}</text>
        <text x="300" y="${currentY + 12}" text-anchor="end" class="k80-text">${visibility.showBaseSalary ? formatMoney(emp.salary) : '***'}</text>
      `);
      currentY += 25;
    }

    elements.push(`
      <text x="20" y="${currentY + 12}" class="k80-text">${row2Label}</text>
      <text x="300" y="${currentY + 12}" text-anchor="end" class="k80-text">${row2Val}</text>
    `);
    currentY += 25;

    elements.push(`
      <text x="20" y="${currentY + 12}" class="k80-text">${row3Label}</text>
      <text x="300" y="${currentY + 12}" text-anchor="end" class="k80-text">${row3Val}</text>
    `);
    currentY += 25;

    // Advance payment
    const empAdvance = emp.advance !== undefined ? emp.advance : advance;
    if (empAdvance > 0 || !thermalOptions.hideEmptyRows) {
      elements.push(`
        <text x="20" y="${currentY + 12}" class="k80-text">Tạm ứng lương</text>
        <text x="300" y="${currentY + 12}" text-anchor="end" class="k80-text" fill="#dc2626">-${formatMoney(empAdvance)}</text>
      `);
      currentY += 25;
    }

    // Deductions
    const totalDeduct = deductions.reduce((sum, d) => sum + d.amount, 0);
    if (totalDeduct > 0 || !thermalOptions.hideEmptyRows) {
      deductions.forEach(d => {
        if (d.amount > 0 || !thermalOptions.hideEmptyRows) {
          elements.push(`
            <text x="20" y="${currentY + 12}" class="k80-text">${escapeHtml(d.label)}</text>
            <text x="300" y="${currentY + 12}" text-anchor="end" class="k80-text" fill="#dc2626">-${formatMoney(d.amount)}</text>
          `);
          currentY += 20;
        }
      });
    }

    // Divider before total
    elements.push(`<line x1="15" y1="${currentY + 5}" x2="305" y2="${currentY + 5}" class="k80-divider" />`);
    currentY += 15;

    // Net total
    elements.push(`
      <text x="20" y="${currentY + 15}" class="k80-total">TỔNG THỰC NHẬN</text>
      <text x="300" y="${currentY + 18}" class="k80-price">${formatMoney(emp.amount)}</text>
    `);
    currentY += 30;

    // Notes
    const wordsText = numberToVietnamese(emp.amount);
    const hasNotes = visibility.showNotes && (!thermalOptions.hideEmptyNotes || wordsText.trim().length > 0);
    if (hasNotes) {
      elements.push(`
        <text x="20" y="${currentY + 10}" class="k80-text" font-style="italic">Bằng chữ:</text>
        <rect x="20" y="${currentY + 20}" width="280" height="40" fill="#f8fafc" rx="4" stroke="#e2e8f0" stroke-width="1"/>
        <text x="25" y="${currentY + 36}" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#475569" width="270">
          ${escapeHtml(wordsText.substring(0, 48))}
        </text>
        <text x="25" y="${currentY + 50}" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#475569" width="270">
          ${escapeHtml(wordsText.substring(48))}
        </text>
      `);
      currentY += 70;
    }

    // Signatures
    const showSignatures = visibility.showSignatures && !thermalOptions.hideSignature;
    if (showSignatures) {
      elements.push(`
        <text x="160" y="${currentY + 15}" text-anchor="middle" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#64748b">${escapeHtml(vDate)}</text>
        
        <text x="80" y="${currentY + 40}" text-anchor="middle" class="k80-bold">Người nhận</text>
        <text x="80" y="${currentY + 55}" text-anchor="middle" font-size="9" font-style="italic" fill="#64748b">(Ký tên)</text>
        
        <text x="240" y="${currentY + 40}" text-anchor="middle" class="k80-bold">Người lập</text>
        <text x="240" y="${currentY + 55}" text-anchor="middle" font-size="9" font-style="italic" fill="#64748b">(Ký tên)</text>
      `);
      currentY += 75;
    } else if (visibility.showSignatures && thermalOptions.hideSignature) {
      elements.push(`
        <text x="20" y="${currentY + 15}" class="k80-bold">Người nhận: ________________________</text>
      `);
      currentY += 25;
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 ${currentY}" fill="none" role="img" aria-label="Phiếu lương ${escapeHtml(emp.name)}">
      <rect width="320" height="${currentY}" fill="#fff"/>
      <style>
        ${getGoogleFontsImport()}
        .k80-text-base { font-family: '${selectedFont}', system-ui, sans-serif; }
        .k80-title { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTitle - 8}px; font-weight: ${titleWeight}; fill: #000; text-anchor: middle; }
        .k80-subtitle { font-family: '${selectedFont}', system-ui, sans-serif; font-size: 10px; fill: #000; text-anchor: middle; }
        .k80-text { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent - 2}px; fill: #000; }
        .k80-bold { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent - 2}px; font-weight: bold; fill: #000; }
        .k80-total { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent}px; font-weight: bold; fill: #000; }
        .k80-price { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeContent + 2}px; font-weight: bold; fill: #dc2626; text-anchor: end; }
        .k80-divider { stroke: #000; stroke-width: 1; stroke-dasharray: 4, 3; }
      </style>
      
      ${elements.join('\n')}
    </svg>`;
  };

  const summarySvgK80 = () => {
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const totalDays = employees.reduce((a, b) => a + Number(b.days || 0), 0);
    const totalSalary = employees.reduce((a, b) => a + Number(b.amount || 0), 0);
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
      elements.push(`
        <text x="20" y="${currentY + 10}" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#000">${i + 1}. ${escapeHtml(e.name.substring(0, 16))}</text>
        <text x="175" y="${currentY + 10}" font-size="9" font-family="'${selectedFont}', sans-serif" text-anchor="middle" fill="#000">${e.days}${isHourly ? 'g' : ''}</text>
        <text x="300" y="${currentY + 10}" font-size="9" font-family="'${selectedFont}', sans-serif" text-anchor="end" fill="#000">${formatMoney(e.amount)}</text>
      `);
      currentY += 22;
    });

    // Divider after table
    elements.push(`<line x1="15" y1="${currentY}" class="k80-divider" />`);
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
    elements.push(`<line x1="15" y1="${currentY + 5}" class="k80-divider" />`);
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
        ${getGoogleFontsImport()}
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
    const isHourly = salaryMode === 'hourly';

    if (salaryMode === 'restaurant') {
      const details = getRestaurantDetails(emp);
      const words = numberToVietnamese(details.tongNhan);

      const tableRows: { label: string; val: string; isBold?: boolean }[] = [
        { label: "Ngày cộng thêm (lễ, bù ngày off)", val: String(emp.addedDays !== undefined ? emp.addedDays : 0) },
        { label: "Tổng giờ làm/tháng", val: String(emp.totalHours !== undefined ? emp.totalHours : 0) },
        { label: "Số ngày làm/tháng", val: String(emp.workedDays !== undefined ? emp.workedDays : emp.days) },
        { label: "Mức lương hiện tại", val: formatMoney(emp.salary) },
        { label: "QUY ĐỔI (LƯƠNG/GIỜ)", val: formatMoney(details.quyDoi) },
        { label: "LƯƠNG  THEO GIỜ", val: formatMoney(details.luongTheoGio) },
        { label: "TIỀN CƠM (  + )", val: formatMoney(details.tienCom) }
      ];
      if (details.thuong > 0) {
        tableRows.push({ label: "THƯỞNG ( + )", val: formatMoney(details.thuong) });
      }
      tableRows.push({ label: "TĂNG CA ( +)", val: formatMoney(details.tangCa) });
      if (details.tamUng > 0) {
        tableRows.push({ label: "TẠM ỨNG ( - )", val: `-${formatMoney(details.tamUng)}` });
      }
      tableRows.push({ label: "ĐỔ BỂ ( - )", val: details.doBe > 0 ? `-${formatMoney(details.doBe)}` : '0' });

      const rowLines = tableRows.map((r, i) => {
        const y = 465 + i * 50;
        return `
          <text x="90" y="${y}" class="modern-text" font-size="${fontSizeTable}" font-weight="600" fill="#475569">${escapeHtml(r.label)}</text>
          <text x="910" y="${y}" text-anchor="end" class="modern-text" font-size="${fontSizeTable + 2}" font-weight="700" fill="#0f172a">${escapeHtml(r.val)}</text>
          <line x1="60" y1="${y + 25}" x2="940" y2="${y + 25}" stroke="#f1f5f9" stroke-width="1"/>
        `;
      }).join('');

      const listHeight = 50 + tableRows.length * 50;
      const boxHeight = listHeight - 15;
      const totalBoxY = 415 + boxHeight + 45;

      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${totalBoxY + 500}" role="img" aria-label="Modern Payroll Slip">
        <defs>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1e3a8a" />
            <stop offset="100%" stop-color="#3b82f6" />
          </linearGradient>
          <linearGradient id="headerGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#eff6ff" />
            <stop offset="100%" stop-color="#ffffff" />
          </linearGradient>
        </defs>
        
        <style>
          ${getGoogleFontsImport()}
          .modern-text { font-family: '${selectedFont}', system-ui, sans-serif; }
        </style>
        
        <rect x="0" y="0" width="1000" height="${totalBoxY + 450}" fill="#f8fafc"/>
        <rect x="25" y="25" width="950" height="${totalBoxY + 400}" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
        
        <path d="M25 45 C 25 35, 35 25, 45 25 L 955 25 C 965 25, 975 35, 975 45 L 975 140 L 25 140 Z" fill="url(#blueGrad)"/>
        <text x="75" y="85" class="modern-text" font-size="${fontSizeTitle}" font-weight="${titleWeight}" fill="#ffffff">PHIẾU CHI LƯƠNG CHI TIẾT</text>
        <text x="75" y="115" class="modern-text" font-size="16" font-weight="600" fill="#93c5fd" letter-spacing="1">${mLabel.toUpperCase()}</text>
        
        ${visibility.showUnitInfo ? `
          <rect x="730" y="55" width="195" height="50" rx="8" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
          <text x="827" y="85" text-anchor="middle" class="modern-text" font-size="11" font-weight="700" fill="#ffffff">KINGS GRILL OFFICE</text>
        ` : ''}
        
        <rect x="60" y="180" width="880" height="150" rx="12" fill="url(#headerGrad)" stroke="#dbeafe" stroke-width="1"/>
        
        ${visibility.showEmpName ? `
          <text x="90" y="225" class="modern-text" font-size="14" font-weight="700" fill="#64748b">HỌ VÀ TÊN NHÂN VIÊN</text>
          <text x="90" y="260" class="modern-text" font-size="28" font-weight="800" fill="#0f172a">${escapeHtml(emp.name)}</text>
        ` : ''}
        
        ${visibility.showEmpRole ? `
          <text x="90" y="295" class="modern-text" font-size="15" font-weight="600" fill="#2563eb">${escapeHtml(defaultPosition)}</text>
        ` : ''}
        
        ${visibility.showEmpDept ? `
          <text x="600" y="225" class="modern-text" font-size="14" font-weight="700" fill="#64748b">PHÒNG BAN/BỘ PHẬN</text>
          <text x="600" y="260" class="modern-text" font-size="24" font-weight="700" fill="#0f172a">${escapeHtml(defaultDept)}</text>
        ` : ''}
        
        <text x="90" y="390" class="modern-text" font-size="20" font-weight="800" fill="#1e3a8a">DANH SÁCH CHI TIẾT TÍNH LƯƠNG</text>
        
        <rect x="60" y="415" width="880" height="${boxHeight}" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
        
        ${rowLines}
        
        <rect x="60" y="${totalBoxY}" width="880" height="150" rx="16" fill="#eff6ff" stroke="#bfdbfe" stroke-width="2"/>
        <text x="100" y="${totalBoxY + 60}" class="modern-text" font-size="18" font-weight="800" fill="#1e3a8a">THANH TOÁN THỰC NHẬN CHUYỂN KHOẢN</text>
        
        ${visibility.showNotes ? `
          <text x="100" y="${totalBoxY + 90}" class="modern-text" font-size="15" font-weight="600" fill="#64748b" font-style="italic">Bằng chữ: ${escapeHtml(words)}</text>
        ` : ''}
        <text x="900" y="${totalBoxY + 85}" text-anchor="end" class="modern-text" font-size="44" font-weight="900" fill="#dc2626">${formatMoney(details.tongNhan)}</text>
        
        <text x="90" y="${totalBoxY + 240}" class="modern-text" font-size="15" font-weight="600" fill="#64748b">${escapeHtml(vDate)}</text>
        <line x1="60" y1="${totalBoxY + 280}" x2="940" y2="${totalBoxY + 280}" stroke="#f1f5f9" stroke-width="1"/>
        
        ${visibility.showSignatures ? `
          <text x="180" y="${totalBoxY + 320}" text-anchor="middle" class="modern-text" font-size="18" font-weight="700" fill="#0f172a">Người Nhận Lương</text>
          <text x="180" y="${totalBoxY + 345}" text-anchor="middle" class="modern-text" font-size="14" font-style="italic" fill="#64748b">(Ký tên xác nhận đã nhận)</text>
          
          <text x="800" y="${totalBoxY + 320}" text-anchor="middle" class="modern-text" font-size="18" font-weight="700" fill="#1e3a8a">Bộ Phận Kế Toán</text>
          <text x="800" y="${totalBoxY + 345}" text-anchor="middle" class="modern-text" font-size="14" font-style="italic" fill="#64748b">(Ký và đóng dấu nếu có)</text>
        ` : ''}
      </svg>`;
    }

    const words = numberToVietnamese(emp.amount);
    const infoDays = isHourly ? (emp.range ? `${emp.days} giờ (${emp.range})` : `${emp.days} giờ`) : (emp.range ? `${emp.days} công (${emp.range})` : `${emp.days} công`);
    
    const row1Label = isHourly ? "Lương cơ bản theo giờ" : "Mức lương cơ bản hàng tháng";
    const row1Val = isHourly ? `${formatMoney(emp.salary)} / giờ` : `${formatMoney(emp.salary)}`;
    const row2Label = isHourly ? "Thời gian làm việc chi tiết" : "Số ngày công định mức trong tháng";
    const row2Val = isHourly ? (emp.range || "Không có") : `${standardDays} ngày`;
    const row3Label = isHourly ? "Tổng số giờ làm việc thực tế" : "Số ngày công đi làm thực tế";
    const row3Val = isHourly ? `${emp.days} giờ` : infoDays;
    const row4Label = isHourly ? "Hệ số tính toán" : "Hệ số hoàn thành nhiệm vụ";
    const row4Val = isHourly ? "Không áp dụng" : (emp.days / standardDays).toFixed(4);

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1350" role="img" aria-label="Modern Payroll Slip">
      <defs>
        <linearGradient id="blueGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e3a8a" />
          <stop offset="100%" stop-color="#3b82f6" />
        </linearGradient>
        <linearGradient id="headerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#eff6ff" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      
      <style>
        ${getGoogleFontsImport()}
        .modern-text { font-family: '${selectedFont}', system-ui, sans-serif; }
      </style>
      
      <rect x="0" y="0" width="1000" height="1350" fill="#f8fafc"/>
      <rect x="25" y="25" width="950" height="1300" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
      
      <path d="M25 45 C 25 35, 35 25, 45 25 L 955 25 C 965 25, 975 35, 975 45 L 975 140 L 25 140 Z" fill="url(#blueGrad)"/>
      <text x="75" y="85" class="modern-text" font-size="${fontSizeTitle}" font-weight="${titleWeight}" fill="#ffffff">PHIẾU CHI LƯƠNG CHI TIẾT</text>
      <text x="75" y="115" class="modern-text" font-size="16" font-weight="600" fill="#93c5fd" letter-spacing="1">${mLabel.toUpperCase()}</text>
      
      ${visibility.showUnitInfo ? `
        <rect x="730" y="55" width="195" height="50" rx="8" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
        <text x="827" y="85" text-anchor="middle" class="modern-text" font-size="11" font-weight="700" fill="#ffffff">KINGS GRILL OFFICE</text>
      ` : ''}
      
      <rect x="60" y="180" width="880" height="150" rx="12" fill="url(#headerGrad)" stroke="#dbeafe" stroke-width="1"/>
      
      ${visibility.showEmpName ? `
        <text x="90" y="225" class="modern-text" font-size="14" font-weight="700" fill="#64748b">HỌ VÀ TÊN NHÂN VIÊN</text>
        <text x="90" y="260" class="modern-text" font-size="28" font-weight="800" fill="#0f172a">${escapeHtml(emp.name)}</text>
      ` : ''}
      
      ${visibility.showEmpRole ? `
        <text x="90" y="295" class="modern-text" font-size="15" font-weight="600" fill="#2563eb">${escapeHtml(defaultPosition)}</text>
      ` : ''}
      
      ${visibility.showEmpDept ? `
        <text x="600" y="225" class="modern-text" font-size="14" font-weight="700" fill="#64748b">PHÒNG BAN/BỘ PHẬN</text>
        <text x="600" y="260" class="modern-text" font-size="24" font-weight="700" fill="#0f172a">${escapeHtml(defaultDept)}</text>
      ` : ''}
      
      <text x="90" y="390" class="modern-text" font-size="20" font-weight="800" fill="#1e3a8a">DANH SÁCH CHI TIẾT TÍNH LƯƠNG</text>
      
      <rect x="60" y="415" width="880" height="340" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      
      <text x="90" y="465" class="modern-text" font-size="${fontSizeTable}" font-weight="600" fill="#475569">${row1Label}</text>
      <text x="910" y="465" text-anchor="end" class="modern-text" font-size="${fontSizeTable + 2}" font-weight="700" fill="#0f172a">${visibility.showBaseSalary ? row1Val : '***'}</text>
      <line x1="60" y1="495" x2="940" y2="495" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="535" class="modern-text" font-size="${fontSizeTable}" font-weight="600" fill="#475569">${row2Label}</text>
      <text x="910" y="535" text-anchor="end" class="modern-text" font-size="${fontSizeTable + 2}" font-weight="700" fill="#0f172a">${row2Val}</text>
      <line x1="60" y1="565" x2="940" y2="565" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="605" class="modern-text" font-size="${fontSizeTable}" font-weight="600" fill="#475569">${row3Label}</text>
      <text x="910" y="605" text-anchor="end" class="modern-text" font-size="${fontSizeTable + 2}" font-weight="700" fill="#2563eb">${row3Val}</text>
      <line x1="60" y1="635" x2="940" y2="635" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="675" class="modern-text" font-size="${fontSizeTable}" font-weight="600" fill="#475569">${row4Label}</text>
      <text x="910" y="675" text-anchor="end" class="modern-text" font-size="${fontSizeTable + 2}" font-weight="700" fill="#0f172a">${row4Val}</text>
      <line x1="60" y1="705" x2="940" y2="705" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="740" class="modern-text" font-size="${fontSizeTable}" font-weight="700" fill="#0f172a">Tiền lương thực nhận dự kiến</text>
      <text x="910" y="740" text-anchor="end" class="modern-text" font-size="${fontSizeTable + 4}" font-weight="800" fill="#0f172a">${formatMoney(emp.amount)}</text>
      
      <rect x="60" y="800" width="880" height="150" rx="16" fill="#eff6ff" stroke="#bfdbfe" stroke-width="2"/>
      <text x="100" y="860" class="modern-text" font-size="18" font-weight="800" fill="#1e3a8a">THANH TOÁN THỰC NHẬN CHUYỂN KHOẢN</text>
      
      ${visibility.showNotes ? `
        <text x="100" y="890" class="modern-text" font-size="15" font-weight="600" fill="#64748b" font-style="italic">Bằng chữ: ${escapeHtml(words)}</text>
      ` : ''}
      <text x="900" y="885" text-anchor="end" class="modern-text" font-size="44" font-weight="900" fill="#dc2626">${formatMoney(emp.amount)}</text>
      
      <text x="90" y="1040" class="modern-text" font-size="15" font-weight="600" fill="#64748b">${escapeHtml(vDate)}</text>
      <line x1="60" y1="1080" x2="940" y2="1080" stroke="#f1f5f9" stroke-width="1"/>
      
      ${visibility.showSignatures ? `
        <text x="180" y="1120" text-anchor="middle" class="modern-text" font-size="18" font-weight="700" fill="#0f172a">Người Nhận Lương</text>
        <text x="180" y="1145" text-anchor="middle" class="modern-text" font-size="14" font-style="italic" fill="#64748b">(Ký tên xác nhận đã nhận)</text>
        
        <text x="800" y="1120" text-anchor="middle" class="modern-text" font-size="18" font-weight="700" fill="#1e3a8a">Bộ Phận Kế Toán</text>
        <text x="800" y="1145" text-anchor="middle" class="modern-text" font-size="14" font-style="italic" fill="#64748b">(Ký và đóng dấu nếu có)</text>
      ` : ''}
    </svg>`;
  };

  const summarySvgModern = () => {
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const totalDays = employees.reduce((a, b) => a + Number(b.days || 0), 0);
    const totalSalary = employees.reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalDeduct = deductions.reduce((a, b) => a + Number(b.amount || 0), 0);
    const net = totalSalary - advance - totalDeduct;
    const words = numberToVietnamese(net);
    const isHourly = salaryMode === 'hourly';

    const rows = employees.slice(0, 10).map((e, i) => {
      const y = 390 + i * 58;
      return `
        <text x="90" y="${y}" font-family="'${selectedFont}', sans-serif" font-size="15" fill="#334155">${i + 1}</text>
        <text x="150" y="${y}" font-family="'${selectedFont}', sans-serif" font-size="15" font-weight="700" fill="#0f172a">${escapeHtml(e.name)}</text>
        <text x="440" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="15" fill="#334155">${e.days}${isHourly ? 'g' : ''}</text>
        <text x="560" y="${y}" text-anchor="middle" font-family="'${selectedFont}', sans-serif" font-size="14" fill="#64748b">${escapeHtml(e.range || '-')}</text>
        <text x="710" y="${y}" text-anchor="end" font-family="'${selectedFont}', sans-serif" font-size="14" fill="#334155">${formatMoney(e.salary)}</text>
        <text x="900" y="${y}" text-anchor="end" font-family="'${selectedFont}', sans-serif" font-size="15" font-weight="700" fill="#0f172a">${formatMoney(e.amount)}</text>
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
        ${getGoogleFontsImport()}
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

  // Convert SVG string to PNG image download link
  const svgToPng = (svgText: string, filename: string, isK80: boolean) => {
    return new Promise<void>((resolve, reject) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgEl = doc.documentElement;
      const baseWidth = isK80 ? 320 : 1000;
      const baseHeight = parseInt(svgEl.getAttribute('viewBox')?.split(' ')[3] || (isK80 ? '540' : '1400'), 10);
      
      const canvas = document.createElement('canvas');
      canvas.width = baseWidth * 2; // high res scaling
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
        
        try {
          const pngUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.download = filename;
          a.href = pngUrl;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG into Image object'));
      };
      img.src = url;
    });
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
    const zip = new JSZip();
    setIsExporting(true);
    setExportProgress(0);
    try {
      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];
        setExportProgress(Math.round(((i + 1) / employees.length) * 100));
        const svgText = getActiveSvgText(emp);
        const isK80 = activeTemplate === 'k80';
        const suffix = isK80 ? '-k80' : '';
        const filename = `phieu-luong-${emp.name.toLowerCase().replace(/\s+/g, '-')}-${payMonth}${suffix}.png`;
        
        const blob = await new Promise<Blob>((resolve, reject) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(svgText, 'image/svg+xml');
          const svgEl = doc.documentElement;
          const baseWidth = isK80 ? 320 : 1000;
          const baseHeight = parseInt(svgEl.getAttribute('viewBox')?.split(' ')[3] || (isK80 ? '540' : '1400'), 10);
          
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
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Canvas conversion to blob failed'));
              }
            }, 'image/png');
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load SVG into Image'));
          };
          img.src = url;
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
      URL.revokeObjectURL(url);
      showToast('Tải file ZIP thành công!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Lỗi xuất ZIP: ${err.message}`, 'error');
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
      const isK80 = activeTemplate === 'k80';
      const svgText = getActiveSvgText(targetEmp);
      const parser = new DOMParser();
      const docXml = parser.parseFromString(svgText, 'image/svg+xml');
      const svgEl = docXml.documentElement;
      const baseWidth = isK80 ? 320 : 1000;
      const baseHeight = parseInt(svgEl.getAttribute('viewBox')?.split(' ')[3] || (isK80 ? '540' : '1400'), 10);
      
      const dataUrl = await new Promise<string>((resolve, reject) => {
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
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load SVG into Image'));
        };
        img.src = url;
      });

      const orientation = isK80 ? 'p' : 'p';
      const format = isK80 ? [80, (baseHeight / baseWidth) * 80] : 'a4';
      const pdfDoc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: format
      });
      
      const pdfWidth = isK80 ? 80 : 210;
      const pdfHeight = isK80 ? (baseHeight / baseWidth) * 80 : 297;
      
      pdfDoc.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const nameStr = activeView === 'receipt' ? targetEmp.name : 'Bang_Tong_Hop_Luong';
      pdfDoc.save(`phieu-luong-${nameStr.toLowerCase().replace(/\s+/g, '-')}-${payMonth}.pdf`);
      showToast('Xuất PDF thành công!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Lỗi xuất PDF: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (activeTemplate === 'k80') {
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
      setCurrencySymbol('đ');
      setCurrencySeparator('.');
      setRoundMode('thousand');
      setZoomLevel(100);
      showToast('Đã khôi phục cài đặt mặc định!', 'info');
    }
  };

  const totalDays = employees.reduce((a, b) => a + Number(b.days || 0), 0);
  const totalSalary = employees.reduce((a, b) => a + Number(b.amount || 0), 0);
  const totalDeduct = deductions.reduce((a, b) => a + Number(b.amount || 0), 0);
  const net = totalSalary - advance - totalDeduct;

  const isHourly = salaryMode === 'hourly';

  const [showMobileEmpList, setShowMobileEmpList] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string[]>(['general', 'employee']);

  const toggleAccordion = (key: string) => {
    setActiveAccordion(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };
  
  const isAccordionOpen = (key: string) => activeAccordion.includes(key);

  const paperBaseWidthPx = activeTemplate === 'k80' ? 320 : 1000;
  const fitScale = useMemo(() => {
    if (!viewportWidth) return 1;
    const padding = activeTemplate === 'k80' ? 0 : 32;
    const availableWidth = viewportWidth - padding;
    return Math.min(1, availableWidth / paperBaseWidthPx);
  }, [viewportWidth, activeTemplate, paperBaseWidthPx]);

  const getZoomWidthStyle = () => {
    if (zoomLevel === 'fit') {
      return { 
        width: `${paperBaseWidthPx * fitScale}px`, 
        maxWidth: '100%', 
        transform: 'none' 
      };
    }
    const zoomVal = Number(zoomLevel) || 100;
    const scaleVal = zoomVal / 100;
    return { 
      width: `${paperBaseWidthPx * scaleVal}px`, 
      maxWidth: 'none', 
      transform: 'none' 
    };
  };

  const renderAccordionSection = (key: string, title: string, icon: string, children: React.ReactNode) => {
    const isOpen = isAccordionOpen(key);
    return (
      <div className={`glass-card collapsible-section ${isOpen ? 'open' : 'collapsed'}`} style={{ padding: '0.85rem 1rem' }}>
        <div 
          className="section-header" 
          onClick={() => toggleAccordion(key)} 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
        >
          <span className="card-heading-title" style={{ fontSize: '0.95rem' }}>
            {icon} {title}
          </span>
          <span style={{ fontSize: '0.75rem', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', color: 'var(--muted)' }}>▼</span>
        </div>
        {isOpen && (
          <div className="section-content" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  const warningsList = useMemo(() => {
    return Object.values(validationMap).flat();
  }, [validationMap]);

  const showConfigPane = layoutMode === 'mobile' 
    ? (mobileActiveTab === 'data' || mobileActiveTab === 'settings' || mobileActiveTab === 'export')
    : !isLeftPanelCollapsed;

  const showPreviewPane = layoutMode === 'mobile'
    ? (mobileActiveTab === 'preview' || mobileActiveTab === 'export')
    : true;

  return (
    <div 
      ref={containerRef} 
      className={`payroll-creator mode-${layoutMode} ${isFullscreenPreview ? 'fullscreen-preview-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {isDraggingFile && (
        <div className="file-dropzone-overlay" style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10, 20, 45, 0.9)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5000,
          border: '3px dashed #3b82f6',
          borderRadius: '16px',
          margin: '8px',
          color: 'white',
          pointerEvents: 'none'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>Thả file Excel phiếu lương vào đây</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>Hỗ trợ tệp Excel (.xlsx, .xls) chứa phiếu lương F&B</div>
        </div>
      )}
      
      {/* Hidden Print only container */}
      <div className="print-only-container">
        {printScope === 'current' && activeEmployee && (
          <div className="print-page" dangerouslySetInnerHTML={{ __html: getActiveSvgText(activeEmployee) }} />
        )}
        
        {printScope === 'all' && (
          employees.map(emp => (
            <div key={emp.id} className="print-page" dangerouslySetInnerHTML={{ __html: getActiveSvgText(emp) }} />
          ))
        )}

        {printScope === 'selected' && (
          employees.filter(emp => selectedEmployeeIds.has(emp.id)).map(emp => (
            <div key={emp.id} className="print-page" dangerouslySetInnerHTML={{ __html: getActiveSvgText(emp) }} />
          ))
        )}
      </div>

      <div className="head">
        <div className="title">
          <h1>Quản lý Phiếu Lương <span className="blue-dot"></span></h1>
          <p>Tạo, quản lý và xuất hóa đơn K80, A4 và lưu trữ Google Sheets</p>
        </div>
        <div className="kpis">
          <StatCard 
            icon="👥" 
            label="Tổng số nhân viên" 
            value={employees.length.toLocaleString('vi-VN')} 
            subtext="Nhân viên tính lương thực tế"
            hasData={employees.length > 0} 
          />
          <StatCard 
            icon="📅" 
            label="Tổng số công" 
            value={totalDays.toLocaleString('vi-VN')} 
            subtext={isHourly ? 'Tổng số giờ làm việc' : 'Tổng số công làm việc'}
            hasData={employees.length > 0} 
          />
          <StatCard 
            icon="🛡" 
            label="Quỹ lương dự kiến" 
            value={`${formatMoney(totalSalary)}`} 
            subtext="Trước khi khấu trừ"
            hasData={employees.length > 0} 
          />
          <StatCard 
            icon="💜" 
            label="Thực nhận" 
            value={`${formatMoney(net)}`} 
            subtext="Sau khi trừ tạm ứng & khấu trừ"
            hasData={employees.length > 0} 
          />
        </div>
      </div>

      <GuidePanel 
        title="Quản lý Phiếu Lương"
        purpose="Tạo phiếu lương chi tiết cho từng nhân viên nhà hàng (hỗ trợ chế độ lương tháng hoặc lương giờ), tính toán thực nhận sau khi cấn trừ tạm ứng & các khoản khấu trừ khác, xuất file ảnh PNG hóa đơn nhiệt K80 hoặc in phiếu A4/A5."
        steps={[
          "Thiết lập tháng thanh toán, ngày lập chứng từ và chế độ tính lương (Lương tháng / Lương giờ).",
          "Nhập dữ liệu nhân viên bằng cách gõ tay, dán dữ liệu thô từ Excel (nút 'Dán dữ liệu') hoặc import tệp CSV.",
          "Cấu hình các khoản khấu trừ chung (như BHXH, đồng phục, tiền phạt) hoặc tiền tạm ứng lương.",
          "Chuyển đổi qua lại giữa 'Phiếu Lương Nhân Viên' và 'Bảng Tổng Hợp Lương' để kiểm tra số liệu.",
          "Chọn các mẫu in 'Standard', 'K80 Thermal' hoặc 'Modern' rồi bấm 'Tải ảnh PNG' hoặc 'In Phiếu' để in hóa đơn vật lý."
        ]}
        notes={[
          "Mức lương và số ngày công phải là số thực tế để tính toán chính xác.",
          "Cấu hình K80 Thermal được tối ưu để in qua máy in hóa đơn nhiệt khổ giấy 80mm."
        ]}
        errors={[
          "Lỗi 'Thực nhận âm' -> Kiểm tra xem số tiền tạm ứng hoặc khấu trừ của nhân viên đó có lớn hơn tổng thu nhập cơ bản không."
        ]}
      />

      {isMobileScreen && (
        <div className="payroll-tabs" style={{ display: 'flex', gap: '0.25rem', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', width: '100%', marginBottom: '1.25rem', border: '1px solid var(--glass-border)', position: 'sticky', top: '0', zIndex: '100' }}>
          <button type="button" className={`tab-btn ${mobileActiveTab === 'data' ? 'active' : ''}`} onClick={() => setMobileActiveTab('data')} style={{ flexGrow: 1, border: 0, background: mobileActiveTab === 'data' ? 'var(--blue)' : 'transparent', color: 'white', padding: '10px 5px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>Dữ liệu</button>
          <button type="button" className={`tab-btn ${mobileActiveTab === 'settings' ? 'active' : ''}`} onClick={() => setMobileActiveTab('settings')} style={{ flexGrow: 1, border: 0, background: mobileActiveTab === 'settings' ? 'var(--blue)' : 'transparent', color: 'white', padding: '10px 5px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>Tùy chỉnh</button>
          <button type="button" className={`tab-btn ${mobileActiveTab === 'preview' ? 'active' : ''}`} onClick={() => setMobileActiveTab('preview')} style={{ flexGrow: 1, border: 0, background: mobileActiveTab === 'preview' ? 'var(--blue)' : 'transparent', color: 'white', padding: '10px 5px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>Xem trước</button>
          <button type="button" className={`tab-btn ${mobileActiveTab === 'export' ? 'active' : ''}`} onClick={() => setMobileActiveTab('export')} style={{ flexGrow: 1, border: 0, background: mobileActiveTab === 'export' ? 'var(--blue)' : 'transparent', color: 'white', padding: '10px 5px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>In / Xuất</button>
        </div>
      )}

      <div className={`payroll-layout ${isLeftPanelCollapsed ? 'left-panel-collapsed' : ''} ${isMobileScreen ? 'layout-mobile' : ''}`}>
        
        {/* Backdrop for narrow mode drawer */}
        {layoutMode === 'narrow' && !isLeftPanelCollapsed && (
          <div className="drawer-backdrop" onClick={() => setIsLeftPanelCollapsed(true)} />
        )}

        {/* LEFT COLUMN: Input form configs */}
        {showConfigPane && (
          <div className="config-pane">
            {/* Close button for narrow mode drawer */}
            {layoutMode === 'narrow' && (
              <div className="drawer-close-row" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                <button 
                  type="button" 
                  className="btn-ghost" 
                  onClick={() => setIsLeftPanelCollapsed(true)} 
                  style={{ color: '#9eb3d7', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '4px 10px', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                >
                  ✕ Đóng
                </button>
              </div>
            )}
            
            {/* Section 1: General configurations */}
            {(!isMobileScreen || mobileActiveTab === 'data') && renderAccordionSection('general', 'Cấu hình phiếu lương chung', '⚙️', (
              <>
                <div className="grid2">
                  <div className="form-group">
                    <label className="form-label">Chế độ tính lương</label>
                    <select 
                      className="form-control" 
                      value={salaryMode} 
                      onChange={(e) => setSalaryMode(e.target.value as 'monthly' | 'hourly' | 'restaurant')}
                    >
                      <option value="restaurant">Nhà hàng F&B (Mức lương/Quy đổi/Giờ/Công/Cơm...)</option>
                      <option value="monthly">Theo tháng (Lương tháng / ngày công)</option>
                      <option value="hourly">Theo giờ (Lương giờ × số giờ)</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Tháng thanh toán</label>
                    <input type="month" className="form-control" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} />
                  </div>
                </div>

                <div className="grid2">
                  <div className="form-group">
                    <label className="form-label">Ngày lập chứng từ</label>
                    <input type="date" className="form-control" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
                  </div>

                  <div className="form-group" style={{ display: isHourly ? 'none' : 'block' }}>
                    <label className="form-label">Số ngày công định mức</label>
                    <input type="number" className="form-control" value={standardDays} onChange={(e) => setStandardDays(Number(e.target.value) || 26)} />
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

                <div className="grid2">
                  <div className="form-group">
                    <label className="form-label">Làm tròn số tiền</label>
                    <select className="form-control" value={roundMode} onChange={(e) => setRoundMode(e.target.value as any)}>
                      <option value="none">Không làm tròn</option>
                      <option value="hundred">Làm tròn hàng trăm (100đ)</option>
                      <option value="thousand">Làm tròn hàng nghìn (1.000đ)</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Khấu trừ tạm ứng chung (đ)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formatMoney(advance)} 
                      onFocus={(e) => {
                        const val = onlyNumber(e.target.value);
                        e.target.value = val === 0 ? '' : String(val);
                      }}
                      onBlur={(e) => {
                        const val = onlyNumber(e.target.value);
                        setAdvance(val);
                        e.target.value = formatMoney(val);
                      }}
                      onChange={() => {}}
                    />
                  </div>
                </div>
              </>
            ))}

            {/* Section 2: Bulk import / Sample Actions */}
            {(!isMobileScreen || mobileActiveTab === 'data') && renderAccordionSection('data_import', 'Nhập dữ liệu & Thao tác', '☁', (
              <>
                <div className="grid3">
                  <input type="file" ref={fileInputRef} accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />
                  <input type="file" ref={excelInputRef} accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleExcelImport} />
                  <button type="button" className="primary" onClick={triggerCsvSelect} style={{ height: '44px', fontSize: '13px' }}>
                    <UploadCloud size={14} />
                    Nhập file CSV
                  </button>
                  <button type="button" className="primary" onClick={triggerExcelSelect} style={{ height: '44px', fontSize: '13px', background: 'var(--primary)', boxShadow: 'none' }}>
                    <UploadCloud size={14} />
                    Nhập file Excel
                  </button>
                  <button type="button" className="primary" onClick={loadSampleData} style={{ height: '44px', fontSize: '13px', background: 'rgba(20,40,90,.9)', boxShadow: 'none' }}>Tải dữ liệu mẫu</button>
                </div>
                <div className="bulk-import-row">
                  <button type="button" className="btn-outline" onClick={clearAllForms} style={{ flexGrow: 1, padding: '8px', fontSize: '13px' }}>Xóa form dữ liệu</button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Hỗ trợ định dạng: .csv, .xlsx, .xls</p>
              </>
            ))}

            {/* Section 6: Nhập dữ liệu nhân viên */}
            {(!isMobileScreen || mobileActiveTab === 'data') && renderAccordionSection('employee', `Nhập dữ liệu nhân viên (${employees.length})`, '👥', (
              <>
                <div className="grid2">
                  <button type="button" className="primary" onClick={addEmployee} style={{ height: '40px', fontSize: '13px' }}>
                    <Plus size={14} />
                    Thêm nhân viên
                  </button>
                  <button type="button" className="primary" onClick={() => {
                    const text = prompt('Dán dữ liệu CSV/TSV tại đây (Họ tên \t Số công/Giờ \t Khoảng thời gian \t Lương):');
                    if (text) {
                      const lines = text.split('\n');
                      const newEmps: Employee[] = [];
                      const isHourly = salaryMode === 'hourly';
                      lines.forEach((line, idx) => {
                        if (!line.trim()) return;
                        const cols = line.split('\t');
                        if (cols.length < 2) return;
                        const name = cols[0]?.trim();
                        const days = Number(cols[1]) || 0;
                        const range = cols[2]?.trim() || '';
                        const salary = onlyNumber(cols[3] || (isHourly ? '35.000' : '10.000.000'));
                        let amount = isHourly ? roundSalary(salary * days) : roundSalary(salary * days / standardDays);
                        newEmps.push({ id: Date.now().toString() + idx, name, days, range, salary, amount });
                      });
                      if (newEmps.length > 0) {
                        setEmployees(prev => [...prev, ...newEmps]);
                        showToast(`Đã dán thành công ${newEmps.length} nhân viên!`, 'success');
                      }
                    }
                  }} style={{ height: '40px', fontSize: '13px', background: 'rgba(20,40,90,.9)', boxShadow: 'none' }}>
                    Dán dữ liệu
                  </button>
                </div>

                <div className="employees-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                  {employees.map((emp, idx) => (
                    <div key={emp.id} className="employee-input-row" style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="employee-row-title" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 700 }}>
                        <span style={{ color: 'var(--cyan)' }}>👤 Nhân viên #{idx + 1}</span>
                        <button type="button" className="btn-danger small-btn" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => deleteEmployee(emp.id)}>Xóa</button>
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Họ và tên</label>
                        <input type="text" className="form-control input-compact" value={emp.name} onChange={(e) => updateEmployeeDetails(emp.id, 'name', e.target.value)} />
                      </div>

                      {salaryMode === 'restaurant' ? (
                        <>
                          <div className="grid3" style={{ marginBottom: '8px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Mức lương</label>
                              <input 
                                type="text" 
                                className="form-control input-compact" 
                                value={formatMoney(emp.salary)} 
                                onFocus={(e) => {
                                  const val = onlyNumber(e.target.value);
                                  e.target.value = val === 0 ? '' : String(val);
                                }}
                                onBlur={(e) => {
                                  const val = onlyNumber(e.target.value);
                                  updateEmployeeSalary(emp.id, String(val));
                                  e.target.value = formatMoney(val);
                                }}
                                onChange={() => {}}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Số ngày làm/tháng</label>
                              <input 
                                type="number" 
                                step="1" 
                                min="0" 
                                className="form-control input-compact" 
                                value={emp.workedDays !== undefined ? emp.workedDays : emp.days} 
                                onChange={(e) => updateEmployeeRestaurantField(emp.id, 'workedDays', Number(e.target.value) || 0)} 
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Ngày cộng thêm</label>
                              <input 
                                type="number" 
                                step="1" 
                                min="0" 
                                className="form-control input-compact" 
                                value={emp.addedDays !== undefined ? emp.addedDays : 0} 
                                onChange={(e) => updateEmployeeRestaurantField(emp.id, 'addedDays', Number(e.target.value) || 0)} 
                              />
                            </div>
                          </div>

                          <div className="grid3" style={{ marginBottom: '8px' }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Tổng giờ làm/tháng</label>
                              <input 
                                type="number" 
                                step="1" 
                                min="0" 
                                className="form-control input-compact" 
                                value={emp.totalHours !== undefined ? emp.totalHours : 0} 
                                onChange={(e) => updateEmployeeRestaurantField(emp.id, 'totalHours', Number(e.target.value) || 0)} 
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Tiền cơm (+)</label>
                              <input 
                                type="text" 
                                className="form-control input-compact" 
                                value={formatMoney(emp.lunchPay !== undefined ? emp.lunchPay : (emp.workedDays !== undefined ? emp.workedDays : emp.days) * 20000)} 
                                onFocus={(e) => {
                                  const val = onlyNumber(e.target.value);
                                  e.target.value = val === 0 ? '' : String(val);
                                }}
                                onBlur={(e) => {
                                  const val = onlyNumber(e.target.value);
                                  updateEmployeeRestaurantField(emp.id, 'lunchPay', val);
                                  e.target.value = formatMoney(val);
                                }}
                                onChange={() => {}}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Thưởng (+)</label>
                              <input 
                                type="text" 
                                className="form-control input-compact" 
                                value={formatMoney(emp.bonus || 0)} 
                                onFocus={(e) => {
                                  const val = onlyNumber(e.target.value);
                                  e.target.value = val === 0 ? '' : String(val);
                                }}
                                onBlur={(e) => {
                                  const val = onlyNumber(e.target.value);
                                  updateEmployeeRestaurantField(emp.id, 'bonus', val);
                                  e.target.value = formatMoney(val);
                                }}
                                onChange={() => {}}
                              />
                            </div>
                          </div>

                          <div className="grid3">
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Tăng ca (+)</label>
                              <input 
                                type="text" 
                                className="form-control input-compact" 
                                value={formatMoney(emp.overtimePay || 0)} 
                                onFocus={(e) => {
                                  const val = onlyNumber(e.target.value);
                                  e.target.value = val === 0 ? '' : String(val);
                                }}
                                onBlur={(e) => {
                                  const val = onlyNumber(e.target.value);
                                  updateEmployeeRestaurantField(emp.id, 'overtimePay', val);
                                  e.target.value = formatMoney(val);
                                }}
                                onChange={() => {}}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Đổ bể (-)</label>
                              <input 
                                type="text" 
                                className="form-control input-compact" 
                                value={formatMoney(emp.deduction || 0)} 
                                onFocus={(e) => {
                                  const val = onlyNumber(e.target.value);
                                  e.target.value = val === 0 ? '' : String(val);
                                }}
                                onBlur={(e) => {
                                  const val = onlyNumber(e.target.value);
                                  updateEmployeeRestaurantField(emp.id, 'deduction', val);
                                  e.target.value = formatMoney(val);
                                }}
                                onChange={() => {}}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11px' }}>Thời gian</label>
                              <input 
                                type="text" 
                                className="form-control input-compact" 
                                placeholder="01/06 - 30/06" 
                                value={emp.range} 
                                onChange={(e) => updateEmployeeDetails(emp.id, 'range', e.target.value)} 
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="grid3">
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px' }}>{isHourly ? 'Giờ làm' : 'Công'}</label>
                            <input 
                              type="number" 
                              step="0.1" 
                              min="0" 
                              className="form-control input-compact" 
                              value={emp.days} 
                              onChange={(e) => updateEmployeeDays(emp.id, Number(e.target.value) || 0)} 
                            />
                          </div>
                          
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px' }}>Thời gian</label>
                            <input 
                              type="text" 
                              className="form-control input-compact" 
                              placeholder="01/06 - 30/06" 
                              value={emp.range} 
                              onChange={(e) => updateEmployeeDetails(emp.id, 'range', e.target.value)} 
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px' }}>{isHourly ? 'Lương giờ' : 'Lương CB'}</label>
                            <input 
                              type="text" 
                              className="form-control input-compact" 
                              value={formatMoney(emp.salary)} 
                              onFocus={(e) => {
                                const val = onlyNumber(e.target.value);
                                e.target.value = val === 0 ? '' : String(val);
                              }}
                              onBlur={(e) => {
                                const val = onlyNumber(e.target.value);
                                updateEmployeeSalary(emp.id, String(val));
                                e.target.value = formatMoney(val);
                              }}
                              onChange={() => {}}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {employees.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '12px' }}>
                      Chưa có nhân viên nào.
                    </div>
                  )}
                </div>
              </>
            ))}

            {/* Section 7: Deductions */}
            {(!isMobileScreen || mobileActiveTab === 'data') && renderAccordionSection('deduction', `Khoản khấu trừ chung (${deductions.length})`, '💸', (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <button type="button" className="primary" onClick={addDeduction} style={{ height: '36px', padding: '0 12px', fontSize: '12px' }}>
                    <Plus size={12} />
                    Thêm khấu trừ
                  </button>
                </div>

                <div className="deductions-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {deductions.map(d => (
                    <div key={d.id} className="deduction-input-row" style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="employee-row-title" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600 }}>Khấu trừ</span>
                        <button type="button" className="btn-danger small-btn" style={{ padding: '1px 5px', fontSize: '10px' }} onClick={() => deleteDeduction(d.id)}>Xóa</button>
                      </div>
                      <div className="grid2">
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '10px' }}>Nội dung</label>
                          <input type="text" className="form-control input-compact" placeholder="BHXH, Phạt..." value={d.label} onChange={(e) => updateDeduction(d.id, 'label', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '10px' }}>Số tiền (đ)</label>
                          <input 
                            type="text" 
                            className="form-control input-compact" 
                            value={formatMoney(d.amount)} 
                            onFocus={(e) => {
                              const val = onlyNumber(e.target.value);
                              e.target.value = val === 0 ? '' : String(val);
                            }}
                            onBlur={(e) => {
                              const val = onlyNumber(e.target.value);
                              updateDeduction(d.id, 'amount', val);
                              e.target.value = formatMoney(val);
                            }}
                            onChange={() => {}}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ))}

            {/* Section 3: Tùy chỉnh hiển thị */}
            {(!isMobileScreen || mobileActiveTab === 'settings') && renderAccordionSection('visibility', 'Tùy chỉnh hiển thị phiếu', '👁️', (
              <>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label">Chọn Preset nhanh</label>
                  <div className="preset-toggle-container">
                    <button type="button" className="btn-outline small-btn" onClick={() => applyPreset('full')}>Đầy đủ</button>
                    <button type="button" className="btn-outline small-btn" onClick={() => applyPreset('compact')}>Rút gọn</button>
                    <button type="button" className="btn-outline small-btn" onClick={() => applyPreset('internal')}>Nội bộ</button>
                    <button type="button" className="btn-outline small-btn" onClick={() => applyPreset('k80')}>In nhiệt</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--cyan)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>PHẦN ĐẦU PHIẾU</span>
                    <div className="checkbox-grid">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showLogo} onChange={e => setVisibility((prev: any) => ({ ...prev, showLogo: e.target.checked }))} />
                        <span>Logo đơn vị</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showUnitInfo} onChange={e => setVisibility((prev: any) => ({ ...prev, showUnitInfo: e.target.checked }))} />
                        <span>Tên & địa chỉ đơn vị</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showTitle} onChange={e => setVisibility((prev: any) => ({ ...prev, showTitle: e.target.checked }))} />
                        <span>Tiêu đề phiếu</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showMetaInfo} onChange={e => setVisibility((prev: any) => ({ ...prev, showMetaInfo: e.target.checked }))} />
                        <span>Tháng & Ngày lập</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--cyan)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>THÔNG TIN NHÂN VIÊN</span>
                    <div className="checkbox-grid">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showEmpName} onChange={e => setVisibility((prev: any) => ({ ...prev, showEmpName: e.target.checked }))} />
                        <span>Tên nhân viên</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showEmpRole} onChange={e => setVisibility((prev: any) => ({ ...prev, showEmpRole: e.target.checked }))} />
                        <span>Chức vụ</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showEmpDept} onChange={e => setVisibility((prev: any) => ({ ...prev, showEmpDept: e.target.checked }))} />
                        <span>Bộ phận</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showEmpBank} onChange={e => setVisibility((prev: any) => ({ ...prev, showEmpBank: e.target.checked }))} />
                        <span>Tài khoản ngân hàng</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--cyan)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>CHI TIẾT LƯƠNG & CHỮ KÝ</span>
                    <div className="checkbox-grid">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showBaseSalary} onChange={e => setVisibility((prev: any) => ({ ...prev, showBaseSalary: e.target.checked }))} />
                        <span>Mức lương cơ bản</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showTime} onChange={e => setVisibility((prev: any) => ({ ...prev, showTime: e.target.checked }))} />
                        <span>Số công/Số giờ làm</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showSignatures} onChange={e => setVisibility((prev: any) => ({ ...prev, showSignatures: e.target.checked }))} />
                        <span>Chữ ký xác nhận</span>
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={visibility.showNotes} onChange={e => setVisibility((prev: any) => ({ ...prev, showNotes: e.target.checked }))} />
                        <span>Ghi chú bằng chữ</span>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            ))}

            {/* Section 4: Kiểu chữ & Typography */}
            {(!isMobileScreen || mobileActiveTab === 'settings') && renderAccordionSection('typography', 'Kiểu chữ & Typography', '🔤', (
              <>
                <div className="form-group">
                  <label className="form-label">Chọn Preset phong cách nhanh</label>
                  <div className="preset-toggle-container">
                    <button type="button" className="btn-outline small-btn" onClick={() => applyTypographyPreset('modern')}>Hiện đại</button>
                    <button type="button" className="btn-outline small-btn" onClick={() => applyTypographyPreset('admin')}>Hành chính</button>
                    <button type="button" className="btn-outline small-btn" onClick={() => applyTypographyPreset('minimalist')}>Tối giản</button>
                    <button type="button" className="btn-outline small-btn" onClick={() => applyTypographyPreset('luxury')}>Sang trọng</button>
                    <button type="button" className="btn-outline small-btn" onClick={() => applyTypographyPreset('k80')}>In nhiệt K80</button>
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

                <div className="grid3">
                  <div className="form-group">
                    <label className="form-label">Cỡ tiêu đề</label>
                    <input type="number" className="form-control" value={fontSizeTitle} onChange={e => setFontSizeTitle(Number(e.target.value) || 28)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cỡ nội dung</label>
                    <input type="number" className="form-control" value={fontSizeContent} onChange={e => setFontSizeContent(Number(e.target.value) || 14)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cỡ bảng</label>
                    <input type="number" className="form-control" value={fontSizeTable} onChange={e => setFontSizeTable(Number(e.target.value) || 13)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Độ đậm tiêu đề</label>
                  <select className="form-control" value={titleWeight} onChange={e => setTitleWeight(e.target.value)}>
                    <option value="400">Regular (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semi Bold (600)</option>
                    <option value="700">Bold (700)</option>
                    <option value="800">Extra Bold (800)</option>
                    <option value="900">Black (900)</option>
                  </select>
                </div>

                <button type="button" className="btn-outline" onClick={resetAllConfigurations} style={{ padding: '8px', width: '100%', marginTop: '4px', fontSize: '13px' }}>
                  Khôi phục mặc định
                </button>
              </>
            ))}

            {/* Section 5: Thiết lập in & Xuất bản */}
            {(!isMobileScreen || mobileActiveTab === 'export') && renderAccordionSection('print_settings', 'Thiết lập in ấn & Khổ giấy', '🖨️', (
              <>
                <div className="grid2">
                  <div className="form-group">
                    <label className="form-label">Phạm vi in ấn</label>
                    <select className="form-control" value={printScope} onChange={e => setPrintScope(e.target.value as any)}>
                      <option value="current">Chỉ in phiếu đang chọn</option>
                      <option value="all">In tất cả nhân viên</option>
                      <option value="selected">In các nhân viên được chọn</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Chọn khổ giấy</label>
                    <select 
                      className="form-control" 
                      value={paperSize} 
                      onChange={e => {
                        const val = e.target.value as 'a4' | 'k80';
                        setPaperSize(val);
                        if (val === 'k80') {
                          setActiveTemplate('k80');
                        } else {
                          setActiveTemplate('standard');
                        }
                      }}
                    >
                      <option value="a4">Khổ giấy chuẩn A4 / A5</option>
                      <option value="k80">Khổ giấy in nhiệt K80 (80mm)</option>
                    </select>
                  </div>
                </div>

                {(paperSize === 'k80' || activeTemplate === 'k80') && (
                  <div style={{ marginTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.85rem' }}>
                    <span style={{ fontSize: '11px', color: 'var(--cyan)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                      ⚙️ TÙY CHỌN IN NHIỆT (K80)
                    </span>
                    <div className="checkbox-grid" style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={thermalOptions.splitEachSlip} 
                          onChange={e => setThermalOptions((prev: any) => ({ ...prev, splitEachSlip: e.target.checked }))} 
                        />
                        <span>Tách từng phiếu khi in hàng loạt</span>
                      </label>
                      
                      <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={thermalOptions.compactCut} 
                          onChange={e => setThermalOptions((prev: any) => ({ ...prev, compactCut: e.target.checked }))} 
                        />
                        <span>Cắt gọn cuối phiếu (Co theo nội dung)</span>
                      </label>

                      <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={thermalOptions.hideSignature} 
                          onChange={e => setThermalOptions((prev: any) => ({ ...prev, hideSignature: e.target.checked }))} 
                        />
                        <span>Ẩn phần ký tên xác nhận</span>
                      </label>

                      <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={thermalOptions.hideEmptyNotes} 
                          onChange={e => setThermalOptions((prev: any) => ({ ...prev, hideEmptyNotes: e.target.checked }))} 
                        />
                        <span>Ẩn ghi chú rỗng</span>
                      </label>

                      <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={thermalOptions.hideEmptyRows} 
                          onChange={e => setThermalOptions((prev: any) => ({ ...prev, hideEmptyRows: e.target.checked }))} 
                        />
                        <span>Ẩn các dòng không có số liệu phát sinh</span>
                      </label>

                      <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={thermalOptions.showCutLine} 
                          onChange={e => setThermalOptions((prev: any) => ({ ...prev, showCutLine: e.target.checked }))} 
                        />
                        <span>In đường cắt răng cưa (---)</span>
                      </label>
                    </div>

                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <label className="form-label">Khoảng cách cuối phiếu</label>
                      <select 
                        className="form-control" 
                        value={thermalOptions.bottomFeedMm} 
                        onChange={e => setThermalOptions((prev: any) => ({ ...prev, bottomFeedMm: Number(e.target.value) }))}
                      >
                        <option value="0">0mm</option>
                        <option value="4">4mm</option>
                        <option value="6">6mm (Mặc định)</option>
                        <option value="8">8mm</option>
                        <option value="12">12mm</option>
                      </select>
                    </div>
                  </div>
                )}
                
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, marginTop: '8px' }}>Cài đặt này sẽ được áp dụng trực tiếp khi bạn bấm nút In Phiếu.</p>
              </>
            ))}

            {/* Section 8: Google Sheets Sync Controls */}
            {(!isMobileScreen || mobileActiveTab === 'settings') && renderAccordionSection('cloud_sync', 'Google Sheets Cloud Sync', '☁', (
              <>
                <div className="sync-status">
                  <span className={`sync-dot ${syncStatus}`}></span>
                  <span>Google Sheets Sync: </span>
                  <strong>{syncStatus === 'online' ? 'Sẵn sàng' : syncStatus === 'loading' ? 'Đang đồng bộ...' : 'Chưa kết nối'}</strong>
                </div>

                <div className="bulk-import-row" style={{ marginTop: '0.75rem' }}>
                  <button type="button" className="primary" style={{ flexGrow: 1, height: '40px', fontSize: '13px' }} onClick={savePayrollToGAS} disabled={syncStatus === 'loading'}>
                    <Save size={14} />
                    Lưu Cloud
                  </button>
                  <button type="button" className="btn-ghost" onClick={fetchHistoryMonths} disabled={syncStatus === 'loading'} title="Tải lại lịch sử">
                    <RefreshCw size={14} className={syncStatus === 'loading' ? 'spinner' : ''} />
                  </button>
                </div>

                <div className="history-list-header" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginTop: '4px' }}>Lịch sử tháng lương đã lưu:</div>
                <div className="history-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '130px', overflowY: 'auto' }}>
                  {historyMonths.map(h => (
                    <div key={h.month} className="history-item-row" onClick={() => loadHistoryMonth(h.month)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                      <div className="history-meta">
                        <span className="h-month">Tháng {h.month.split('-')[1]}/{h.month.split('-')[0]}</span>
                        <span className="h-info" style={{ fontSize: '10px', color: 'var(--muted)' }}>Ghi bởi: {h.operator} - {h.updatedTime}</span>
                      </div>
                      <button 
                        type="button"
                        className="btn-danger small-btn" 
                        style={{ padding: '3px 6px', fontSize: '10px' }} 
                        onClick={(e) => { e.stopPropagation(); deleteHistoryMonth(h.month); }}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                  {historyMonths.length === 0 && (
                    <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>Chưa có dữ liệu nào lưu trữ đám mây.</div>
                  )}
                </div>
              </>
            ))}

            {/* Section 9: Validation Messages */}
            {(!isMobileScreen || mobileActiveTab === 'settings') && warningsList.length > 0 && renderAccordionSection('warnings', `Cảnh báo dữ liệu (${warningsList.length})`, '⚠️', (
              <div className="warnings-container-scroll" style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {employees.map(emp => {
                  const msgs = validationMap[emp.id] || [];
                  if (msgs.length === 0) return null;
                  return (
                    <div key={emp.id} style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.15)', padding: '6px 10px', borderRadius: '6px' }}>
                      <strong style={{ color: 'white', display: 'block', marginBottom: '2px' }}>{emp.name || '(Trống)'}</strong>
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
            ))}

          </div>
        )}

        {/* RIGHT COLUMN: Live dynamic preview rendering */}
        {showPreviewPane && (
          <div className="preview-pane">
            
            {/* Preview Tab Control Panel */}
            <div className="preview-header-panel">
              <div className="preview-views-toggle">
                <button 
                  type="button"
                  className={`view-toggle-btn ${activeView === 'receipt' ? 'active' : ''}`} 
                  onClick={() => { setActiveView('receipt'); setPreviewMode('single'); }}
                >
                  📄 Phiếu Lương Nhân Viên
                </button>
                <button 
                  type="button"
                  className={`view-toggle-btn ${activeView === 'summary' ? 'active' : ''}`} 
                  onClick={() => { setActiveView('summary'); setPreviewMode('single'); }}
                >
                  📊 Bảng Tổng Hợp Lương
                </button>
              </div>

              <div className="preview-templates-toggle">
                <button 
                  type="button"
                  className={`template-toggle-btn ${activeTemplate === 'standard' ? 'active' : ''}`} 
                  onClick={() => setActiveTemplate('standard')}
                >
                  Standard
                </button>
                <button 
                  type="button"
                  className={`template-toggle-btn ${activeTemplate === 'modern' ? 'active' : ''}`} 
                  onClick={() => setActiveTemplate('modern')}
                >
                  Modern
                </button>
                <button 
                  type="button"
                  className={`template-toggle-btn ${activeTemplate === 'k80' ? 'active' : ''}`} 
                  onClick={() => setActiveTemplate('k80')}
                >
                  K80
                </button>
              </div>
            </div>

            {/* Quick Metrics display bar */}
            {activeView === 'receipt' && activeEmployee && (
              <div className="metrics-strip-pnl">
                <div className="metric-box">
                  <span>Mức Lương</span>
                  <strong>{formatMoney(activeEmployee.salary)}</strong>
                </div>
                <div className="metric-box">
                  <span>{isHourly ? 'Giờ Làm' : 'Ngày Công'}</span>
                  <strong>{activeEmployee.days}</strong>
                </div>
                <div className="metric-box">
                  <span>Khấu Trừ</span>
                  <strong className="red">{formatMoney(totalDeduct + (activeEmployee.advance || 0))}</strong>
                </div>
                <div className="metric-box">
                  <span>Thực Nhận</span>
                  <strong style={{ color: 'var(--cyan)' }}>{formatMoney(activeEmployee.amount)}</strong>
                </div>
              </div>
            )}

            {/* Quick Preview Toolbar: zoom, template, full-screen, print actions */}
            <div className="preview-toolbar-bar">
              <div className="toolbar-left-group">
                {(layoutMode === 'wide' || layoutMode === 'compact') ? (
                  <>
                    <div className="zoom-controller-box">
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Tỷ lệ:</span>
                      <select 
                        className="form-control select-compact" 
                        style={{ width: '100px', height: '32px', padding: '0 8px', fontSize: '12px' }} 
                        value={zoomLevel} 
                        onChange={e => setZoomLevel(e.target.value)}
                      >
                        <option value="fit">Vừa khít</option>
                        <option value="50">50%</option>
                        <option value="75">75%</option>
                        <option value="100">100%</option>
                        <option value="125">125%</option>
                        <option value="150">150%</option>
                        <option value="200">200%</option>
                      </select>
                    </div>

                    {activeView === 'receipt' && (
                      <div className="preview-modes-toggle">
                        <button type="button" className={`mode-toggle-btn ${previewMode === 'single' ? 'active' : ''}`} onClick={() => setPreviewMode('single')} title="Xem một phiếu">Phiếu</button>
                        <button type="button" className={`mode-toggle-btn ${previewMode === 'list' ? 'active' : ''}`} onClick={() => setPreviewMode('list')} title="Xem danh sách liên tục">Liên tiếp</button>
                        <button type="button" className={`mode-toggle-btn ${previewMode === 'thumbnail' ? 'active' : ''}`} onClick={() => setPreviewMode('thumbnail')} title="Xem dạng lưới nhỏ">Lưới</button>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <button 
                      type="button" 
                      className="btn-outline" 
                      onClick={() => setShowToolbarOptions(!showToolbarOptions)}
                      style={{ height: '32px', padding: '0 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,132,206,0.22)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      ⚙️ Tùy chọn ▾
                    </button>
                    {showToolbarOptions && (
                      <>
                        <div className="dropdown-click-outside-backdrop" onClick={() => setShowToolbarOptions(false)} style={{ zIndex: 1000, position: 'fixed', inset: 0 }} />
                        <div className="toolbar-options-dropdown" style={{ position: 'absolute', top: '36px', left: 0, background: 'linear-gradient(145deg, #0d1e44, #060e22)', border: '1px solid rgba(77,134,224,0.4)', borderRadius: '8px', padding: '12px', zIndex: 1001, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '220px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                          <div className="zoom-controller-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#b6c7e8' }}>TỶ LỆ XEM:</span>
                            <select 
                              className="form-control select-compact" 
                              style={{ width: '100%', height: '30px', padding: '0 8px', fontSize: '12px', background: 'rgba(5, 17, 42, 0.75)', border: '1px solid rgba(91,134,211,0.3)', color: 'white', borderRadius: '6px' }} 
                              value={zoomLevel} 
                              onChange={e => { setZoomLevel(e.target.value); setShowToolbarOptions(false); }}
                            >
                              <option value="fit">Vừa khít</option>
                              <option value="50">50%</option>
                              <option value="75">75%</option>
                              <option value="100">100%</option>
                              <option value="125">125%</option>
                              <option value="150">150%</option>
                              <option value="200">200%</option>
                            </select>
                          </div>
                          
                          {activeView === 'receipt' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#b6c7e8' }}>CHẾ ĐỘ HIỂN THỊ:</span>
                              <div className="preview-modes-toggle" style={{ width: '100%', display: 'flex', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,132,206,0.22)', borderRadius: '6px', padding: '2px' }}>
                                <button type="button" className={`mode-toggle-btn ${previewMode === 'single' ? 'active' : ''}`} style={{ flexGrow: 1, padding: '4px 6px', fontSize: '11px' }} onClick={() => { setPreviewMode('single'); setShowToolbarOptions(false); }}>Phiếu</button>
                                <button type="button" className={`mode-toggle-btn ${previewMode === 'list' ? 'active' : ''}`} style={{ flexGrow: 1, padding: '4px 6px', fontSize: '11px' }} onClick={() => { setPreviewMode('list'); setShowToolbarOptions(false); }}>Liên tiếp</button>
                                <button type="button" className={`mode-toggle-btn ${previewMode === 'thumbnail' ? 'active' : ''}`} style={{ flexGrow: 1, padding: '4px 6px', fontSize: '11px' }} onClick={() => { setPreviewMode('thumbnail'); setShowToolbarOptions(false); }}>Lưới</button>
                              </div>
                            </div>
                          )}

                          {layoutMode === 'narrow' && (
                            <button 
                              type="button" 
                              className="btn-outline" 
                              onClick={() => { setIsLeftPanelCollapsed(!isLeftPanelCollapsed); setShowToolbarOptions(false); }}
                              style={{ height: '30px', fontSize: '12px', width: '100%', padding: '0 8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,132,206,0.22)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              {isLeftPanelCollapsed ? '⚙️ Hiện Cấu hình' : '⚙️ Ẩn Cấu hình'}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button 
                  type="button" 
                  className="btn-ghost" 
                  onClick={() => setIsFullscreenPreview(!isFullscreenPreview)} 
                  title="Bật/Tắt toàn màn hình preview"
                  style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isFullscreenPreview ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
                
                {(layoutMode === 'wide' || layoutMode === 'compact') && (
                  <button 
                    type="button" 
                    className="btn-ghost" 
                    onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)} 
                    title="Ẩn/Hiện cột cấu hình bên trái"
                    style={{ padding: '0 8px', height: '32px', fontSize: '12px' }}
                  >
                    {isLeftPanelCollapsed ? ' Hiện cấu hình ›' : '‹ Ẩn cấu hình'}
                  </button>
                )}

                {layoutMode === 'narrow' && isLeftPanelCollapsed && (
                  <button 
                    type="button" 
                    className="btn-ghost" 
                    onClick={() => setIsLeftPanelCollapsed(false)} 
                    title="Hiện cột cấu hình"
                    style={{ padding: '0 8px', height: '32px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(99,132,206,0.15)', borderRadius: '6px' }}
                  >
                    ⚙️ Cấu hình
                  </button>
                )}
              </div>

              <div className="toolbar-right-group">
                {activeView === 'receipt' && previewMode === 'single' && (
                  <div className="employee-navigator-widget" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button type="button" className="btn-ghost" onClick={handlePrevEmployee} disabled={currentEmployeeIndex === 0} style={{ width: '32px', height: '32px' }}>
                      <ChevronLeft size={16} />
                    </button>
                    <span 
                      style={{ fontSize: '13px', fontWeight: 600, color: 'white', minWidth: '70px', textAlign: 'center', cursor: isMobileScreen ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
                      onClick={() => { if (isMobileScreen) setShowMobileEmpList(true); }}
                      title={isMobileScreen ? "Click để chọn nhanh nhân viên" : undefined}
                    >
                      {employees.length > 0 ? `${currentEmployeeIndex + 1} / ${employees.length}` : '0 / 0'}
                      {isMobileScreen && <span style={{ fontSize: '9px', color: 'var(--cyan)' }}>▼</span>}
                    </span>
                    <button type="button" className="btn-ghost" onClick={handleNextEmployee} disabled={currentEmployeeIndex === employees.length - 1} style={{ width: '32px', height: '32px' }}>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                <div className="action-buttons-box" style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" className="primary" onClick={() => handleDownloadPng()} style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}>
                    <Download size={13} />
                    Xuất Ảnh
                  </button>
                  
                  {activeView === 'receipt' && previewMode === 'single' && (
                    <button type="button" className="btn-outline" onClick={() => handleDownloadPdf()} style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}>
                      <FileText size={13} />
                      PDF
                    </button>
                  )}

                  {activeView === 'receipt' && previewMode !== 'single' && (
                    <button type="button" className="btn-outline" onClick={handleDownloadZip} disabled={isExporting} style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}>
                      <Archive size={13} />
                      Tải ZIP
                    </button>
                  )}
                  
                  <button type="button" className="btn-outline" onClick={handlePrint} style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}>
                    <Printer size={13} />
                    In Phiếu
                  </button>
                </div>
              </div>
            </div>

            {/* Exporting progress overlay indicator */}
            {isExporting && (
              <div className="export-progress-overlay">
                <div className="export-progress-card">
                  <div className="spinner" style={{ fontSize: '24px' }}>⏳</div>
                  <strong>Đang xử lý xuất tập tin...</strong>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${exportProgress}%` }}></div>
                  </div>
                  <span>Hoàn thành {exportProgress}%</span>
                </div>
              </div>
            )}

            {/* Render target content preview canvas viewport */}
            <div className="preview-scroll-container PayrollPreviewViewport" ref={previewViewportRef}>
              {employees.length === 0 ? (
                <EmptyState 
                  icon="📄"
                  title="Chưa có phiếu lương để hiển thị"
                  description="Vui lòng thêm nhân viên mới hoặc tải file CSV dữ liệu chấm công ở cột bên trái để bắt đầu tạo phiếu lương và bảng tổng hợp."
                  actionLabel="Thêm nhân viên đầu tiên"
                  onAction={addEmployee}
                  style={{ height: '450px' }}
                />
              ) : (
                <div className="sheet-canvas-wrapper" style={getZoomWidthStyle()}>
                  
                  {/* 1. SINGLE SLIP MODE */}
                  {previewMode === 'single' && (
                    <div className="preview-receipt-card" style={{ width: '100%', margin: '0 auto' }}>
                      <div className="receipt-card-header print-hidden">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {activeView === 'receipt' && activeEmployee && (
                            <input 
                              type="checkbox" 
                              checked={selectedEmployeeIds.has(activeEmployee.id)} 
                              onChange={() => handleToggleEmployeeSelection(activeEmployee.id)} 
                            />
                          )}
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>
                            {activeView === 'receipt' && activeEmployee
                              ? `Phiếu #${currentEmployeeIndex + 1} - ${activeEmployee.name}`
                              : `Bảng Tổng Hợp Lương (${payMonth})`
                            }
                          </span>
                        </div>
                        
                        {activeView === 'receipt' && activeEmployee && validationMap[activeEmployee.id] && (
                          <span className="warning-pill-indicator">
                            ⚠️ Cảnh báo dữ liệu
                          </span>
                        )}
                      </div>
                      
                      <div 
                        className="receipt-svg-holder" 
                        dangerouslySetInnerHTML={{ __html: getActiveSvgText(activeView === 'receipt' ? activeEmployee : undefined) }} 
                      />
                    </div>
                  )}

                  {/* 2. LIST CONTINUOUS SLIP MODE */}
                  {previewMode === 'list' && activeView === 'receipt' && (
                    <div className="continuous-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                      {employees.map((emp, index) => (
                        <div key={emp.id} className="preview-receipt-card" style={{ width: '100%', margin: '0 auto' }}>
                          <div className="receipt-card-header print-hidden">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedEmployeeIds.has(emp.id)} 
                                onChange={() => handleToggleEmployeeSelection(emp.id)} 
                              />
                              <span>Phiếu #${index + 1} - {emp.name}</span>
                            </div>
                            {validationMap[emp.id] && (
                              <span className="warning-pill-indicator">
                                ⚠️ Cảnh báo
                              </span>
                            )}
                          </div>
                          <div className="receipt-svg-holder" dangerouslySetInnerHTML={{ __html: getActiveSvgText(emp) }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. THUMBNAIL PREVIEW GRID */}
                  {previewMode === 'thumbnail' && activeView === 'receipt' && (
                    <div className="thumbnail-grid-layout">
                      {employees.map((emp, index) => (
                        <div 
                          key={emp.id} 
                          className={`thumbnail-preview-card ${currentEmployeeIndex === index ? 'active' : ''}`}
                          onClick={() => { setCurrentEmployeeIndex(index); setPreviewMode('single'); }}
                        >
                          <div className="thumbnail-card-header">
                            <input 
                              type="checkbox" 
                              checked={selectedEmployeeIds.has(emp.id)} 
                              onClick={e => e.stopPropagation()}
                              onChange={() => handleToggleEmployeeSelection(emp.id)} 
                            />
                            <span>#{index + 1} - {emp.name}</span>
                          </div>
                          <div className="thumbnail-svg-render" dangerouslySetInnerHTML={{ __html: getActiveSvgText(emp) }} />
                          {validationMap[emp.id] && (
                            <div className="thumbnail-warning-overlay">⚠️ Lỗi dữ liệu</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Desktop bottom navigator - hidden on mobile viewports */}
            {!isMobileScreen && employees.length > 0 && activeView === 'receipt' && (
              <div className="preview-bottom-navigator print-hidden">
                <div className="navigator-filter-toolbar">
                  <div className="search-field-box">
                    <Search size={14} className="search-icon" />
                    <input 
                      type="text" 
                      placeholder="Tìm nhân viên..." 
                      className="form-control"
                      value={searchEmployeeQuery}
                      onChange={e => setSearchEmployeeQuery(e.target.value)}
                    />
                  </div>
                  <div className="filter-buttons-box">
                    <button type="button" className={`filter-tag ${navigatorFilter === 'all' ? 'active' : ''}`} onClick={() => setNavigatorFilter('all')}>Tất cả ({employees.length})</button>
                    <button type="button" className={`filter-tag ${navigatorFilter === 'invalid' ? 'active' : ''}`} onClick={() => setNavigatorFilter('invalid')}>Cảnh báo ({Object.keys(validationMap).length})</button>
                    <button type="button" className={`filter-tag ${navigatorFilter === 'valid' ? 'active' : ''}`} onClick={() => setNavigatorFilter('valid')}>Đủ chuẩn</button>
                  </div>
                </div>

                <div className="navigator-horizontal-scroll">
                  {filteredNavigatorEmployees.map(emp => {
                    const idx = employees.findIndex(e => e.id === emp.id);
                    const isActive = currentEmployeeIndex === idx;
                    const hasWarning = !!validationMap[emp.id];
                    
                    return (
                      <div 
                        key={emp.id} 
                        className={`navigator-item-card ${isActive ? 'active' : ''} ${hasWarning ? 'warn' : ''}`}
                        onClick={() => { setCurrentEmployeeIndex(idx); setPreviewMode('single'); }}
                      >
                        <div className="nav-item-meta">
                          <span className="name">{emp.name}</span>
                          <span className="sub">{emp.days} {isHourly ? 'giờ' : 'công'} • {formatMoney(emp.amount)}</span>
                        </div>
                        {hasWarning && <span className="nav-item-warn-tag">⚠️</span>}
                      </div>
                    );
                  })}
                  {filteredNavigatorEmployees.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem', width: '100%', textAlign: 'center' }}>
                      Không tìm thấy nhân viên phù hợp bộ lọc.
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* Mobile Employee List selector Drawer / Bottom Sheet */}
      {isMobileScreen && showMobileEmpList && (
        <>
          <div className="dropdown-click-outside-backdrop" onClick={() => setShowMobileEmpList(false)} style={{ zIndex: 2002, background: 'rgba(5, 11, 30, 0.7)' }} />
          <div className="bank-dropdown-popover" style={{ zIndex: 2101, maxHeight: '80vh', height: '80vh', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div className="bank-dropdown-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
              <span style={{ fontSize: '14px', color: 'white', fontWeight: 700 }}>Danh sách nhân viên ({employees.length})</span>
              <button type="button" className="close-dropdown-btn" onClick={() => setShowMobileEmpList(false)} style={{ background: 'none', border: 0, color: 'white', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div className="search-field-box" style={{ marginBottom: '12px', flexShrink: 0 }}>
              <Search size={14} className="search-icon" />
              <input 
                type="text" 
                placeholder="Tìm nhân viên..." 
                className="form-control"
                value={searchEmployeeQuery}
                onChange={e => setSearchEmployeeQuery(e.target.value)}
              />
            </div>

            <div className="bank-options-list" style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredNavigatorEmployees.map((emp) => {
                const idx = employees.findIndex(e => e.id === emp.id);
                const isCurrent = currentEmployeeIndex === idx;
                const hasWarning = !!validationMap[emp.id];
                return (
                  <div 
                    key={emp.id}
                    className={`navigator-item-card ${isCurrent ? 'active' : ''} ${hasWarning ? 'warn' : ''}`}
                    onClick={() => {
                      setCurrentEmployeeIndex(idx);
                      setPreviewMode('single');
                      setShowMobileEmpList(false);
                    }}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px', 
                      borderRadius: '10px', 
                      background: isCurrent ? 'var(--blue)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isCurrent ? 'var(--blue)' : 'rgba(255,255,255,0.05)'}`,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <strong style={{ color: 'white', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {emp.name || '(Chưa điền tên)'}
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {emp.days} {isHourly ? 'giờ' : 'công'} • Lương: {formatMoney(emp.salary)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: isCurrent ? 'white' : 'var(--green)' }}>
                        {formatMoney(emp.amount)}
                      </span>
                      {hasWarning && <span style={{ fontSize: '14px' }}>⚠️</span>}
                    </div>
                  </div>
                );
              })}
              {filteredNavigatorEmployees.length === 0 && (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Không tìm thấy nhân viên phù hợp.
                </div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
