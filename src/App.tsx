import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  CheckCircle, 
  FileText, 
  Download, 
  Clock, 
  Calendar, 
  ShieldCheck, 
  Loader2, 
  Menu, 
  X, 
  QrCode, 
  CreditCard, 
  Plus, 
  Trash2, 
  Settings, 
  ExternalLink, 
  Save, 
  Copy, 
  Check,
  Send,
  HelpCircle
} from 'lucide-react';
import './App.css';
import { parseFile, processRecords, exportToExcel, ProcessedRecord } from './processor';

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
  const [currentView, setCurrentView] = useState<'attendance' | 'vietqr' | 'settings'>('attendance');
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

  return (
    <div className="dashboard-layout">
      {/* Toast Notification badges */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span style={{ fontSize: '1.1rem' }}>
              {t.type === 'success' && <CheckCircle size={18} color="#10b981" />}
              {t.type === 'error' && <X size={18} color="#ef4444" />}
              {t.type === 'info' && <HelpCircle size={18} color="#3b82f6" />}
            </span>
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t.message}</div>
          </div>
        ))}
      </div>

      {/* Hamburger Menu Toggle Button */}
      <button 
        className="sidebar-toggle" 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label="Toggle Navigation Menu"
      >
        <Menu size={22} />
      </button>

      {/* Navigation Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={28} color="var(--primary-color)" />
            <span className="logo-text">KG_TOOL</span>
          </div>
          <button className="sidebar-close" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${currentView === 'attendance' ? 'active' : ''}`}
            onClick={() => { setCurrentView('attendance'); setIsSidebarOpen(false); }}
          >
            <FileText size={20} />
            <span>Xử lý Chấm Công</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'vietqr' ? 'active' : ''}`}
            onClick={() => { setCurrentView('vietqr'); setIsSidebarOpen(false); }}
          >
            <QrCode size={20} />
            <span>VietQR & Tài khoản</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => { setCurrentView('settings'); setIsSidebarOpen(false); }}
          >
            <Settings size={20} />
            <span>Cấu hình Hệ thống</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <span>Phiên bản v1.2.0</span>
          <span>Kings Grill</span>
        </div>
      </aside>

      {/* Background Dim Overlay on Mobile when Sidebar is Open */}
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* Main Content Pane */}
      <main className="main-content">
        
        {/* VIEW 1: ATTENDANCE PROCESSOR */}
        {currentView === 'attendance' && (
          <div className="app-container">
            <div className="header">
              <h1 className="title">KG_TOOL - Hệ Thống Xử Lý Chấm Công</h1>
              <p className="subtitle">Tự động hoá chuẩn hoá dữ liệu, phân ca đêm và nội suy ngày giờ</p>
            </div>

            <div className="glass-panel">
              {!file ? (
                <div 
                  className="drop-zone"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="icon-container">
                    <UploadCloud size={40} />
                  </div>
                  <h3 className="upload-text">Kéo thả file vào đây hoặc click để duyệt</h3>
                  <p className="upload-hint">Hỗ trợ định dạng: .xlsx, .xls, .csv</p>
                  <input 
                    type="file" 
                    className="file-input" 
                    ref={fileInputRef}
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={(e) => e.target.files && handleFileSelection(e.target.files[0])}
                  />
                  {errorMsg && <p style={{ color: '#ef4444', marginTop: '1rem', fontWeight: 500 }}>{errorMsg}</p>}
                </div>
              ) : (
                <div className="status-section">
                  <div className="file-info">
                    <FileText size={32} color="var(--primary-color)" />
                    <div style={{ minWidth: 0, flexGrow: 1 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {(file.size / 1024).toFixed(2)} KB
                      </div>
                    </div>
                  </div>

                  {errorMsg && (
                    <div style={{ color: '#ef4444', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', width: '100%', maxWidth: '450px' }}>
                      {errorMsg}
                    </div>
                  )}

                  {!isSuccess ? (
                    <div className="actions-row">
                      <button className="btn-outline" onClick={resetState}>
                        Hủy bỏ
                      </button>
                      <button 
                        className="btn-primary" 
                        onClick={handleProcess}
                        disabled={isProcessing}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                        <CheckCircle size={24} />
                        <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Xử lý hoàn tất!</span>
                      </div>
                      
                      <div className="actions-row">
                        <button className="btn-outline" onClick={resetState}>
                          Xử lý file khác
                        </button>
                        
                        <button className="btn-primary btn-success" onClick={handleDownload}>
                          <Download size={20} />
                          Tải File Kết Quả
                        </button>

                        <button 
                          className="btn-secondary" 
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
                              <CheckCircle size={20} color="#10b981" />
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

              <div className="features-grid">
                <div className="feature-card">
                  <Clock className="feature-icon" size={32} />
                  <div style={{ fontWeight: 600 }}>Xử Lý Ca Đêm</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tự động gán giờ trước 6h sáng về ngày hôm trước</div>
                </div>
                <div className="feature-card">
                  <Calendar className="feature-icon" size={32} />
                  <div style={{ fontWeight: 600 }}>Nội Suy Lịch</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Khớp dữ liệu với dải ngày chuẩn trong tháng</div>
                </div>
                <div className="feature-card">
                  <ShieldCheck className="feature-icon" size={32} />
                  <div style={{ fontWeight: 600 }}>Định Dạng Tự Động</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Xuất ra format chuẩn báo cáo dễ nhìn</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: VIETQR & BANK ACCOUNTS */}
        {currentView === 'vietqr' && (
          <div className="app-container" style={{ maxWidth: '1000px' }}>
            <div className="view-header">
              <h1 className="view-title">Tạo mã QR Thanh toán (VietQR)</h1>
              <p className="view-subtitle">Nhập số tài khoản cá nhân, chọn ngân hàng để tạo mã QR chuẩn Napas 247 và lưu trữ Cloud</p>
            </div>

            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div className="vietqr-split-container">
                
                {/* LEFT COLUMN: Input Forms and Saved Accounts */}
                <div className="input-section">
                  
                  {/* Local account select list */}
                  <div className="accounts-section" style={{ border: 'none', paddingTop: 0, marginTop: 0 }}>
                    <div className="section-title">
                      <span>Tài khoản cá nhân của bạn</span>
                      <button 
                        className="btn-primary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}
                        onClick={() => setShowAddAccountForm(!showAddAccountForm)}
                      >
                        <Plus size={16} />
                        Thêm mới
                      </button>
                    </div>

                    {showAddAccountForm && (
                      <form onSubmit={handleAddAccount} className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem', border: '1px dashed rgba(99,102,241,0.4)', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Thêm tài khoản lưu trữ</span>
                          <button type="button" className="btn-outline" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }} onClick={() => setShowAddAccountForm(false)}>Hủy</button>
                        </div>

                        {/* Searchable Select Bank for New Account */}
                        <div className="form-group">
                          <label className="form-label">Ngân hàng <span style={{ color: '#ef4444' }}>*</span></label>
                          <div className="bank-select-wrapper">
                            {newBank ? (
                              <div className="selected-bank-indicator">
                                <div className="selected-bank-info">
                                  <img src={newBank.logo} alt={newBank.code} className="bank-logo-img" />
                                  <span style={{ fontWeight: 600 }}>{newBank.shortName}</span>
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

                        <div className="form-group">
                          <label className="form-label">Số tài khoản <span style={{ color: '#ef4444' }}>*</span></label>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="Nhập số tài khoản ngân hàng"
                            value={newAccountNo}
                            onChange={(e) => setNewAccountNo(e.target.value.replace(/\s+/g, ''))}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Tên chủ tài khoản (Không dấu) <span style={{ color: '#ef4444' }}>*</span></label>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="Ví dụ: NGUYEN VAN A"
                            style={{ textTransform: 'uppercase' }}
                            value={newAccountHolder}
                            onChange={(e) => setNewAccountHolder(e.target.value)}
                            required
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.75rem' }}>
                          <div className="form-group">
                            <label className="form-label">Số tiền mặc định</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              placeholder="Ví dụ: 500,000"
                              value={newDefaultAmount ? formatVND(newDefaultAmount) : ''}
                              onChange={(e) => setNewDefaultAmount(e.target.value.replace(/\D/g, ''))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Nội dung mặc định</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              placeholder="Ví dụ: CK TIEN AN"
                              value={newDefaultMemo}
                              onChange={(e) => setNewDefaultMemo(e.target.value)}
                            />
                          </div>
                        </div>

                        <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                          <Save size={18} />
                          Lưu tài khoản
                        </button>
                      </form>
                    )}

                    {/* Render saved accounts cards */}
                    <div className="accounts-grid">
                      {savedAccounts.map(acc => {
                        const isCurrentActive = selectedBank?.code === acc.bankCode && accountNo === acc.accountNo;
                        return (
                          <div 
                            key={acc.id} 
                            className={`account-card ${isCurrentActive ? 'active' : ''}`}
                            onClick={() => selectAccount(acc)}
                          >
                            <div className="account-card-header">
                              <span className="account-card-bank">{acc.bankCode}</span>
                              <button 
                                className="delete-account-btn"
                                onClick={(e) => handleDeleteAccount(acc.id, e)}
                                title="Xóa tài khoản này"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                            <div className="account-card-no">{acc.accountNo}</div>
                            <div className="account-card-holder">{acc.accountHolder}</div>
                          </div>
                        );
                      })}
                      {savedAccounts.length === 0 && !showAddAccountForm && (
                        <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--glass-border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                          Chưa lưu tài khoản cá nhân nào. Hãy click "Thêm mới" để tạo nhanh!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active Generator inputs form */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CreditCard size={18} color="var(--primary-color)" />
                      <span>Thông tin thanh toán hiện tại</span>
                    </div>

                    {/* Bank Selection Searchable Input */}
                    <div className="form-group">
                      <label className="form-label">Chọn ngân hàng thụ hưởng</label>
                      <div className="bank-select-wrapper">
                        {selectedBank ? (
                          <div className="selected-bank-indicator">
                            <div className="selected-bank-info">
                              <img src={selectedBank.logo} alt={selectedBank.code} className="bank-logo-img" />
                              <span style={{ fontWeight: 600 }}>{selectedBank.shortName}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}> - {selectedBank.name}</span>
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Số tài khoản</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Ví dụ: 1903678..."
                          value={accountNo}
                          onChange={(e) => setAccountNo(e.target.value.replace(/\s+/g, ''))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Tên chủ tài khoản</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Ví dụ: NGUYEN VAN A"
                          style={{ textTransform: 'uppercase' }}
                          value={accountHolder}
                          onChange={(e) => setAccountHolder(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Số tiền (VND)</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Ví dụ: 100,000"
                          value={amount ? formatVND(amount) : ''}
                          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Nội dung chuyển khoản</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Ví dụ: THANH TOAN TIEN COM"
                          value={memo}
                          onChange={(e) => setMemo(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                </div>

                {/* RIGHT COLUMN: Live QR Code Preview and cloud action */}
                <div className="output-section">
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <QrCode size={18} color="var(--primary-color)" />
                    <span>Mã VietQR của bạn</span>
                  </div>

                  {qrUrl ? (
                    <div className="qr-preview-card">
                      <div className="template-selector">
                        <button 
                          className={`template-btn ${selectedTemplate === 'qr_only' ? 'active' : ''}`}
                          onClick={() => setSelectedTemplate('qr_only')}
                        >
                          Chỉ mã QR
                        </button>
                        <button 
                          className={`template-btn ${selectedTemplate === 'compact' ? 'active' : ''}`}
                          onClick={() => setSelectedTemplate('compact')}
                        >
                          Gọn 1
                        </button>
                        <button 
                          className={`template-btn ${selectedTemplate === 'compact2' ? 'active' : ''}`}
                          onClick={() => setSelectedTemplate('compact2')}
                        >
                          Gọn 2
                        </button>
                        <button 
                          className={`template-btn ${selectedTemplate === 'print' ? 'active' : ''}`}
                          onClick={() => setSelectedTemplate('print')}
                        >
                          Thẻ in
                        </button>
                      </div>

                      <div className="qr-image-frame">
                        <img 
                          src={qrUrl} 
                          alt="VietQR Code" 
                          className={`qr-img ${isQrLoading ? 'loading' : ''}`}
                          onLoad={() => setIsQrLoading(false)}
                          onError={() => { setIsQrLoading(false); showToast('Lỗi tải ảnh QR từ VietQR', 'error'); }}
                        />
                        {isQrLoading && <Loader2 className="loader qr-spinner" size={32} />}
                      </div>

                      <div className="qr-details">
                        <div className="qr-detail-row">
                          <span className="qr-detail-label">Thụ hưởng</span>
                          <span className="qr-detail-value holder">{accountHolder}</span>
                        </div>
                        <div className="qr-detail-row">
                          <span className="qr-detail-label">Tài khoản</span>
                          <span className="qr-detail-value" style={{ fontFamily: 'monospace' }}>{accountNo}</span>
                        </div>
                        <div className="qr-detail-row">
                          <span className="qr-detail-label">Ngân hàng</span>
                          <span className="qr-detail-value">{selectedBank?.shortName}</span>
                        </div>
                        {amount && (
                          <div className="qr-detail-row">
                            <span className="qr-detail-label">Số tiền</span>
                            <span className="qr-detail-value amount">{formatVND(amount)} VND</span>
                          </div>
                        )}
                        {memo && (
                          <div className="qr-detail-row">
                            <span className="qr-detail-label">Nội dung</span>
                            <span className="qr-detail-value">{memo}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <button className="btn-outline" style={{ padding: '0.65rem' }} onClick={handleCopyQRLink}>
                            <Copy size={16} />
                            Sao chép link
                          </button>
                          <button className="btn-outline" style={{ padding: '0.65rem' }} onClick={handleDownloadQR}>
                            <Download size={16} />
                            Tải ảnh QR
                          </button>
                        </div>

                        <button 
                          className="btn-primary btn-success" 
                          style={{ width: '100%' }}
                          onClick={handleSaveToSpreadsheet}
                          disabled={isSavingAccount}
                        >
                          {isSavingAccount ? (
                            <>
                              <Loader2 className="loader" size={18} />
                              Đang lưu Cloud...
                            </>
                          ) : (
                            <>
                              <Send size={18} />
                              Lưu vào Spreadsheet (DATA2)
                            </>
                          )}
                        </button>
                      </div>

                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--glass-border)', borderRadius: '20px', color: 'var(--text-muted)', textAlign: 'center', height: '100%', minHeight: '350px' }}>
                      <QrCode size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <p>Vui lòng chọn ngân hàng, nhập số tài khoản và tên chủ tài khoản thụ hưởng để bắt đầu tạo mã QR</p>
                    </div>
                  )}

                </div>

              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: SYSTEM CONFIG & SETTINGS */}
        {currentView === 'settings' && (
          <div className="app-container" style={{ maxWidth: '800px' }}>
            <div className="view-header">
              <h1 className="view-title">Cấu hình kết nối Google Sheets</h1>
              <p className="view-subtitle">Thiết lập kết nối an toàn tới Google Apps Script API của Kings Grill</p>
            </div>

            <div className="glass-panel" style={{ padding: '2.5rem' }}>
              <form onSubmit={handleSaveSettings} className="settings-container">
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Google Apps Script Web App URL</span>
                    <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="url" 
                    className="form-control" 
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    value={gasUrl}
                    onChange={(e) => setGasUrl(e.target.value.trim())}
                    required
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mọi hoạt động lưu trữ (chấm công & tạo QR tài khoản) đều được chuyển giao qua API trung gian này để ghi vào Google Sheet.</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Google Spreadsheet ID mặc định</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="1jL7m6dZuuxOdpMPSOO1KfMviUmbI1VJXAq3Hmwz9DGk"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value.trim())}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mã ID của bảng tính Google Sheet chứa sheet <strong>DATA2</strong> và <strong>Bang_Cham_Cong_Log</strong>.</p>
                </div>

                <button type="submit" className="btn-primary" style={{ width: 'fit-content' }}>
                  <Save size={18} />
                  Lưu cấu hình hệ thống
                </button>
              </form>

              <div className="guide-box">
                <h4 className="card-title">
                  <HelpCircle size={18} color="var(--primary-color)" />
                  Hướng dẫn cấu hình & Deploy script
                </h4>
                <ol className="guide-list">
                  <li>
                    Mở trang Google Sheet của bạn, hoặc dùng trực tiếp file chỉ định: <br />
                    <a 
                      href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ color: '#818cf8', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
                    >
                      Mở Google Sheet <ExternalLink size={12} />
                    </a>
                  </li>
                  <li>Chọn <strong>Tiện ích mở rộng (Extensions)</strong> &gt; <strong>Apps Script</strong>.</li>
                  <li>Copy toàn bộ mã code trong file <code>gas_backend.gs</code> của dự án này dán vào trình biên tập script.</li>
                  <li>Click nút <strong>Triển khai (Deploy)</strong> ở góc trên bên phải &gt; <strong>Triển khai mới (New deployment)</strong>.</li>
                  <li>
                    Chọn loại cấu hình là <strong>Ứng dụng web (Web app)</strong>:
                    <ul style={{ paddingLeft: '1rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                      <li>Thực thi dưới quyền (Execute as): <strong>Tôi (Me)</strong></li>
                      <li>Quyền truy cập (Who has access): <strong>Bất kỳ ai (Anyone)</strong></li>
                    </ul>
                  </li>
                  <li>Sao chép <strong>URL Ứng dụng web</strong> nhận được và dán vào ô nhập liệu bên trên.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
