import React, { useState, useRef, useEffect } from 'react';
import { 
  CheckCircle, 
  FileText, 
  Download, 
  Loader2, 
  X, 
  QrCode, 
  CreditCard, 
  Plus, 
  Trash2, 
  Settings, 
  Save, 
  Send,
  HelpCircle,
  Volume2,
  Cpu
} from 'lucide-react';
import './App.css';
import { parseFile, processRecords, exportToExcel, type ProcessedRecord, type TimeRecord } from './processor';
import PayrollCreator from './PayrollCreator';
import TransferFileTool from './components/TransferFileTool';
import TTSPage from './components/TTSPage';
import HikvisionSync from './components/HikvisionSync';
import { StatCard, EmptyState, GuidePanel } from './components/Shared';

// Interface definitions
interface Bank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
}

interface SavedAccount {
  id: string;
  bankId: string; // BIN number or Code
  bankName: string;
  bankCode: string;
  accountNo: string;
  accountHolder: string;
  defaultMemo: string;
  defaultAmount: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const FALLBACK_BANKS: Bank[] = [
  { id: 1, name: "Ngân hàng TMCP Ngoại Thương Việt Nam", code: "VCB", bin: "970436", shortName: "Vietcombank", logo: "https://api.vietqr.io/resources/images/bank_logos/vietcombank.png" },
  { id: 2, name: "Ngân hàng TMCP Công Thương Việt Nam", code: "CTG", bin: "970415", shortName: "VietinBank", logo: "https://api.vietqr.io/resources/images/bank_logos/vietinbank.png" },
  { id: 3, name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam", code: "BIDV", bin: "970418", shortName: "BIDV", logo: "https://api.vietqr.io/resources/images/bank_logos/bidv.png" },
  { id: 4, name: "Ngân hàng TMCP Kỹ Thương Việt Nam", code: "TCB", bin: "970407", shortName: "Techcombank", logo: "https://api.vietqr.io/resources/images/bank_logos/techcombank.png" },
  { id: 5, name: "Ngân hàng TMCP Quân Đội", code: "MB", bin: "970422", shortName: "MBBank", logo: "https://api.vietqr.io/resources/images/bank_logos/mbb.png" },
  { id: 6, name: "Ngân hàng TMCP Á Châu", code: "ACB", bin: "970416", shortName: "ACB", logo: "https://api.vietqr.io/resources/images/bank_logos/acb.png" },
  { id: 7, name: "Ngân hàng TMCP Sài Gòn Thương Tín", code: "STB", bin: "970403", shortName: "Sacombank", logo: "https://api.vietqr.io/resources/images/bank_logos/sacombank.png" },
  { id: 8, name: "Ngân hàng TMCP Tiên Phong", code: "TPB", bin: "970423", shortName: "TPBank", logo: "https://api.vietqr.io/resources/images/bank_logos/tpbank.png" },
  { id: 9, name: "Ngân hàng TMCP Phát triển TP.HCM", code: "HDB", bin: "970437", shortName: "HDBank", logo: "https://api.vietqr.io/resources/images/bank_logos/hdbank.png" },
  { id: 10, name: "Ngân hàng TMCP Việt Nam Thịnh Vượng", code: "VPB", bin: "970432", shortName: "VPBank", logo: "https://api.vietqr.io/resources/images/bank_logos/vpbank.png" },
  { id: 11, name: "Ngân hàng TMCP Bưu Điện Liên Việt", code: "LPB", bin: "970449", shortName: "LPBank", logo: "https://api.vietqr.io/resources/images/bank_logos/lpb.png" },
  { id: 12, name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam", code: "VBA", bin: "970405", shortName: "Agribank", logo: "https://api.vietqr.io/resources/images/bank_logos/agribank.png" }
];

function App() {
  // Navigation & UI state
  const [currentView, setCurrentView] = useState<'attendance' | 'vietqr' | 'payroll' | 'settings' | 'transfer' | 'tts' | 'hikvision'>('attendance');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('kg_tool_sidebar_collapsed') === 'true';
  });
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Resize listener for responsive App Shell
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const mobile = width < 640;
      const tablet = width >= 640 && width < 1024;
      setIsMobile(mobile);
      if (tablet) {
        setSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileDrawerOpen(prev => !prev);
    } else {
      setSidebarCollapsed(prev => {
        const next = !prev;
        localStorage.setItem('kg_tool_sidebar_collapsed', String(next));
        return next;
      });
    }
  };

  // Config State
  const [gasUrl, setGasUrl] = useState(() => localStorage.getItem('kg_tool_gas_url') || '');
  const [spreadsheetId, setSpreadsheetId] = useState(() => localStorage.getItem('kg_tool_spreadsheet_id') || '');
  const [connectionStatus, setConnectionStatus] = useState<'not_configured' | 'testing' | 'connected' | 'failed'>(() => {
    return gasUrl ? 'connected' : 'not_configured';
  });

