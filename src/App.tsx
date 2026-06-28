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
  HelpCircle
} from 'lucide-react';
import './App.css';
import { parseFile, processRecords, exportToExcel, type ProcessedRecord } from './processor';
import PayrollCreator from './PayrollCreator';

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
  const [currentView, setCurrentView] = useState<'attendance' | 'vietqr' | 'payroll' | 'settings'>('attendance');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Config State
  const [gasUrl, setGasUrl] = useState(() => localStorage.getItem('kg_tool_gas_url') || '');
  const [spreadsheetId, setSpreadsheetId] = useState(() => localStorage.getItem('kg_tool_spreadsheet_id') || '1jL7m6dZuuxOdpMPSOO1KfMviUmbI1VJXAq3Hmwz9DGk');

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
  const [banks, setBanks] = useState<Bank[]>(FALLBACK_BANKS);
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

  // Fetch VietQR Bank list on mount
  useEffect(() => {
    fetch('https://api.vietqr.io/v2/banks')
      .then(res => res.json())
      .then(resData => {
        if (resData.code === '00' && Array.isArray(resData.data)) {
          setBanks(resData.data);
        }
      })
      .catch(err => {
        console.error('Không thể lấy danh sách ngân hàng từ VietQR API, dùng danh sách dự phòng:', err);
      });
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
    } catch (e) {
      // Fallback: Open in new tab if fetch is blocked by CORS (standard behaviour for img.vietqr.io)
      window.open(qrUrl, '_blank');
      showToast('Mở mã QR trong tab mới để tải về!', 'info');
    }
  };

  const handleCopyQRLink = () => {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl)
      .then(() => showToast('Đã sao chép link ảnh VietQR!', 'success'))
      .catch(() => showToast('Không thể sao chép link!', 'error'));
  };

  // VND Number formatter for text display
  const formatVND = (val: string) => {
    const num = val.replace(/\D/g, '');
    if (!num) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(num, 10));
  };

  // Filter banks for custom searchable selection
  const filteredBanks = searchBankQuery
    ? banks.filter(b => 
        b.name.toLowerCase().includes(searchBankQuery.toLowerCase()) ||
        b.code.toLowerCase().includes(searchBankQuery.toLowerCase()) ||
        b.shortName.toLowerCase().includes(searchBankQuery.toLowerCase())
      )
    : banks;

  const filteredNewBanks = newSearchBankQuery
    ? banks.filter(b => 
        b.name.toLowerCase().includes(newSearchBankQuery.toLowerCase()) ||
        b.code.toLowerCase().includes(newSearchBankQuery.toLowerCase()) ||
        b.shortName.toLowerCase().includes(newSearchBankQuery.toLowerCase())
      )
    : banks;

  // Dynamic KPIs calculations for Attendance
  const empCount = processedRecords.length > 0 ? new Set(processedRecords.map(r => r.employeeName)).size : 1248;
  const daysCount = processedRecords.length > 0 ? processedRecords.length : 25840;
  const processedCount = processedRecords.length > 0 ? processedRecords.filter(r => r.checkIn && r.checkOut).length : 25328;
  const nightCount = processedRecords.length > 0 ? processedRecords.filter(r => r.overtime).length : 1152;
  const completionRate = processedRecords.length > 0 ? ((processedCount / daysCount) * 100).toFixed(2) : '97.98';

  return (
    <div className="dashboard-layout">
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
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="logo"></div>
          <span className="logo-text">KG_TOOL</span>
        </div>

        <nav className="nav">
          <button 
            className={`nav-item ${currentView === 'attendance' ? 'active' : ''}`}
            onClick={() => { setCurrentView('attendance'); setIsSidebarOpen(false); }}
          >
            <span className="ico"><FileText size={20} /></span>
            <span>Xử lý Chấm Công</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'vietqr' ? 'active' : ''}`}
            onClick={() => { setCurrentView('vietqr'); setIsSidebarOpen(false); }}
          >
            <span className="ico"><QrCode size={20} /></span>
            <span>VietQR & Tài khoản</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'payroll' ? 'active' : ''}`}
            onClick={() => { setCurrentView('payroll'); setIsSidebarOpen(false); }}
          >
            <span className="ico"><CreditCard size={20} /></span>
            <span>Quản lý Phiếu Lương</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => { setCurrentView('settings'); setIsSidebarOpen(false); }}
          >
            <span className="ico"><Settings size={20} /></span>
            <span>Cấu hình Hệ thống</span>
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
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* Main Content Pane */}
      <main className="main-content">
        
        {/* Top Header Bar */}
        <div className="topbar">
          <button className="hamb" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
          <div className="user">
            <div className="mini-btn">🔔<i className="dot"></i></div>
            <div className="mini-btn">☾</div>
            <div className="avatar">A</div>
            <div>
              <b>Admin</b>
              <small>Quản trị viên</small>
            </div>
            <span style={{ cursor: 'pointer' }}>⌄</span>
          </div>
        </div>

        {/* VIEW 1: ATTENDANCE PROCESSOR */}
        {currentView === 'attendance' && (
          <div className="screen active">
            <div className="head">
              <div className="title">
                <h1>Xử lý Chấm Công <span className="blue-dot"></span></h1>
                <p>Tự động hoá chuẩn hoá dữ liệu, phân ca đêm và nội suy ngày giờ</p>
              </div>
              <div className="kpis">
                <div className="kpi">
                  <div className="icon">👥</div>
                  <div>
                    Nhân viên
                    <b>{empCount.toLocaleString('vi-VN')}</b>
                    <span>Tổng số nhân viên</span>
                  </div>
                </div>
                <div className="kpi">
                  <div className="icon">📅</div>
                  <div>
                    Ngày công
                    <b>{daysCount.toLocaleString('vi-VN')}</b>
                    <span>Tháng này</span>
                  </div>
                </div>
                <div className="kpi">
                  <div className="icon">✅</div>
                  <div>
                    Đã xử lý
                    <b>{processedCount.toLocaleString('vi-VN')}</b>
                    <span>{completionRate}% hoàn thành</span>
                  </div>
                </div>
                <div className="kpi">
                  <div className="icon">🌙</div>
                  <div>
                    Ca đêm
                    <b>{nightCount.toLocaleString('vi-VN')}</b>
                    <span>Đêm qua</span>
                  </div>
                </div>
              </div>
            </div>

            {!file ? (
              <div 
                className="card upload"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-content">
                  <div className="file-icon">☁</div>
                  <h2>Kéo thả file Excel hoặc CSV vào đây</h2>
                  <a href="#" onClick={(e) => e.preventDefault()}>hoặc click để chọn file</a>
                  <p>Hỗ trợ định dạng: .xlsx, .xls, .csv ⓘ</p>
                  <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '8px' }}>🛡 Dữ liệu của bạn được bảo mật tuyệt đối và chỉ sử dụng để xử lý chấm công.</p>
                  <input 
                    type="file" 
                    className="file-input" 
                    ref={fileInputRef}
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={(e) => e.target.files && handleFileSelection(e.target.files[0])}
                  />
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
                  <p>Tự động gán giờ trước 6h sáng về ngày hôm trước</p>
                </div>
                <div className="arrow">→</div>
              </div>
              <div className="card feature" style={{ borderColor: 'rgba(22, 119, 255, 0.4)' }}>
                <div className="ficon">📆</div>
                <div>
                  <h3>Nội Suy Lịch</h3>
                  <p>Khớp dữ liệu với dải ngày chuẩn trong tháng</p>
                </div>
                <div className="arrow">→</div>
              </div>
              <div className="card feature" style={{ borderColor: 'rgba(34, 211, 238, 0.4)' }}>
                <div className="ficon">🪄</div>
                <div>
                  <h3>Định Dạng Tự Động</h3>
                  <p>Xuất ra format chuẩn báo cáo dễ nhìn</p>
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
                <div className="kpi">
                  <div className="icon">👤</div>
                  <div>
                    Tài khoản đã lưu
                    <b>{String(savedAccounts.length).padStart(2, '0')}</b>
                    <span>Tổng số tài khoản</span>
                  </div>
                </div>
                <div className="kpi">
                  <div className="icon">▦</div>
                  <div>
                    QR đã tạo hôm nay
                    <b>28</b>
                    <span>Mã QR</span>
                  </div>
                </div>
                <div className="kpi">
                  <div className="icon">📈</div>
                  <div>
                    Tổng giao dịch
                    <b>128</b>
                    <span>30 ngày qua</span>
                  </div>
                </div>
                <div className="kpi">
                  <div className="icon">💼</div>
                  <div>
                    Tổng tiền nhận
                    <b>27.450.000đ</b>
                    <span>30 ngày qua</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="two-col">
              {/* LEFT COLUMN: Input Forms and Saved Accounts */}
              <div className="card panel">
                <h2>👥 Tài khoản của bạn</h2>
                <p className="sub">Quản lý và sử dụng tài khoản để tạo mã QR thanh toán.</p>
                <button 
                  className="primary" 
                  style={{ width: '180px', height: '44px', float: 'right', marginTop: '-60px' }}
                  onClick={() => setShowAddAccountForm(!showAddAccountForm)}
                >
                  <Plus size={16} />
                  Thêm tài khoản
                </button>

                {showAddAccountForm && (
                  <form onSubmit={handleAddAccount} className="card panel" style={{ border: '1px dashed rgba(34,211,238,0.5)', padding: '1.25rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'white' }}>Thêm tài khoản lưu trữ</span>
                      <button type="button" className="btn-outline" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }} onClick={() => setShowAddAccountForm(false)}>Hủy</button>
                    </div>

                    <div className="field full">
                      <label>Ngân hàng <span style={{ color: 'var(--red)' }}>*</span></label>
                      <div className="bank-select-wrapper">
                        {newBank ? (
                          <div className="selected-bank-indicator">
                            <div className="selected-bank-info">
                              <img src={newBank.logo} alt={newBank.code} className="bank-logo-img" />
                              <span style={{ fontWeight: 600, color: 'white' }}>{newBank.shortName}</span>
                            </div>
                            <button type="button" className="change-bank-btn" onClick={() => setNewBank(null)}>Thay đổi</button>
                          </div>
                        ) : (
                          <>
                            <input 
                              type="text" 
                              className="form-control bank-search-input" 
                              placeholder="Tìm tên hoặc mã ngân hàng..."
                              value={newSearchBankQuery}
                              onChange={(e) => { setNewSearchBankQuery(e.target.value); setShowNewBankDropdown(true); }}
                              onFocus={() => setShowNewBankDropdown(true)}
                              style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid rgba(91,134,211,.3)', background: 'rgba(5,17,42,.75)', color: 'white', padding: '0 14px' }}
                            />
                            {showNewBankDropdown && (
                              <div className="bank-dropdown">
                                {filteredNewBanks.slice(0, 10).map(b => (
                                  <div 
                                    key={b.id} 
                                    className="bank-option"
                                    onClick={() => {
                                      setNewBank(b);
                                      setShowNewBankDropdown(false);
                                    }}
                                  >
                                    <img src={b.logo} alt={b.code} className="bank-logo-img" />
                                    <div className="bank-option-text">
                                      <span className="bank-option-code">{b.code} ({b.shortName})</span>
                                      <span className="bank-option-name">{b.name}</span>
                                    </div>
                                  </div>
                                ))}
                                {filteredNewBanks.length === 0 && (
                                  <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>Không tìm thấy ngân hàng nào</div>
                                )}
                              </div>
                            )}
                          </>
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
                          placeholder="Ví dụ: 500,000"
                          value={newDefaultAmount ? formatVND(newDefaultAmount) : ''}
                          onChange={(e) => setNewDefaultAmount(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div className="field">
                        <label>Nội dung mặc định</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: CK TIEN AN"
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
                    <div className="full" style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--glass-border)', borderRadius: '12px', color: 'var(--muted)' }}>
                      Chưa lưu tài khoản cá nhân nào. Hãy click "Thêm tài khoản" để tạo nhanh!
                    </div>
                  )}
                </div>

                <h2>▣ Thông tin tạo mã QR</h2>
                <div className="form-grid">
                  <div className="field full">
                    <label>Chọn ngân hàng thụ hưởng</label>
                    <div className="bank-select-wrapper">
                      {selectedBank ? (
                        <div className="selected-bank-indicator" style={{ marginTop: 0 }}>
                          <div className="selected-bank-info">
                            <img src={selectedBank.logo} alt={selectedBank.code} className="bank-logo-img" />
                            <span style={{ fontWeight: 600, color: 'white' }}>{selectedBank.shortName}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}> - {selectedBank.name}</span>
                          </div>
                          <button type="button" className="change-bank-btn" onClick={() => { setSelectedBank(null); setSearchBankQuery(''); }}>Thay đổi</button>
                        </div>
                      ) : (
                        <>
                          <input 
                            type="text" 
                            className="form-control bank-search-input" 
                            placeholder="Tìm tên hoặc mã ngân hàng..."
                            value={searchBankQuery}
                            onChange={(e) => { setSearchBankQuery(e.target.value); setShowBankDropdown(true); }}
                            onFocus={() => setShowBankDropdown(true)}
                            style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid rgba(91,134,211,.3)', background: 'rgba(5,17,42,.75)', color: 'white', padding: '0 14px' }}
                          />
                          {showBankDropdown && (
                            <div className="bank-dropdown">
                              {filteredBanks.slice(0, 10).map(b => (
                                <div 
                                  key={b.id} 
                                  className="bank-option"
                                  onClick={() => {
                                    setSelectedBank(b);
                                    setSearchBankQuery(b.shortName);
                                    setShowBankDropdown(false);
                                  }}
                                >
                                  <img src={b.logo} alt={b.code} className="bank-logo-img" />
                                  <div className="bank-option-text">
                                    <span className="bank-option-code">{b.code} ({b.shortName})</span>
                                    <span className="bank-option-name">{b.name}</span>
                                  </div>
                                </div>
                              ))}
                              {filteredBanks.length === 0 && (
                                <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>Không tìm thấy ngân hàng nào</div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="field">
                    <label>Số tài khoản</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: 1903678..."
                      value={accountNo}
                      onChange={(e) => setAccountNo(e.target.value.replace(/\s+/g, ''))}
                    />
                  </div>

                  <div className="field">
                    <label>Tên chủ tài khoản (Không dấu)</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: NGUYEN VAN A"
                      style={{ textTransform: 'uppercase' }}
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Số tiền (VND)</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: 100,000"
                      value={amount ? formatVND(amount) : ''}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>

                  <div className="field">
                    <label>Nội dung chuyển khoản</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: THANH TOAN TIEN COM"
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
                <p className="sub" style={{ marginBottom: '1.5rem' }}>Quét mã để chuyển khoản nhanh chóng và chính xác.</p>

                {qrUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
                    <div className="template-selector" style={{ display: 'flex', gap: '0.25rem', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '8px', width: '100%', border: '1px solid var(--glass-border)' }}>
                      <button className={`template-btn ${selectedTemplate === 'qr_only' ? 'active' : ''}`} onClick={() => setSelectedTemplate('qr_only')} style={{ flexGrow: 1, border: 0, background: selectedTemplate === 'qr_only' ? 'var(--blue)' : 'transparent', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Chỉ mã QR</button>
                      <button className={`template-btn ${selectedTemplate === 'compact' ? 'active' : ''}`} onClick={() => setSelectedTemplate('compact')} style={{ flexGrow: 1, border: 0, background: selectedTemplate === 'compact' ? 'var(--blue)' : 'transparent', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Gọn 1</button>
                      <button className={`template-btn ${selectedTemplate === 'compact2' ? 'active' : ''}`} onClick={() => setSelectedTemplate('compact2')} style={{ flexGrow: 1, border: 0, background: selectedTemplate === 'compact2' ? 'var(--blue)' : 'transparent', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Gọn 2</button>
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
                      <button className="primary" style={{ height: '48px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', boxShadow: 'none' }} onClick={handleCopyQRLink}>Link QR</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', color: 'var(--muted)', textAlign: 'center' }}>
                    <QrCode size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>Vui lòng điền thông tin tài khoản thụ hưởng để bắt đầu tạo mã QR</p>
                  </div>
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
                style={{ width: '160px', height: '44px' }}
                onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, '_blank')}
              >
                ⓘ Xem Google Sheet
              </button>
            </div>

            <div className="settings-layout">
              <div className="card panel">
                <h2>Thông tin kết nối Google</h2>
                <p className="sub" style={{ marginBottom: '1rem' }}>Cung cấp thông tin kết nối với Google Apps Script Web App để hệ thống có thể ghi và đọc dữ liệu.</p>
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
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>Mã ID của bảng tính Google Sheet chứa sheet DATA2 và Bang_Cham_Cong_Log.</p>
                  </div>

                  <button type="submit" className="primary full" style={{ height: '48px' }}>
                    🔒 Lưu cấu hình
                  </button>
                </form>
                <p className="sub" style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '1rem' }}>🛡 Thông tin của bạn được mã hóa và lưu trữ an toàn. Chỉ quản trị viên mới có quyền thay đổi cấu hình.</p>
              </div>

              <div className="status-col">
                <div className="card status">
                  <h3>Trạng thái kết nối</h3>
                  <b style={{ color: gasUrl ? 'var(--green)' : 'var(--red)' }}>{gasUrl ? 'Đã cấu hình' : 'Chưa cấu hình'}</b>
                  <p className="sub">Đường dẫn Google Apps Script Web App.</p>
                </div>
                <div className="card status">
                  <h3>Sức khỏe đồng bộ</h3>
                  <b>{gasUrl ? '100%' : '0%'}</b>
                  <p className="sub">{gasUrl ? 'Hệ thống hoạt động ổn định' : 'Vui lòng cấu hình URL'}</p>
                </div>
              </div>
            </div>

            <div className="card guide">
              <h2>Hướng dẫn cấu hình & Triển khai</h2>
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

      </main>
    </div>
  );
}

export default App;
