import React, { useState, useRef, useEffect, useMemo } from 'react';
import html2canvas from 'html2canvas';
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
  Search,
  Copy,
  Check,
  Moon,
  Sun,
  Bell,
  Puzzle,
  Sparkles,
  PanelRight,
  Users,
  Calendar,
  Cpu,
  Wallet,
  Activity,
  UploadCloud
} from 'lucide-react';
import './App.css';
import { parseFile, processRecords, exportToExcel, exportAttendanceTemplate, summarizeAttendanceForPayroll, type ProcessedRecord, type TimeRecord } from './processor';
import PayrollCreator from './PayrollCreator';
import TransferFileTool from './components/TransferFileTool';
import TTSPage from './components/TTSPage';
import HikvisionSync from './components/HikvisionSync';
import { StatCard, EmptyState, GuidePanel, PageHeader, Badge } from './components/Shared';
import { CommandPalette } from './components/CommandPalette';



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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('kg_tool_theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [isExtensionMode, setIsExtensionMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'extension' || window.innerWidth <= 480;
  });
  const [showExtensionGuideModal, setShowExtensionGuideModal] = useState(false);

  // Sync theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kg_tool_theme', theme);
  }, [theme]);

  // Sync extension compact mode class to body
  useEffect(() => {
    document.body.classList.toggle('is-extension-mode', isExtensionMode);
  }, [isExtensionMode]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      showToast(
        next === 'light'
          ? 'Đã chuyển sang chế độ Sáng (Daylight Alabaster)'
          : 'Đã chuyển sang chế độ Tối (Warm Carbon Studio)',
        'info'
      );
      return next;
    });
  };

  // Global Shortcut listener for Command Palette (Ctrl+K / Cmd+K) & Module Switch (Alt+1..5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      } else if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') { e.preventDefault(); setCurrentView('attendance'); }
        else if (e.key === '2') { e.preventDefault(); setCurrentView('payroll'); }
        else if (e.key === '3') { e.preventDefault(); setCurrentView('transfer'); }
        else if (e.key === '4') { e.preventDefault(); setCurrentView('vietqr'); }
        else if (e.key === '5') { e.preventDefault(); setCurrentView('tts'); }
        else if (e.key === '6') { e.preventDefault(); setCurrentView('settings'); }
        else if (e.key === '7') { e.preventDefault(); setCurrentView('hikvision'); }
      }
    };
    const handleNavigateTab = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setCurrentView(detail);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('kg-navigate-tab', handleNavigateTab as EventListener);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('kg-navigate-tab', handleNavigateTab as EventListener);
    };
  }, []);

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
  const [gasUrl, setGasUrl] = useState(() => {
    const cached = localStorage.getItem('kg_tool_gas_url');
    const targetUrl = "https://script.google.com/macros/s/AKfycbyCetIZ7cBHfLOF5eu1PXyeHfg7Gmqo9m-V8j6fJc_-7rjT2_YL4IKvzz6nbOHbsulrCw/exec";
    if (cached && !cached.includes("AKfycbyCetIZ7cBHfLOF5eu1PXyeHfg7Gmqo9m-V8j6fJc_-7rjT2_YL4IKvzz6nbOHbsulrCw")) {
      localStorage.setItem('kg_tool_gas_url', targetUrl);
      return targetUrl;
    }
    return cached || targetUrl;
  });
  const [spreadsheetId, setSpreadsheetId] = useState(() => localStorage.getItem('kg_tool_spreadsheet_id') || '');
  const [connectionStatus, setConnectionStatus] = useState<'not_configured' | 'testing' | 'connected' | 'failed'>(() => {
    const cached = localStorage.getItem('kg_tool_gas_url');
    const activeGasUrl = (cached && !cached.includes("AKfycbyCetIZ7cBHfLOF5eu1PXyeHfg7Gmqo9m-V8j6fJc_-7rjT2_YL4IKvzz6nbOHbsulrCw"))
      ? "https://script.google.com/macros/s/AKfycbyCetIZ7cBHfLOF5eu1PXyeHfg7Gmqo9m-V8j6fJc_-7rjT2_YL4IKvzz6nbOHbsulrCw/exec"
      : (cached || "https://script.google.com/macros/s/AKfycbyCetIZ7cBHfLOF5eu1PXyeHfg7Gmqo9m-V8j6fJc_-7rjT2_YL4IKvzz6nbOHbsulrCw/exec");
    return activeGasUrl ? 'connected' : 'not_configured';
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

  // Topbar interactive menu state
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Attendance search & filter for preview table
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'night' | 'complete' | 'incomplete'>('all');
  const [copiedBankId, setCopiedBankId] = useState<string | null>(null);


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

  // Bill splitter states
  const [vietQrViewMode, setVietQrViewMode] = useState<'single' | 'split'>('single');
  const [splitTotalAmount, setSplitTotalAmount] = useState('1200000');
  const [splitPeopleCount, setSplitPeopleCount] = useState(4);
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom'>('equal');
  const [splitGuests, setSplitGuests] = useState<any[]>([
    { id: '1', name: 'Khách A', amount: 300000, memo: 'THANH TOAN BAN 05 KHACH A' },
    { id: '2', name: 'Khách B', amount: 300000, memo: 'THANH TOAN BAN 05 KHACH B' },
    { id: '3', name: 'Khách C', amount: 300000, memo: 'THANH TOAN BAN 05 KHACH C' },
    { id: '4', name: 'Khách D', amount: 300000, memo: 'THANH TOAN BAN 05 KHACH D' },
  ]);
  const [selectedSplitGuestIndex, setSelectedSplitGuestIndex] = useState(0);

  // Branded Receipt states
  const [receiptTheme, setReceiptTheme] = useState<'blue' | 'green' | 'black' | 'gold'>('blue');
  const [receiptThankYou, setReceiptThankYou] = useState('Kings Grill cảm ơn Quý khách!');
  const [receiptShowLogo, setReceiptShowLogo] = useState(true);
  const [receiptShowCashier, setReceiptShowCashier] = useState(true);
  const [receiptShowDate, setReceiptShowDate] = useState(true);
  const [receiptTableNo, setReceiptTableNo] = useState('Bàn 05');
  const [receiptShowBranded, setReceiptShowBranded] = useState(true);

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

  // Fetch VietQR Bank list and handle Extension / Deep-link URL parameters on mount
  useEffect(() => {
    fetchBanksList(true);
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const amountParam = params.get('amount');
    const descParam = params.get('desc');
    const textParam = params.get('text');

    if (tabParam === 'qr' || tabParam === 'vietqr' || amountParam) {
      setCurrentView('vietqr');
      if (amountParam) setAmount(amountParam.replace(/\D/g, ''));
      if (descParam) setMemo(descParam);
      // Pre-select first saved account if available
      if (savedAccounts.length > 0 && !selectedBank) {
        const firstAcc = savedAccounts[0];
        const foundBank = banks.find(b => b.bin === firstAcc.bankId || b.code === firstAcc.bankCode) || FALLBACK_BANKS[0];
        setSelectedBank(foundBank);
        setAccountNo(firstAcc.accountNo);
        setAccountHolder(firstAcc.accountHolder);
        if (!descParam && firstAcc.defaultMemo) setMemo(firstAcc.defaultMemo);
      }
    } else if (tabParam === 'tts' || textParam) {
      setCurrentView('tts');
    } else if (tabParam === 'payroll') {
      setCurrentView('payroll');
    } else if (tabParam === 'transfer') {
      setCurrentView('transfer');
    } else if (tabParam === 'attendance') {
      setCurrentView('attendance');
    }
  }, []);

  // Update split bill details
  useEffect(() => {
    if (splitMethod === 'equal') {
      const cleanTotal = Number(splitTotalAmount.replace(/\D/g, '')) || 0;
      const count = Number(splitPeopleCount) || 1;
      const equalShare = Math.round(cleanTotal / count);
      
      const newGuests = Array.from({ length: count }, (_, i) => ({
        id: String(i + 1),
        name: `Khách ${String.fromCharCode(65 + i)}`,
        amount: equalShare,
        memo: `CK ${receiptTableNo || 'BAN 05'} PHAN ${i + 1}`
      }));
      setSplitGuests(newGuests);
      setSelectedSplitGuestIndex(0);
    }
  }, [splitTotalAmount, splitPeopleCount, splitMethod, receiptTableNo]);

  // Update QR Code Image Link dynamically based on inputs
  useEffect(() => {
    if (selectedBank && accountNo && accountHolder) {
      setIsQrLoading(true);
      let cleanAmount = '';
      let activeMemo = '';
      
      if (vietQrViewMode === 'split' && splitGuests[selectedSplitGuestIndex]) {
        cleanAmount = String(splitGuests[selectedSplitGuestIndex].amount);
        activeMemo = splitGuests[selectedSplitGuestIndex].memo || '';
      } else {
        cleanAmount = amount.replace(/\D/g, '');
        activeMemo = memo;
      }
      
      const bankId = selectedBank.bin || selectedBank.code;
      const url = `https://img.vietqr.io/image/${bankId}-${accountNo}-${selectedTemplate}.png?amount=${cleanAmount}&addInfo=${encodeURIComponent(activeMemo)}&accountName=${encodeURIComponent(accountHolder.toUpperCase())}`;
      setQrUrl(url);
    } else {
      setQrUrl('');
    }
  }, [selectedBank, accountNo, accountHolder, amount, memo, selectedTemplate, vietQrViewMode, splitGuests, selectedSplitGuestIndex]);

  // Toast System Helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const getThemeGradient = () => {
    switch (receiptTheme) {
      case 'blue': return 'linear-gradient(180deg, #1e3a8a 0%, #0f172a 100%)';
      case 'green': return 'linear-gradient(180deg, #064e3b 0%, #022c22 100%)';
      case 'black': return 'linear-gradient(180deg, #374151 0%, #111827 100%)';
      case 'gold': return 'linear-gradient(180deg, #78350f 0%, #1e1b4b 100%)';
      default: return 'linear-gradient(180deg, #1e3a8a 0%, #0f172a 100%)';
    }
  };

  const getThemeBorder = () => {
    switch (receiptTheme) {
      case 'blue': return 'rgba(59, 130, 246, 0.4)';
      case 'green': return 'rgba(16, 185, 129, 0.4)';
      case 'black': return 'rgba(156, 163, 175, 0.4)';
      case 'gold': return 'rgba(245, 158, 11, 0.4)';
      default: return 'rgba(59, 130, 246, 0.4)';
    }
  };

  const handleDownloadReceipt = async () => {
    const el = document.getElementById('branded-receipt-card');
    if (!el) return;
    try {
      showToast('Đang tạo hình ảnh biên lai...', 'info');
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: null
      });
      const link = document.createElement('a');
      link.download = `BienLai_KingsGrill_${vietQrViewMode === 'split' ? `Ban_${receiptTableNo}_Khach_${selectedSplitGuestIndex + 1}` : 'Don'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Đã tải xuống hình ảnh biên lai thành công!', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(`Lỗi khi tạo ảnh: ${e.message}`, 'error');
    }
  };

  const handlePrintReceipt = () => {
    const el = document.getElementById('branded-receipt-card');
    if (!el) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const themeGradient = getThemeGradient();
    
    printWindow.document.write(`
      <html>
        <head>
          <title>In Biên lai Kings Grill</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              background-color: #f3f4f6;
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .receipt-card {
              width: 380px;
              background: ${themeGradient};
              color: white;
              padding: 24px;
              border-radius: 16px;
              box-shadow: 0 4px 10px rgba(0,0,0,0.1);
              box-sizing: border-box;
            }
            .receipt-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .receipt-header h1 {
              font-size: 22px;
              margin: 0;
              letter-spacing: 0.5px;
            }
            .receipt-header p {
              font-size: 11px;
              margin: 4px 0 0 0;
              opacity: 0.7;
            }
            .receipt-divider {
              border-top: 1px dashed rgba(255,255,255,0.2);
              margin: 16px 0;
            }
            .receipt-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              margin-bottom: 8px;
            }
            .receipt-row .label {
              opacity: 0.6;
            }
            .receipt-row .value {
              font-weight: 600;
            }
            .receipt-amount-row {
              background: rgba(255,255,255,0.05);
              padding: 10px;
              border-radius: 8px;
              margin-bottom: 12px;
            }
            .receipt-qr-wrapper {
              display: flex;
              justify-content: center;
              margin: 20px 0;
            }
            .receipt-qr-img {
              width: 200px;
              height: 200px;
              background: white;
              padding: 8px;
              border-radius: 12px;
            }
            .receipt-footer {
              text-align: center;
              font-size: 12px;
              opacity: 0.8;
              font-style: italic;
            }
            .receipt-controls-print {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            ${el.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
      const records = await parseFile(file);
      const processed = processRecords(records);
      const blob = await exportToExcel(processed);
      const summary = summarizeAttendanceForPayroll(processed);
      localStorage.setItem('kg_tool_attendance_summary', JSON.stringify(summary));
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
            const sec = timeParts.length >= 3 ? parseInt(timeParts[2], 10) : 0;
            const inDate = new Date(y, m, d, h, min, sec, 0);
            records.push({ name: log.name, timestamp: inDate });
          }
        }
        
        if (log.checkOut) {
          const timeParts = log.checkOut.split(':');
          if (timeParts.length >= 2) {
            const h = parseInt(timeParts[0], 10);
            const min = parseInt(timeParts[1], 10);
            const sec = timeParts.length >= 3 ? parseInt(timeParts[2], 10) : 0;
            let outDate = new Date(y, m, d, h, min, sec, 0);
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
      const summary = summarizeAttendanceForPayroll(processed);
      localStorage.setItem('kg_tool_attendance_summary', JSON.stringify(summary));
      
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

  const handlePipeAttendanceToPayroll = () => {
    if (processedRecords.length > 0) {
      const summary = summarizeAttendanceForPayroll(processedRecords);
      localStorage.setItem('kg_tool_attendance_summary', JSON.stringify(summary));
    }
    setCurrentView('payroll');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('kg-import-attendance-to-payroll'));
    }, 120);
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

  const handleDownloadTemplate = async () => {
    try {
      showToast('Đang tạo file mẫu chấm công...', 'info');
      const blob = await exportAttendanceTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Mau_Cham_Cong_Tho.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Đã tải file mẫu chấm công về máy!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Không thể tạo file mẫu: ' + err.message, 'error');
    }
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
    setAttendanceSearch('');
    setAttendanceFilter('all');
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

  const activeAmount = vietQrViewMode === 'split' && splitGuests[selectedSplitGuestIndex]
    ? splitGuests[selectedSplitGuestIndex].amount
    : (amount ? Number(amount.replace(/\D/g, '')) : 0);
    
  const activeMemo = vietQrViewMode === 'split' && splitGuests[selectedSplitGuestIndex]
    ? splitGuests[selectedSplitGuestIndex].memo
    : memo;

  const activeGuestName = vietQrViewMode === 'split' && splitGuests[selectedSplitGuestIndex]
    ? splitGuests[selectedSplitGuestIndex].name
    : '';

  // Split bill disparity calculation & helpers
  const splitTotalNum = Number(splitTotalAmount.replace(/\D/g, '')) || 0;
  const splitCurrentSum = splitGuests.reduce((acc, g) => acc + (Number(g.amount) || 0), 0);
  const splitDisparity = splitTotalNum - splitCurrentSum;

  const handleAutoBalanceSplit = () => {
    if (splitGuests.length === 0) return;
    const lastIndex = splitGuests.length - 1;
    const currentLastAmount = Number(splitGuests[lastIndex].amount) || 0;
    const newLastAmount = Math.max(0, currentLastAmount + splitDisparity);
    setSplitGuests(prev => prev.map((g, idx) => idx === lastIndex ? { ...g, amount: newLastAmount } : g));
    showToast('Đã tự động bù số dư vào phần khách cuối!', 'success');
  };

  const handleAddSplitGuest = () => {
    const nextIdx = splitGuests.length + 1;
    const newGuest = {
      id: String(Date.now()),
      name: `Khách ${String.fromCharCode(64 + Math.min(nextIdx, 26))}`,
      amount: 0,
      memo: `CK ${receiptTableNo || 'BAN 05'} PHAN ${nextIdx}`
    };
    setSplitGuests(prev => [...prev, newGuest]);
    setSplitPeopleCount(prev => prev + 1);
  };

  const handleRemoveSplitGuest = (idx: number) => {
    if (splitGuests.length <= 1) return;
    setSplitGuests(prev => prev.filter((_, i) => i !== idx));
    setSplitPeopleCount(prev => Math.max(1, prev - 1));
    if (selectedSplitGuestIndex >= splitGuests.length - 1) {
      setSelectedSplitGuestIndex(Math.max(0, splitGuests.length - 2));
    }
  };

  const addSampleKingsGrillAccount = () => {
    const sampleBank = banks.find(b => b.code === 'VCB') || FALLBACK_BANKS[0];
    const sampleAcc: SavedAccount = {
      id: Date.now().toString(),
      bankId: sampleBank.bin || sampleBank.code,
      bankName: sampleBank.name,
      bankCode: sampleBank.code,
      accountNo: '1023456789',
      accountHolder: 'KINGS GRILL RESTAURANT',
      defaultMemo: 'THANH TOAN TIEC KINGS GRILL',
      defaultAmount: '500000'
    };
    const updated = [...savedAccounts, sampleAcc];
    setSavedAccounts(updated);
    localStorage.setItem('kg_tool_saved_accounts', JSON.stringify(updated));
    setSelectedBank(sampleBank);
    setAccountNo(sampleAcc.accountNo);
    setAccountHolder(sampleAcc.accountHolder);
    setMemo(sampleAcc.defaultMemo);
    setAmount(sampleAcc.defaultAmount);
    showToast('Đã thêm tài khoản mẫu Kings Grill thành công!', 'success');
  };

  // Filtered attendance records for DataGrid table preview
  const filteredAttendanceRecords = useMemo(() => {
    let list = processedRecords;
    if (attendanceFilter === 'night') {
      list = list.filter(r => r.overtime);
    } else if (attendanceFilter === 'complete') {
      list = list.filter(r => r.checkIn && r.checkOut);
    } else if (attendanceFilter === 'incomplete') {
      list = list.filter(r => !r.checkIn || !r.checkOut);
    }
    if (attendanceSearch.trim()) {
      const q = stripAccents(attendanceSearch.trim()).toLowerCase();
      list = list.filter(r => stripAccents(r.employeeName).toLowerCase().includes(q));
    }
    return list;
  }, [processedRecords, attendanceFilter, attendanceSearch]);

  const formatTimeStr = (d: Date | null) => {
    if (!d) return '—';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };


  return (
    <div className={`dashboard-layout ${isMobile ? 'layout-mobile' : ''} ${!isMobile && sidebarCollapsed ? 'layout-collapsed' : ''} ${isExtensionMode ? 'is-extension-mode' : ''}`}>
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
          <span className="logo-text">KG_STUDIO</span>
        </div>

        <nav className="nav">
          <button 
            className={`nav-item ${currentView === 'attendance' || currentView === 'hikvision' ? 'active' : ''}`}
            onClick={() => { setCurrentView('attendance'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "Chấm Công & Thiết Bị (Alt+1)" : "Phím tắt: Alt+1"}
          >
            <span className="ico"><FileText size={20} /></span>
            <span>Chấm Công & Thiết Bị</span>
            <span className="nav-kbd">Alt+1</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'payroll' || currentView === 'transfer' ? 'active' : ''}`}
            onClick={() => { setCurrentView('payroll'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "Lương & Chuyển Tiền (Alt+2)" : "Phím tắt: Alt+2 / Alt+3"}
          >
            <span className="ico"><CreditCard size={20} /></span>
            <span>Lương & Chuyển Tiền</span>
            <span className="nav-kbd">Alt+2</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'vietqr' ? 'active' : ''}`}
            onClick={() => { setCurrentView('vietqr'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "VietQR & Thu Ngân (Alt+4)" : "Phím tắt: Alt+4"}
          >
            <span className="ico"><QrCode size={20} /></span>
            <span>VietQR & Thu Ngân</span>
            <span className="nav-kbd">Alt+4</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'tts' ? 'active' : ''}`}
            onClick={() => { setCurrentView('tts'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "Đọc TTS AI (Alt+5)" : "Phím tắt: Alt+5"}
          >
            <span className="ico"><Volume2 size={20} /></span>
            <span>Đọc TTS AI</span>
            <span className="nav-kbd">Alt+5</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => { setCurrentView('settings'); setIsMobileDrawerOpen(false); }}
            title={(!isMobile && sidebarCollapsed) ? "Cấu Hình System (Alt+6)" : "Phím tắt: Alt+6"}
          >
            <span className="ico"><Settings size={20} /></span>
            <span>Cấu Hình System</span>
            <span className="nav-kbd">Alt+6</span>
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
          <span>Phiên bản v2.5.0</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <button className="hamb" onClick={toggleSidebar} title="Thu gọn / Mở rộng thanh điều hướng">☰</button>
            <div 
              className="topbar-command-trigger"
              onClick={() => setIsCommandPaletteOpen(true)}
              title="Mở Command Hub (Ctrl+K)"
            >
              <Search size={14} style={{ color: 'var(--cyan)' }} />
              <span className="command-trigger-text">Tìm lệnh & thao tác nhanh...</span>
              <kbd>Ctrl+K</kbd>
            </div>

            {/* 1-Click Operational Workflow Pipeline */}
            <div className="topbar-quick-pipeline" aria-label="Quy trình vận hành nhanh">
              <button
                type="button"
                className={`pipeline-step-pill ${currentView === 'attendance' || currentView === 'hikvision' ? 'active' : ''}`}
                onClick={() => setCurrentView('attendance')}
                title="Bước 1: Xử lý Chấm công & Máy chấm công (Alt+1)"
              >
                <span>1. Chấm công</span>
              </button>
              <span className="pipeline-arrow">›</span>
              <button
                type="button"
                className={`pipeline-step-pill ${currentView === 'payroll' ? 'active' : ''}`}
                onClick={() => setCurrentView('payroll')}
                title="Bước 2: Tính lương & In phiếu K80/A4 (Alt+2)"
              >
                <span>2. Tính lương</span>
              </button>
              <span className="pipeline-arrow">›</span>
              <button
                type="button"
                className={`pipeline-step-pill ${currentView === 'transfer' ? 'active' : ''}`}
                onClick={() => setCurrentView('transfer')}
                title="Bước 3: Xuất lệnh chuyển khoản lô MyVIB / VCB (Alt+3)"
              >
                <span>3. Lệnh CK</span>
              </button>
              <span className="pipeline-arrow" style={{ margin: '0 2px', opacity: 0.4 }}>|</span>
              <button
                type="button"
                className={`pipeline-step-pill ${currentView === 'vietqr' ? 'active' : ''}`}
                onClick={() => setCurrentView('vietqr')}
                title="Thu ngân: Tạo mã VietQR & Chia bill POS (Alt+4)"
              >
                <span>⚡ VietQR</span>
              </button>
              <button
                type="button"
                className={`pipeline-step-pill ${currentView === 'tts' ? 'active' : ''}`}
                onClick={() => setCurrentView('tts')}
                title="Phát thanh: Đọc thông báo AI TTS (Alt+5)"
              >
                <span>🔊 TTS AI</span>
              </button>
            </div>
          </div>
          
          <div className="user">
            {/* Notification Button & Popover */}
            <div className="topbar-action-item">
              <div 
                className="mini-btn" 
                onClick={() => { setShowNotifications(prev => !prev); setShowUserMenu(false); }}
                title="Thông báo hệ thống"
              >
                <Bell size={18} />
                <i className="dot" style={{ background: connectionStatus === 'connected' ? '#30e797' : '#ff4f6d' }}></i>
              </div>

              {showNotifications && (
                <>
                  <div className="dropdown-click-outside-backdrop" onClick={() => setShowNotifications(false)} />
                  <div className="topbar-popover">
                    <div className="topbar-popover-header">
                      <span className="topbar-popover-title">🔔 Trạng thái hệ thống</span>
                      <button type="button" className="topbar-popover-close" onClick={() => setShowNotifications(false)}>✕</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--muted)' }}>Google Cloud Sync:</span>
                        <span className="pulse-indicator">
                          <span className={`pulse-dot ${connectionStatus === 'connected' ? '' : connectionStatus === 'failed' ? 'danger' : 'warning'}`} />
                          <span style={{ color: connectionStatus === 'connected' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                            {connectionStatus === 'connected' ? 'Đã kết nối' : connectionStatus === 'failed' ? 'Lỗi kết nối' : 'Chưa cấu hình'}
                          </span>
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--muted)' }}>Ngân hàng VietQR:</span>
                        <span style={{ color: banks.length > 0 ? 'var(--cyan)' : 'var(--muted)', fontWeight: 600 }}>
                          {banks.length} ngân hàng sẵn sàng
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--muted)' }}>Mã QR hôm nay:</span>
                        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{qrCreatedToday} giao dịch</span>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className="primary" 
                      style={{ height: '34px', fontSize: '12px', marginTop: '4px' }}
                      onClick={() => { setCurrentView('settings'); setShowNotifications(false); }}
                    >
                      Kiểm tra cài đặt hệ thống →
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Extension Companion Mode Toggle */}
            <div 
              className="mini-btn" 
              onClick={() => {
                setIsExtensionMode(prev => {
                  const next = !prev;
                  showToast(next ? 'Đã bật Chế độ Extension / Side Panel nhỏ gọn' : 'Đã trở về Giao diện Webapp Studio đầy đủ', 'info');
                  return next;
                });
              }}
              title={isExtensionMode ? "Thoát chế độ Extension nhỏ gọn" : "Chế độ Extension / Side Panel nhỏ gọn"}
              style={isExtensionMode ? { borderColor: 'var(--blue)', color: 'var(--blue)', background: 'var(--accent-primary-subtle)' } : undefined}
            >
              <PanelRight size={17} />
            </div>

            {/* Browser Extension Install Guide Button */}
            <div 
              className="mini-btn" 
              onClick={() => setShowExtensionGuideModal(true)}
              title="Cài đặt Tiện ích mở rộng (Chrome / Edge Extension)"
            >
              <Puzzle size={17} />
            </div>

            {/* Theme Switcher Button */}
            <div 
              className="mini-btn" 
              onClick={toggleTheme}
              title={theme === 'dark' ? "Chuyển sang giao diện Sáng (Daylight Alabaster)" : "Chuyển sang giao diện Tối (Warm Carbon Studio)"}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </div>

            {/* User Profile */}
            <div className="topbar-action-item">
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                onClick={() => { setShowUserMenu(prev => !prev); setShowNotifications(false); }}
              >
                <div className="avatar">K</div>
                <div className="user-text">
                  <b>Quản trị viên</b>
                  <small>Kings Grill F&B</small>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--muted)' }}>▼</span>
              </div>

              {showUserMenu && (
                <>
                  <div className="dropdown-click-outside-backdrop" onClick={() => setShowUserMenu(false)} />
                  <div className="topbar-popover" style={{ width: '240px' }}>
                    <div className="topbar-popover-header">
                      <span className="topbar-popover-title">👤 Tài khoản vận hành</span>
                      <button type="button" className="topbar-popover-close" onClick={() => setShowUserMenu(false)}>✕</button>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.4 }}>
                      <p style={{ margin: '0 0 4px', color: '#fff', fontWeight: 600 }}>Kings Grill Restaurant</p>
                      <p style={{ margin: 0 }}>Quyền: Toàn quyền Quản trị & Kế toán</p>
                    </div>
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button 
                        type="button" 
                        className="btn-outline" 
                        style={{ height: '34px', fontSize: '12px', justifyContent: 'flex-start' }}
                        onClick={() => { setCurrentView('settings'); setShowUserMenu(false); }}
                      >
                        ⚙️ Cấu hình hệ thống
                      </button>
                      <button 
                        type="button" 
                        className="btn-outline" 
                        style={{ height: '34px', fontSize: '12px', justifyContent: 'flex-start' }}
                        onClick={() => {
                          showToast('Dữ liệu được lưu trong trình duyệt & Google Sheet của bạn.', 'info');
                          setShowUserMenu(false);
                        }}
                      >
                        🛡 Kiểm tra an toàn
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>


        {/* VIEW 1: ATTENDANCE PROCESSOR */}
        {currentView === 'attendance' && (
          <div className="screen active">
            <PageHeader
              icon={<FileText size={26} />}
              title="Quản Lý Chấm Công & Thiết Bị"
              subtitle="Tự động hóa chuẩn hóa dữ liệu chấm công nhà hàng, phân ca đêm và kết nối thiết bị Hikvision Cloud"
              badgeText="Chấm Công Hub"
              badgeVariant="info"
            />
            <div className="hub-subtab-bar">
              <button 
                type="button" 
                className="hub-subtab-btn active"
                onClick={() => setCurrentView('attendance')}
              >
                <FileText size={15} />
                <span>Xử lý Chấm Công & Phân Ca</span>
              </button>
              <button 
                type="button" 
                className="hub-subtab-btn"
                onClick={() => setCurrentView('hikvision')}
              >
                <Cpu size={15} />
                <span>Máy Chấm Công Cloud (Hikvision)</span>
              </button>
            </div>
            <div className="head" style={{ marginBottom: '1.5rem' }}>
              <div className="kpis">
                <StatCard 
                  icon={<Users size={18} />} 
                  label="Nhân viên" 
                  value={empCount.toLocaleString('vi-VN')} 
                  subtext="Tổng số nhân viên thực tế"
                  hasData={hasAttendanceData} 
                />
                <StatCard 
                  icon={<Calendar size={18} />} 
                  label="Ngày công" 
                  value={daysCount.toLocaleString('vi-VN')} 
                  subtext="Tổng số dòng công ghi nhận"
                  hasData={hasAttendanceData} 
                />
                <StatCard 
                  icon={<CheckCircle size={18} />} 
                  label="Đã xử lý" 
                  value={processedCount.toLocaleString('vi-VN')} 
                  subtext={`${completionRate}% ca hoàn thành`}
                  hasData={hasAttendanceData} 
                />
                <StatCard 
                  icon={<Moon size={18} />} 
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
                  <div className="file-icon">
                    <UploadCloud size={22} />
                  </div>
                  <h2 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>Xử lý chấm công nhân viên</h2>
                  <p style={{ margin: '0.25rem 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                    Chọn tải tệp thô từ máy tính hoặc đồng bộ dữ liệu trực tuyến từ Google Sheets
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', width: '100%', maxWidth: '640px', margin: '1rem auto 1.25rem', zIndex: 10 }}>
                    {/* Option 1: Local file upload */}
                    <label 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '20px 18px', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border-strong)', 
                        background: 'var(--bg-panel)', 
                        cursor: 'pointer',
                        transition: 'all 0.16s ease',
                        textAlign: 'center',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                      className="upload-source-card"
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-primary-subtle)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} />
                      </div>
                      <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>Tải file từ máy tính</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nhận file thô Excel (.xlsx, .xls) hoặc CSV</span>
                      <span className="btn-outline" style={{ marginTop: '6px', fontSize: '12px', height: '32px', padding: '0 14px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', pointerEvents: 'none' }}>
                        Chọn tệp máy tính...
                      </span>
                      <input 
                        type="file" 
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        onChange={(e) => e.target.files && handleFileSelection(e.target.files[0])}
                      />
                    </label>

                    {/* Option 2: Cloud Sync */}
                    <div 
                      onClick={!isProcessing ? handleFetchAndProcessFromSheet : undefined}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '20px 18px', 
                        borderRadius: '12px', 
                        border: '1px solid rgba(59, 130, 246, 0.3)', 
                        background: 'linear-gradient(180deg, var(--accent-primary-subtle) 0%, var(--bg-panel) 100%)', 
                        cursor: isProcessing ? 'wait' : 'pointer',
                        transition: 'all 0.16s ease',
                        textAlign: 'center',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                      className="upload-source-card"
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={20} />
                      </div>
                      <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>Đồng bộ từ Google Sheet</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Lấy trực tiếp dữ liệu chấm công đám mây</span>
                      <button 
                        type="button" 
                        className="primary" 
                        disabled={isProcessing}
                        style={{ marginTop: '6px', fontSize: '12px', height: '32px', padding: '0 14px', pointerEvents: 'none' }}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="loader" size={13} />
                            Đang tải...
                          </>
                        ) : (
                          'Nạp tự động Cloud'
                        )}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'center', flexWrap: 'wrap', zIndex: 10 }}>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--blue)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      📥 Tải file excel mẫu (.xlsx)
                    </button>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>•</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>🛡 Bảo mật cục bộ 100%</span>
                  </div>
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
                      <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Xử lý hoàn tất ({processedRecords.length} dòng công)!</span>
                    </div>
                    
                    <div className="actions-row" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
                      {/* Primary Action */}
                      <button 
                        className="primary" 
                        style={{ height: '46px', padding: '0 1.75rem', background: 'linear-gradient(135deg, var(--green), #059669)', boxShadow: '0 0 20px rgba(48,231,151,.25)', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }} 
                        onClick={handleDownload}
                      >
                        <Download size={18} />
                        <span>Tải File Kết Quả (.xlsx)</span>
                      </button>

                      {/* 1-Click Pipeline: Attendance -> Payroll */}
                      <button 
                        className="btn-outline" 
                        style={{ height: '46px', padding: '0 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', borderColor: 'rgba(245, 158, 11, 0.45)', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--orange)', fontWeight: 700 }}
                        onClick={handlePipeAttendanceToPayroll}
                        title="Đẩy thẳng số ngày công & tổng giờ làm của từng nhân viên sang Module Tính Lương"
                      >
                        <Sparkles size={16} />
                        <span>⚡ Chuyển sang Tính Lương</span>
                      </button>

                      {/* Secondary Action */}
                      <button 
                        className="btn-outline" 
                        style={{ height: '46px', padding: '0 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', borderColor: 'rgba(34, 211, 238, 0.4)', background: 'rgba(34, 211, 238, 0.05)' }}
                        onClick={handleSyncAttendance}
                        disabled={isSyncingAttendance || attendanceSyncSuccess}
                      >
                        {isSyncingAttendance ? (
                          <>
                            <Loader2 className="loader" size={16} />
                            <span>Đang lưu Cloud...</span>
                          </>
                        ) : attendanceSyncSuccess ? (
                          <>
                            <CheckCircle size={16} color="var(--green)" />
                            <span style={{ color: 'var(--green)' }}>Đã Lưu Google Sheet</span>
                          </>
                        ) : (
                          <>
                            <Send size={16} style={{ color: 'var(--cyan)' }} />
                            <span>Lưu Cloud (Google Sheet)</span>
                          </>
                        )}
                      </button>

                      {/* Ghost / Tertiary Action */}
                      <button 
                        className="btn-ghost" 
                        onClick={resetState}
                        style={{ height: '46px', padding: '0 1.25rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                      >
                        <span>🔄 Xử lý file khác</span>
                      </button>
                    </div>

                    {/* INTERACTIVE DATAGRID PREVIEW TABLE */}
                    <div className="datagrid-card" style={{ width: '100%', marginTop: '0.5rem' }}>
                      <div className="datagrid-toolbar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={16} color="var(--cyan)" />
                            Xem trước kết quả đã xử lý
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
                            {filteredAttendanceRecords.length} / {processedRecords.length} dòng
                          </span>
                        </div>

                        {/* Search & Filter pills */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ position: 'relative', width: '220px' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                            <input 
                              type="text" 
                              placeholder="Tìm theo tên nhân viên..."
                              value={attendanceSearch}
                              onChange={(e) => setAttendanceSearch(e.target.value)}
                              style={{ width: '100%', height: '32px', fontSize: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', padding: '0 28px 0 30px' }}
                            />
                            {attendanceSearch && (
                              <button 
                                type="button" 
                                onClick={() => setAttendanceSearch('')}
                                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                              type="button" 
                              className={`filter-tag ${attendanceFilter === 'all' ? 'active' : ''}`}
                              onClick={() => setAttendanceFilter('all')}
                              style={{ padding: '4px 10px', fontSize: '11.5px' }}
                            >
                              Tất cả
                            </button>
                            <button 
                              type="button" 
                              className={`filter-tag ${attendanceFilter === 'night' ? 'active' : ''}`}
                              onClick={() => setAttendanceFilter('night')}
                              style={{ padding: '4px 10px', fontSize: '11.5px' }}
                            >
                              🌙 Ca đêm ({nightCount})
                            </button>
                            <button 
                              type="button" 
                              className={`filter-tag ${attendanceFilter === 'complete' ? 'active' : ''}`}
                              onClick={() => setAttendanceFilter('complete')}
                              style={{ padding: '4px 10px', fontSize: '11.5px' }}
                            >
                              ✅ Đủ giờ ({processedCount})
                            </button>
                            <button 
                              type="button" 
                              className={`filter-tag ${attendanceFilter === 'incomplete' ? 'active' : ''}`}
                              onClick={() => setAttendanceFilter('incomplete')}
                              style={{ padding: '4px 10px', fontSize: '11.5px' }}
                            >
                              ⚠️ Thiếu giờ ({daysCount - processedCount})
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="datagrid-table-wrapper" style={{ maxHeight: '380px' }}>
                        {filteredAttendanceRecords.length === 0 ? (
                          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                            Không tìm thấy dòng công nào khớp với bộ lọc tìm kiếm.
                          </div>
                        ) : (
                          <table className="datagrid-table">
                            <thead>
                              <tr>
                                <th style={{ width: '45px', textAlign: 'center' }}>STT</th>
                                <th>Họ tên nhân viên</th>
                                <th style={{ width: '110px' }}>Ngày công</th>
                                <th style={{ width: '100px' }}>Giờ vào</th>
                                <th style={{ width: '100px' }}>Giờ ra</th>
                                <th style={{ width: '110px' }}>Phân ca</th>
                                <th style={{ width: '110px' }}>Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredAttendanceRecords.map((r, idx) => {
                                const isNight = r.overtime;
                                const isComplete = r.checkIn && r.checkOut;
                                return (
                                  <tr key={`${r.employeeName}-${r.logicalDate}-${idx}`}>
                                    <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>{idx + 1}</td>
                                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{r.employeeName}</td>
                                    <td style={{ color: 'var(--muted)', fontSize: '12px' }}>{formatDateStr(r.logicalDate)}</td>
                                    <td>
                                      {r.checkIn ? (
                                        <span style={{ color: 'var(--green)', background: 'rgba(48,231,151,0.08)', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '12px' }}>
                                          {formatTimeStr(r.checkIn)}
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--red)', opacity: 0.7 }}>—</span>
                                      )}
                                    </td>
                                    <td>
                                      {r.checkOut ? (
                                        <span style={{ color: 'var(--cyan)', background: 'rgba(34,211,238,0.08)', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '12px' }}>
                                          {formatTimeStr(r.checkOut)}
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--red)', opacity: 0.7 }}>—</span>
                                      )}
                                    </td>
                                    <td>
                                      {isNight ? (
                                        <Badge variant="purple">🌙 Ca đêm</Badge>
                                      ) : (
                                        <Badge variant="info">Ca ngày</Badge>
                                      )}
                                    </td>
                                    <td>
                                      {isComplete ? (
                                        <Badge variant="success">✅ Đủ giờ</Badge>
                                      ) : (
                                        <Badge variant="warning">⚠️ Thiếu giờ</Badge>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="feature-grid">
              <div className="card feature">
                <div className="ficon" style={{ color: 'var(--purple)' }}><Moon size={18} /></div>
                <div>
                  <h3>Xử Lý Ca Đêm</h3>
                  <p>Tự động gán giờ trước 6h sáng về ca ngày hôm trước</p>
                </div>
                <div className="arrow">→</div>
              </div>
              <div className="card feature">
                <div className="ficon" style={{ color: 'var(--accent-primary)' }}><Calendar size={18} /></div>
                <div>
                  <h3>Nội Suy Lịch</h3>
                  <p>Khớp dữ liệu chấm công với dải ngày hành chính và phân ca</p>
                </div>
                <div className="arrow">→</div>
              </div>
              <div className="card feature">
                <div className="ficon" style={{ color: 'var(--cyan)' }}><Sparkles size={18} /></div>
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
            <PageHeader
              icon={<QrCode size={26} />}
              title="VietQR & Quản Lý Thanh Toán"
              subtitle="Tạo mã QR thanh toán động VietQR Napas247 & Công cụ chia tiền bàn tự động cho Kings Grill"
              badgeText="Napas 247"
              badgeVariant="success"
            />
            <div className="hub-subtab-bar" style={{ marginBottom: '1.5rem' }}>
              <button 
                type="button" 
                className={`hub-subtab-btn ${vietQrViewMode === 'single' ? 'active' : ''}`}
                onClick={() => setVietQrViewMode('single')}
              >
                ⚡ Tạo QR Thanh Toán Đơn
              </button>
              <button 
                type="button" 
                className={`hub-subtab-btn ${vietQrViewMode === 'split' ? 'active' : ''}`}
                onClick={() => setVietQrViewMode('split')}
              >
                ✂ Tách & Chia Tiền Bàn (Split Bill)
              </button>
            </div>
            <div className="head" style={{ marginBottom: '1.5rem' }}>
              <div className="kpis">
                <StatCard 
                  icon={<Users size={18} />} 
                  label="Tài khoản đã lưu" 
                  value={savedAccounts.length} 
                  subtext="Tài khoản đã được cấu hình"
                  hasData={savedAccounts.length > 0} 
                />
                <StatCard 
                  icon={<QrCode size={18} />} 
                  label="QR đã tạo hôm nay" 
                  value={qrCreatedToday} 
                  subtext="Mã QR tạo trong ngày"
                  hasData={totalTransactions > 0} 
                />
                <StatCard 
                  icon={<Activity size={18} />} 
                  label="Tổng giao dịch" 
                  value={totalTransactions} 
                  subtext="Số lần xuất/tạo mã QR"
                  hasData={totalTransactions > 0} 
                />
                <StatCard 
                  icon={<Wallet size={18} />} 
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>👥 Tài khoản của bạn</h2>
                    <p className="sub" style={{ margin: '4px 0 0' }}>Quản lý và sử dụng tài khoản để tạo mã QR thanh toán nhanh.</p>
                  </div>
                  <button 
                    className="primary" 
                    style={{ height: '40px', padding: '0 16px', flexShrink: 0 }}
                    onClick={() => setShowAddAccountForm(!showAddAccountForm)}
                  >
                    <Plus size={16} />
                    Thêm tài khoản
                  </button>
                </div>

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
                              style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-input)', color: 'var(--text)', padding: '0 14px' }}
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <b>{acc.bankCode}</b>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(acc.accountNo);
                                setCopiedBankId(acc.id);
                                setTimeout(() => setCopiedBankId(null), 1500);
                                showToast(`Đã sao chép STK: ${acc.accountNo}`, 'success');
                              }}
                              title="Sao chép số tài khoản"
                              style={{ background: 'transparent', border: 'none', color: copiedBankId === acc.id ? 'var(--green)' : 'var(--cyan)', cursor: 'pointer', padding: '2px', display: 'inline-flex' }}
                            >
                              {copiedBankId === acc.id ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                            <button 
                              className="delete-account-btn"
                              onClick={(e) => handleDeleteAccount(acc.id, e)}
                              title="Xóa tài khoản"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <p>•••• {acc.accountNo.slice(-4) || acc.accountNo}</p>
                        <small>{acc.accountHolder}</small>
                        {idx === 0 && <span className="pill">Mặc định</span>}
                      </div>
                    );
                  })}
                  {savedAccounts.length === 0 && !showAddAccountForm && (
                    <EmptyState 
                      icon="👤"
                      title="Chưa lưu tài khoản cá nhân"
                      description="Lưu thông tin ngân hàng thụ hưởng hay dùng để tạo mã QR thanh toán nhanh chỉ với 1 click."
                      actionLabel="💡 Thêm tài khoản mẫu Kings Grill"
                      onAction={addSampleKingsGrillAccount}
                      style={{ gridColumn: 'span 2', padding: '2rem 1rem' }}
                    />
                  )}
                </div>

                <h2 style={{ marginTop: '1.5rem' }}>▣ Thông tin tài khoản nhận</h2>
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
                            style={{ width: '100%', height: '48px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-input)', color: 'var(--text)', padding: '0 14px' }}
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

                  {vietQrViewMode === 'single' ? (
                    <>
                      <div className="field">
                        <label>Số tiền chuyển khoản (VND)</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: 100.000 (hoặc gõ 150 rồi bấm .000)"
                          value={amount ? formatVND(amount) : ''}
                          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                        />
                        <div className="amount-chips-row">
                          {amount && amount.length > 0 && amount.length <= 6 && !amount.endsWith('000') && (
                            <button
                              type="button"
                              className="amount-chip"
                              style={{ borderColor: 'var(--green)', color: 'var(--green)', background: 'rgba(34, 197, 94, 0.12)' }}
                              onClick={() => setAmount(`${amount.replace(/\D/g, '')}000`)}
                              title="Nhân 1.000 VNĐ"
                            >
                              ⚡ {formatVND(`${amount}000`)}đ (.000)
                            </button>
                          )}
                          {[50000, 100000, 200000, 500000, 1000000, 2000000].map(val => (
                            <button 
                              key={val}
                              type="button" 
                              className="amount-chip"
                              onClick={() => {
                                const current = amount ? Number(amount.replace(/\D/g, '')) : 0;
                                setAmount(String(current + val));
                              }}
                              title="Cộng dồn thêm vào số tiền hiện tại"
                            >
                              +{val >= 1000000 ? `${val / 1000000}tr` : `${val / 1000}k`}
                            </button>
                          ))}
                          <button 
                            type="button" 
                            className="amount-chip chip-clear"
                            onClick={() => setAmount('')}
                          >
                            ✕ Xóa
                          </button>
                        </div>
                      </div>

                      <div className="field">
                        <label>Nội dung chuyển khoản</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: THANH TOAN HOA DON COM CHIEU"
                          value={memo}
                          onChange={(e) => setMemo(e.target.value)}
                        />
                        <div className="amount-chips-row">
                          {['THANH TOAN BAN 01', 'THANH TOAN BAN 05', 'DAT COC TIEC KINGS GRILL', 'CK TIEN COM'].map(presetMemo => (
                            <button
                              key={presetMemo}
                              type="button"
                              className="amount-chip"
                              onClick={() => setMemo(presetMemo)}
                            >
                              {presetMemo}
                            </button>
                          ))}
                        </div>
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
                    </>
                  ) : (
                    <>
                      <div className="field">
                        <label>Tổng số tiền cần chia (VND)</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: 1.200.000"
                          value={splitTotalAmount ? formatVND(splitTotalAmount) : ''}
                          onChange={(e) => setSplitTotalAmount(e.target.value.replace(/\D/g, ''))}
                        />
                        <div className="amount-chips-row">
                          {[200000, 500000, 1000000, 2000000, 5000000].map(val => (
                            <button 
                              key={val}
                              type="button" 
                              className="amount-chip"
                              onClick={() => setSplitTotalAmount(String(val))}
                            >
                              {val >= 1000000 ? `${val / 1000000}tr` : `${val / 1000}k`}
                            </button>
                          ))}
                          <button 
                            type="button" 
                            className="amount-chip chip-clear"
                            onClick={() => setSplitTotalAmount('')}
                          >
                            ✕ Xóa
                          </button>
                        </div>
                      </div>

                      <div className="field">
                        <label>Số người chia</label>
                        <input 
                          type="number" 
                          min="1" 
                          max="20"
                          value={splitPeopleCount}
                          onChange={(e) => setSplitPeopleCount(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </div>

                      {splitDisparity !== 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: 'rgba(247, 160, 50, 0.12)', border: '1px solid rgba(247, 160, 50, 0.35)', margin: '4px 0 10px', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--orange)', fontWeight: 600 }}>
                            ⚠️ Tổng chia ({formatVND(String(splitCurrentSum))} đ) lệch hóa đơn ({formatVND(String(splitTotalNum))} đ): {splitDisparity > 0 ? `Thiếu ${formatVND(String(splitDisparity))} đ` : `Dư ${formatVND(String(Math.abs(splitDisparity)))} đ`}
                          </span>
                          <button 
                            type="button" 
                            className="amount-chip"
                            onClick={handleAutoBalanceSplit}
                            style={{ borderColor: 'var(--orange)', color: '#ffffff', background: 'rgba(247, 160, 50, 0.35)' }}
                          >
                            ⚡ Bù vào khách cuối
                          </button>
                        </div>
                      )}

                      <div className="field">
                        <label>Mã bàn / Vị trí</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: Bàn 05"
                          value={receiptTableNo}
                          onChange={(e) => setReceiptTableNo(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Phương thức chia</label>
                        <select 
                          className="form-control"
                          value={splitMethod}
                          onChange={(e) => setSplitMethod(e.target.value as any)}
                          style={{ height: '48px', borderRadius: '12px', background: 'var(--surface-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0 12px' }}
                        >
                          <option value="equal">Chia đều</option>
                          <option value="custom">Tự điền (Custom)</option>
                        </select>
                      </div>

                      <div className="field full" style={{ marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--cyan)' }}>
                            📋 Danh sách phần chia ({splitGuests.length} khách) - Chọn để xem QR:
                          </span>
                          <button 
                            type="button" 
                            className="btn-outline" 
                            onClick={handleAddSplitGuest}
                            style={{ padding: '3px 10px', fontSize: '11px', borderRadius: '6px' }}
                          >
                            + Thêm khách
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                          {splitGuests.map((guest, idx) => {
                            const isSelected = selectedSplitGuestIndex === idx;
                            return (
                              <div 
                                key={guest.id} 
                                onClick={() => setSelectedSplitGuestIndex(idx)}
                                style={{ 
                                  display: 'flex', 
                                  gap: '8px', 
                                  alignItems: 'center', 
                                  padding: '10px 12px', 
                                  borderRadius: '10px', 
                                  background: isSelected ? 'rgba(34, 211, 238, 0.08)' : 'rgba(255,255,255,0.01)', 
                                  border: `1px solid ${isSelected ? 'var(--cyan)' : 'rgba(255,255,255,0.05)'}`,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: isSelected ? 'var(--cyan)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? '#000' : '#fff', fontSize: '11px', fontWeight: 'bold' }}>
                                  {idx + 1}
                                </div>
                                <input 
                                  type="text"
                                  value={guest.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSplitGuests(prev => prev.map((g, i) => i === idx ? { ...g, name: val } : g));
                                  }}
                                  style={{ flexGrow: 1, minWidth: 0, background: 'transparent', border: 0, padding: 0, color: 'white', fontSize: '13px', fontWeight: 600 }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <input 
                                  type="text"
                                  value={guest.amount ? formatVND(String(guest.amount)) : ''}
                                  disabled={splitMethod === 'equal'}
                                  onChange={(e) => {
                                    const val = Number(e.target.value.replace(/\D/g, '')) || 0;
                                    setSplitGuests(prev => prev.map((g, i) => i === idx ? { ...g, amount: val } : g));
                                  }}
                                  style={{ width: '110px', textAlign: 'right', background: 'transparent', border: 0, padding: 0, color: isSelected ? 'var(--green)' : 'white', fontSize: '13px', fontWeight: 700 }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>đ</span>
                                {splitGuests.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveSplitGuest(idx);
                                    }}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px 4px', fontSize: '11px' }}
                                    title="Xóa phần này"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                </div>
              </div>

              {/* RIGHT COLUMN: Live QR Code Preview and actions */}
              <div className="card panel qrbox" style={{ overflow: 'visible' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
                  <h2 style={{ margin: 0 }}>▦ Mã QR thanh toán</h2>
                  {qrUrl && (
                    <div style={{ display: 'flex', gap: '2px', background: 'rgba(15, 23, 42, 0.4)', padding: '3px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                      <button 
                        type="button" 
                        onClick={() => setReceiptShowBranded(false)}
                        style={{ border: 0, background: !receiptShowBranded ? 'var(--blue)' : 'transparent', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        Mẫu QR thường
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setReceiptShowBranded(true)}
                        style={{ border: 0, background: receiptShowBranded ? 'var(--blue)' : 'transparent', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        Biên lai Kings Grill
                      </button>
                    </div>
                  )}
                </div>
                <p className="sub" style={{ marginBottom: '1.5rem' }}>Quét mã QR bằng App Ngân hàng hoặc Ví điện tử để chuyển khoản nhanh.</p>

                {qrUrl ? (
                  !receiptShowBranded ? (
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
                        <div className="qr-detail-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: 'var(--muted)' }}>Số tiền:</span><span style={{ fontWeight: 700, color: 'var(--green)' }}>{formatVND(String(activeAmount))} đ</span></div>
                        <div className="qr-detail-row" style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted)' }}>Nội dung:</span><span style={{ fontWeight: 600, color: 'white' }}>{activeMemo}</span></div>
                      </div>

                      <div className="form-grid" style={{ width: '100%' }}>
                        <button className="primary" style={{ height: '48px' }} onClick={handleDownloadQR}>Tải ảnh QR</button>
                        <button className="btn-outline" style={{ height: '48px' }} onClick={handleCopyQRLink}>Sao chép link</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
                      {/* Branded Receipt Element */}
                      <div 
                        id="branded-receipt-card"
                        style={{ 
                          width: '100%', 
                          maxWidth: '360px', 
                          background: getThemeGradient(), 
                          color: 'white', 
                          padding: '24px', 
                          borderRadius: '20px', 
                          border: `1px solid ${getThemeBorder()}`, 
                          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                          position: 'relative',
                          boxSizing: 'border-box'
                        }}
                      >
                        <div className="receipt-header" style={{ textAlign: 'center', marginBottom: '16px' }}>
                          {receiptShowLogo && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--cyan), var(--blue))', marginBottom: '8px', boxShadow: '0 4px 12px rgba(6,182,212,0.4)' }}>
                              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#000' }}>K</span>
                            </div>
                          )}
                          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.5px', textTransform: 'uppercase' }}>KINGS GRILL</h1>
                          <p style={{ fontSize: '10px', opacity: 0.7, margin: '2px 0 0 0', textTransform: 'uppercase', fontWeight: 600 }}>Biên lai thanh toán điện tử</p>
                        </div>

                        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '12px 0' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ opacity: 0.6 }}>Địa điểm:</span>
                            <span style={{ fontWeight: 600 }}>{receiptTableNo || 'Bàn 05'}</span>
                          </div>
                          {receiptShowDate && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ opacity: 0.6 }}>Thời gian:</span>
                              <span style={{ fontWeight: 600 }}>{new Date().toLocaleString('vi-VN')}</span>
                            </div>
                          )}
                          {receiptShowCashier && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ opacity: 0.6 }}>Thu ngân:</span>
                              <span style={{ fontWeight: 600 }}>Kế toán viên</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ opacity: 0.6 }}>Thụ hưởng:</span>
                            <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{accountHolder}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ opacity: 0.6 }}>Tài khoản:</span>
                            <span style={{ fontWeight: 600 }}>{selectedBank?.shortName} ({accountNo})</span>
                          </div>
                          
                          {vietQrViewMode === 'split' && splitGuests[selectedSplitGuestIndex] && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cyan)' }}>
                              <span style={{ fontWeight: 600 }}>Phần thanh toán:</span>
                              <span style={{ fontWeight: 700 }}>{activeGuestName}</span>
                            </div>
                          )}
                        </div>

                        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '12px 0' }} />

                        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '12px', textAlign: 'center', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ fontSize: '11px', opacity: 0.6, display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>Số tiền thanh toán</span>
                          <strong style={{ fontSize: '20px', color: 'var(--green)', fontWeight: 800 }}>
                            {formatVND(String(activeAmount))} đ
                          </strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                          <div style={{ width: '180px', height: '180px', borderRadius: '12px', background: 'white', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                            <img 
                              src={qrUrl} 
                              alt="VietQR Code" 
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ opacity: 0.6, fontSize: '10px' }}>NỘI DUNG CHUYỂN KHOẢN MÃ HÓA</span>
                          <strong style={{ fontFamily: 'monospace', fontSize: '11px', color: '#fff', wordBreak: 'break-all' }}>{activeMemo}</strong>
                        </div>

                        {receiptThankYou && (
                          <>
                            <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '12px 0' }} />
                            <div style={{ textAlign: 'center', fontSize: '11px', opacity: 0.8, fontStyle: 'italic' }}>
                              {receiptThankYou}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Customizer controls */}
                      <div style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px', boxSizing: 'border-box' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cyan)', display: 'block', marginBottom: '12px' }}>
                          🎨 Tùy chỉnh phong cách biên lai:
                        </span>
                        
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Tông màu nền:</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {[
                              { key: 'blue', color: '#3b82f6' },
                              { key: 'green', color: '#10b981' },
                              { key: 'black', color: '#4b5563' },
                              { key: 'gold', color: '#d97706' }
                            ].map((t) => (
                              <button 
                                key={t.key}
                                type="button"
                                onClick={() => setReceiptTheme(t.key as any)}
                                style={{ 
                                  width: '20px', 
                                  height: '20px', 
                                  borderRadius: '50%', 
                                  border: receiptTheme === t.key ? '2px solid white' : '1px solid transparent',
                                  background: t.color,
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>Lời chúc cuối biên lai</label>
                            <input 
                              type="text" 
                              value={receiptThankYou} 
                              onChange={(e) => setReceiptThankYou(e.target.value)} 
                              style={{ width: '100%', height: '36px', fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', padding: '0 8px', color: '#fff', boxSizing: 'border-box' }}
                            />
                          </div>
                          
                          <div style={{ display: 'flex', gap: '16px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={receiptShowLogo} onChange={(e) => setReceiptShowLogo(e.target.checked)} />
                              Hiện Logo
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={receiptShowDate} onChange={(e) => setReceiptShowDate(e.target.checked)} />
                              Hiện Giờ
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={receiptShowCashier} onChange={(e) => setReceiptShowCashier(e.target.checked)} />
                              Hiện Thu ngân
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Download & print actions */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                        <button className="primary" style={{ height: '44px', fontSize: '12px' }} onClick={handleDownloadReceipt}>
                          <Download size={14} style={{ marginRight: '6px' }} />
                          Tải Biên lai
                        </button>
                        <button className="btn-outline" style={{ height: '44px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }} onClick={handlePrintReceipt}>
                          🖨️ In Biên lai
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <EmptyState 
                    icon="▦"
                    title="Chưa có mã QR"
                    description="Nhập đầy đủ thông tin ngân hàng, số tài khoản và họ tên chủ tài khoản ở bảng bên để hệ thống tạo mã QR thanh toán động."
                    style={{ minHeight: '320px', border: 'none', background: 'transparent' }}
                  />
                )}

                {/* Recent VietQR Transactions History for 1-click Cashier Reuse */}
                {qrHistory.length > 0 && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        🕒 Giao dịch QR gần đây ({qrHistory.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQrHistory([]);
                          localStorage.removeItem('kg_tool_qr_history');
                          showToast('Đã xóa lịch sử giao dịch QR gần đây', 'info');
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '11px', cursor: 'pointer', padding: '2px 6px' }}
                      >
                        Xóa lịch sử
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {qrHistory.slice(-5).reverse().map((tx, idx) => (
                        <div
                          key={tx.id || idx}
                          onClick={() => {
                            if (tx.amount) setAmount(String(tx.amount));
                            if (tx.memo) setMemo(tx.memo);
                            if (tx.accountNo) setAccountNo(tx.accountNo);
                            if (tx.bankCode) {
                              const found = banks.find(b => b.code === tx.bankCode);
                              if (found) setSelectedBank(found);
                            }
                            setVietQrViewMode('single');
                            showToast(`Đã nạp lại mẫu QR: ${formatVND(String(tx.amount || 0))}đ`, 'info');
                          }}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: 'var(--surface-subtle)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            transition: 'all 0.15s ease'
                          }}
                          title="Nhấn để nạp lại số tiền và nội dung này"
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <strong style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {tx.bankCode || 'QR'} • {tx.memo || 'Không có nội dung'}
                            </strong>
                            <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                              STK: {tx.accountNo} • {tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <span style={{ fontWeight: 700, color: 'var(--green)', whiteSpace: 'nowrap', marginLeft: '8px', fontFamily: 'var(--font-mono)' }}>
                            {formatVND(String(tx.amount || 0))} đ
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: EMPLOYEE PAYROLL CREATOR */}
        {currentView === 'payroll' && (
          <div className="screen active">
            <div className="hub-subtab-bar" style={{ marginBottom: '1.25rem' }}>
              <button 
                type="button" 
                className="hub-subtab-btn active"
                onClick={() => setCurrentView('payroll')}
              >
                <CreditCard size={15} />
                <span>Bảng Lương & Phiếu Lương</span>
              </button>
              <button 
                type="button" 
                className="hub-subtab-btn"
                onClick={() => setCurrentView('transfer')}
              >
                <Send size={15} />
                <span>Chuyển Tiền Ngân Hàng Hàng Loạt</span>
              </button>
            </div>
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
            <div className="hub-subtab-bar" style={{ marginBottom: '1.25rem' }}>
              <button 
                type="button" 
                className="hub-subtab-btn"
                onClick={() => setCurrentView('payroll')}
              >
                <CreditCard size={15} />
                <span>Bảng Lương & Phiếu Lương</span>
              </button>
              <button 
                type="button" 
                className="hub-subtab-btn active"
                onClick={() => setCurrentView('transfer')}
              >
                <Send size={15} />
                <span>Chuyển Tiền Ngân Hàng Hàng Loạt</span>
              </button>
            </div>
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
            <PageHeader
              icon={<Settings size={26} />}
              title="Cấu Hình Hệ Thống & Kết Nối API"
              subtitle="Thiết lập kết nối an toàn tới Google Sheets, Google Apps Script API và quản lý tài khoản"
              badgeText="Hệ thống"
              badgeVariant="neutral"
              actions={
                <button 
                  className="primary" 
                  style={{ minWidth: '160px', height: '40px', fontSize: '13px' }}
                  disabled={!spreadsheetId || spreadsheetId.trim() === ''}
                  onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, '_blank')}
                >
                  ⓘ Xem Google Sheet
                </button>
              }
            />

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
                      className="btn-outline" 
                      style={{ width: '180px', height: '48px' }}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Trạng thái kết nối</h3>
                    <span className={`pulse-dot ${connectionStatus === 'connected' ? '' : connectionStatus === 'failed' ? 'danger' : 'warning'}`} />
                  </div>
                  {connectionStatus === 'connected' && <b style={{ color: 'var(--green)' }}>Đã kết nối Google Sheet</b>}
                  {connectionStatus === 'testing' && <b style={{ color: 'var(--cyan)' }}>Đang kiểm tra kết nối...</b>}
                  {connectionStatus === 'failed' && <b style={{ color: 'var(--red)' }}>Lỗi kết nối</b>}
                  {connectionStatus === 'not_configured' && <b style={{ color: 'var(--muted)' }}>Chưa cấu hình</b>}
                  <p className="sub">Trạng thái xác thực Google Apps Script Web App API.</p>
                </div>
                <div className="card status">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Sức khỏe đồng bộ</h3>
                    <span style={{ fontSize: '18px' }}>{connectionStatus === 'connected' ? '⚡' : '💤'}</span>
                  </div>
                  <b>{connectionStatus === 'connected' ? '100% Hoàn hảo' : '0% Chưa sẵn sàng'}</b>
                  <p className="sub">{connectionStatus === 'connected' ? 'Hệ thống lưu trữ Cloud hoạt động thông suốt' : 'Kiểm tra lại cấu hình kết nối'}</p>
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
            onNavigate={(v) => setCurrentView(v)}
          />
        )}

        {/* Global Command Palette */}
        <CommandPalette 
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigateTab={(tab) => setCurrentView(tab as any)}
          onTriggerAction={(action) => {
            if (action === 'open_payroll_config') {
              setCurrentView('payroll');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('kg_open_payroll_config'));
              }, 80);
            } else if (action === 'pipe_attendance_payroll') {
              handlePipeAttendanceToPayroll();
            } else if (action === 'pipe_payroll_transfer') {
              setCurrentView('transfer');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('kg-import-payroll-to-transfer'));
              }, 120);
            } else if (action === 'preset_k80') {
              setCurrentView('payroll');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('kg-preset-k80'));
              }, 100);
            } else if (action === 'print_payroll') {
              setCurrentView('payroll');
              showToast('Đang mở lệnh in phiếu lương...', 'info');
              setTimeout(() => window.print(), 300);
            } else if (action === 'normalize_names') {
              setCurrentView('transfer');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('kg-normalize-transfer-names'));
              }, 120);
            } else if (action === 'sync_cloud') {
              if (currentView === 'attendance') {
                handleFetchAndProcessFromSheet();
              } else {
                testConnection();
              }
            } else if (action === 'toggle_theme') {
              toggleTheme();
            } else if (action === 'toggle_extension_mode') {
              setIsExtensionMode(prev => {
                const next = !prev;
                showToast(next ? 'Đã bật Chế độ Extension / Side Panel nhỏ gọn' : 'Đã trở về Giao diện Webapp Studio đầy đủ', 'info');
                return next;
              });
            } else if (action === 'open_extension_guide') {
              setShowExtensionGuideModal(true);
            }
          }}
        />

        {/* Extension Compact Bottom Navigation Dock */}
        {isExtensionMode && (
          <nav className="extension-bottom-dock">
            <button
              type="button"
              className={`extension-dock-btn ${currentView === 'vietqr' ? 'active' : ''}`}
              onClick={() => setCurrentView('vietqr')}
            >
              <QrCode size={17} />
              <span>VietQR</span>
            </button>
            <button
              type="button"
              className={`extension-dock-btn ${currentView === 'tts' ? 'active' : ''}`}
              onClick={() => setCurrentView('tts')}
            >
              <Volume2 size={17} />
              <span>TTS AI</span>
            </button>
            <button
              type="button"
              className={`extension-dock-btn ${currentView === 'attendance' || currentView === 'hikvision' ? 'active' : ''}`}
              onClick={() => setCurrentView('attendance')}
            >
              <FileText size={17} />
              <span>Chấm Công</span>
            </button>
            <button
              type="button"
              className={`extension-dock-btn ${currentView === 'payroll' ? 'active' : ''}`}
              onClick={() => setCurrentView('payroll')}
            >
              <CreditCard size={17} />
              <span>Phiếu Lương</span>
            </button>
            <button
              type="button"
              className={`extension-dock-btn ${currentView === 'transfer' ? 'active' : ''}`}
              onClick={() => setCurrentView('transfer')}
            >
              <Send size={17} />
              <span>Lệnh CK</span>
            </button>
          </nav>
        )}

        {/* Extension & PWA Installation Guide Modal */}
        {showExtensionGuideModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setShowExtensionGuideModal(false)}
          >
            <div
              className="card panel"
              style={{
                width: '100%',
                maxWidth: '640px',
                maxHeight: '88vh',
                overflowY: 'auto',
                padding: '24px',
                border: '1px solid var(--border-strong)',
                boxShadow: 'var(--shadow-lg)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--accent-primary-subtle)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Puzzle size={20} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '17px' }}>Cài đặt Tiện ích mở rộng (Extension) & Webapp</h2>
                    <p className="sub" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                      Hỗ trợ song song cả Webapp độc lập (PWA) và Chrome / Edge Extension (Manifest V3)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px' }}
                  onClick={() => setShowExtensionGuideModal(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', lineHeight: 1.55 }}>
                <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--line)' }}>
                  <strong style={{ color: 'var(--green)', display: 'block', marginBottom: '6px' }}>
                    🧩 Cách 1: Cài đặt làm Chrome / Microsoft Edge Extension (Popup & Thanh bên Side Panel)
                  </strong>
                  <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <li>Chạy lệnh <code>npm run build</code> để xuất gói đóng gói tại thư mục <code>dist/</code> (đã bao gồm <code>manifest.json</code> và <code>background.js</code> chuẩn Manifest V3).</li>
                    <li>Mở trình duyệt Chrome (<code>chrome://extensions</code>) hoặc Edge (<code>edge://extensions</code>) và bật <b>Chế độ nhà phát triển (Developer mode)</b>.</li>
                    <li>Nhấn <b>Tải tiện ích đã giải nén (Load unpacked)</b> và chọn thư mục <code>dist</code> của dự án.</li>
                    <li>
                      <b>Tính năng đặc quyền của Extension:</b>
                      <ul style={{ marginTop: '4px', paddingLeft: '18px', color: 'var(--muted)' }}>
                        <li>Mở nhanh cửa sổ thu ngân <b>Popup (420×640)</b> hoặc gắn cố định ở <b>Thanh bên (Side Panel)</b> khi đang mở trang quản lý POS / Ngân hàng.</li>
                        <li><b>Menu chuột phải thông minh:</b> Bôi đen bất kỳ con số nào trên web → Chuột phải chọn <i>"⚡ Tạo mã VietQR với số tiền..."</i> hoặc bôi đen văn bản → <i>"🔊 Phát thanh AI (TTS)..."</i>.</li>
                      </ul>
                    </li>
                  </ol>
                </div>

                <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--line)' }}>
                  <strong style={{ color: 'var(--orange)', display: 'block', marginBottom: '6px' }}>
                    💻 Cách 2: Cài đặt làm Ứng dụng Máy tính / Điện thoại (Webapp PWA)
                  </strong>
                  <p style={{ margin: 0, color: 'var(--muted)' }}>
                    Trên thanh địa chỉ trình duyệt Chrome / Edge, nhấn biểu tượng <b>Cài đặt ứng dụng (Install KG Studio)</b> để ghim trực tiếp lên Màn hình chính hoặc Thanh tác vụ Windows/macOS và chạy độc lập như phần mềm gốc.
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', paddingTop: '6px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <a
                      href="/KG-Studio-Extension-v2.5.0.zip"
                      download="KG-Studio-Extension-v2.5.0.zip"
                      className="primary"
                      style={{ height: '38px', padding: '0 14px', fontSize: '12.5px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Download size={15} />
                      <span>Tải gói Extension (.zip)</span>
                    </a>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ height: '38px', fontSize: '12.5px' }}
                      onClick={() => {
                        setIsExtensionMode(prev => !prev);
                        setShowExtensionGuideModal(false);
                      }}
                    >
                      <PanelRight size={15} />
                      <span>{isExtensionMode ? 'Giao diện Webapp đầy đủ' : 'Dùng thử giao diện Extension'}</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ height: '38px', padding: '0 18px', fontSize: '12.5px' }}
                    onClick={() => setShowExtensionGuideModal(false)}
                  >
                    Đóng
                  </button>
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