  // 1. Attendance processing state
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processedRecords, setProcessedRecords] = useState<ProcessedRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);
  const [attendanceSyncSuccess, setAttendanceSyncSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. VietQR & Personal Bank state
  const [banks, setBanks] = useState<Bank[]>(() => {
    const cached = localStorage.getItem('kg_tool_cached_banks');
    return cached ? JSON.parse(cached) : FALLBACK_BANKS;
  });
  const [isBanksLoading, setIsBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState(false);

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => {
    const saved = localStorage.getItem('kg_tool_saved_accounts');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [searchBankQuery, setSearchBankQuery] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [accountNo, setAccountNo] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'qr_only' | 'compact' | 'compact2' | 'print'>('compact');
  
  // VietQR Transaction History state
  const [qrHistory, setQrHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('kg_tool_qr_history');
    return saved ? JSON.parse(saved) : [];
  });

  // VietQR Actions & State
  const [qrUrl, setQrUrl] = useState('');
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);

  // New account form temporary state
  const [newBank, setNewBank] = useState<Bank | null>(null);
  const [newSearchBankQuery, setNewSearchBankQuery] = useState('');
  const [showNewBankDropdown, setShowNewBankDropdown] = useState(false);
  const [newAccountNo, setNewAccountNo] = useState('');
  const [newAccountHolder, setNewAccountHolder] = useState('');
  const [newDefaultMemo, setNewDefaultMemo] = useState('');
  const [newDefaultAmount, setNewDefaultAmount] = useState('');

  const fetchBanksList = async (showToastNotice = false) => {
    setIsBanksLoading(true);
    setBanksError(false);
    try {
      const res = await fetch('https://api.vietqr.io/v2/banks');
      const resData = await res.json();
      if (resData.code === '00' && Array.isArray(resData.data)) {
        setBanks(resData.data);
        localStorage.setItem('kg_tool_cached_banks', JSON.stringify(resData.data));
        setBanksError(false);
        if (showToastNotice) {
          showToast('Đã tải lại danh sách ngân hàng thành công!', 'success');
        }
      } else {
        throw new Error('API returned invalid code');
      }
    } catch (err) {
      console.error('Không thể lấy danh sách ngân hàng từ VietQR API:', err);
      const cached = localStorage.getItem('kg_tool_cached_banks');
      if (cached) {
        if (showToastNotice) {
          showToast('Không kết nối được API. Đang dùng danh sách đã lưu gần nhất.', 'info');
        }
      } else {
        setBanksError(true);
      }
    } finally {
      setIsBanksLoading(false);
    }
  };

  // Fetch VietQR Bank list on mount
  useEffect(() => {
    fetchBanksList(true);
  }, []);

  // Update QR Code Image Link dynamically based on inputs
  useEffect(() => {
    if (selectedBank && accountNo && accountHolder) {
      setIsQrLoading(true);
      const cleanAmount = amount.replace(/\D/g, '');
      const bankId = selectedBank.bin || selectedBank.code;
      const url = `https://img.vietqr.io/image/${bankId}-${accountNo}-${selectedTemplate}.png?amount=${cleanAmount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(accountHolder.toUpperCase())}`;
      setQrUrl(url);
    } else {
      setQrUrl('');
    }
  }, [selectedBank, accountNo, accountHolder, amount, memo, selectedTemplate]);

  // Toast System Helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Save changes to localStorage for persistent configuration
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('kg_tool_gas_url', gasUrl);
    localStorage.setItem('kg_tool_spreadsheet_id', spreadsheetId);
    showToast('Đã lưu cấu hình hệ thống thành công!', 'success');
    if (gasUrl) {
      testConnection();
    } else {
      setConnectionStatus('not_configured');
    }
  };

  // Test Connection to Apps Script backend
  const testConnection = async () => {
    if (!gasUrl) {
      showToast('Vui lòng cấu hình URL Google Apps Script Web App trước!', 'error');
      setConnectionStatus('not_configured');
      return;
    }
    setConnectionStatus('testing');
    try {
      const url = `${gasUrl}?action=getMonths&ssId=${encodeURIComponent(spreadsheetId)}`;
      const res = await fetch(url);
      const result = await res.json();
      if (result.success || Array.isArray(result) || result.status === 'success') {
        setConnectionStatus('connected');
        showToast('Kết nối Google Sheets API thành công!', 'success');
      } else {
        setConnectionStatus('failed');
        showToast('Kết nối thất bại: API phản hồi sai cấu trúc.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      setConnectionStatus('failed');
      showToast(`Không thể kết nối: ${err.message || 'Lỗi mạng hoặc URL không tồn tại'}`, 'error');
    }
  };

  // Drag and Drop File Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('active');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('active');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('active');
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    const ext = selectedFile.name.toLowerCase().split('.').pop();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      setErrorMsg('Vui lòng chọn file định dạng CSV hoặc Excel (.xlsx, .xls)');
      return;
    }
    setFile(selectedFile);
    setErrorMsg(null);
    setIsSuccess(false);
    setProcessedBlob(null);
    setProcessedRecords([]);
    setAttendanceSyncSuccess(false);
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await new Promise(r => setTimeout(r, 800));
      const records = await parseFile(file);
      const processed = processRecords(records);
      const blob = await exportToExcel(processed);
      setProcessedBlob(blob);
      setProcessedRecords(processed);
      setIsSuccess(true);
      showToast('Xử lý chấm công hoàn tất thành công!', 'success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra trong quá trình xử lý');
      console.error(err);
      showToast('Lỗi xử lý file chấm công!', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFetchAndProcessFromSheet = async () => {
    if (!gasUrl) {
      showToast('Vui lòng cấu hình URL Google Apps Script trong phần Cài đặt trước!', 'error');
      setCurrentView('settings');
      return;
    }
    
    setIsProcessing(true);
    setErrorMsg(null);
    setIsSuccess(false);
    setProcessedBlob(null);
    setProcessedRecords([]);
    
    try {
      showToast('Đang tải dữ liệu chấm công từ Google Sheets...', 'info');
      const url = `${gasUrl}?action=getAttendanceLogs&ssId=${encodeURIComponent(spreadsheetId)}`;
      const res = await fetch(url);
      const result = await res.json();
      
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.error || 'Dữ liệu phản hồi từ Apps Script không đúng cấu trúc.');
      }
      
      const logs = result.data;
      if (logs.length === 0) {
        throw new Error('Sheet Bang_Cham_Cong_Log đang trống. Chưa có dữ liệu chấm công nào để xử lý.');
      }
      
      // Convert AttendanceLog to TimeRecord
      const records: TimeRecord[] = [];
      logs.forEach((log: any) => {
        const parts = log.date.split('/');
        if (parts.length !== 3) return;
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        
        if (log.checkIn) {
          const timeParts = log.checkIn.split(':');
          if (timeParts.length >= 2) {
            const h = parseInt(timeParts[0], 10);
            const min = parseInt(timeParts[1], 10);
            const inDate = new Date(y, m, d, h, min, 0, 0);
            records.push({ name: log.name, timestamp: inDate });
          }
        }
        
        if (log.checkOut) {
          const timeParts = log.checkOut.split(':');
          if (timeParts.length >= 2) {
            const h = parseInt(timeParts[0], 10);
            const min = parseInt(timeParts[1], 10);
            let outDate = new Date(y, m, d, h, min, 0, 0);
            if (h < 6) {
              outDate = new Date(outDate.getTime() + 86400000);
            }
            records.push({ name: log.name, timestamp: outDate });
          }
        }
      });

      if (records.length === 0) {
        throw new Error('Không thể phân tích dữ liệu chấm công hợp lệ từ Google Sheet.');
      }

      // Process records using existing engine
      const processed = processRecords(records);
      const blob = await exportToExcel(processed);
      
      setProcessedBlob(blob);
      setProcessedRecords(processed);
      setIsSuccess(true);
      
      // Mock File object to transition the UI state
      setFile(new File([], `Dữ_Liệu_Sheet_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`));
      
      showToast(`Đã xử lý chấm công của ${processed.length} dòng dữ liệu thành công!`, 'success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tải hoặc xử lý dữ liệu từ Google Sheet.');
      console.error(err);
      showToast('Lỗi xử lý dữ liệu chấm công Cloud!', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedBlob) return;
    const url = URL.createObjectURL(processedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bang_Cham_Cong_Da_Xu_Ly_${new Date().getTime()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Đã tải file kết quả về máy!', 'success');
  };

  const handleSyncAttendance = async () => {
    if (!gasUrl) {
      showToast('Vui lòng cấu hình URL Google Apps Script trong phần Cài đặt trước!', 'error');
      setCurrentView('settings');
      return;
    }
    if (processedRecords.length === 0) return;

    setIsSyncingAttendance(true);
    try {
      const serialized = processedRecords.map(r => ({
        employeeName: r.employeeName,
        logicalDate: r.logicalDate,
        checkIn: r.checkIn ? r.checkIn.toISOString() : null,
        checkOut: r.checkOut ? r.checkOut.toISOString() : null,
        overtime: r.overtime
      }));

      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          action: 'save_attendance',
          records: serialized,
          spreadsheetId: spreadsheetId
        })
      });

      const resText = await res.text();
      let resJson;
      try {
        resJson = JSON.parse(resText);
      } catch (e) {
        throw new Error('Không thể parse dữ liệu phản hồi từ Apps Script. Hãy đảm bảo bạn đã deploy Apps Script đúng cách.');
      }

      if (resJson.status === 'success') {
        showToast(`Đồng bộ thành công ${resJson.inserted} dòng dữ liệu lên Google Sheet!`, 'success');
        setAttendanceSyncSuccess(true);
      } else {
        throw new Error(resJson.message || 'Lỗi từ Apps Script backend.');
      }
    } catch (err: any) {
      console.error(err);
      showToast(`Đồng bộ thất bại: ${err.message || 'Kiểm tra lại kết nối và URL Apps Script'}`, 'error');
    } finally {
      setIsSyncingAttendance(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setIsSuccess(false);
    setProcessedBlob(null);
    setProcessedRecords([]);
    setErrorMsg(null);
    setAttendanceSyncSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Add personal bank account locally
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBank || !newAccountNo || !newAccountHolder) {
      showToast('Vui lòng điền đầy đủ các trường thông tin bắt buộc!', 'error');
      return;
    }

    const newAcc: SavedAccount = {
      id: Date.now().toString(),
      bankId: newBank.bin || newBank.code,
      bankName: newBank.name,
      bankCode: newBank.code,
      accountNo: newAccountNo.trim(),
      accountHolder: newAccountHolder.trim().toUpperCase(),
      defaultMemo: newDefaultMemo.trim(),
      defaultAmount: newDefaultAmount.replace(/\D/g, '')
    };

    const updated = [...savedAccounts, newAcc];
    setSavedAccounts(updated);
    localStorage.setItem('kg_tool_saved_accounts', JSON.stringify(updated));
    showToast('Đã lưu tài khoản mới thành công!', 'success');
    
    // Clear forms and inputs
    setNewBank(null);
    setNewSearchBankQuery('');
    setNewAccountNo('');
    setNewAccountHolder('');
    setNewDefaultMemo('');
    setNewDefaultAmount('');
    setShowAddAccountForm(false);

    // Auto select newly created account
    setSelectedBank(newBank);
    setAccountNo(newAcc.accountNo);
    setAccountHolder(newAcc.accountHolder);
    setMemo(newAcc.defaultMemo);
    setAmount(newAcc.defaultAmount);
  };

  const handleDeleteAccount = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Bạn có chắc chắn muốn xóa tài khoản này không?')) {
      const updated = savedAccounts.filter(acc => acc.id !== id);
      setSavedAccounts(updated);
      localStorage.setItem('kg_tool_saved_accounts', JSON.stringify(updated));
      showToast('Đã xóa tài khoản!', 'info');
      
      // Clear fields if the deleted account was selected
      setAccountNo('');
      setAccountHolder('');
      setMemo('');
      setAmount('');
      setSelectedBank(null);
      setSearchBankQuery('');
    }
  };

  const selectAccount = (acc: SavedAccount) => {
    setAccountNo(acc.accountNo);
    setAccountHolder(acc.accountHolder);
    setMemo(acc.defaultMemo);
    setAmount(acc.defaultAmount);
    
    const bank = banks.find(b => b.code === acc.bankCode || b.bin === acc.bankId);
    if (bank) {
      setSelectedBank(bank);
      setSearchBankQuery(bank.shortName);
    }
    showToast(`Đã chọn tài khoản: ${acc.bankCode} - ${acc.accountNo}`, 'info');
  };

  // Submit QR information to Google Spreadsheet DATA2
  const handleSaveToSpreadsheet = async () => {
    if (!gasUrl) {
      showToast('Vui lòng cấu hình URL Google Apps Script trong Cài đặt trước!', 'error');
      setCurrentView('settings');
      return;
    }
    if (!selectedBank || !accountNo || !accountHolder) {
      showToast('Vui lòng chọn ngân hàng, nhập số tài khoản và tên chủ tài khoản!', 'error');
      return;
    }

    setIsSavingAccount(true);
    try {
      const payload = {
        action: 'save_bank_account',
        spreadsheetId: spreadsheetId,
        account: {
          bankName: selectedBank.name,
          bankId: selectedBank.bin || selectedBank.code,
          bankCode: selectedBank.code,
          accountNo: accountNo.trim(),
          accountHolder: accountHolder.trim().toUpperCase(),
          amount: amount ? parseInt(amount.replace(/\D/g, ''), 10) : 0,
          memo: memo.trim(),
          qrUrl: qrUrl,
          createdAt: new Date().toISOString()
        }
      };

      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
      });

      const resText = await res.text();
      let resJson;
      try {
        resJson = JSON.parse(resText);
      } catch (e) {
        throw new Error('Phản hồi từ Google Apps Script không hợp lệ. Hãy kiểm tra lại Deployment Web App.');
      }

      if (resJson.status === 'success') {
        showToast('Lưu tài khoản và mã QR thành công lên sheet DATA2!', 'success');
        
        // Log to history
        const newTx = {
          id: Date.now().toString(),
          bankCode: selectedBank.code,
          accountNo: accountNo.trim(),
          amount: amount ? parseInt(amount.replace(/\D/g, ''), 10) : 0,
          memo: memo.trim(),
          timestamp: new Date().toISOString()
        };
        const updatedHistory = [...qrHistory, newTx];
        setQrHistory(updatedHistory);
        localStorage.setItem('kg_tool_qr_history', JSON.stringify(updatedHistory));
      } else {
        throw new Error(resJson.message || 'Lỗi không rõ từ script.');
      }
    } catch (err: any) {
      console.error(err);
      showToast(`Không thể lưu: ${err.message || 'Kiểm tra lại cấu hình hoặc kết nối'}`, 'error');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleDownloadQR = async () => {
    if (!qrUrl) return;
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VietQR_${selectedBank?.code || ''}_${accountNo}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Đã tải hình ảnh QR Code về máy!', 'success');

      // Log to history
      const newTx = {
        id: Date.now().toString(),
        bankCode: selectedBank?.code || '',
        accountNo: accountNo.trim(),
        amount: amount ? parseInt(amount.replace(/\D/g, ''), 10) : 0,
        memo: memo.trim(),
        timestamp: new Date().toISOString()
      };
      const updatedHistory = [...qrHistory, newTx];
      setQrHistory(updatedHistory);
      localStorage.setItem('kg_tool_qr_history', JSON.stringify(updatedHistory));
    } catch (e) {
      window.open(qrUrl, '_blank');
      showToast('Mở mã QR trong tab mới để tải về!', 'info');
    }
  };

  const handleCopyQRLink = () => {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl)
      .then(() => {
        showToast('Đã sao chép link ảnh VietQR!', 'success');
        
        // Log to history
        const newTx = {
          id: Date.now().toString(),
          bankCode: selectedBank?.code || '',
          accountNo: accountNo.trim(),
          amount: amount ? parseInt(amount.replace(/\D/g, ''), 10) : 0,
          memo: memo.trim(),
          timestamp: new Date().toISOString()
        };
        const updatedHistory = [...qrHistory, newTx];
        setQrHistory(updatedHistory);
        localStorage.setItem('kg_tool_qr_history', JSON.stringify(updatedHistory));
      })
      .catch(() => showToast('Không thể sao chép link!', 'error'));
  };

  // VND Number formatter for text display
  const formatVND = (val: string) => {
    const num = val.replace(/\D/g, '');
    if (!num) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(num, 10));
  };

  // Strip accents helper for search
  const stripAccents = (str: string): string => {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  };

  // Filter banks for custom searchable selection
  const filteredBanks = (() => {
    const query = stripAccents(searchBankQuery).trim();
    if (!query) return banks;
    return banks.filter(b => 
      stripAccents(b.name || '').includes(query) ||
      stripAccents(b.code || '').includes(query) ||
      stripAccents(b.shortName || '').includes(query) ||
      (b.bin && b.bin.includes(query))
    );
  })();

  const filteredNewBanks = (() => {
    const query = stripAccents(newSearchBankQuery).trim();
    if (!query) return banks;
    return banks.filter(b => 
      stripAccents(b.name || '').includes(query) ||
      stripAccents(b.code || '').includes(query) ||
      stripAccents(b.shortName || '').includes(query) ||
      (b.bin && b.bin.includes(query))
    );
  })();

  // Dynamic KPIs calculations for Attendance
  const hasAttendanceData = processedRecords.length > 0;
  const empCount = hasAttendanceData ? new Set(processedRecords.map(r => r.employeeName)).size : 0;
  const daysCount = hasAttendanceData ? processedRecords.length : 0;
  const processedCount = hasAttendanceData ? processedRecords.filter(r => r.checkIn && r.checkOut).length : 0;
  const nightCount = hasAttendanceData ? processedRecords.filter(r => r.overtime).length : 0;
  const completionRate = hasAttendanceData ? ((processedCount / daysCount) * 100).toFixed(2) : '0';

  // VietQR calculation metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const qrCreatedToday = qrHistory.filter(h => h.timestamp && h.timestamp.startsWith(todayStr)).length;
  const totalTransactions = qrHistory.length;
  const totalAmountReceived = qrHistory.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);

  return (
    <div className={`dashboard-layout ${isMobile ? 'layout-mobile' : ''} ${!isMobile && sidebarCollapsed ? 'layout-collapsed' : ''}`}>
      {/* Toast Notification badges */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span style={{ fontSize: '1.1rem' }}>
              {t.type === 'success' && <CheckCircle size={18} color="#30e797" />}
              {t.type === 'error' && <X size={18} color="#ff5c7a" />}
              {t.type === 'info' && <HelpCircle size={18} color="#22d3ee" />}
            </span>
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t.message}</div>
          </div>
        ))}
      </div>

      {/* Navigation Sidebar */}
      <aside className={`sidebar ${isMobile ? 'mobile-drawer' : ''} ${isMobile && isMobileDrawerOpen ? 'drawer-open' : ''} ${!isMobile && sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <div className="logo"></div>
          <span className="logo-text">KG_TOOL</span>
        </div>

        <nav className="nav">
          <button 
            className={`nav-item ${currentView === 'attendance' ? 'active' : ''}`}
            onClick={() => { setCurrentView('attendance'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "Chấm Công" : undefined}
          >
            <span className="ico"><FileText size={20} /></span>
            <span>Chấm Công</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'vietqr' ? 'active' : ''}`}
            onClick={() => { setCurrentView('vietqr'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "VietQR & Tài khoản" : undefined}
          >
            <span className="ico"><QrCode size={20} /></span>
            <span>VietQR & Tài khoản</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'payroll' ? 'active' : ''}`}
            onClick={() => { setCurrentView('payroll'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "Phiếu Lương" : undefined}
          >
            <span className="ico"><CreditCard size={20} /></span>
            <span>Phiếu Lương</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'transfer' ? 'active' : ''}`}
            onClick={() => { setCurrentView('transfer'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "Chuyển Tiền" : undefined}
          >
            <span className="ico"><Send size={20} /></span>
            <span>Chuyển Tiền</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'tts' ? 'active' : ''}`}
            onClick={() => { setCurrentView('tts'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "Đọc TTS" : undefined}
          >
            <span className="ico"><Volume2 size={20} /></span>
            <span>Đọc TTS</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'hikvision' ? 'active' : ''}`}
            onClick={() => { setCurrentView('hikvision'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "Máy Chấm Công" : undefined}
          >
            <span className="ico"><Cpu size={20} /></span>
            <span>Máy Chấm Công</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => { setCurrentView('settings'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "Cấu hình" : undefined}
          >
            <span className="ico"><Settings size={20} /></span>
            <span>Cấu hình</span>
          </button>
        </nav>

        <div className="sidebar-art"></div>

        <div className="support" onClick={() => showToast('Hỗ trợ kỹ thuật: dmt.kgwork@gmail.com', 'info')}>
          <div>
            <strong>🎧 Hỗ trợ</strong>
            <span>Trung tâm trợ giúp</span>
          </div>
          <b>›</b>
        </div>

        <div className="foot">
          <span>Phiên bản v1.2.0</span>
          <span>Kings Grill</span>
        </div>
      </aside>

      {/* Background Dim Overlay on Mobile when Sidebar is Open */}
      {isMobile && isMobileDrawerOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileDrawerOpen(false)}></div>
      )}

      {/* Main Content Pane */}
      <main className="main-content">
        
        {/* Top Header Bar */}
        <div className="topbar">
          <button className="hamb" onClick={toggleSidebar}>☰</button>
          <div className="user">
            <div className="mini-btn">🔔<i className="dot"></i></div>
            <div className="mini-btn">☾</div>
            <div className="avatar">Q</div>
            <div className="user-text">
              <b>Quản trị viên</b>
              <small>Quản lý nhà hàng</small>
            </div>
            <span style={{ cursor: 'pointer' }}>▼</span>
          </div>
        </div>

        {/* VIEW 1: ATTENDANCE PROCESSOR */}
        {currentView === 'attendance' && (
          <div className="screen active">
            <div className="head">
              <div className="title">
                <h1>Xử lý Chấm Công <span className="blue-dot"></span></h1>
                <p>Tự động hóa chuẩn hóa dữ liệu chấm công nhà hàng, phân ca đêm và nội suy ngày giờ</p>
              </div>
              <div className="kpis">
                <StatCard 
                  icon="👥" 
                  label="Nhân viên" 
                  value={empCount.toLocaleString('vi-VN')} 
                  subtext="Tổng số nhân viên thực tế"
                  hasData={hasAttendanceData} 
                />
                <StatCard 
                  icon="📅" 
                  label="Ngày công" 
                  value={daysCount.toLocaleString('vi-VN')} 
                  subtext="Tổng số dòng công ghi nhận"
                  hasData={hasAttendanceData} 
                />
                <StatCard 
                  icon="✅" 
                  label="Đã xử lý" 
                  value={processedCount.toLocaleString('vi-VN')} 
                  subtext={`${completionRate}% ca hoàn thành`}
                  hasData={hasAttendanceData} 
                />
                <StatCard 
                  icon="🌙" 
                  label="Ca đêm" 
                  value={nightCount.toLocaleString('vi-VN')} 
                  subtext="Số ca đêm phát hiện"
                  hasData={hasAttendanceData} 
                />
              </div>
            </div>

            {/* Instruction module */}
            <GuidePanel 
              title="Xử lý Chấm Công"
              purpose="Tải tệp chấm công thô từ máy chấm công nhà hàng, tự động làm sạch, xử lý ca làm việc kéo dài qua đêm (ca đêm), nội suy lịch làm việc và xuất báo cáo chuẩn để tính lương."
              steps={[
                "Tải file chấm công thô định dạng Excel (.xlsx, .xls) hoặc tệp phẳng (.csv) lên hệ thống.",
                "Hệ thống sẽ tự động quét, phân tích và chuẩn hóa tên nhân viên, các mốc thời gian vào/ra.",
                "Hệ thống tự động phát hiện và xử lý ca đêm (mốc giờ sau 0h và trước 6h sáng được quy về ca tối của ngày hôm trước).",
                "Tải file kết quả chuẩn hóa về máy hoặc chọn nút đồng bộ lên Google Sheet."
              ]}
              notes={[
                "Dữ liệu thô phải có các cột cơ bản chứa tên nhân viên và thời gian Check-In/Check-Out rõ ràng.",
                "Các mốc giờ đi làm muộn hoặc về sớm sẽ được giữ nguyên trạng để phục vụ tính lương phạt."
              ]}
              errors={[
                "Lỗi 'Không đọc được file' -> Đảm bảo tệp của bạn không bị khóa password và có phần mở rộng đúng chuẩn.",
                "Lỗi 'Thiếu cột dữ liệu bắt buộc' -> Hãy kiểm tra lại tiêu đề cột trong file Excel xem có trùng khớp không."
              ]}
            />

            {!file ? (
              <div 
                className="card upload"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="upload-content" style={{ width: '100%' }}>
                  <div className="file-icon">☁</div>
                  <h2>Xử lý chấm công nhân viên</h2>
                  <p style={{ margin: '0.25rem 0 0.75rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
                    Chọn tải tệp thô từ máy tính hoặc tải dữ liệu đồng bộ trực tuyến từ Google Sheets
                  </p>
                  
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', width: '100%', margin: '0.5rem 0 1.25rem', zIndex: 10 }}>
                    <label className="primary" style={{ padding: '10px 20px', cursor: 'pointer', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <span>Chọn tệp từ máy tính</span>
                      <input 
                        type="file" 
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        onChange={(e) => e.target.files && handleFileSelection(e.target.files[0])}
                      />
                    </label>
                    <button 
                      type="button" 
                      className="primary" 
                      onClick={handleFetchAndProcessFromSheet}
                      disabled={isProcessing}
                      style={{ 
                        padding: '10px 20px', 
                        borderRadius: '8px', 
                        fontSize: '0.85rem', 
                        background: 'linear-gradient(135deg, var(--cyan), var(--blue))',
                        boxShadow: '0 0 16px rgba(34,211,238,.25)', 
                        border: 'none', 
                        color: 'white', 
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="loader" size={14} />
                          Đang tải...
                        </>
                      ) : (
                        <>
                          <span>⚡️ Xử lý từ Google Sheet</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p style={{ marginTop: '0.5rem' }}>Hỗ trợ định dạng file thô: .xlsx, .xls, .csv ⓘ</p>
                  <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '8px' }}>🛡 Dữ liệu của bạn được bảo mật tuyệt đối và chỉ sử dụng để xử lý chấm công.</p>
                </div>
                {errorMsg && <p style={{ color: '#ff5c7a', marginTop: '1rem', fontWeight: 500, zIndex: 5 }}>{errorMsg}</p>}
              </div>
            ) : (
              <div className="card panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                <div className="file-info">
                  <FileText size={32} color="var(--blue)" />
                  <div style={{ minWidth: 0, flexGrow: 1 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                      {(file.size / 1024).toFixed(2)} KB
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div style={{ color: '#ff5c7a', padding: '1rem', background: 'rgba(255, 92, 122, 0.1)', borderRadius: '8px', width: '100%', maxWidth: '450px' }}>
                    {errorMsg}
                  </div>
                )}

                {!isSuccess ? (
                  <div className="actions-row">
                    <button className="btn-outline" onClick={resetState}>
                      Hủy bỏ
                    </button>
                    <button 
                      className="primary" 
                      onClick={handleProcess}
                      disabled={isProcessing}
                      style={{ height: '48px', padding: '0 2rem' }}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="loader" size={20} />
                          Đang xử lý...
                        </>
                      ) : (
                        'Bắt đầu xử lý'
                      )}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--green)' }}>
                      <CheckCircle size={24} />
                      <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Xử lý hoàn tất!</span>
                    </div>
                    
                    <div className="actions-row">
                      <button className="btn-outline" onClick={resetState}>
                        Xử lý file khác
                      </button>
                      
                      <button className="primary" style={{ height: '48px', padding: '0 2rem', background: 'linear-gradient(135deg, var(--green), #059669)', boxShadow: '0 0 24px rgba(48,231,151,.3)' }} onClick={handleDownload}>
                        <Download size={20} />
                        Tải File Kết Quả
                      </button>

                      <button 
                        className="primary" 
                        style={{ height: '48px', padding: '0 2rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}
                        onClick={handleSyncAttendance}
                        disabled={isSyncingAttendance || attendanceSyncSuccess}
                      >
                        {isSyncingAttendance ? (
                          <>
                            <Loader2 className="loader" size={20} />
                            Đang đồng bộ...
                          </>
                        ) : attendanceSyncSuccess ? (
                          <>
                            <CheckCircle size={20} color="var(--green)" />
                            Đã Đồng Bộ Cloud
                          </>
                        ) : (
                          <>
                            <Send size={20} />
                            Lưu Cloud (Google Sheet)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="feature-grid">
              <div className="card feature" style={{ borderColor: 'rgba(124, 60, 255, 0.4)' }}>
                <div className="ficon">🌙</div>
                <div>
                  <h3>Xử Lý Ca Đêm</h3>
                  <p>Tự động gán giờ trước 6h sáng về ca ngày hôm trước</p>
                </div>
                <div className="arrow">→</div>
              </div>
              <div className="card feature" style={{ borderColor: 'rgba(22, 119, 255, 0.4)' }}>
                <div className="ficon">📆</div>
                <div>
                  <h3>Nội Suy Lịch</h3>
                  <p>Khớp dữ liệu chấm công với dải ngày hành chính và phân ca</p>
                </div>
                <div className="arrow">→</div>
              </div>
              <div className="card feature" style={{ borderColor: 'rgba(34, 211, 238, 0.4)' }}>
                <div className="ficon">🪄</div>
                <div>
                  <h3>Định Dạng Tự Động</h3>
                  <p>Chuẩn hóa dữ liệu thô xuất ra bảng báo cáo dễ theo dõi</p>
                </div>
                <div className="arrow">→</div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: VIETQR & BANK ACCOUNTS */}
        {currentView === 'vietqr' && (
          <div className="screen active">
            <div className="head">
              <div className="title">
                <h1>Tạo mã QR thanh toán (VietQR) <span className="blue-dot"></span></h1>
                <p>Nhập thông tin tài khoản và tạo mã QR chuẩn Napas 247 để nhận thanh toán nhanh chóng.</p>
              </div>
              <div className="kpis">
                <StatCard 
                  icon="👤" 
                  label="Tài khoản đã lưu" 
                  value={savedAccounts.length} 
                  subtext="Tài khoản đã được cấu hình"
                  hasData={savedAccounts.length > 0} 
                />
                <StatCard 
                  icon="▦" 
                  label="QR đã tạo hôm nay" 
                  value={qrCreatedToday} 
                  subtext="Mã QR tạo trong ngày"
                  hasData={totalTransactions > 0} 
                />
                <StatCard 
                  icon="📈" 
                  label="Tổng giao dịch" 
                  value={totalTransactions} 
                  subtext="Số lần xuất/tạo mã QR"
                  hasData={totalTransactions > 0} 
                />
                <StatCard 
                  icon="💼" 
                  label="Tổng tiền nhận" 
                  value={`${totalAmountReceived.toLocaleString('vi-VN')}đ`} 
                  subtext="Tổng giá trị các mã QR"
                  hasData={totalTransactions > 0} 
                />
              </div>
            </div>

            {/* Instruction module */}
            <GuidePanel 
              title="VietQR & Tài khoản"
              purpose="Tạo nhanh mã QR thanh toán động theo chuẩn Napas 247 của ngân hàng Việt Nam, cho phép khách hàng quét chuyển khoản điền sẵn số tài khoản, chủ tài khoản, số tiền và nội dung chuyển khoản tự động."
              steps={[
                "Lưu thông tin các số tài khoản ngân hàng thụ hưởng hay dùng tại mục 'Tài khoản của bạn' để không phải gõ lại.",
                "Nhấp chọn tài khoản ngân hàng thụ hưởng mong muốn trong danh sách thẻ.",
                "Nhập số tiền cần thanh toán và ghi chú nội dung chuyển khoản ở phần form bên dưới.",
                "Ảnh QR tương ứng sẽ được tự động vẽ trực tiếp bên khung preview phải.",
                "Chọn 'Tải ảnh QR', sao chép link hoặc bấm 'Lưu Cloud' để lưu lịch sử giao dịch lên bảng tính Google Sheet."
              ]}
              notes={[
                "Họ tên chủ tài khoản viết hoa không dấu (ví dụ: NGUYEN VAN A).",
                "VietQR được tạo động qua API mở VietQR và hoàn toàn miễn phí."
              ]}
              errors={[
                "Lỗi ảnh QR không hiển thị -> Vui lòng kiểm tra lại kết nối mạng Internet hoặc kiểm tra tính hợp lệ của Số tài khoản."
              ]}
            />

            <div className="two-col">
              {/* LEFT COLUMN: Input Forms and Saved Accounts */}
              <div className="card panel">
                <h2>👥 Tài khoản của bạn</h2>
                <p className="sub" style={{ marginBottom: '1.5rem' }}>Quản lý và sử dụng tài khoản để tạo mã QR thanh toán nhanh.</p>
                <button 
                  className="primary" 
                  style={{ width: '180px', height: '44px', float: 'right', marginTop: '-60px' }}
                  onClick={() => setShowAddAccountForm(!showAddAccountForm)}
                >
                  <Plus size={16} />
                  Thêm tài khoản
                </button>

                {showAddAccountForm && (
                  <form onSubmit={handleAddAccount} className="card panel" style={{ border: '1px dashed rgba(34,211,238,0.5)', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'white' }}>Thêm tài khoản mới</span>
                      <button type="button" className="btn-outline" style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem' }} onClick={() => setShowAddAccountForm(false)}>Hủy</button>
                    </div>

                    <div className="field full">
                      <label>Ngân hàng <span style={{ color: 'var(--red)' }}>*</span></label>
                      <div className="bank-select-wrapper">
                        {newBank ? (
                          <div className="selected-bank-compact-card">
                            <div className="bank-card-details">
                              <div className="logo-box">
                                <img 
                                  src={newBank.logo} 
                                  alt={newBank.code} 
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const textFallback = e.currentTarget.nextSibling as HTMLSpanElement;
                                    if (textFallback) textFallback.style.display = 'flex';
                                  }}
                                />
                                <span className="logo-text-fallback" style={{ display: 'none' }}>
                                  {newBank.shortName.slice(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <div className="bank-info-text">
                                <strong>{newBank.shortName}</strong>
                                <small>{newBank.name}</small>
                                <span className="bin-tag">BIN: {newBank.bin || newBank.code}</span>
                              </div>
                            </div>
                            <button 
                              type="button" 
                              className="change-bank-btn" 
                              onClick={() => { setNewBank(null); setNewSearchBankQuery(''); }}
                            >
                              Thay đổi
                            </button>
                          </div>
                        ) : (
                          <div className="bank-selector-input-container">
                            <input 
                              type="text" 
                              className="form-control bank-search-input" 
                              placeholder="🔍 Tìm theo tên viết tắt, tên đầy đủ hoặc mã BIN..."
                              value={newSearchBankQuery}
                              onChange={(e) => { setNewSearchBankQuery(e.target.value); setShowNewBankDropdown(true); }}
                              onFocus={() => setShowNewBankDropdown(true)}
                              disabled={isBanksLoading}
                              style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid rgba(91,134,211,.3)', background: 'rgba(5,17,42,.75)', color: 'white', padding: '0 14px' }}
                            />
                            
                            {showNewBankDropdown && (
                              <>
                                <div className="dropdown-click-outside-backdrop" onClick={() => setShowNewBankDropdown(false)} />
                                <div className="bank-dropdown-popover">
                                  <div className="bank-dropdown-header">
                                    <span>Kết quả tìm kiếm ({filteredNewBanks.length})</span>
                                    <button type="button" className="close-dropdown-btn" onClick={() => setShowNewBankDropdown(false)}>✕</button>
                                  </div>
                                  
                                  <div className="bank-options-list">
                                    {isBanksLoading && (
                                      <div className="loading-dropdown-state">
                                        <span>Đang tải danh sách...</span>
                                      </div>
                                    )}
                                    
                                    {banksError && (
                                      <div className="error-dropdown-state">
                                        <span>Không thể tải danh sách.</span>
                                        <button type="button" className="retry-btn" onClick={() => fetchBanksList(true)}>Thử lại</button>
                                      </div>
                                    )}
                                    
                                    {banksError && (
                                      <div className="error-dropdown-state">
                                        <span>Không thể tải danh sách.</span>
                                        <button type="button" className="retry-btn" onClick={() => fetchBanksList(true)}>Thử lại</button>
                                      </div>
                                    )}
                                    
                                    {filteredNewBanks.slice(0, 50).map(b => (
                                      <div 
                                        key={b.id} 
                                        className="bank-option-card"
                                        onClick={() => {
                                          setNewBank(b);
                                          setNewSearchBankQuery('');
                                          setShowNewBankDropdown(false);
                                        }}
                                      >
                                        <div className="option-logo-box">
                                          <img 
                                            src={b.logo} 
                                            alt={b.code} 
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                              const textFallback = e.currentTarget.nextSibling as HTMLSpanElement;
                                              if (textFallback) textFallback.style.display = 'flex';
                                            }}
                                          />
                                          <span className="logo-text-fallback" style={{ display: 'none' }}>
                                            {b.shortName.slice(0, 2).toUpperCase()}
                                          </span>
                                        </div>
                                        <div className="option-info">
                                          <div className="option-shortname">{b.shortName} <span className="option-bin">({b.bin || b.code})</span></div>
                                          <div className="option-fullname">{b.name}</div>
                                        </div>
                                      </div>
                                    ))}
                                    
                                    {!isBanksLoading && filteredNewBanks.length === 0 && (
                                      <div className="empty-dropdown-state">
                                        Không tìm thấy ngân hàng phù hợp
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="field">
                        <label>Số tài khoản <span style={{ color: 'var(--red)' }}>*</span></label>
                        <input 
                          type="text" 
                          placeholder="Nhập số tài khoản"
                          value={newAccountNo}
                          onChange={(e) => setNewAccountNo(e.target.value.replace(/\s+/g, ''))}
                          required
                        />
                      </div>

                      <div className="field">
                        <label>Tên chủ tài khoản <span style={{ color: 'var(--red)' }}>*</span></label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: NGUYEN VAN A"
                          style={{ textTransform: 'uppercase' }}
                          value={newAccountHolder}
                          onChange={(e) => setNewAccountHolder(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="field">
                        <label>Số tiền mặc định</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: 500.000"
                          value={newDefaultAmount ? formatVND(newDefaultAmount) : ''}
                          onChange={(e) => setNewDefaultAmount(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div className="field">
                        <label>Nội dung mặc định</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: CK TIEN COM"
                          value={newDefaultMemo}
                          onChange={(e) => setNewDefaultMemo(e.target.value)}
                        />
                      </div>
                    </div>

                    <button type="submit" className="primary full" style={{ height: '48px' }}>
                      <Save size={18} />
                      Lưu tài khoản
                    </button>
                  </form>
                )}

                {/* Render saved accounts cards */}
                <div className="bank-row">
                  {savedAccounts.map((acc, idx) => {
                    const isCurrentActive = selectedBank?.code === acc.bankCode && accountNo === acc.accountNo;
                    return (
                      <div 
                        key={acc.id} 
                        className={`bank ${isCurrentActive ? 'active' : ''}`}
                        onClick={() => selectAccount(acc)}
                      >
                        <b>{acc.bankCode}</b>
                        <p>•••• {acc.accountNo.slice(-4) || acc.accountNo}</p>
                        <small>{acc.accountHolder}</small>
                        {idx === 0 && <span className="pill">Mặc định</span>}
                        <button 
                          className="delete-account-btn"
                          onClick={(e) => handleDeleteAccount(acc.id, e)}
                          title="Xóa tài khoản"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', zIndex: 10 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  {savedAccounts.length === 0 && !showAddAccountForm && (
                    <EmptyState 
                      icon="👤"
                      title="Chưa lưu tài khoản cá nhân"
                      description="Hãy bấm nút 'Thêm tài khoản' phía trên để lưu thông tin thụ hưởng hay dùng của bạn."
                      style={{ gridColumn: 'span 2', padding: '2rem 1rem' }}
                    />
                  )}
                </div>

                <h2 style={{ marginTop: '2rem' }}>▣ Thông tin tạo mã QR</h2>
                <div className="form-grid">
                  <div className="field full">
                    <label>Chọn ngân hàng thụ hưởng</label>
                    <div className="bank-select-wrapper">
                      {selectedBank ? (
                        <div className="selected-bank-compact-card">
                          <div className="bank-card-details">
                            <div className="logo-box">
                              <img 
                                src={selectedBank.logo} 
                                alt={selectedBank.code} 
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const textFallback = e.currentTarget.nextSibling as HTMLSpanElement;
                                  if (textFallback) textFallback.style.display = 'flex';
                                }}
                              />
                              <span className="logo-text-fallback" style={{ display: 'none' }}>
                                {selectedBank.shortName.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="bank-info-text">
                              <strong>{selectedBank.shortName}</strong>
                              <small>{selectedBank.name}</small>
                              <span className="bin-tag">BIN: {selectedBank.bin || selectedBank.code}</span>
                            </div>
                          </div>
                          <button 
                            type="button" 
                            className="change-bank-btn" 
                            onClick={() => { setSelectedBank(null); setSearchBankQuery(''); }}
                          >
                            Thay đổi
                          </button>
                        </div>
                      ) : (
                        <div className="bank-selector-input-container">
                          <input 
                            type="text" 
                            className="form-control bank-search-input" 
                            placeholder="🔍 Tìm theo tên viết tắt, tên đầy đủ hoặc mã BIN..."
                            value={searchBankQuery}
                            onChange={(e) => { setSearchBankQuery(e.target.value); setShowBankDropdown(true); }}
                            onFocus={() => setShowBankDropdown(true)}
                            disabled={isBanksLoading}
                            style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid rgba(91,134,211,.3)', background: 'rgba(5,17,42,.75)', color: 'white', padding: '0 14px' }}
                          />
                          
                          {showBankDropdown && (
                            <>
                              <div className="dropdown-click-outside-backdrop" onClick={() => setShowBankDropdown(false)} />
                              <div className="bank-dropdown-popover">
                                <div className="bank-dropdown-header">
                                  <span>Kết quả tìm kiếm ({filteredBanks.length})</span>
                                  <button type="button" className="close-dropdown-btn" onClick={() => setShowBankDropdown(false)}>✕</button>
                                </div>
                                
                                <div className="bank-options-list">
                                  {isBanksLoading && (
                                    <div className="loading-dropdown-state">
                                      <span>Đang tải danh sách...</span>
                                    </div>
                                  )}
                                  
                                  {banksError && (
                                    <div className="error-dropdown-state">
                                      <span>Không thể tải danh sách.</span>
                                      <button type="button" className="retry-btn" onClick={() => fetchBanksList(true)}>Thử lại</button>
                                    </div>
                                  )}
                                  
                                  {filteredBanks.slice(0, 50).map(b => (
                                    <div 
                                      key={b.id} 
                                      className="bank-option-card"
                                      onClick={() => {
                                        setSelectedBank(b);
                                        setSearchBankQuery('');
                                        setShowBankDropdown(false);
                                      }}
                                    >
                                      <div className="option-logo-box">
                                        <img 
                                          src={b.logo} 
                                          alt={b.code} 
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            const textFallback = e.currentTarget.nextSibling as HTMLSpanElement;
                                            if (textFallback) textFallback.style.display = 'flex';
                                          }}
                                        />
                                        <span className="logo-text-fallback" style={{ display: 'none' }}>
                                          {b.shortName.slice(0, 2).toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="option-info">
                                        <div className="option-shortname">{b.shortName} <span className="option-bin">({b.bin || b.code})</span></div>
                                        <div className="option-fullname">{b.name}</div>
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {!isBanksLoading && filteredBanks.length === 0 && (
                                    <div className="empty-dropdown-state">
                                      Không tìm thấy ngân hàng phù hợp
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="field">
                    <label>Số tài khoản thụ hưởng</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: 1903678..."
                      value={accountNo}
                      onChange={(e) => setAccountNo(e.target.value.replace(/\s+/g, ''))}
                    />
                  </div>

                  <div className="field">
                    <label>Tên chủ tài khoản (Viết hoa không dấu)</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: NGUYEN VAN A"
                      style={{ textTransform: 'uppercase' }}
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Số tiền chuyển khoản (VND)</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: 100.000"
                      value={amount ? formatVND(amount) : ''}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>

                  <div className="field">
                    <label>Nội dung chuyển khoản</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: THANH TOAN HOA DON COM CHIEU"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                    />
                  </div>

                  <button className="primary full" onClick={handleSaveToSpreadsheet} disabled={isSavingAccount}>
                    {isSavingAccount ? (
                      <>
                        <Loader2 className="loader" size={18} />
                        Đang tạo và lưu...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        ⚡ Tạo mã QR & Lưu Cloud
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Live QR Code Preview and actions */}
              <div className="card panel qrbox">
                <h2>▦ Mã QR thanh toán</h2>
                <p className="sub" style={{ marginBottom: '1.5rem' }}>Quét mã QR bằng App Ngân hàng hoặc Ví điện tử để chuyển khoản.</p>

                {qrUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
                    <div className="template-selector" style={{ display: 'flex', gap: '0.25rem', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '8px', width: '100%', border: '1px solid var(--glass-border)' }}>
                      <button className={`template-btn ${selectedTemplate === 'qr_only' ? 'active' : ''}`} onClick={() => setSelectedTemplate('qr_only')} style={{ flexGrow: 1, border: 0, background: selectedTemplate === 'qr_only' ? 'var(--blue)' : 'transparent', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Chỉ QR</button>
                      <button className={`template-btn ${selectedTemplate === 'compact' ? 'active' : ''}`} onClick={() => setSelectedTemplate('compact')} style={{ flexGrow: 1, border: 0, background: selectedTemplate === 'compact' ? 'var(--blue)' : 'transparent', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Mẫu 1</button>
                      <button className={`template-btn ${selectedTemplate === 'compact2' ? 'active' : ''}`} onClick={() => setSelectedTemplate('compact2')} style={{ flexGrow: 1, border: 0, background: selectedTemplate === 'compact2' ? 'var(--blue)' : 'transparent', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Mẫu 2</button>
                      <button className={`template-btn ${selectedTemplate === 'print' ? 'active' : ''}`} onClick={() => setSelectedTemplate('print')} style={{ flexGrow: 1, border: 0, background: selectedTemplate === 'print' ? 'var(--blue)' : 'transparent', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Thẻ in</button>
                    </div>

                    <div className="qr-image-frame" style={{ width: '260px', height: '260px', borderRadius: '22px', background: 'white', padding: '10px', boxShadow: '0 0 45px rgba(69,115,255,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <img 
                        src={qrUrl} 
                        alt="VietQR Code" 
                        className={`qr-img ${isQrLoading ? 'loading' : ''}`}
                        onLoad={() => setIsQrLoading(false)}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                      {isQrLoading && <Loader2 className="loader qr-spinner" size={32} style={{ position: 'absolute', color: 'var(--blue)' }} />}
                    </div>

                    <div className="qr-details" style={{ width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                      <div className="qr-detail-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: 'var(--muted)' }}>Chủ TK:</span><span style={{ fontWeight: 600, color: 'white', textTransform: 'uppercase' }}>{accountHolder}</span></div>
                      <div className="qr-detail-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: 'var(--muted)' }}>Số TK:</span><span style={{ fontWeight: 600, color: 'white', fontFamily: 'monospace' }}>{accountNo}</span></div>
                      <div className="qr-detail-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: 'var(--muted)' }}>Ngân hàng:</span><span style={{ fontWeight: 600, color: 'white' }}>{selectedBank?.shortName}</span></div>
                      {amount && <div className="qr-detail-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: 'var(--muted)' }}>Số tiền:</span><span style={{ fontWeight: 700, color: 'var(--green)' }}>{formatVND(amount)} đ</span></div>}
                      {memo && <div className="qr-detail-row" style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Nội dung:</span><span style={{ fontWeight: 600, color: 'white' }}>{memo}</span></div>}
                    </div>

                    <div className="form-grid">
                      <button className="primary" style={{ height: '48px' }} onClick={handleDownloadQR}>Tải ảnh QR</button>
                      <button className="primary" style={{ height: '48px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', boxShadow: 'none' }} onClick={handleCopyQRLink}>Sao chép link</button>
                    </div>
                  </div>
                ) : (
                  <EmptyState 
                    icon="▦"
                    title="Chưa có mã QR"
                    description="Nhập đầy đủ thông tin ngân hàng, số tài khoản và họ tên chủ tài khoản ở bảng bên để hệ thống tạo mã QR thanh toán động."
                    style={{ minHeight: '320px', border: 'none', background: 'transparent' }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: EMPLOYEE PAYROLL CREATOR */}
        {currentView === 'payroll' && (
          <div className="screen active">
            <PayrollCreator 
              gasUrl={gasUrl} 
              spreadsheetId={spreadsheetId} 
              operatorName="Kế toán trưởng" 
              showToast={showToast} 
            />
          </div>
        )}

        {/* VIEW 5: MYVIB TRANSFER FILE CREATOR */}
        {currentView === 'transfer' && (
          <div className="screen active">
            <TransferFileTool showToast={showToast} />
          </div>
        )}

        {/* VIEW 6: TEXT-TO-SPEECH (TTS) TOOL */}
        {currentView === 'tts' && (
          <div className="screen active">
            <TTSPage 
              showToast={showToast} 
              gasUrl={gasUrl} 
              spreadsheetId={spreadsheetId} 
            />
          </div>
        )}

        {/* VIEW 3: SYSTEM CONFIG & SETTINGS */}
        {currentView === 'settings' && (
          <div className="screen active">
            <div className="head">
              <div className="title">
                <h1>Cấu hình Hệ thống <span className="blue-dot"></span></h1>
                <p>Thiết lập kết nối an toàn tới Google Sheets và Google Apps Script API</p>
              </div>
              <button 
                className="primary" 
                style={{ width: '180px', height: '44px' }}
                disabled={!spreadsheetId || spreadsheetId.trim() === ''}
                onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, '_blank')}
              >
                ⓘ Xem Google Sheet
              </button>
            </div>

            {/* Instruction module */}
            <GuidePanel 
              title="Cấu hình Hệ thống"
              purpose="Cấu hình tài khoản và định danh bảng tính Google Sheets để lưu trữ lịch sử chấm công, danh sách tài khoản VietQR và lịch sử xuất bảng tổng hợp lương nhà hàng an toàn qua API."
              steps={[
                "Mở tệp Google Spreadsheet của bạn và copy chuỗi ID trên thanh URL (Spreadsheet ID).",
                "Mở Script Editor (Trình soạn thảo mã) Google Apps Script bound với bảng tính.",
                "Dán mã backend API tương ứng vào file Code.gs của Apps Script.",
                "Thực hiện Deploy dưới dạng Web App với quyền truy cập 'Anyone' (Bất kỳ ai).",
                "Copy URL Web App của Google và dán vào form cấu hình bên dưới cùng với Spreadsheet ID.",
                "Bấm '🔒 Lưu cấu hình' rồi bấm 'Kiểm tra kết nối' để test kết nối thực tế."
              ]}
              notes={[
                "Nút 'Xem Google Sheet' ở đầu trang sẽ tự động bị khóa (Disabled) cho đến khi bạn điền một ID Spreadsheet hợp lệ.",
                "URL Apps Script Web App của Google luôn kết thúc bằng từ khóa '/exec'."
              ]}
              errors={[
                "Trạng thái báo 'Lỗi kết nối' -> Đảm bảo bạn đã cấp quyền chạy Script cho tài khoản Google của bạn (Authorize Script) trong Google Editor."
              ]}
            />

            <div className="settings-layout">
              <div className="card panel">
                <h2>Thông tin kết nối Google</h2>
                <p className="sub" style={{ marginBottom: '1.5rem' }}>Cung cấp thông tin kết nối với Google Apps Script Web App để hệ thống có thể ghi và đọc dữ liệu.</p>
                <form onSubmit={handleSaveSettings} className="form-grid">
                  <div className="field full">
                    <label>Google Apps Script Web App URL</label>
                    <input 
                      type="url" 
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      value={gasUrl}
                      onChange={(e) => setGasUrl(e.target.value.trim())}
                      required
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>Mọi hoạt động lưu trữ (chấm công & tạo QR tài khoản) đều được chuyển giao qua API Web App này.</p>
                  </div>

                  <div className="field full">
                    <label>Google Spreadsheet ID (ID bảng tính)</label>
                    <input 
                      type="text" 
                      placeholder="1jL7m6dZuuxOdpMPSOO1KfMviUmbI1VJXAq3Hmwz9DGk"
                      value={spreadsheetId}
                      onChange={(e) => setSpreadsheetId(e.target.value.trim())}
                      required
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>Mã ID của bảng tính Google Sheet chứa sheet DATA2 và Bang_Cham_Cong_Log.</p>
                  </div>

                  <div className="bulk-import-row full" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button type="submit" className="primary" style={{ flexGrow: 1, height: '48px' }}>
                      🔒 Lưu cấu hình
                    </button>
                    <button 
                      type="button" 
                      className="primary" 
                      style={{ width: '180px', height: '48px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}
                      onClick={testConnection}
                      disabled={connectionStatus === 'testing'}
                    >
                      {connectionStatus === 'testing' ? 'Đang test...' : 'Kiểm tra kết nối'}
                    </button>
                  </div>
                </form>
                <p className="sub" style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '1rem' }}>🛡 Thông tin của bạn được mã hóa và lưu trữ an toàn. Chỉ quản trị viên mới có quyền thay đổi cấu hình.</p>
              </div>

              <div className="status-col">
                <div className="card status">
                  <h3>Trạng thái kết nối</h3>
                  {connectionStatus === 'connected' && <b style={{ color: 'var(--green)' }}>Đã kết nối</b>}
                  {connectionStatus === 'testing' && <b style={{ color: 'var(--cyan)' }}>Đang kết kiểm tra...</b>}
                  {connectionStatus === 'failed' && <b style={{ color: 'var(--red)' }}>Lỗi kết nối</b>}
                  {connectionStatus === 'not_configured' && <b style={{ color: 'var(--muted)' }}>Chưa cấu hình</b>}
                  <p className="sub">Trạng thái xác thực Google Apps Script.</p>
                </div>
                <div className="card status">
                  <h3>Sức khỏe đồng bộ</h3>
                  <b>{connectionStatus === 'connected' ? '100%' : '0%'}</b>
                  <p className="sub">{connectionStatus === 'connected' ? 'Hệ thống hoạt động ổn định' : 'Kiểm tra lại cấu hình kết nối'}</p>
                </div>
              </div>
            </div>

            <div className="card guide">
              <h2>Hướng dẫn cấu hình & Triển khai nhanh</h2>
              <div className="steps">
                <div className="step">
                  <div className="num">1</div>
                  <h4>Mở Google Sheet</h4>
                  <p>Mở sheet của bạn hoặc tạo mới với cấu trúc chuẩn.</p>
                </div>
                <div className="step">
                  <div className="num">2</div>
                  <h4>Mở Apps Script</h4>
                  <p>Vào Extensions &gt; Apps Script để mở trình biên tập.</p>
                </div>
                <div className="step">
                  <div className="num">3</div>
                  <h4>Dán mã code</h4>
                  <p>Sao chép mã trong gas_backend.gs và dán vào.</p>
                </div>
                <div className="step">
                  <div className="num">4</div>
                  <h4>Triển khai mới</h4>
                  <p>Nhấn Deploy &gt; New deployment &gt; Chọn loại Web App.</p>
                </div>
                <div className="step">
                  <div className="num">5</div>
                  <h4>Cấu hình quyền</h4>
                  <p>Thực thi dưới quyền Tôi, Ai có quyền truy cập: Bất kỳ ai.</p>
                </div>
                <div className="step">
                  <div className="num">6</div>
                  <h4>Lấy URL & ID</h4>
                  <p>Sao chép URL Web App và ID bảng tính dán vào form ở trên.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'hikvision' && (
          <HikvisionSync 
            gasUrl={gasUrl} 
            spreadsheetId={spreadsheetId} 
            showToast={showToast} 
          />
        )}

      </main>
    </div>
  );
}

export default App;
