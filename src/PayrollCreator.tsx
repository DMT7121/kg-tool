import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Plus, 
  Download, 
  FileText, 
  Save, 
  RefreshCw,
  TrendingDown,
  UploadCloud
} from 'lucide-react';
import './PayrollCreator.css';

// Styling Themes (Colors match standard layouts)
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

// Format Utilities
const escapeHtml = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c] || ''));
const onlyNumber = (v: any) => Number(String(v ?? '').replace(/\./g, '').replace(/[^0-9-]/g, '')) || 0;
const formatMoney = (n: number) => Math.round(n).toLocaleString('vi-VN');
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
  const [roundMode, setRoundMode] = useState<'dong' | 'thousand'>('dong');
  const [advance, setAdvance] = useState(10000000);

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
        setRoundMode(data.roundMode || 'dong');
        setAdvance(Number(data.advance) || 0);
        setEmployees(data.employees || []);
        setDeductions(data.deductions || []);
        setActiveTemplate(data.activeTemplate || 'standard');
      } catch (e) {
        console.error(e);
        loadSampleData();
      }
    } else {
      loadSampleData();
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
      roundMode,
      advance,
      employees,
      deductions,
      activeTemplate
    };
    localStorage.setItem('kg_tool_payroll_state', JSON.stringify(stateObj));
  }, [salaryMode, payMonth, voucherDate, standardDays, defaultPosition, defaultDept, roundMode, advance, employees, deductions, activeTemplate]);

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
  };

  const deleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
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
        if (idx === 0 || !line.trim()) return; // skip header/empty
        
        // Handle split by comma or semicolon
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
        setRoundMode(data.roundMode || 'dong');
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

  // SVG Receipt Generators (translated from app.js)
  const slipSvgStandard = (emp: Employee) => {
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const isHourly = salaryMode === 'hourly';
    const infoDays = isHourly ? (emp.range ? `${emp.days} giờ (${emp.range})` : `${emp.days} giờ`) : (emp.range ? `${emp.days} công (${emp.range})` : `${emp.days} công`);
    const words = numberToVietnamese(emp.amount);
    
    const row1Label = isHourly ? "Lương cơ bản theo giờ" : "Mức lương cơ bản";
    const row1Val = `${formatMoney(emp.salary)} / giờ`;
    const row2Label = isHourly ? "Tổng số giờ làm việc" : "Số công định mức";
    const row2Val = isHourly ? `${emp.days} giờ` : `${standardDays} công`;
    const row3Label = isHourly ? "Thời gian làm việc" : "Số công thực tế";
    const row3Val = infoDays;
    const row4Label = isHourly ? "Hệ số hoàn thành" : "Hệ số tính lương";
    const row4Val = isHourly ? "1.00" : `${emp.days} / ${standardDays}`;
    const row5Label = isHourly ? "Tiền lương thực nhận" : "Lương thực nhận";
    const row5Formula = isHourly ? `${formatMoney(emp.salary)} × ${emp.days} giờ` : `${formatMoney(emp.salary)} × ${emp.days}/${standardDays}`;
    
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" role="img" aria-label="Phiếu lương ${escapeHtml(emp.name)}">
      <rect x="16" y="16" width="968" height="1368" rx="0" fill="#fff" stroke="${THEMES.blue}" stroke-width="4"/>
      <rect x="26" y="26" width="948" height="1348" rx="0" fill="none" stroke="${THEMES.blue}" stroke-width="2" opacity=".9"/>
      
      <text x="500" y="120" text-anchor="middle" font-family="Georgia, serif" font-size="60" font-weight="700" fill="${THEMES.blue}">PHIẾU LƯƠNG NHÂN VIÊN</text>
      <text x="500" y="190" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-weight="700" fill="${THEMES.blue}">${mLabel}</text>

      <text x="70" y="285" font-family="Georgia, serif" font-size="26" font-weight="700">Họ và tên</text>
      <text x="245" y="285" font-family="Georgia, serif" font-size="26" font-weight="700">:</text>
      <text x="285" y="285" font-family="Georgia, serif" font-size="26">${escapeHtml(emp.name)}</text>
      
      <text x="70" y="345" font-family="Georgia, serif" font-size="26" font-weight="700">Chức vụ</text>
      <text x="245" y="345" font-family="Georgia, serif" font-size="26" font-weight="700">:</text>
      <text x="285" y="345" font-family="Georgia, serif" font-size="26">${escapeHtml(defaultPosition)}</text>
      
      <text x="70" y="405" font-family="Georgia, serif" font-size="26" font-weight="700">Bộ phận</text>
      <text x="245" y="405" font-family="Georgia, serif" font-size="26" font-weight="700">:</text>
      <text x="285" y="405" font-family="Georgia, serif" font-size="26">${escapeHtml(defaultDept)}</text>

      <rect x="45" y="465" width="910" height="510" fill="#fff" stroke="${THEMES.blue}" stroke-width="2"/>
      <rect x="45" y="465" width="910" height="76" fill="${THEMES.lightBlue}" opacity=".75"/>
      <line x1="140" y1="465" x2="140" y2="975" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="455" y1="465" x2="455" y2="975" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="770" y1="465" x2="770" y2="975" stroke="${THEMES.blue}" stroke-width="2"/>
      
      ${[541, 622, 703, 784, 865, 975].map(y => `<line x1="45" y1="${y}" x2="955" y2="${y}" stroke="${THEMES.blue}" stroke-width="2"/>`).join('')}
      
      <text x="92" y="515" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" fill="${THEMES.blue}">STT</text>
      <text x="300" y="515" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" fill="${THEMES.blue}">NỘI DUNG THANH TOÁN</text>
      <text x="612" y="515" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" fill="${THEMES.blue}">THÔNG TIN</text>
      <text x="862" y="515" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" fill="${THEMES.blue}">SỐ TIỀN (đ)</text>

      ${[1, 2, 3, 4, 5].map((n, i) => `<text x="92" y="${590 + i * 81}" text-anchor="middle" font-family="Georgia, serif" font-size="26">${n}</text>`).join('')}
      
      <text x="165" y="590" font-family="Georgia, serif" font-size="24">${row1Label}</text>
      <text x="928" y="590" text-anchor="end" font-family="Georgia, serif" font-size="24">${row1Val}</text>
      
      <text x="165" y="671" font-family="Georgia, serif" font-size="24">${row2Label}</text>
      <text x="505" y="671" font-family="Georgia, serif" font-size="24">${row2Val}</text>
      
      <text x="165" y="752" font-family="Georgia, serif" font-size="24">${row3Label}</text>
      <text x="505" y="752" font-family="Georgia, serif" font-size="24">${escapeHtml(row3Val)}</text>
      
      <text x="165" y="833" font-family="Georgia, serif" font-size="24">${row4Label}</text>
      <text x="505" y="833" font-family="Georgia, serif" font-size="24">${row4Val}</text>
      
      <text x="165" y="914" font-family="Georgia, serif" font-size="24" font-weight="700">${row5Label}</text>
      <text x="505" y="914" font-family="Georgia, serif" font-size="24">${row5Formula}</text>
      <text x="928" y="914" text-anchor="end" font-family="Georgia, serif" font-size="24" font-weight="700">${formatMoney(emp.amount)}</text>

      <rect x="45" y="1005" width="910" height="108" fill="${THEMES.lightBlue}" opacity=".8" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="690" y1="1005" x2="690" y2="1113" stroke="${THEMES.blue}" stroke-width="2"/>
      <text x="70" y="1070" font-family="Georgia, serif" font-size="30" font-weight="700" fill="${THEMES.blue}">TỔNG TIỀN THỰC NHẬN</text>
      <text x="930" y="1072" text-anchor="end" font-family="Georgia, serif" font-size="40" font-weight="700" fill="${THEMES.red}">${formatMoney(emp.amount)} đ</text>
      
      <text x="500" y="1165" text-anchor="middle" font-family="Georgia, serif" font-size="24" font-style="italic">(Bằng chữ: ${escapeHtml(words)})</text>
      <text x="70" y="1260" font-family="Georgia, serif" font-size="24">${escapeHtml(vDate)}</text>
      <text x="750" y="1260" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700">Người nhận lương</text>
      <text x="750" y="1300" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-style="italic">(Ký và ghi rõ họ tên)</text>
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

    const rows = employees.slice(0, 10).map((e, i) => {
      const y = 382 + i * 66;
      return `
        <text x="75" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="20">${i + 1}</text>
        <text x="125" y="${y}" font-family="Georgia, serif" font-size="20">${escapeHtml(e.name)}</text>
        <text x="462" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="20">${e.days}${isHourly ? 'g' : ''}</text>
        <text x="590" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="18">${escapeHtml(e.range || '-')}</text>
        <text x="738" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="18">${formatMoney(e.salary)}</text>
        <text x="890" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="18">${formatMoney(e.amount)}</text>`;
    }).join('');

    const tableBottom = 330 + Math.max(employees.length, 5) * 66;
    const summaryTop = tableBottom + 28;
    
    const deductionRows = deductions.map((d, i) => {
      const y = summaryTop + 225 + i * 58;
      return `
        <line x1="45" y1="${y - 40}" x2="955" y2="${y - 40}" stroke="${THEMES.blue}" stroke-width="2"/>
        <text x="70" y="${y}" font-family="Georgia, serif" font-size="22" font-weight="700">${escapeHtml(d.label)}</text>
        <text x="928" y="${y}" text-anchor="end" font-family="Georgia, serif" font-size="22" font-weight="700" fill="${THEMES.red}">${formatMoney(d.amount)}</text>`;
    }).join('');
    
    const netTop = summaryTop + 245 + deductions.length * 58;
    const bottomTotalLabel = isHourly ? "TỔNG SỐ GIỜ LÀM CỦA NHÂN VIÊN" : "TỔNG SỐ CÔNG CỦA NHÂN VIÊN";
    const bottomTotalVal = isHourly ? `${totalDays} giờ` : `${totalDays} công`;
    
    const col3Header = isHourly ? "SỐ GIỜ" : "SỐ CÔNG";
    const col3SubHeader = isHourly ? "LÀM VIỆC" : "THỰC TẾ";
    const col5Header = isHourly ? "LƯƠNG GIỜ" : "MỨC LƯƠNG";
    const col5SubHeader = isHourly ? "(ĐƠN GIÁ)" : `(${standardDays} CÔNG)`;

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" role="img" aria-label="Phiếu tổng hợp lương">
      <rect x="16" y="16" width="968" height="1368" rx="0" fill="#fff" stroke="${THEMES.blue}" stroke-width="4"/>
      <rect x="26" y="26" width="948" height="1348" rx="0" fill="none" stroke="${THEMES.blue}" stroke-width="2" opacity=".9"/>
      
      <text x="500" y="105" text-anchor="middle" font-family="Georgia, serif" font-size="50" font-weight="700" fill="${THEMES.blue}">PHIẾU TỔNG HỢP LƯƠNG</text>
      <text x="500" y="165" text-anchor="middle" font-family="Georgia, serif" font-size="30" font-weight="700" fill="${THEMES.blue}">${mLabel}</text>

      <rect x="45" y="220" width="910" height="${tableBottom - 220}" fill="#fff" stroke="${THEMES.blue}" stroke-width="2"/>
      <rect x="45" y="220" width="910" height="78" fill="${THEMES.lightBlue}" opacity=".75"/>
      <line x1="105" y1="220" x2="105" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="390" y1="220" x2="390" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="530" y1="220" x2="530" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="650" y1="220" x2="650" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="825" y1="220" x2="825" y2="${tableBottom}" stroke="${THEMES.blue}" stroke-width="2"/>
      
      ${Array.from({ length: Math.max(employees.length, 5) + 1 }, (_, i) => 298 + i * 66).map(y => `<line x1="45" y1="${y}" x2="955" y2="${y}" stroke="${THEMES.blue}" stroke-width="2"/>`).join('')}
      
      <text x="75" y="270" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700" fill="${THEMES.blue}">STT</text>
      <text x="245" y="270" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700" fill="${THEMES.blue}">HỌ VÀ TÊN</text>
      <text x="462" y="255" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${THEMES.blue}">${col3Header}</text>
      <text x="462" y="285" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${THEMES.blue}">${col3SubHeader}</text>
      <text x="590" y="255" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${THEMES.blue}">THỜI GIAN</text>
      <text x="590" y="285" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${THEMES.blue}">LÀM VIỆC</text>
      <text x="738" y="255" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${THEMES.blue}">${col5Header}</text>
      <text x="738" y="285" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${THEMES.blue}">${col5SubHeader}</text>
      <text x="890" y="255" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${THEMES.blue}">TIỀN LƯƠNG</text>
      <text x="890" y="285" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${THEMES.blue}">THỰC NHẬN</text>
      
      ${rows}

      <rect x="45" y="${summaryTop}" width="910" height="${245 + deductions.length * 58}" fill="#fff" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="650" y1="${summaryTop}" x2="650" y2="${summaryTop + 245 + deductions.length * 58}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="45" y1="${summaryTop + 62}" x2="955" y2="${summaryTop + 62}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="45" y1="${summaryTop + 124}" x2="955" y2="${summaryTop + 124}" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="45" y1="${summaryTop + 186}" x2="955" y2="${summaryTop + 186}" stroke="${THEMES.blue}" stroke-width="2"/>
      
      <text x="70" y="${summaryTop + 42}" font-family="Georgia, serif" font-size="22" font-weight="700">${bottomTotalLabel}</text>
      <text x="928" y="${summaryTop + 42}" text-anchor="end" font-family="Georgia, serif" font-size="22" font-weight="700">${bottomTotalVal}</text>
      
      <text x="70" y="${summaryTop + 104}" font-family="Georgia, serif" font-size="22" font-weight="700">TỔNG TIỀN LƯƠNG TRƯỚC KHẤU TRỪ</text>
      <text x="928" y="${summaryTop + 104}" text-anchor="end" font-family="Georgia, serif" font-size="22" font-weight="700">${formatMoney(totalSalary)}</text>
      
      <text x="70" y="${summaryTop + 166}" font-family="Georgia, serif" font-size="22" font-weight="700">TẠM ỨNG LƯƠNG</text>
      <text x="928" y="${summaryTop + 166}" text-anchor="end" font-family="Georgia, serif" font-size="22" font-weight="700">${formatMoney(advance)}</text>
      
      ${deductionRows}

      <rect x="45" y="${netTop}" width="910" height="108" fill="${THEMES.lightBlue}" opacity=".8" stroke="${THEMES.blue}" stroke-width="2"/>
      <line x1="650" y1="${netTop}" x2="650" y2="${netTop + 108}" stroke="${THEMES.blue}" stroke-width="2"/>
      <text x="70" y="${netTop + 68}" font-family="Georgia, serif" font-size="34" font-weight="700" fill="${THEMES.blue}">THANH TOÁN THỰC NHẬN</text>
      <text x="930" y="${netTop + 68}" text-anchor="end" font-family="Georgia, serif" font-size="40" font-weight="700" fill="${THEMES.red}">${formatMoney(net)} đ</text>
      
      <text x="500" y="${netTop + 160}" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-style="italic">(Bằng chữ: ${escapeHtml(words)})</text>
      <text x="70" y="${netTop + 250}" font-family="Georgia, serif" font-size="22">${escapeHtml(vDate)}</text>
      
      <text x="350" y="${netTop + 250}" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700">Người lập phiếu</text>
      <text x="350" y="${netTop + 290}" text-anchor="middle" font-family="Georgia, serif" font-size="20" font-style="italic">(Ký, ghi rõ họ tên)</text>
      
      <text x="750" y="${netTop + 250}" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700">Kế toán trưởng</text>
      <text x="750" y="${netTop + 290}" text-anchor="middle" font-family="Georgia, serif" font-size="20" font-style="italic">(Ký, ghi rõ họ tên)</text>
    </svg>`;
  };

  const slipSvgK80 = (emp: Employee) => {
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const isHourly = salaryMode === 'hourly';
    const infoDays = isHourly ? (emp.range ? `${emp.days} giờ (${emp.range})` : `${emp.days} giờ`) : (emp.range ? `${emp.days} công (${emp.range})` : `${emp.days} công`);
    
    const row1Label = isHourly ? "Lương giờ (đ)" : "Mức lương cơ bản";
    const row2Label = isHourly ? "Tổng số giờ" : "Công định mức / Thực tế";
    const row2Val = isHourly ? `${emp.days} giờ` : `${standardDays} / ${infoDays}`;
    const row3Label = isHourly ? "Công thức tính" : "Hệ số tính lương";
    const row3Val = isHourly ? "Lương giờ × Số giờ" : `${emp.days}/${standardDays}`;

    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 540" fill="none" role="img" aria-label="Phiếu lương K80 ${escapeHtml(emp.name)}">
      <rect width="320" height="540" fill="#fff"/>
      <style>
        .k80-title { font: bold 16px 'Inter', sans-serif; fill: #000; text-anchor: middle; }
        .k80-subtitle { font: 10px 'Inter', sans-serif; fill: #000; text-anchor: middle; }
        .k80-text { font: 11px 'Inter', sans-serif; fill: #000; }
        .k80-bold { font: bold 11px 'Inter', sans-serif; fill: #000; }
        .k80-total { font: bold 13px 'Inter', sans-serif; fill: #000; }
        .k80-price { font: bold 14px 'Inter', sans-serif; fill: #dc2626; text-anchor: end; }
        .k80-divider { stroke: #000; stroke-width: 1; stroke-dasharray: 4, 3; }
      </style>
      
      <text x="160" y="32" class="k80-title">PHIẾU LƯƠNG K80</text>
      <text x="160" y="48" class="k80-subtitle">${mLabel}</text>
      
      <line x1="15" y1="62" x2="305" y2="62" class="k80-divider" />
      
      <text x="20" y="85" class="k80-bold">Họ và tên:</text>
      <text x="110" y="85" class="k80-text">${escapeHtml(emp.name)}</text>
      
      <text x="20" y="105" class="k80-bold">Chức vụ:</text>
      <text x="110" y="105" class="k80-text">${escapeHtml(defaultPosition)}</text>
      
      <text x="20" y="125" class="k80-bold">Bộ phận:</text>
      <text x="110" y="125" class="k80-text">${escapeHtml(defaultDept)}</text>

      <line x1="15" y1="140" x2="305" y2="140" class="k80-divider" />
      
      <text x="20" y="165" class="k80-text">${row1Label}</text>
      <text x="300" y="165" text-anchor="end" class="k80-text">${formatMoney(emp.salary)}</text>
      
      <text x="20" y="190" class="k80-text">${row2Label}</text>
      <text x="300" y="190" text-anchor="end" class="k80-text">${row2Val}</text>
      
      <text x="20" y="215" class="k80-text">${row3Label}</text>
      <text x="300" y="215" text-anchor="end" class="k80-text">${row3Val}</text>
      
      <line x1="15" y1="235" x2="305" y2="235" class="k80-divider" />
      
      <text x="20" y="262" class="k80-total">TỔNG THỰC NHẬN</text>
      <text x="300" y="265" class="k80-price">${formatMoney(emp.amount)} đ</text>
      
      <text x="20" y="300" class="k80-text" font-style="italic">Bằng chữ:</text>
      <rect x="20" y="310" width="280" height="40" fill="#f8fafc" rx="4" stroke="#e2e8f0" stroke-width="1"/>
      <text x="25" y="326" font-size="9" font-family="'Inter', sans-serif" fill="#475569" width="270">
        ${escapeHtml(numberToVietnamese(emp.amount).substring(0, 48))}
      </text>
      <text x="25" y="340" font-size="9" font-family="'Inter', sans-serif" fill="#475569" width="270">
        ${escapeHtml(numberToVietnamese(emp.amount).substring(48))}
      </text>

      <text x="160" y="380" text-anchor="middle" font-size="9" font-family="'Inter', sans-serif" fill="#64748b">${escapeHtml(vDate)}</text>
      
      <text x="80" y="420" text-anchor="middle" class="k80-bold">Người nhận</text>
      <text x="80" y="435" text-anchor="middle" font-size="9" font-style="italic" fill="#64748b">(Ký tên)</text>
      
      <text x="240" y="420" text-anchor="middle" class="k80-bold">Người lập phiếu</text>
      <text x="240" y="435" text-anchor="middle" font-size="9" font-style="italic" fill="#64748b">(Ký tên)</text>
      
      <text x="160" y="500" text-anchor="middle" font-size="10" font-family="'Inter', sans-serif" fill="#94a3b8">* Xin quý khách vui lòng kiểm tra kỹ *</text>
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

    const rows = employees.slice(0, 8).map((e, i) => {
      const y = 145 + i * 22;
      return `
        <text x="20" y="${y}" font-size="9" font-family="'Inter', sans-serif" fill="#000">${i + 1}. ${escapeHtml(e.name.substring(0, 16))}</text>
        <text x="175" y="${y}" font-size="9" font-family="'Inter', sans-serif" text-anchor="middle" fill="#000">${e.days}${isHourly ? 'g' : ''}</text>
        <text x="300" y="${y}" font-size="9" font-family="'Inter', sans-serif" text-anchor="end" fill="#000">${formatMoney(e.amount)}</text>
      `;
    }).join('');

    const tableBottom = 135 + Math.max(employees.length, 3) * 22;
    const summaryTop = tableBottom + 15;
    const deductionsTop = summaryTop + 65;

    const deductionRows = deductions.map((d, i) => {
      const y = deductionsTop + 20 + i * 20;
      return `
        <text x="20" y="${y}" font-size="10" font-family="'Inter', sans-serif" fill="#000">${escapeHtml(d.label)}</text>
        <text x="300" y="${y}" font-size="10" font-family="'Inter', sans-serif" text-anchor="end" fill="#dc2626">${formatMoney(d.amount)}</text>
      `;
    }).join('');

    const netTop = deductionsTop + 30 + deductions.length * 20;
    
    const col2Header = isHourly ? "Giờ" : "Công";
    const bottomTotalLabel = isHourly ? "Tổng giờ làm việc" : "Tổng công nhân viên";
    
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 ${netTop + 140}" fill="none" role="img" aria-label="Phiếu tổng hợp lương K80">
      <rect width="320" height="${netTop + 140}" fill="#fff"/>
      <style>
        .k80-title { font: bold 15px 'Inter', sans-serif; fill: #000; text-anchor: middle; }
        .k80-subtitle { font: 10px 'Inter', sans-serif; fill: #000; text-anchor: middle; }
        .k80-divider { stroke: #000; stroke-width: 1; stroke-dasharray: 4, 3; }
        .k80-bold { font: bold 10px 'Inter', sans-serif; fill: #000; }
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
      
      <text x="20" y="${summaryTop + 15}" font-size="10" font-family="'Inter', sans-serif" fill="#000">${bottomTotalLabel}</text>
      <text x="300" y="${summaryTop + 15}" font-size="10" font-family="'Inter', sans-serif" text-anchor="end" fill="#000">${totalDays}</text>
      
      <text x="20" y="${summaryTop + 35}" font-size="10" font-family="'Inter', sans-serif" fill="#000">Tổng tiền lương</text>
      <text x="300" y="${summaryTop + 35}" font-size="10" font-family="'Inter', sans-serif" text-anchor="end" fill="#000">${formatMoney(totalSalary)}</text>
      
      <text x="20" y="${summaryTop + 55}" font-size="10" font-family="'Inter', sans-serif" fill="#000">Tạm ứng</text>
      <text x="300" y="${summaryTop + 55}" font-size="10" font-family="'Inter', sans-serif" text-anchor="end" fill="#000">${formatMoney(advance)}</text>
      
      ${deductionRows}
      
      <line x1="15" y1="${netTop - 10}" class="k80-divider" />
      
      <text x="20" y="${netTop + 15}" font-size="12" font-family="'Inter', sans-serif" font-weight="700" fill="#000">THANH TOÁN THỰC NHẬN</text>
      <text x="300" y="${netTop + 15}" font-size="14" font-family="'Inter', sans-serif" font-weight="700" text-anchor="end" fill="#dc2626">${formatMoney(net)} đ</text>
      
      <text x="160" y="${netTop + 45}" text-anchor="middle" font-size="9" font-family="'Inter', sans-serif" fill="#64748b">${escapeHtml(vDate)}</text>
      <text x="80" y="${netTop + 75}" text-anchor="middle" class="k80-bold">Người lập</text>
      <text x="240" y="${netTop + 75}" text-anchor="middle" class="k80-bold">Kế toán trưởng</text>
    </svg>`;
  };

  const slipSvgModern = (emp: Employee) => {
    const mLabel = monthLabel(payMonth);
    const vDate = formatDate(voucherDate);
    const isHourly = salaryMode === 'hourly';
    const infoDays = isHourly ? (emp.range ? `${emp.days} giờ (${emp.range})` : `${emp.days} giờ`) : (emp.range ? `${emp.days} công (${emp.range})` : `${emp.days} công`);
    const words = numberToVietnamese(emp.amount);
    
    const row1Label = isHourly ? "Lương cơ bản theo giờ" : "Mức lương cơ bản hàng tháng";
    const row1Val = isHourly ? `${formatMoney(emp.salary)} đ / giờ` : `${formatMoney(emp.salary)} đ`;
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
      
      <rect x="0" y="0" width="1000" height="1350" fill="#f8fafc"/>
      <rect x="25" y="25" width="950" height="1300" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
      
      <path d="M25 45 C 25 35, 35 25, 45 25 L 955 25 C 965 25, 975 35, 975 45 L 975 140 L 25 140 Z" fill="url(#blueGrad)"/>
      <text x="75" y="85" font-family="'Outfit', sans-serif" font-size="34" font-weight="800" fill="#ffffff">PHIẾU CHI LƯƠNG CHI TIẾT</text>
      <text x="75" y="115" font-family="'Inter', sans-serif" font-size="16" font-weight="600" fill="#93c5fd" letter-spacing="1">${mLabel.toUpperCase()}</text>
      
      <rect x="750" y="55" width="175" height="50" rx="8" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <text x="837" y="85" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="14" font-weight="700" fill="#ffffff">PAYROLL OFFICE</text>
      
      <rect x="60" y="180" width="880" height="150" rx="12" fill="url(#headerGrad)" stroke="#dbeafe" stroke-width="1"/>
      <text x="90" y="225" font-family="'Outfit', sans-serif" font-size="16" font-weight="700" fill="#64748b">HỌ VÀ TÊN NHÂN VIÊN</text>
      <text x="90" y="260" font-family="'Outfit', sans-serif" font-size="28" font-weight="800" fill="#0f172a">${escapeHtml(emp.name)}</text>
      <text x="90" y="295" font-family="'Inter', sans-serif" font-size="15" font-weight="600" fill="#2563eb">${escapeHtml(defaultPosition)}</text>
      
      <text x="600" y="225" font-family="'Outfit', sans-serif" font-size="16" font-weight="700" fill="#64748b">PHÒNG BAN/BỘ PHẬN</text>
      <text x="600" y="260" font-family="'Outfit', sans-serif" font-size="24" font-weight="700" fill="#0f172a">${escapeHtml(defaultDept)}</text>
      
      <text x="60" y="390" font-family="'Outfit', sans-serif" font-size="20" font-weight="800" fill="#1e3a8a">DANH SÁCH CHI TIẾT TÍNH LƯƠNG</text>
      
      <rect x="60" y="415" width="880" height="340" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      
      <text x="90" y="465" font-family="'Inter', sans-serif" font-size="16" font-weight="600" fill="#475569">${row1Label}</text>
      <text x="910" y="465" text-anchor="end" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#0f172a">${row1Val}</text>
      <line x1="60" y1="495" x2="940" y2="495" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="535" font-family="'Inter', sans-serif" font-size="16" font-weight="600" fill="#475569">${row2Label}</text>
      <text x="910" y="535" text-anchor="end" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#0f172a">${row2Val}</text>
      <line x1="60" y1="565" x2="940" y2="565" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="605" font-family="'Inter', sans-serif" font-size="16" font-weight="600" fill="#475569">${row3Label}</text>
      <text x="910" y="605" text-anchor="end" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#2563eb">${row3Val}</text>
      <line x1="60" y1="635" x2="940" y2="635" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="675" font-family="'Inter', sans-serif" font-size="16" font-weight="600" fill="#475569">${row4Label}</text>
      <text x="910" y="675" text-anchor="end" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#0f172a">${row4Val}</text>
      <line x1="60" y1="705" x2="940" y2="705" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="740" font-family="'Inter', sans-serif" font-size="16" font-weight="700" fill="#0f172a">Tiền lương thực nhận dự kiến</text>
      <text x="910" y="740" text-anchor="end" font-family="'Outfit', sans-serif" font-size="20" font-weight="800" fill="#0f172a">${formatMoney(emp.amount)} đ</text>
      
      <rect x="60" y="800" width="880" height="150" rx="16" fill="#eff6ff" stroke="#bfdbfe" stroke-width="2"/>
      <text x="100" y="860" font-family="'Outfit', sans-serif" font-size="18" font-weight="800" fill="#1e3a8a">THANH TOÁN THỰC NHẬN CHUYỂN KHOẢN</text>
      <text x="100" y="890" font-family="'Inter', sans-serif" font-size="15" font-weight="600" fill="#64748b" font-style="italic">Bằng chữ: ${escapeHtml(words)}</text>
      <text x="900" y="885" text-anchor="end" font-family="'Outfit', sans-serif" font-size="44" font-weight="900" fill="#dc2626">${formatMoney(emp.amount)} đ</text>
      
      <text x="90" y="1040" font-family="'Inter', sans-serif" font-size="15" font-weight="600" fill="#64748b">${escapeHtml(vDate)}</text>
      <line x1="60" y1="1080" x2="940" y2="1080" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="180" y="1120" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#0f172a">Người Nhận Lương</text>
      <text x="180" y="1145" text-anchor="middle" font-family="'Inter', sans-serif" font-size="14" font-style="italic" fill="#64748b">(Ký tên xác nhận đã nhận)</text>
      
      <text x="800" y="1120" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#1e3a8a">Bộ Phận Kế Toán</text>
      <text x="800" y="1145" text-anchor="middle" font-family="'Inter', sans-serif" font-size="14" font-style="italic" fill="#64748b">(Ký và đóng dấu nếu có)</text>
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
        <text x="90" y="${y}" font-family="'Inter', sans-serif" font-size="15" fill="#334155">${i + 1}</text>
        <text x="150" y="${y}" font-family="'Inter', sans-serif" font-size="15" font-weight="700" fill="#0f172a">${escapeHtml(e.name)}</text>
        <text x="440" y="${y}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="15" fill="#334155">${e.days}${isHourly ? 'g' : ''}</text>
        <text x="560" y="${y}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="14" fill="#64748b">${escapeHtml(e.range || '-')}</text>
        <text x="710" y="${y}" text-anchor="end" font-family="'Inter', sans-serif" font-size="14" fill="#334155">${formatMoney(e.salary)}</text>
        <text x="900" y="${y}" text-anchor="end" font-family="'Outfit', sans-serif" font-size="15" font-weight="700" fill="#0f172a">${formatMoney(e.amount)}</text>
        <line x1="60" y1="${y + 18}" x2="940" y2="${y + 18}" stroke="#f8fafc" stroke-width="1"/>
      `;
    }).join('');

    const tableBottom = 330 + Math.max(employees.length, 5) * 58;
    const summaryTop = tableBottom + 25;
    const netTop = summaryTop + 230 + deductions.length * 50;

    const deductionRows = deductions.map((d, i) => {
      const y = summaryTop + 185 + i * 50;
      return `
        <text x="90" y="${y}" font-family="'Inter', sans-serif" font-size="16" font-weight="600" fill="#64748b">${escapeHtml(d.label)}</text>
        <text x="910" y="${y}" text-anchor="end" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#dc2626">${formatMoney(d.amount)} đ</text>
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
      
      <rect x="0" y="0" width="1000" height="${netTop + 330}" fill="#f8fafc"/>
      <rect x="25" y="25" width="950" height="${netTop + 280}" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
      
      <path d="M25 45 C 25 35, 35 25, 45 25 L 955 25 C 965 25, 975 35, 975 45 L 975 140 L 25 140 Z" fill="url(#blueGrad)"/>
      <text x="75" y="85" font-family="'Outfit', sans-serif" font-size="32" font-weight="800" fill="#ffffff">BẢNG TỔNG HỢP LƯƠNG DOANH NGHIỆP</text>
      <text x="75" y="115" font-family="'Inter', sans-serif" font-size="16" font-weight="600" fill="#93c5fd" letter-spacing="1">${mLabel.toUpperCase()}</text>
      
      <rect x="60" y="180" width="880" height="${tableBottom - 180}" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      
      <rect x="61" y="181" width="878" height="50" rx="11" fill="#f1f5f9"/>
      <text x="90" y="212" font-family="'Outfit', sans-serif" font-size="14" font-weight="800" fill="#475569">STT</text>
      <text x="150" y="212" font-family="'Outfit', sans-serif" font-size="14" font-weight="800" fill="#475569">HỌ VÀ TÊN</text>
      <text x="440" y="212" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="14" font-weight="800" fill="#475569">${col3Header}</text>
      <text x="560" y="212" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="14" font-weight="800" fill="#475569">THỜI GIAN</text>
      <text x="710" y="212" text-anchor="end" font-family="'Outfit', sans-serif" font-size="14" font-weight="800" fill="#475569">${col5Header}</text>
      <text x="900" y="212" text-anchor="end" font-family="'Outfit', sans-serif" font-size="14" font-weight="800" fill="#475569">THỰC NHẬN</text>
      
      ${rows}
      
      <rect x="60" y="${summaryTop}" width="880" height="${210 + deductions.length * 50}" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      
      <text x="90" y="${summaryTop + 35}" font-family="'Inter', sans-serif" font-size="16" font-weight="600" fill="#64748b">${bottomTotalLabel}</text>
      <text x="910" y="${summaryTop + 35}" text-anchor="end" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#0f172a">${bottomTotalVal}</text>
      <line x1="60" y1="${summaryTop + 55}" x2="940" y2="${summaryTop + 55}" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="${summaryTop + 85}" font-family="'Inter', sans-serif" font-size="16" font-weight="600" fill="#64748b">Tổng quỹ lương thực tế</text>
      <text x="910" y="${summaryTop + 85}" text-anchor="end" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#0f172a">${formatMoney(totalSalary)} đ</text>
      <line x1="60" y1="${summaryTop + 105}" x2="940" y2="${summaryTop + 105}" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="90" y="${summaryTop + 135}" font-family="'Inter', sans-serif" font-size="16" font-weight="600" fill="#64748b">Khấu trừ tạm ứng lương</text>
      <text x="910" y="${summaryTop + 135}" text-anchor="end" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#0f172a">${formatMoney(advance)} đ</text>
      <line x1="60" y1="${summaryTop + 155}" x2="940" y2="${summaryTop + 155}" stroke="#f1f5f9" stroke-width="1"/>
      
      ${deductionRows}
      
      <rect x="60" y="${netTop}" width="880" height="110" rx="12" fill="#eff6ff" stroke="#bfdbfe" stroke-width="2"/>
      <text x="90" y="${netTop + 45}" font-family="'Outfit', sans-serif" font-size="18" font-weight="800" fill="#1e3a8a">THANH TOÁN THỰC NHẬN SAU KHẤU TRỪ</text>
      <text x="90" y="${netTop + 75}" font-family="'Inter', sans-serif" font-size="14" font-style="italic" fill="#64748b">Bằng chữ: ${escapeHtml(words)}</text>
      <text x="910" y="${netTop + 65}" text-anchor="end" font-family="'Outfit', sans-serif" font-size="34" font-weight="900" fill="#dc2626">${formatMoney(net)} đ</text>
      
      <text x="90" y="${netTop + 175}" font-family="'Inter', sans-serif" font-size="15" fill="#64748b">${escapeHtml(vDate)}</text>
      <line x1="60" y1="${netTop + 205}" x2="940" y2="${netTop + 205}" stroke="#f1f5f9" stroke-width="1"/>
      
      <text x="250" y="${netTop + 245}" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#0f172a">Người Lập Báo Cáo</text>
      <text x="250" y="${netTop + 270}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="14" font-style="italic" fill="#64748b">(Ký và ghi rõ họ tên)</text>
      
      <text x="750" y="${netTop + 245}" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="18" font-weight="700" fill="#1e3a8a">Kế Toán Trưởng</text>
      <text x="750" y="${netTop + 270}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="14" font-style="italic" fill="#64748b">(Ký và ghi rõ họ tên)</text>
    </svg>`;
  };

  const getActiveSvgText = (emp?: Employee) => {
    if (activeView === 'receipt') {
      const targetEmp = emp || employees[0];
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

  const handlePrint = () => {
    if (activeTemplate === 'k80') {
      document.body.classList.add('print-k80-mode');
    } else {
      document.body.classList.remove('print-k80-mode');
    }
    window.print();
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
    const text = getActiveSvgText(emp);
    if (!text) {
      showToast('Không có dữ liệu phiếu để xuất ảnh', 'error');
      return;
    }
    const nameStr = activeView === 'receipt' ? (emp?.name || employees[0]?.name || 'Phieu_Luong') : 'Bang_Tong_Hop_Luong';
    const filename = `${nameStr}_${activeTemplate.toUpperCase()}.png`;
    
    try {
      showToast('Đang tạo hình ảnh chất lượng cao...', 'info');
      await svgToPng(text, filename, activeTemplate === 'k80');
      showToast('Xuất ảnh PNG thành công!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Xuất ảnh thất bại. Dùng tính năng In để thay thế.', 'error');
    }
  };

  const totalDays = employees.reduce((a, b) => a + Number(b.days || 0), 0);
  const totalSalary = employees.reduce((a, b) => a + Number(b.amount || 0), 0);
  const totalDeduct = deductions.reduce((a, b) => a + Number(b.amount || 0), 0);
  const net = totalSalary - advance - totalDeduct;

  const isHourly = salaryMode === 'hourly';

  return (
    <div className="payroll-creator">
      <div className="view-header">
        <h1 className="view-title">KG_TOOL - Hệ thống Tạo & Quản lý Phiếu Lương</h1>
        <p className="view-subtitle">Tạo phiếu lương tự động, xuất hóa đơn K80, A4 và lưu trữ đồng bộ Google Sheets</p>
      </div>

      <div className="payroll-layout">
        
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
                  <select className="form-control" value={roundMode} onChange={(e) => setRoundMode(e.target.value as 'dong' | 'thousand')}>
                    <option value="dong">Làm tròn đến hàng đơn vị (đ)</option>
                    <option value="thousand">Làm tròn đến hàng nghìn (1.000đ)</option>
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
            <span className="card-heading-title" style={{ display: 'block', marginBottom: '1rem' }}>📁 Bulk Importer / Actions</span>
            <div className="bulk-import-row">
              <input type="file" ref={fileInputRef} accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />
              <button className="btn-ghost" onClick={triggerCsvSelect} style={{ flexGrow: 1 }}>
                <UploadCloud size={16} />
                Nhập danh sách CSV
              </button>
              <button className="btn-outline" onClick={loadSampleData}>Dữ liệu mẫu</button>
              <button className="btn-danger" onClick={clearAllForms}>Xóa form</button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Định dạng file CSV mẫu: <code>Họ tên, Số công/Giờ, Khoảng thời gian, Lương cơ bản</code></p>
          </div>

          {/* Section 3: Employees List */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="card-heading-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={18} />
                Danh sách nhân viên ({employees.length})
              </span>
              <button className="btn-primary small-btn" onClick={addEmployee}>
                <Plus size={14} />
                Thêm nhân viên
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
                      <label className="form-label">{isHourly ? 'Lương giờ (đ)' : 'Lương cơ bản (đ)'}</label>
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

          {/* Section 4: Deductions */}
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

          {/* Section 5: Google Sheets Sync Controls */}
          <div className="glass-card sync-box">
            <div className="sync-status">
              <span className={`sync-dot ${syncStatus}`}></span>
              <span>Google Sheets Sync: </span>
              <strong>{syncStatus === 'online' ? 'Sẵn sàng' : syncStatus === 'loading' ? 'Đang đồng bộ...' : 'Chưa kết nối'}</strong>
            </div>

            <div className="bulk-import-row" style={{ marginTop: '0.75rem' }}>
              <button className="btn-primary" style={{ flexGrow: 1 }} onClick={savePayrollToGAS} disabled={syncStatus === 'loading'}>
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

        </div>

        {/* RIGHT COLUMN: Live dynamic preview rendering */}
        <div className="preview-pane">
          
          {/* Preview Tab Control Panel */}
          <div className="preview-header-panel">
            <div className="preview-views-toggle">
              <button className={`view-toggle-btn ${activeView === 'receipt' ? 'active' : ''}`} onClick={() => setActiveView('receipt')}>
                📄 Phiếu Lương Nhân Viên
              </button>
              <button className={`view-toggle-btn ${activeView === 'summary' ? 'active' : ''}`} onClick={() => setActiveView('summary')}>
                📊 Bảng Tổng Hợp Lương
              </button>
            </div>

            <div className="preview-templates-toggle">
              <button className={`template-toggle-btn ${activeTemplate === 'standard' ? 'active' : ''}`} onClick={() => setActiveTemplate('standard')}>
                Standard
              </button>
              <button className={`template-toggle-btn ${activeTemplate === 'k80' ? 'active' : ''}`} onClick={() => setActiveTemplate('k80')}>
                K80 Thermal
              </button>
              <button className={`template-toggle-btn ${activeTemplate === 'modern' ? 'active' : ''}`} onClick={() => setActiveTemplate('modern')}>
                Modern
              </button>
            </div>
          </div>

          {/* Quick Metrics display bar */}
          <div className="metrics-strip-pnl">
            <div className="metric-box">
              <span>Tổng số nhân viên</span>
              <strong>{employees.length}</strong>
            </div>
            <div className="metric-box">
              <span>{isHourly ? 'Tổng số giờ làm' : 'Tổng số công'}</span>
              <strong>{totalDays}</strong>
            </div>
            <div className="metric-box">
              <span>Tổng quỹ lương</span>
              <strong>{formatMoney(totalSalary)}đ</strong>
            </div>
            <div className="metric-box">
              <span>Thực nhận (Sau K.Trừ)</span>
              <strong className={net < 0 ? 'red' : ''}>{formatMoney(net)}đ</strong>
            </div>
          </div>

          {/* Render target content */}
          <div className="preview-scroll-container">
            {activeView === 'receipt' ? (
              employees.map((emp, index) => {
                const svgText = getActiveSvgText(emp);
                return (
                  <div key={emp.id} className="preview-receipt-card">
                    <div className="receipt-card-header">
                      <span>Phiếu #{index + 1} - {emp.name}</span>
                      <div className="receipt-card-actions">
                        <button className="btn-ghost small-btn" onClick={() => handleDownloadPng(emp)}>
                          <Download size={12} />
                          Ảnh PNG
                        </button>
                        <button className="btn-primary small-btn" onClick={handlePrint}>
                          In Phiếu
                        </button>
                      </div>
                    </div>
                    <div className="receipt-svg-holder" dangerouslySetInnerHTML={{ __html: svgText }} />
                  </div>
                );
              })
            ) : (
              <div className="preview-receipt-card">
                <div className="receipt-card-header">
                  <span>Bảng Tổng Hợp Lương ({payMonth})</span>
                  <div className="receipt-card-actions">
                    <button className="btn-ghost small-btn" onClick={() => handleDownloadPng()}>
                      <Download size={12} />
                      Ảnh PNG
                    </button>
                    <button className="btn-primary small-btn" onClick={handlePrint}>
                      In Bảng Tổng Hợp
                    </button>
                  </div>
                </div>
                <div className="receipt-svg-holder" dangerouslySetInnerHTML={{ __html: getActiveSvgText() }} />
              </div>
            )}

            {employees.length === 0 && (
              <div className="empty-preview-state">
                <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <p>Nhập thông tin nhân viên ở cột bên trái để hiển thị bản xem trước phiếu lương.</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
