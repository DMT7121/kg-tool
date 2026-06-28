import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Download, 
  Save, 
  RefreshCw,
  TrendingDown,
  UploadCloud,
  Loader2,
  Printer,
  FileText,
  Archive,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertTriangle,
  Minimize2,
  Maximize2
} from 'lucide-react';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import './PayrollCreator.css';
import { StatCard, EmptyState, GuidePanel } from './components/Shared';

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
  const [salaryMode, setSalaryMode] = useState<'monthly' | 'hourly'>('monthly');
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
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');
  const [navigatorFilter, setNavigatorFilter] = useState<'all' | 'valid' | 'invalid' | 'deduction' | 'advance'>('all');
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  
  const [printScope, setPrintScope] = useState<'current' | 'all' | 'selected'>('current');
  const [paperSize, setPaperSize] = useState<'a4' | 'k80'>('a4');

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

  // Recalculate employee payout amount when basic salary or days changes
  const updateEmployeeSalary = (id: string, salaryVal: string) => {
    const rawSal = onlyNumber(salaryVal);
    setEmployees(prev => prev.map(e => {
      if (e.id === id) {
        let amount = 0;
        if (salaryMode === 'hourly') {
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
        if (salaryMode === 'hourly') {
          amount = roundSalary(e.salary * daysVal);
        } else {
          amount = roundSalary(e.salary * daysVal / standardDays);
        }
        return { ...e, days: daysVal, amount };
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
      if (salaryMode === 'hourly') {
        amount = roundSalary(e.salary * e.days);
      } else {
        amount = roundSalary(e.salary * e.days / standardDays);
      }
      return { ...e, amount };
    }));
  }, [salaryMode, standardDays, roundMode]);

  const loadSampleData = () => {
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
  };

  const addEmployee = () => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 4);
    setEmployees(prev => [
      ...prev,
      {
        id,
        name: `Nhân viên mới ${prev.length + 1}`,
        days: salaryMode === 'hourly' ? 160 : 26,
        range: '',
        salary: salaryMode === 'hourly' ? 35000 : 10000000,
        amount: salaryMode === 'hourly' ? roundSalary(35000 * 160) : roundSalary(10000000 * 26 / standardDays)
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
    let rounded = n;
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
      const netAmount = Number(emp.amount || 0) - advance - totalDeduct;
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
    const infoDays = isHourly ? (emp.range ? `${emp.days} giờ (${emp.range})` : `${emp.days} giờ`) : (emp.range ? `${emp.days} công (${emp.range})` : `${emp.days} công`);
    
    const row1Label = isHourly ? "Lương giờ (đ)" : "Mức lương cơ bản";
    const row2Label = isHourly ? "Tổng số giờ" : "Công định mức / Thực tế";
    const row2Val = isHourly ? `${emp.days} giờ` : `${standardDays} / ${infoDays}`;
    const row3Label = isHourly ? "Công thức tính" : "Hệ số tính lương";
    const row3Val = isHourly ? "Lương giờ × Số giờ" : `${emp.days}/${standardDays}`;

    const lineCount = visibility.showSignatures ? 540 : 420;

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 ${lineCount}" fill="none" role="img" aria-label="Phiếu lương K80 ${escapeHtml(emp.name)}">
      <rect width="320" height="${lineCount}" fill="#fff"/>
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
      
      <text x="160" y="32" class="k80-title">PHIẾU LƯƠNG K80</text>
      <text x="160" y="48" class="k80-subtitle">${mLabel}</text>
      
      <line x1="15" y1="62" x2="305" y2="62" class="k80-divider" />
      
      ${visibility.showEmpName ? `
        <text x="20" y="85" class="k80-bold">Họ và tên:</text>
        <text x="110" y="85" class="k80-text">${escapeHtml(emp.name)}</text>
      ` : ''}
      
      ${visibility.showEmpRole ? `
        <text x="20" y="105" class="k80-bold">Chức vụ:</text>
        <text x="110" y="105" class="k80-text">${escapeHtml(defaultPosition)}</text>
      ` : ''}
      
      ${visibility.showEmpDept ? `
        <text x="20" y="125" class="k80-bold">Bộ phận:</text>
        <text x="110" y="125" class="k80-text">${escapeHtml(defaultDept)}</text>
      ` : ''}

      <line x1="15" y1="140" x2="305" y2="140" class="k80-divider" />
      
      <text x="20" y="165" class="k80-text">${row1Label}</text>
      <text x="300" y="165" text-anchor="end" class="k80-text">${visibility.showBaseSalary ? formatMoney(emp.salary) : '***'}</text>
      
      <text x="20" y="190" class="k80-text">${row2Label}</text>
      <text x="300" y="190" text-anchor="end" class="k80-text">${row2Val}</text>
      
      <text x="20" y="215" class="k80-text">${row3Label}</text>
      <text x="300" y="215" text-anchor="end" class="k80-text">${row3Val}</text>
      
      <line x1="15" y1="235" x2="305" y2="235" class="k80-divider" />
      
      <text x="20" y="262" class="k80-total">TỔNG THỰC NHẬN</text>
      <text x="300" y="265" class="k80-price">${formatMoney(emp.amount)}</text>
      
      ${visibility.showNotes ? `
        <text x="20" y="300" class="k80-text" font-style="italic">Bằng chữ:</text>
        <rect x="20" y="310" width="280" height="40" fill="#f8fafc" rx="4" stroke="#e2e8f0" stroke-width="1"/>
        <text x="25" y="326" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#475569" width="270">
          ${escapeHtml(numberToVietnamese(emp.amount).substring(0, 48))}
        </text>
        <text x="25" y="340" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#475569" width="270">
          ${escapeHtml(numberToVietnamese(emp.amount).substring(48))}
        </text>
      ` : ''}

      ${visibility.showSignatures ? `
        <text x="160" y="380" text-anchor="middle" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#64748b">${escapeHtml(vDate)}</text>
        
        <text x="80" y="420" text-anchor="middle" class="k80-bold">Người nhận</text>
        <text x="80" y="435" text-anchor="middle" font-size="9" font-style="italic" fill="#64748b">(Ký tên)</text>
        
        <text x="240" y="420" text-anchor="middle" class="k80-bold">Người lập</text>
        <text x="240" y="435" text-anchor="middle" font-size="9" font-style="italic" fill="#64748b">(Ký tên)</text>
      ` : ''}
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

    const rows = employees.slice(0, 10).map((e, i) => {
      const y = 145 + i * 22;
      return `
        <text x="20" y="${y}" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#000">${i + 1}. ${escapeHtml(e.name.substring(0, 16))}</text>
        <text x="175" y="${y}" font-size="9" font-family="'${selectedFont}', sans-serif" text-anchor="middle" fill="#000">${e.days}${isHourly ? 'g' : ''}</text>
        <text x="300" y="${y}" font-size="9" font-family="'${selectedFont}', sans-serif" text-anchor="end" fill="#000">${formatMoney(e.amount)}</text>
      `;
    }).join('');

    const tableBottom = 135 + Math.max(employees.length, 3) * 22;
    const summaryTop = tableBottom + 15;
    const deductionsTop = summaryTop + 65;

    const deductionRows = deductions.map((d, i) => {
      const y = deductionsTop + 20 + i * 20;
      return `
        <text x="20" y="${y}" font-size="10" font-family="'${selectedFont}', sans-serif" fill="#000">${escapeHtml(d.label)}</text>
        <text x="300" y="${y}" font-size="10" font-family="'${selectedFont}', sans-serif" text-anchor="end" fill="#dc2626">${formatMoney(d.amount)}</text>
      `;
    }).join('');

    const netTop = deductionsTop + 30 + deductions.length * 20;
    const col2Header = isHourly ? "Giờ" : "Công";
    const bottomTotalLabel = isHourly ? "Tổng giờ làm việc" : "Tổng công nhân viên";
    
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 ${netTop + 140}" fill="none" role="img" aria-label="Phiếu tổng hợp lương K80">
      <rect width="320" height="${netTop + 140}" fill="#fff"/>
      <style>
        ${getGoogleFontsImport()}
        .k80-title { font-family: '${selectedFont}', system-ui, sans-serif; font-size: ${fontSizeTitle - 8}px; font-weight: ${titleWeight}; fill: #000; text-anchor: middle; }
        .k80-subtitle { font-family: '${selectedFont}', system-ui, sans-serif; font-size: 10px; fill: #000; text-anchor: middle; }
        .k80-divider { stroke: #000; stroke-width: 1; stroke-dasharray: 4, 3; }
        .k80-bold { font-family: '${selectedFont}', system-ui, sans-serif; font-size: 10px; font-weight: bold; fill: #000; }
      </style>
      
      <text x="160" y="32" class="k80-title">TỔNG HỢP LƯƠNG K80</text>
      <text x="160" y="48" class="k80-subtitle">${mLabel}</text>
      
      <line x1="15" y1="62" x2="305" y2="62" class="k80-divider" />
      
      <text x="20" y="80" class="k80-bold">Nhân viên</text>
      <text x="175" y="80" class="k80-bold" text-anchor="middle">${col2Header}</text>
      <text x="300" y="80" class="k80-bold" text-anchor="end">Thực nhận</text>
      
      <line x1="15" y1="90" x2="305" y2="90" stroke="#000" stroke-width="1"/>
      
      ${rows}
      
      <line x1="15" y1="${tableBottom}" class="k80-divider" />
      
      <text x="20" y="${summaryTop + 15}" font-size="10" font-family="'${selectedFont}', sans-serif" fill="#000">${bottomTotalLabel}</text>
      <text x="300" y="${summaryTop + 15}" font-size="10" font-family="'${selectedFont}', sans-serif" text-anchor="end" fill="#000">${totalDays}</text>
      
      <text x="20" y="${summaryTop + 35}" font-size="10" font-family="'${selectedFont}', sans-serif" fill="#000">Tổng tiền lương</text>
      <text x="300" y="${summaryTop + 35}" font-size="10" font-family="'${selectedFont}', sans-serif" text-anchor="end" fill="#000">${formatMoney(totalSalary)}</text>
      
      <text x="20" y="${summaryTop + 55}" font-size="10" font-family="'${selectedFont}', sans-serif" fill="#000">Tạm ứng</text>
      <text x="300" y="${summaryTop + 55}" font-size="10" font-family="'${selectedFont}', sans-serif" text-anchor="end" fill="#000">${formatMoney(advance)}</text>
      
      ${deductionRows}
      
      <line x1="15" y1="${netTop - 10}" class="k80-divider" />
      
      <text x="20" y="${netTop + 15}" font-size="12" font-family="'${selectedFont}', sans-serif" font-weight="700" fill="#000">THANH TOÁN THỰC NHẬN</text>
      <text x="300" y="${netTop + 15}" font-size="14" font-family="'${selectedFont}', sans-serif" font-weight="700" text-anchor="end" fill="#dc2626">${formatMoney(net)}</text>
      
      <text x="160" y="${netTop + 45}" text-anchor="middle" font-size="9" font-family="'${selectedFont}', sans-serif" fill="#64748b">${escapeHtml(vDate)}</text>
      <text x="80" y="${netTop + 75}" text-anchor="middle" class="k80-bold">Người lập</text>
      <text x="240" y="${netTop + 75}" text-anchor="middle" class="k80-bold">Kế toán trưởng</text>
    </svg>`;
  };

  const slipSvgModern = (emp: Employee) => {
    if (!emp) return '';
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const isHourly = salaryMode === 'hourly';
    const infoDays = isHourly ? (emp.range ? `${emp.days} giờ (${emp.range})` : `${emp.days} giờ`) : (emp.range ? `${emp.days} công (${emp.range})` : `${emp.days} công`);
    const words = numberToVietnamese(emp.amount);
    
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
        const filename = `phieu-luong-${emp.name.toLowerCase().replace(/\s+/g, '-')}-${payMonth}.png`;
        
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
    } else {
      document.body.classList.remove('print-k80-mode');
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

  // Warnings list
  const warningsList = useMemo(() => {
    return Object.values(validationMap).flat();
  }, [validationMap]);

  return (
    <div className={`payroll-creator ${isFullscreenPreview ? 'fullscreen-preview-active' : ''}`}>
      
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

      <div className={`payroll-layout ${isLeftPanelCollapsed ? 'left-panel-collapsed' : ''}`}>
        
        {/* LEFT COLUMN: Input form configs */}
        <div className="config-pane">
          
          {/* Section 1: General configurations */}
          <div className="glass-card collapsible-section">
            <div className="section-header" onClick={(e) => e.currentTarget.classList.toggle('collapsed')}>
              <span className="card-heading-title">⚙️ Cấu hình phiếu lương chung</span>
            </div>
            <div className="section-content">
              <div className="grid2">
                <div className="form-group">
                  <label className="form-label">Chế độ tính lương</label>
                  <select 
                    className="form-control" 
                    value={salaryMode} 
                    onChange={(e) => setSalaryMode(e.target.value as 'monthly' | 'hourly')}
                  >
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
            </div>
          </div>

          {/* Section 2: Bulk import / Sample Actions */}
          <div className="glass-card">
            <span className="card-heading-title" style={{ display: 'block', marginBottom: '1rem' }}>☁ Nhập dữ liệu hàng loạt / Thao tác</span>
            <div className="grid2">
              <input type="file" ref={fileInputRef} accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />
              <button className="primary" onClick={triggerCsvSelect} style={{ height: '44px', fontSize: '14px' }}>
                <UploadCloud size={16} />
                Nhập danh sách CSV
              </button>
              <button className="primary" onClick={loadSampleData} style={{ height: '44px', fontSize: '14px', background: 'rgba(20,40,90,.9)', boxShadow: 'none' }}>Tải dữ liệu mẫu</button>
            </div>
            <div className="bulk-import-row" style={{ marginTop: '0.75rem' }}>
              <button className="btn-outline" onClick={clearAllForms} style={{ flexGrow: 1, padding: '0.5rem' }}>Xóa form dữ liệu</button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Hỗ trợ định dạng: .csv, .xlsx, .xls</p>
          </div>

          {/* Section 3: Tùy chỉnh hiển thị */}
          <div className="glass-card collapsible-section">
            <div className="section-header" onClick={(e) => e.currentTarget.classList.toggle('collapsed')}>
              <span className="card-heading-title">👁️ Tùy chỉnh hiển thị phiếu</span>
            </div>
            <div className="section-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Chọn Preset nhanh</label>
                <div className="preset-toggle-container">
                  <button className="btn-outline small-btn" onClick={() => applyPreset('full')}>Đầy đủ</button>
                  <button className="btn-outline small-btn" onClick={() => applyPreset('compact')}>Rút gọn</button>
                  <button className="btn-outline small-btn" onClick={() => applyPreset('internal')}>Nội bộ</button>
                  <button className="btn-outline small-btn" onClick={() => applyPreset('k80')}>In nhiệt</button>
                </div>
              </div>

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
                  <input type="checkbox" checked={visibility.showBaseSalary} onChange={e => setVisibility((prev: any) => ({ ...prev, showBaseSalary: e.target.checked }))} />
                  <span>Mức lương cơ bản</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={visibility.showTime} onChange={e => setVisibility((prev: any) => ({ ...prev, showTime: e.target.checked }))} />
                  <span>Số giờ/Số công làm</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={visibility.showSignatures} onChange={e => setVisibility((prev: any) => ({ ...prev, showSignatures: e.target.checked }))} />
                  <span>Ký tên xác nhận</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={visibility.showNotes} onChange={e => setVisibility((prev: any) => ({ ...prev, showNotes: e.target.checked }))} />
                  <span>Ghi chú bằng chữ</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Kiểu chữ & Typography */}
          <div className="glass-card collapsible-section">
            <div className="section-header" onClick={(e) => e.currentTarget.classList.toggle('collapsed')}>
              <span className="card-heading-title">🔤 Kiểu chữ & Typography</span>
            </div>
            <div className="section-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Chọn Preset phong cách nhanh</label>
                <div className="preset-toggle-container">
                  <button className="btn-outline small-btn" onClick={() => applyTypographyPreset('modern')}>Hiện đại</button>
                  <button className="btn-outline small-btn" onClick={() => applyTypographyPreset('admin')}>Hành chính</button>
                  <button className="btn-outline small-btn" onClick={() => applyTypographyPreset('minimalist')}>Tối giản</button>
                  <button className="btn-outline small-btn" onClick={() => applyTypographyPreset('luxury')}>Sang trọng</button>
                  <button className="btn-outline small-btn" onClick={() => applyTypographyPreset('k80')}>In nhiệt K80</button>
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

              <button className="btn-outline" onClick={resetAllConfigurations} style={{ padding: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
                Khôi phục mặc định
              </button>
            </div>
          </div>

          {/* Section 5: Thiết lập in & Xuất bản */}
          <div className="glass-card collapsible-section">
            <div className="section-header" onClick={(e) => e.currentTarget.classList.toggle('collapsed')}>
              <span className="card-heading-title">🖨️ Thiết lập in ấn & Khổ giấy</span>
            </div>
            <div className="section-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
                  <select className="form-control" value={paperSize} onChange={e => setPaperSize(e.target.value as any)}>
                    <option value="a4">Khổ giấy chuẩn A4 / A5</option>
                    <option value="k80">Khổ giấy in nhiệt K80 (80mm)</option>
                  </select>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cài đặt này sẽ được áp dụng trực tiếp khi bạn bấm nút In Phiếu.</p>
            </div>
          </div>

          {/* Section 6: Nhập dữ liệu nhân viên */}
          <div className="glass-card">
            <span className="card-heading-title" style={{ display: 'block', marginBottom: '1rem' }}>👥 Nhập dữ liệu nhân viên ({employees.length})</span>
            <div className="grid2" style={{ marginBottom: '1.25rem' }}>
              <button className="primary" onClick={addEmployee} style={{ height: '44px', fontSize: '14px' }}>
                <Plus size={14} />
                Thêm nhân viên
              </button>
              <button className="primary" onClick={() => {
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
              }} style={{ height: '44px', fontSize: '14px', background: 'rgba(20,40,90,.9)', boxShadow: 'none' }}>
                Dán dữ liệu
              </button>
            </div>

            <div className="employees-list-container">
              {employees.map((emp, idx) => (
                <div key={emp.id} className="employee-input-row">
                  <div className="employee-row-title">
                    <span>👤 Nhân viên #{idx + 1}</span>
                    <button className="btn-danger small-btn" style={{ padding: '2px 6px' }} onClick={() => deleteEmployee(emp.id)}>Xóa</button>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Họ và tên</label>
                    <input type="text" className="form-control" value={emp.name} onChange={(e) => updateEmployeeDetails(emp.id, 'name', e.target.value)} />
                  </div>

                  <div className="grid3">
                    <div className="form-group">
                      <label className="form-label">{isHourly ? 'Số giờ làm' : 'Số công'}</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0" 
                        className="form-control" 
                        value={emp.days} 
                        onChange={(e) => updateEmployeeDays(emp.id, Number(e.target.value) || 0)} 
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Thời gian làm việc</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="01/06 - 30/06" 
                        value={emp.range} 
                        onChange={(e) => updateEmployeeDetails(emp.id, 'range', e.target.value)} 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{isHourly ? 'Lương giờ' : 'Lương cơ bản'}</label>
                      <input 
                        type="text" 
                        className="form-control" 
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
                </div>
              ))}
              {employees.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Chưa có nhân viên nào. Vui lòng thêm thủ công hoặc tải file CSV mẫu.
                </div>
              )}
            </div>
          </div>

          {/* Section 7: Deductions */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="card-heading-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingDown size={18} />
                Khoản khấu trừ chung ({deductions.length})
              </span>
              <button className="btn-primary small-btn" onClick={addDeduction}>
                <Plus size={14} />
                Thêm khấu trừ
              </button>
            </div>

            <div className="deductions-list-container">
              {deductions.map(d => (
                <div key={d.id} className="deduction-input-row">
                  <div className="employee-row-title">
                    <span>💸 Khấu trừ</span>
                    <button className="btn-danger small-btn" style={{ padding: '2px 6px' }} onClick={() => deleteDeduction(d.id)}>Xóa</button>
                  </div>
                  <div className="grid2">
                    <div className="form-group">
                      <label className="form-label">Nội dung</label>
                      <input type="text" className="form-control" placeholder="BHXH, Đồng phục..." value={d.label} onChange={(e) => updateDeduction(d.id, 'label', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Số tiền (đ)</label>
                      <input 
                        type="text" 
                        className="form-control" 
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
          </div>

          {/* Section 8: Google Sheets Sync Controls */}
          <div className="glass-card sync-box">
            <div className="sync-status">
              <span className={`sync-dot ${syncStatus}`}></span>
              <span>Google Sheets Sync: </span>
              <strong>{syncStatus === 'online' ? 'Sẵn sàng' : syncStatus === 'loading' ? 'Đang đồng bộ...' : 'Chưa kết nối'}</strong>
            </div>

            <div className="bulk-import-row" style={{ marginTop: '0.75rem' }}>
              <button className="primary" style={{ flexGrow: 1 }} onClick={savePayrollToGAS} disabled={syncStatus === 'loading'}>
                <Save size={16} />
                Lưu Cloud (Google Sheets)
              </button>
              <button className="btn-ghost" onClick={fetchHistoryMonths} disabled={syncStatus === 'loading'} title="Tải lại lịch sử">
                <RefreshCw size={16} className={syncStatus === 'loading' ? 'spinner' : ''} />
              </button>
            </div>

            <div className="history-list-header">Lịch sử tháng lương đã lưu:</div>
            <div className="history-items-list">
              {historyMonths.map(h => (
                <div key={h.month} className="history-item-row" onClick={() => loadHistoryMonth(h.month)}>
                  <div className="history-meta">
                    <span className="h-month">Tháng {h.month.split('-')[1]}/{h.month.split('-')[0]}</span>
                    <span className="h-info">Ghi bởi: {h.operator} - {h.updatedTime}</span>
                  </div>
                  <button 
                    className="btn-danger small-btn" 
                    style={{ padding: '3px 6px', fontSize: '10px' }} 
                    onClick={(e) => { e.stopPropagation(); deleteHistoryMonth(h.month); }}
                  >
                    Xóa
                  </button>
                </div>
              ))}
              {historyMonths.length === 0 && (
                <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chưa có dữ liệu nào lưu trữ đám mây.</div>
              )}
            </div>
          </div>

          {/* Section 9: Validation Messages */}
          {warningsList.length > 0 && (
            <div className="glass-card" style={{ border: '1px solid rgba(255, 92, 122, 0.4)', background: 'rgba(255, 92, 122, 0.05)' }}>
              <span className="card-heading-title" style={{ color: '#ff5c7a' }}>
                <AlertTriangle size={18} />
                Cảnh báo dữ liệu ({warningsList.length})
              </span>
              <div className="warnings-container-scroll" style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
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
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Live dynamic preview rendering */}
        <div className="preview-pane">
          
          {/* Preview Tab Control Panel */}
          <div className="preview-header-panel">
            <div className="preview-views-toggle">
              <button 
                className={`view-toggle-btn ${activeView === 'receipt' ? 'active' : ''}`} 
                onClick={() => { setActiveView('receipt'); setPreviewMode('single'); }}
              >
                📄 Phiếu Lương Nhân Viên
              </button>
              <button 
                className={`view-toggle-btn ${activeView === 'summary' ? 'active' : ''}`} 
                onClick={() => { setActiveView('summary'); setPreviewMode('single'); }}
              >
                📊 Bảng Tổng Hợp Lương
              </button>
            </div>

            <div className="preview-templates-toggle">
              <button className={`template-toggle-btn ${activeTemplate === 'standard' ? 'active' : ''}`} onClick={() => setActiveTemplate('standard')}>
                Mẫu chuẩn
              </button>
              <button className={`template-toggle-btn ${activeTemplate === 'k80' ? 'active' : ''}`} onClick={() => setActiveTemplate('k80')}>
                Hóa đơn nhiệt K80
              </button>
              <button className={`template-toggle-btn ${activeTemplate === 'modern' ? 'active' : ''}`} onClick={() => setActiveTemplate('modern')}>
                Mẫu hiện đại
              </button>
            </div>
          </div>

          {/* Quick Metrics display bar */}
          <div className="preview-toolbar-bar">
            {/* Left toolbar items: scale & view modes */}
            <div className="toolbar-left-group">
              <div className="zoom-controller-box">
                <span style={{ fontSize: '12px' }}>Tỷ lệ:</span>
                <select className="form-control select-compact" style={{ width: '90px' }} value={zoomLevel} onChange={e => setZoomLevel(Number(e.target.value))}>
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
                  <button className={`mode-toggle-btn ${previewMode === 'single' ? 'active' : ''}`} onClick={() => setPreviewMode('single')} title="Xem từng phiếu">Phiếu</button>
                  <button className={`mode-toggle-btn ${previewMode === 'list' ? 'active' : ''}`} onClick={() => setPreviewMode('list')} title="Xem danh sách liên tiếp">Liên tiếp</button>
                  <button className={`mode-toggle-btn ${previewMode === 'thumbnail' ? 'active' : ''}`} onClick={() => setPreviewMode('thumbnail')} title="Xem danh mục thu nhỏ">Thumbnail</button>
                </div>
              )}

              <button className="btn-ghost" onClick={() => setIsFullscreenPreview(!isFullscreenPreview)} title="Bật/Tắt toàn màn hình preview">
                {isFullscreenPreview ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button className="btn-ghost" onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)} title="Ẩn/Hiện cột tùy chỉnh">
                {isLeftPanelCollapsed ? ' Hiện cấu hình ›' : '‹ Ẩn cấu hình'}
              </button>
            </div>

            {/* Right toolbar items: Export actions */}
            <div className="toolbar-right-group">
              {activeView === 'receipt' && previewMode === 'single' && (
                <div className="employee-navigator-widget">
                  <button className="btn-ghost" onClick={handlePrevEmployee} disabled={currentEmployeeIndex === 0}>
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'white', minWidth: '70px', textAlign: 'center' }}>
                    {employees.length > 0 ? `${currentEmployeeIndex + 1} / ${employees.length}` : '0 / 0'}
                  </span>
                  <button className="btn-ghost" onClick={handleNextEmployee} disabled={currentEmployeeIndex === employees.length - 1}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              <div className="action-buttons-box">
                <button className="primary" onClick={handlePrint} style={{ height: '36px', fontSize: '13px', padding: '0 12px' }}>
                  <Printer size={14} />
                  In Phiếu
                </button>
                <button className="primary" onClick={() => handleDownloadPng()} style={{ height: '36px', fontSize: '13px', padding: '0 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}>
                  <Download size={14} />
                  Xuất PNG
                </button>
                {employees.length > 1 && (
                  <button className="primary" onClick={handleDownloadZip} style={{ height: '36px', fontSize: '13px', padding: '0 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}>
                    <Archive size={14} />
                    Tải ZIP
                  </button>
                )}
                <button className="primary" onClick={() => handleDownloadPdf()} style={{ height: '36px', fontSize: '13px', padding: '0 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}>
                  <FileText size={14} />
                  Xuất PDF
                </button>
              </div>
            </div>
          </div>

          {/* Export Loader Overlay */}
          {isExporting && (
            <div className="export-progress-overlay">
              <div className="export-progress-card">
                <Loader2 className="spinner" size={32} />
                <h3>Đang tạo tệp xuất...</h3>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${exportProgress}%` }}></div>
                </div>
                <span>Hoàn thành {exportProgress}%</span>
              </div>
            </div>
          )}

          {/* Render target content */}
          <div className="preview-scroll-container">
            {employees.length === 0 ? (
              <EmptyState 
                icon="📄"
                title="Chưa có phiếu lương để hiển thị"
                description="Vui lòng nhập thông tin nhân viên hoặc tải file CSV dữ liệu chấm công ở cột bên trái để bắt đầu tạo phiếu lương và bảng tổng hợp."
                actionLabel="Thêm nhân viên đầu tiên"
                onAction={addEmployee}
                style={{ height: '550px' }}
              />
            ) : (
              <div className="sheet-canvas-wrapper" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}>
                
                {/* 1. SINGLE SLIP MODE */}
                {previewMode === 'single' && (
                  <div className="preview-receipt-card" style={{ maxWidth: activeTemplate === 'k80' ? '360px' : '900px', margin: '0 auto' }}>
                    <div className="receipt-card-header print-hidden">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {activeView === 'receipt' && activeEmployee && (
                          <input 
                            type="checkbox" 
                            checked={selectedEmployeeIds.has(activeEmployee.id)} 
                            onChange={() => handleToggleEmployeeSelection(activeEmployee.id)} 
                          />
                        )}
                        <span>
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
                  <div className="continuous-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {employees.map((emp, index) => (
                      <div key={emp.id} className="preview-receipt-card" style={{ maxWidth: activeTemplate === 'k80' ? '360px' : '900px', margin: '0 auto' }}>
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

          {/* Navigator bottom / Sidebar list for quick selection */}
          {employees.length > 0 && activeView === 'receipt' && (
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
                  <button className={`filter-tag ${navigatorFilter === 'all' ? 'active' : ''}`} onClick={() => setNavigatorFilter('all')}>Tất cả ({employees.length})</button>
                  <button className={`filter-tag ${navigatorFilter === 'invalid' ? 'active' : ''}`} onClick={() => setNavigatorFilter('invalid')}>Cảnh báo ({Object.keys(validationMap).length})</button>
                  <button className={`filter-tag ${navigatorFilter === 'valid' ? 'active' : ''}`} onClick={() => setNavigatorFilter('valid')}>Đủ chuẩn</button>
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

      </div>
    </div>
  );
}
