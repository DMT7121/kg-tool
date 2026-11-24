import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  FileSpreadsheet, 
  Upload, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Search,
  ChevronDown,
  Sparkles,
  ClipboardCheck,
  Edit2,
  Info,
  Landmark,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { VIB_BANKS } from '../constants/vibBanks';
import { VCB_BANKS } from '../constants/vcbBanks';
import { StatCard, EmptyState, PageHeader, Badge } from './Shared';
import {
  removeVietnameseAccents,
  normalizeVietnameseName,
  parseSmartCurrency,
  unwrapExcelCellValue
} from '../utils/numberUtils';

export interface TransferEmployee {
  id: string;
  stt?: number;
  name: string; 
  accountNo: string; 
  bankCodeName: string; 
  amount: number; 
  memo: string; 
  // VCB specific
  idNo?: string;
  issuedDate?: string;
  issuedPlace?: string;
  refNo?: string;
  address?: string;
  // Extra payroll fields
  payMonth?: string;
  dept?: string;
  role?: string;
  phone?: string;
  notes?: string;
  source: 'manual' | 'import' | 'payroll';
  isValid: boolean;
  errors: string[];
}

interface TransferFileToolProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface PayrollDraftEmployee {
  id?: string;
  name?: string;
  amount?: number;
  advance?: number;
  deduction?: number;
}

interface SavedBankAccountItem {
  accountHolder?: string;
  label?: string;
  accountNo?: string;
  bankName?: string;
  bankCode?: string;
}

export default function TransferFileTool({ showToast }: TransferFileToolProps) {
  const [bankTemplate, setBankTemplate] = useState<'vib' | 'vcb'>(() => {
    return (localStorage.getItem('kg_tool_transfer_active_bank') as 'vib' | 'vcb') || 'vib';
  });

  const [employees, setEmployees] = useState<TransferEmployee[]>(() => {
    const saved = localStorage.getItem('kg_tool_transfer_entries');
    return saved ? JSON.parse(saved) : [];
  });

  const [defaultMemoTemplate, setDefaultMemoTemplate] = useState(() => {
    return localStorage.getItem('kg_tool_transfer_memo_template') || "KINGS GRILL thanh toan luong {ten_nhan_vien} {thang_luong}";
  });

  const [vcbMemoTemplate, setVcbMemoTemplate] = useState(() => {
    return localStorage.getItem('kg_tool_transfer_vcb_memo_template') || "KG LUONG NV T{thang_luong}";
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('kg_tool_transfer_entries', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('kg_tool_transfer_active_bank', bankTemplate);
  }, [bankTemplate]);

  useEffect(() => {
    localStorage.setItem('kg_tool_transfer_memo_template', defaultMemoTemplate);
  }, [defaultMemoTemplate]);

  useEffect(() => {
    localStorage.setItem('kg_tool_transfer_vcb_memo_template', vcbMemoTemplate);
  }, [vcbMemoTemplate]);

  // Form edit states
  const [activeEmployeeEdit, setActiveEmployeeEdit] = useState<TransferEmployee | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Bank search selectors
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [showBankSelectorForId, setShowBankSelectorForId] = useState<string | null>(null);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  // Loading/Export States
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isMobileScreen, setIsMobileScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Click outside listener for bank dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target as Node)) {
        setShowBankSelectorForId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Strip Vietnamese tones for search filter queries
  const stripTones = useCallback((str: string): string => {
    return removeVietnameseAccents(str).toLowerCase();
  }, []);

  // Filter banks for selection
  const filteredBanks = useMemo(() => {
    const q = stripTones(bankSearchQuery.trim());
    const currentBankList = bankTemplate === 'vib' ? VIB_BANKS : VCB_BANKS;
    if (!q) return currentBankList;
    return currentBankList.filter(b => 
      stripTones(b.codeName).includes(q) || 
      stripTones(b.fullName).includes(q)
    );
  }, [bankSearchQuery, bankTemplate, stripTones]);

  // Map arbitrary bank name to VIB codeName
  const resolveVibBankName = useCallback((rawBank: string): string => {
    if (!rawBank) return '';
    const cleanRaw = rawBank.trim();
    const direct = VIB_BANKS.find(b => b.codeName.toLowerCase() === cleanRaw.toLowerCase() || b.fullName.toLowerCase() === cleanRaw.toLowerCase());
    if (direct) return direct.codeName;

    const queryClean = stripTones(cleanRaw);
    const numberCode = cleanRaw.match(/^\d+/);
    if (numberCode) {
      const codeMatch = VIB_BANKS.find(b => b.codeName.startsWith(numberCode[0]));
      if (codeMatch) return codeMatch.codeName;
    }

    const matches = VIB_BANKS.filter(b => {
      const targetClean = stripTones(b.codeName);
      const fullClean = stripTones(b.fullName);
      return targetClean.includes(queryClean) || queryClean.includes(targetClean) || fullClean.includes(queryClean);
    });

    if (matches.length > 0) return matches[0].codeName;

    // Common abbreviations
    if (queryClean.includes('vcb') || queryClean.includes('vietcombank')) return '203 - Vietcombank';
    if (queryClean.includes('agri') || queryClean.includes('agribank') || queryClean.includes('vba')) return '204 - Agribank';
    if (queryClean.includes('tcb') || queryClean.includes('techcombank')) return '310 - Techcombank';
    if (queryClean.includes('bidv')) return '202 - BIDV';
    if (queryClean.includes('vietin')) return '201 - Vietinbank';
    if (queryClean.includes('mb') || queryClean.includes('mbb') || queryClean.includes('quan doi')) return '311 - Quân đội';
    if (queryClean.includes('acb') || queryClean.includes('a chau')) return '307 - Á Châu';
    if (queryClean.includes('vib')) return '314 - NH Quốc tế VIB';
    if (queryClean.includes('tp') || queryClean.includes('tien phong')) return '358 - TPBank';
    if (queryClean.includes('vp') || queryClean.includes('vpb')) return '309 - VPBank';
    
    return cleanRaw;
  }, [stripTones]);

  // Map arbitrary bank name to Vietcombank format (e.g. "(ACB) Á Châu")
  const resolveVcbBankName = useCallback((rawBank: string): string => {
    if (!rawBank) return '';
    const cleanRaw = rawBank.trim();
    const direct = VCB_BANKS.find(b => b.codeName.toLowerCase() === cleanRaw.toLowerCase() || b.fullName.toLowerCase() === cleanRaw.toLowerCase());
    if (direct) return direct.codeName;

    const queryClean = stripTones(cleanRaw);
    
    const matches = VCB_BANKS.filter(b => {
      const targetClean = stripTones(b.codeName);
      const fullClean = stripTones(b.fullName);
      return targetClean.includes(queryClean) || queryClean.includes(targetClean) || fullClean.includes(queryClean);
    });

    if (matches.length > 0) return matches[0].codeName;

    if (queryClean.includes('vcb') || queryClean.includes('vietcombank')) return '(VCB) Vietcombank';
    if (queryClean.includes('acb') || queryClean.includes('a chau')) return '(ACB) Á Châu';
    if (queryClean.includes('mb') || queryClean.includes('mbb') || queryClean.includes('quan doi')) return '(MB) Quân Đội';
    if (queryClean.includes('vib')) return '(VIB) Ngân hàng Quốc tế';
    if (queryClean.includes('bidv')) return '(BIDV) Đầu tư & Phát triển';
    if (queryClean.includes('vietin')) return '(VIETINBANK) Công Thương';
    if (queryClean.includes('agri') || queryClean.includes('agribank') || queryClean.includes('vba')) return '(AGRIBANK) Nông nghiệp & PTNT';
    if (queryClean.includes('tcb') || queryClean.includes('techcombank')) return '(TECHCOMBANK) Kỹ Thương';
    if (queryClean.includes('vp') || queryClean.includes('vpb')) return '(VPBANK) Việt Nam Thịnh Vượng';
    if (queryClean.includes('tp') || queryClean.includes('tien phong')) return '(TPBANK) Tiên Phong';
    if (queryClean.includes('sacom') || queryClean.includes('stb')) return '(SACOMBANK) Sài Gòn Thương Tín';

    return cleanRaw;
  }, [stripTones]);

  // Validation function
  const validateRecord = useCallback((emp: Partial<TransferEmployee>, activeBank: 'vib' | 'vcb' = bankTemplate): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // 1. Name Check
    if (!emp.name || emp.name.trim() === '') {
      errors.push('Tên người nhận không được rỗng.');
    } else {
      const nameVal = emp.name.trim();
      if (activeBank === 'vcb') {
        const normalized = normalizeVietnameseName(nameVal);
        if (normalized.length === 0) {
          errors.push('Tên sau khi chuyển không dấu bị rỗng.');
        }
        // VCB strictly permits only uppercase letters without accent
        const vcbNameRegex = /^[A-Z0-9\s]*$/;
        if (!vcbNameRegex.test(normalized)) {
          errors.push('Tên thụ hưởng Vietcombank chỉ được chứa chữ cái IN HOA không dấu.');
        }
      } else {
        if (nameVal.length > 35) {
          errors.push('Tên không được vượt quá 35 ký tự.');
        }
        const allowedRegex = /^[a-zA-Z0-9aAàÀảẢãÃáÁạẠăĂằẰẳẲẵẴắẮặẶâÂầẦẩẨẫẪấẤậẬeEèÈẻẺẽẼéÉẹẸêÊềỀểỂễỄếẾệỆiIìÌỉỈĩĨíÍịỊoOòÒỏỎõÕóÓọỌôÔồỒổỔỗỖốỐộỘơƠờỜởỞỡỠớỚợỢuUùÙủỦũŨúÚụỤưƯừỪửỬữỮứỨựỰyYỳỲỷỶỹỸýÝỵYđĐ\s,.\-+():_&?]*$/;
        if (!allowedRegex.test(nameVal)) {
          errors.push('Tên chứa ký tự lạ. Chỉ cho phép chữ, số và ,.-+():_&?');
        }
      }
    }

    // 2. Account No Check
    if (!emp.accountNo || emp.accountNo.trim() === '') {
      errors.push('Số tài khoản nhận không được rỗng.');
    } else {
      const acc = emp.accountNo.trim().replace(/\s+/g, '');
      if (acc.length > 25) {
        errors.push('Số tài khoản không vượt quá 25 ký tự.');
      }
      const numAlpha = /^[a-zA-Z0-9]*$/;
      if (!numAlpha.test(acc)) {
        errors.push('Số tài khoản chỉ chứa chữ hoặc số.');
      }
    }

    // 3. Amount Check
    if (emp.amount === undefined || isNaN(emp.amount)) {
      errors.push('Số tiền chuyển không hợp lệ.');
    } else {
      if (emp.amount <= 0) {
        errors.push('Số tiền chuyển phải lớn hơn 0 đ.');
      }
      if (activeBank === 'vib') {
        if (emp.amount < 10000) {
          errors.push('VIB yêu cầu chuyển khoản tối thiểu 10.000 đ.');
        }
        if (emp.amount > 499999999) {
          errors.push('VIB giới hạn chuyển khoản tối đa 499.999.999 đ.');
        }
      }
    }

    // 4. Memo Check
    if (!emp.memo || emp.memo.trim() === '') {
      errors.push('Nội dung giao dịch không được rỗng.');
    } else {
      const memoText = emp.memo.trim();
      if (memoText.length > 120) {
        errors.push('Nội dung không vượt quá 120 ký tự.');
      }
      // VCB usually expects uppercase unaccented contents
      if (activeBank === 'vcb') {
        const vcbMemoRegex = /^[A-Z0-9\s,.\-+():_&?]*$/;
        if (!vcbMemoRegex.test(memoText.toUpperCase())) {
          errors.push('Nội dung chuyển khoản chứa ký tự lạ không được Vietcombank hỗ trợ.');
        }
      } else {
        const allowedRegex = /^[a-zA-Z0-9aAàÀảẢãÃáÁạẠăĂằẰẳẲẵẴắẮặẶâÂầẦẩẨẫẪấẤậẬeEèÈẻẺẽẼéÉẹẸêÊềỀểỂễỄếẾệỆiIìÌỉỈĩĨíÍịỊoOòÒỏỎõÕóÓọỌôÔồỒổỔỗỖốỐộỘơƠờỜởỞỡỠớỚợỢuUùÙủỦũŨúÚụỤưƯừỪửỬữỮứỨựỰyYỳỲỷỶỹỸýÝỵYđĐ\s,.\-+():_&?]*$/;
        if (!allowedRegex.test(memoText)) {
          errors.push('Nội dung chứa ký tự lạ. Chỉ cho phép chữ, số và ,.-+():_&?');
        }
      }
    }

    // 5. Bank Check
    if (!emp.bankCodeName || emp.bankCodeName.trim() === '') {
      errors.push('Ngân hàng nhận không được trống.');
    } else {
      const bankList = activeBank === 'vib' ? VIB_BANKS : VCB_BANKS;
      const matched = bankList.some(b => b.codeName === emp.bankCodeName);
      if (!matched) {
        errors.push(`Ngân hàng không khớp danh mục mẫu ${activeBank.toUpperCase()}.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [bankTemplate]);

  // Run validation on all records
  const revalidateAll = useCallback((list: TransferEmployee[], activeBank: 'vib' | 'vcb' = bankTemplate): TransferEmployee[] => {
    return list.map(item => {
      const res = validateRecord(item, activeBank);
      return {
        ...item,
        isValid: res.isValid,
        errors: res.errors
      };
    });
  }, [bankTemplate, validateRecord]);

  const handleSwitchBankTemplate = useCallback((nextBank: 'vib' | 'vcb') => {
    setBankTemplate(nextBank);
    setEmployees(prev => {
      if (prev.length === 0) return prev;
      const converted = prev.map(emp => ({
        ...emp,
        bankCodeName:
          nextBank === 'vcb'
            ? resolveVcbBankName(emp.bankCodeName)
            : resolveVibBankName(emp.bankCodeName)
      }));
      return revalidateAll(converted, nextBank);
    });
  }, [resolveVcbBankName, resolveVibBankName, revalidateAll]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = employees.length;
    const validCount = employees.filter(e => e.isValid).length;
    const invalidCount = total - validCount;
    const totalAmount = employees.reduce((sum, e) => sum + (e.amount || 0), 0);
    return { total, validCount, invalidCount, totalAmount };
  }, [employees]);

  // Helper to compile transaction memo with variables
  const compileMemo = useCallback((template: string, name: string, month: string, dept: string = ''): string => {
    let result = template
      .replace(/{ten_nhan_vien}/gi, removeVietnameseAccents(name).toUpperCase())
      .replace(/{thang_luong}/gi, month)
      .replace(/{bo_phan}/gi, removeVietnameseAccents(dept).toUpperCase());
    
    // Clean spaces
    result = result.trim().replace(/\s+/g, ' ');
    if (result.length > 120) {
      result = result.substring(0, 120);
    }
    return result;
  }, []);

  // 1. LOAD FROM PAYROLL (Accent-insensitive & preserves existing account numbers)
  const handleLoadFromPayroll = useCallback(() => {
    const rawPayroll = localStorage.getItem('kg_tool_payroll_state');
    if (!rawPayroll) {
      showToast('Không tìm thấy dữ liệu Phiếu Lương nháp nào trong hệ thống.', 'error');
      return;
    }

    try {
      const payrollData = JSON.parse(rawPayroll) as {
        employees?: PayrollDraftEmployee[];
        payMonth?: string;
        salaryMode?: 'monthly' | 'hourly' | 'restaurant';
      };
      const payrollEmployees = payrollData.employees || [];
      const payMonth = payrollData.payMonth || '06-2026';
      const isRestaurantMode = (payrollData.salaryMode || 'restaurant') === 'restaurant';
      
      if (payrollEmployees.length === 0) {
        showToast('Module Phiếu Lương hiện tại đang trống. Vui lòng nhập dữ liệu tính lương trước.', 'info');
        return;
      }

      const rawAccounts = localStorage.getItem('kg_tool_saved_accounts');
      const savedAccountsList: SavedBankAccountItem[] = rawAccounts ? JSON.parse(rawAccounts) : [];

      const cleanMatchKey = (str: string) =>
        normalizeVietnameseName(String(str || '').replace(/\(.*?\)/g, ''));

      setEmployees(prevEmployees => {
        const newEntries: TransferEmployee[] = payrollEmployees.map((pe: PayrollDraftEmployee, idx: number) => {
          const rawName = String(pe.name || '').trim().replace(/\s+/g, ' ');
          const cleanPeName = cleanMatchKey(rawName);
          const accountMatch = savedAccountsList.find((acc: SavedBankAccountItem) => {
            const holderKey = cleanMatchKey(acc.accountHolder || '');
            const labelKey = cleanMatchKey(acc.label || '');
            return (holderKey && holderKey === cleanPeName) || (labelKey && cleanPeName && labelKey.includes(cleanPeName));
          });

          const existingEmp = prevEmployees.find(e => cleanMatchKey(e.name) === cleanPeName);

          let bankCodeName = existingEmp?.bankCodeName || '';
          let accountNo = existingEmp?.accountNo || '';
          if (accountMatch) {
            accountNo = accountMatch.accountNo || accountNo;
            bankCodeName = bankTemplate === 'vib' 
              ? resolveVibBankName(accountMatch.bankName || accountMatch.bankCode || '')
              : resolveVcbBankName(accountMatch.bankName || accountMatch.bankCode || '');
          }

          const templateToUse = bankTemplate === 'vib' ? defaultMemoTemplate : vcbMemoTemplate;
          const compiled = compileMemo(templateToUse, rawName, payMonth);
          const finalMemo = bankTemplate === 'vcb' ? compiled.toUpperCase() : compiled;

          // In restaurant mode, `pe.amount` already has `advance` and `deduction` subtracted;
          // in monthly/hourly mode, `pe.amount` is gross before per-employee `advance` / `deduction`.
          const grossOrNet = parseSmartCurrency(pe.amount);
          const netPayout = isRestaurantMode
            ? Math.max(0, grossOrNet)
            : Math.max(0, grossOrNet - parseSmartCurrency(pe.advance) - parseSmartCurrency(pe.deduction));

          return {
            id: 'payroll-' + (pe.id || idx) + '-' + Date.now(),
            name: rawName,
            accountNo: accountNo,
            bankCodeName: bankCodeName,
            amount: netPayout,
            memo: finalMemo,
            payMonth: payMonth,
            source: 'payroll',
            isValid: false,
            errors: []
          };
        });

        const validated = revalidateAll(newEntries, bankTemplate);
        showToast(`Đã đồng bộ ${validated.length} nhân viên từ Bảng Lương sang Lệnh Chuyển Khoản!`, 'success');
        return validated;
      });
    } catch (e) {
      console.error(e);
      showToast('Lỗi phân tích dữ liệu Bảng Lương.', 'error');
    }
  }, [bankTemplate, compileMemo, defaultMemoTemplate, revalidateAll, resolveVcbBankName, resolveVibBankName, showToast, vcbMemoTemplate]);

  // Normalize all names to uppercase non-accented
  const handleNormalizeAllNames = useCallback(() => {
    setEmployees(prev => {
      if (prev.length === 0) {
        showToast('Chưa có nhân viên nào trong danh sách để chuẩn hóa.', 'info');
        return prev;
      }
      const updated = prev.map(emp => {
        const normalizedName = normalizeVietnameseName(emp.name);
        const updatedEmp = { ...emp, name: normalizedName };
        const validation = validateRecord(updatedEmp);
        return {
          ...updatedEmp,
          isValid: validation.isValid,
          errors: validation.errors
        };
      });
      showToast(`Đã tự động chuẩn hóa ${updated.length} tên nhân viên sang IN HOA KHÔNG DẤU!`, 'success');
      return updated;
    });
  }, [showToast, validateRecord]);

  // Inline table cell update helper (zero-modal fast editing)
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<'all' | 'valid' | 'invalid'>('all');

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (tableFilter === 'valid') list = list.filter(e => e.isValid);
    else if (tableFilter === 'invalid') list = list.filter(e => !e.isValid);
    if (tableSearch.trim()) {
      const q = removeVietnameseAccents(tableSearch.trim()).toLowerCase();
      list = list.filter(e =>
        removeVietnameseAccents(e.name).toLowerCase().includes(q) ||
        (e.accountNo && e.accountNo.toLowerCase().includes(q)) ||
        removeVietnameseAccents(e.bankCodeName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, tableFilter, tableSearch]);

  const handleBulkFillMissingBank = () => {
    const defaultBank = bankTemplate === 'vib' ? '203 - Vietcombank' : '(VCB) Vietcombank';
    let count = 0;
    const updated = employees.map(emp => {
      if (!emp.bankCodeName || emp.bankCodeName.trim() === '') {
        count++;
        const nextEmp = { ...emp, bankCodeName: defaultBank };
        const v = validateRecord(nextEmp, bankTemplate);
        return { ...nextEmp, isValid: v.isValid, errors: v.errors };
      }
      return emp;
    });
    if (count === 0) {
      showToast('Tất cả nhân viên đã có ngân hàng nhận!', 'info');
      return;
    }
    setEmployees(updated);
    showToast(`Đã gán nhanh ${defaultBank} cho ${count} dòng chưa có ngân hàng!`, 'success');
  };

  const handleInlineFieldChange = (id: string, field: 'name' | 'accountNo' | 'amount' | 'memo', rawValue: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== id) return emp;
      const updated: TransferEmployee = {
        ...emp,
        [field]: field === 'amount'
          ? Math.round(Number(rawValue.replace(/\D/g, '')) || 0)
          : field === 'accountNo'
          ? rawValue.replace(/\s+/g, '')
          : rawValue
      };
      const validation = validateRecord(updated, bankTemplate);
      return {
        ...updated,
        isValid: validation.isValid,
        errors: validation.errors
      };
    }));
  };

  // Listen for cross-module pipeline triggers (from PayrollCreator & CommandPalette)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (localStorage.getItem('kg_tool_pending_payroll_transfer') === '1') {
        localStorage.removeItem('kg_tool_pending_payroll_transfer');
        handleLoadFromPayroll();
      }
      if (localStorage.getItem('kg_tool_pending_normalize_transfer') === '1') {
        localStorage.removeItem('kg_tool_pending_normalize_transfer');
        handleNormalizeAllNames();
      }
    }, 0);
    const onImportEvent = () => {
      localStorage.removeItem('kg_tool_pending_payroll_transfer');
      handleLoadFromPayroll();
    };
    const onNormalizeEvent = () => {
      localStorage.removeItem('kg_tool_pending_normalize_transfer');
      handleNormalizeAllNames();
    };
    window.addEventListener('kg-import-payroll-to-transfer', onImportEvent);
    window.addEventListener('kg-normalize-transfer-names', onNormalizeEvent);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('kg-import-payroll-to-transfer', onImportEvent);
      window.removeEventListener('kg-normalize-transfer-names', onNormalizeEvent);
    };
  }, [handleLoadFromPayroll, handleNormalizeAllNames]);

  // 2. PARSE EXCEL/CSV IMPORT
  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsImporting(true);
    showToast(`Đang tải file ${file.name}...`, 'info');

    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      if (extension === 'csv') {
        const PapaMod = await import('papaparse');
        const Papa = PapaMod.default ?? PapaMod;
        Papa.parse<unknown[]>(file, {
          complete: (results) => {
            processParsedData(results.data || []);
          },
          error: (err) => {
            showToast(`Lỗi đọc file CSV: ${err.message}`, 'error');
            setIsImporting(false);
          },
          header: false,
          skipEmptyLines: true
        });
      } else if (extension === 'xlsx') {
        const buffer = await file.arrayBuffer();
        const ExcelJSMod = await import('exceljs');
        const ExcelJS = ExcelJSMod.default ?? ExcelJSMod;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet) {
          throw new Error('Không tìm thấy trang tính trong file Excel.');
        }
        const maxCols = Math.max(sheet.columnCount || 0, 12);
        const rowsData: unknown[][] = [];
        sheet.eachRow({ includeEmpty: false }, (row) => {
          const vals: unknown[] = [];
          const count = Math.max(maxCols, row.cellCount);
          for (let c = 1; c <= count; c++) {
            vals.push(unwrapExcelCellValue(row.getCell(c).value));
          }
          rowsData.push(vals);
        });
        processParsedData(rowsData);
      } else {
        showToast('Định dạng tệp không được hỗ trợ. Chỉ nhận file .xlsx hoặc .csv', 'error');
        setIsImporting(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      showToast(`Không thể đọc file: ${message}`, 'error');
      setIsImporting(false);
    }
  };

  const processParsedData = (rows: unknown[][]) => {
    if (rows.length === 0) {
      showToast('Tệp rỗng hoặc không đọc được dữ liệu.', 'error');
      setIsImporting(false);
      return;
    }

    let startIdx = 0;
    const headerSample = String(unwrapExcelCellValue(rows[0][0]) || '').toLowerCase();
    if (headerSample.includes('stt') || headerSample.includes('họ tên') || headerSample.includes('tên') || isNaN(Number(unwrapExcelCellValue(rows[0][0])))) {
      startIdx = 1;
    }

    const importedEntries: TransferEmployee[] = [];
    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      let name = '';
      let accountNo = '';
      let amount = 0;
      let memo = '';
      let bankCodeName = '';
      // extra fields
      let idNo = '';
      let issuedDate = '';
      let issuedPlace = '';
      let refNo = '';
      let address = '';

      const col0Val = unwrapExcelCellValue(row[0]);
      const col0IsNum = !isNaN(Number(col0Val)) && String(col0Val).trim() !== '';

      if (bankTemplate === 'vcb') {
        // VCB template layout mapping:
        // Col A: STT, Col B: Ref, Col C: Account, Col D: CMND, Col E: Issued Date, Col F: Issued Place, Col G: Name, Col H: Address, Col I: Bank, Col J: Amount, Col K: Currency, Col L: Content
        if (col0IsNum && row.length >= 10) {
          refNo = String(unwrapExcelCellValue(row[1]) || '').trim();
          accountNo = String(unwrapExcelCellValue(row[2]) || '').trim();
          idNo = String(unwrapExcelCellValue(row[3]) || '').trim();
          issuedDate = String(unwrapExcelCellValue(row[4]) || '').trim();
          issuedPlace = String(unwrapExcelCellValue(row[5]) || '').trim();
          name = String(unwrapExcelCellValue(row[6]) || '').trim();
          address = String(unwrapExcelCellValue(row[7]) || '').trim();
          bankCodeName = resolveVcbBankName(String(unwrapExcelCellValue(row[8]) || ''));
          amount = parseSmartCurrency(row[9]);
          memo = String(unwrapExcelCellValue(row[11]) || '').trim();
        } else {
          name = String(col0Val || '').trim();
          accountNo = String(unwrapExcelCellValue(row[1]) || '').trim();
          amount = parseSmartCurrency(row[2]);
          memo = String(unwrapExcelCellValue(row[3]) || '').trim();
        }
      } else {
        // VIB template layout
        if (col0IsNum && row.length >= 6) {
          name = String(unwrapExcelCellValue(row[1]) || '').trim();
          accountNo = String(unwrapExcelCellValue(row[2]) || '').trim();
          amount = parseSmartCurrency(row[3]);
          memo = String(unwrapExcelCellValue(row[4]) || '').trim();
          bankCodeName = resolveVibBankName(String(unwrapExcelCellValue(row[5]) || ''));
        } else {
          name = String(col0Val || '').trim();
          accountNo = String(unwrapExcelCellValue(row[1]) || '').trim();
          amount = parseSmartCurrency(row[2]);
          memo = String(unwrapExcelCellValue(row[3]) || '').trim();
          bankCodeName = resolveVibBankName(String(unwrapExcelCellValue(row[4]) || ''));
        }
      }

      if (!name) continue;

      if (!memo) {
        const templateToUse = bankTemplate === 'vib' ? defaultMemoTemplate : vcbMemoTemplate;
        const compiled = compileMemo(templateToUse, name, '06-2026');
        memo = bankTemplate === 'vcb' ? compiled.toUpperCase() : compiled;
      }

      importedEntries.push({
        id: 'imported-' + i + '-' + Date.now(),
        name,
        accountNo,
        bankCodeName,
        amount,
        memo,
        idNo,
        issuedDate,
        issuedPlace,
        refNo,
        address,
        source: 'import',
        isValid: false,
        errors: []
      });
    }

    const validated = revalidateAll(importedEntries, bankTemplate);
    setEmployees(prev => [...prev, ...validated]);
    showToast(`Đã import thành công ${validated.length} nhân viên từ tệp!`, 'success');
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 3. BULK PASTE
  const handleBulkPasteSave = () => {
    if (!bulkText.trim()) {
      showToast('Nội dung dán trống.', 'error');
      return;
    }

    const rows = bulkText.split('\n').map(r => r.split('\t'));
    const parsedEntries: TransferEmployee[] = [];
    
    rows.forEach((row, i) => {
      const cleanRow = row.map(c => c.trim());
      if (cleanRow.length < 3 || !cleanRow[0]) return;

      const name = cleanRow[0];
      const accountNo = cleanRow[1];
      const amount = parseSmartCurrency(cleanRow[2]);
      
      const templateToUse = bankTemplate === 'vib' ? defaultMemoTemplate : vcbMemoTemplate;
      const compiled = compileMemo(templateToUse, name, '06-2026');
      const memo = cleanRow[3] || (bankTemplate === 'vcb' ? compiled.toUpperCase() : compiled);
      
      const bankCodeName = cleanRow[4] 
        ? (bankTemplate === 'vib' ? resolveVibBankName(cleanRow[4]) : resolveVcbBankName(cleanRow[4])) 
        : '';

      parsedEntries.push({
        id: 'paste-' + i + '-' + Date.now(),
        name,
        accountNo,
        bankCodeName,
        amount,
        memo,
        source: 'manual',
        isValid: false,
        errors: []
      });
    });

    const validated = revalidateAll(parsedEntries, bankTemplate);
    setEmployees(prev => [...prev, ...validated]);
    showToast(`Đã dán và nạp ${validated.length} nhân viên thành công!`, 'success');
    setShowBulkModal(false);
    setBulkText('');
  };

  // 4. MANUAL ROW ADD/EDIT/DELETE
  const handleAddManualRow = () => {
    const defaultName = 'NHAN VIEN MOI';
    const templateToUse = bankTemplate === 'vib' ? defaultMemoTemplate : vcbMemoTemplate;
    const compiled = compileMemo(templateToUse, defaultName, '06-2026');
    const finalMemo = bankTemplate === 'vcb' ? compiled.toUpperCase() : compiled;

    const newEmp: TransferEmployee = {
      id: 'manual-' + Date.now(),
      name: defaultName,
      accountNo: '',
      bankCodeName: '',
      amount: 5000000,
      memo: finalMemo,
      source: 'manual',
      isValid: false,
      errors: ['Vui lòng điền thông tin tài khoản và ngân hàng.']
    };
    setEmployees(prev => [newEmp, ...prev]);
    setActiveEmployeeEdit(newEmp);
    setIsAdding(true);
  };

  const handleEditRowClick = (emp: TransferEmployee) => {
    setActiveEmployeeEdit({ ...emp });
    setIsAdding(false);
  };

  const handleSaveActiveEdit = () => {
    if (!activeEmployeeEdit) return;

    const candidate: TransferEmployee = bankTemplate === 'vcb'
      ? {
          ...activeEmployeeEdit,
          name: normalizeVietnameseName(activeEmployeeEdit.name),
          memo: activeEmployeeEdit.memo.toUpperCase()
        }
      : { ...activeEmployeeEdit };

    const validated = validateRecord(candidate, bankTemplate);
    const updated: TransferEmployee = {
      ...candidate,
      isValid: validated.isValid,
      errors: validated.errors
    };

    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
    setActiveEmployeeEdit(null);
    showToast('Đã cập nhật thông tin nhân viên!', 'success');
  };

  const handleDeleteRow = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa nhân viên này khỏi danh sách chuyển tiền?')) {
      setEmployees(prev => prev.filter(e => e.id !== id));
      showToast('Đã xóa nhân viên.', 'info');
    }
  };

  const handleClearAll = () => {
    if (confirm('Lưu ý: Hành động này sẽ xóa toàn bộ danh sách chuyển tiền hiện tại. Bạn có chắc chắn muốn làm sạch?')) {
      setEmployees([]);
      showToast('Đã xóa sạch dữ liệu.', 'info');
    }
  };

  // 5. EXPORT BANK TRANSFER EXCEL VIB
  const handleExportExcelVib = async () => {
    setIsExporting(true);
    showToast('Đang tạo file Excel chuyển tiền MyVIB...', 'info');

    try {
      const response = await fetch('/templates/myvib-transfer-template.xlsx');
      if (!response.ok) {
        throw new Error('Không thể tải file mẫu MyVIB từ máy chủ.');
      }

      const arrayBuffer = await response.arrayBuffer();
      const ExcelJSMod = await import('exceljs');
      const ExcelJS = ExcelJSMod.default ?? ExcelJSMod;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        throw new Error('Không tìm thấy Sheet "Danh sách chuyển tiền" trong file mẫu.');
      }

      const templateRow = sheet.getRow(5);
      const N = employees.length;

      for (let i = 0; i < N; i++) {
        const emp = employees[i];
        const r = 5 + i;
        const row = sheet.getRow(r);

        if (r > 14) {
          for (let c = 1; c <= 6; c++) {
            const templateCell = templateRow.getCell(c);
            const targetCell = row.getCell(c);
            targetCell.style = { ...templateCell.style };
            if (templateCell.dataValidation) {
              targetCell.dataValidation = { ...templateCell.dataValidation };
            }
          }
        }

        row.getCell(1).value = i + 1; // STT
        row.getCell(2).value = emp.name.toUpperCase().trim(); 
        row.getCell(3).value = String(emp.accountNo).trim(); 
        row.getCell(4).value = Number(emp.amount); 
        row.getCell(5).value = emp.memo.trim(); 
        row.getCell(6).value = emp.bankCodeName; 
      }

      const lastRow = Math.max(sheet.rowCount, 100);
      for (let r = 5 + N; r <= lastRow; r++) {
        const row = sheet.getRow(r);
        row.getCell(1).value = null;
        row.getCell(2).value = null;
        row.getCell(3).value = null;
        row.getCell(4).value = null;
        row.getCell(5).value = null;
        row.getCell(6).value = null;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const cleanMonth = (employees[0]?.payMonth || '06-2026').replace(/\//g, '-');
      const filename = `myvib-chuyen-tien-luong-kings-grill-${cleanMonth}.xlsx`;
      
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      showToast('Đã xuất file chuyển tiền MyVIB thành công!', 'success');
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      showToast(`Lỗi xuất file Excel: ${message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 6. EXPORT BANK TRANSFER EXCEL VIETCOMBANK
  const handleExportExcelVcb = async () => {
    setIsExporting(true);
    showToast('Đang tạo file Excel chuyển tiền Vietcombank...', 'info');

    try {
      // Fetch converted VCB xlsx template
      const response = await fetch('/templates/vietcombank-transfer-template.xlsx');
      if (!response.ok) {
        throw new Error('Không thể tải file mẫu Vietcombank A222 từ máy chủ.');
      }

      const arrayBuffer = await response.arrayBuffer();
      const ExcelJSMod = await import('exceljs');
      const ExcelJS = ExcelJSMod.default ?? ExcelJSMod;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        throw new Error('Không tìm thấy Sheet1 trong file mẫu Vietcombank.');
      }

      // VCB starts data at row 2
      const templateRow = sheet.getRow(2);
      const N = employees.length;

      for (let i = 0; i < N; i++) {
        const emp = employees[i];
        const r = 2 + i;
        const row = sheet.getRow(r);

        // Copy styles from row 2 down if we exceed the default templates length
        if (r > 12) {
          for (let c = 1; c <= 12; c++) {
            const templateCell = templateRow.getCell(c);
            const targetCell = row.getCell(c);
            targetCell.style = { ...templateCell.style };
            if (templateCell.dataValidation) {
              targetCell.dataValidation = { ...templateCell.dataValidation };
            }
          }
        }

        // Set row values
        row.getCell(1).value = i + 1; // STT / No (col A)
        row.getCell(2).value = emp.refNo ? String(emp.refNo).trim() : null; // so ref (col B)
        row.getCell(3).value = String(emp.accountNo).trim(); // so tai khoan (col C)
        row.getCell(4).value = emp.idNo ? String(emp.idNo).trim() : null; // so cmnd (col D)
        row.getCell(5).value = emp.issuedDate ? String(emp.issuedDate).trim() : null; // ngay cap (col E)
        row.getCell(6).value = emp.issuedPlace ? String(emp.issuedPlace).trim() : null; // noi cap (col F)
        row.getCell(7).value = normalizeVietnameseName(emp.name); // ten nguoi huong (col G)
        row.getCell(8).value = emp.address ? String(emp.address).trim() : null; // dia chi (col H)
        row.getCell(9).value = emp.bankCodeName; // ten ngan hang (col I)
        row.getCell(10).value = Number(emp.amount); // so tien (col J)
        row.getCell(11).value = "VND"; // loai tien (col K)
        row.getCell(12).value = emp.memo.toUpperCase().trim(); // noi dung (col L)
      }

      // Clear surplus rows from 2 + N to rowCount
      const lastRow = Math.max(sheet.rowCount, 50);
      for (let r = 2 + N; r <= lastRow; r++) {
        const row = sheet.getRow(r);
        for (let c = 1; c <= 12; c++) {
          row.getCell(c).value = null;
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const cleanMonth = (employees[0]?.payMonth || '06-2026').replace(/\//g, '-');
      const filename = `vcb-chuyen-tien-kings-grill-${cleanMonth}.xlsx`;
      
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      showToast('Đã xuất file chuyển tiền Vietcombank thành công! (Tải tệp .xlsx, tự đổi đuôi thành .xls nếu cổng VCB yêu cầu định dạng cũ)', 'success');
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      showToast(`Lỗi xuất file Vietcombank: ${message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportClick = () => {
    if (employees.length === 0) {
      showToast('Không có dữ liệu để xuất file chuyển tiền.', 'error');
      return;
    }

    const invalidCount = employees.filter(e => !e.isValid).length;
    if (invalidCount > 0) {
      showToast(`Không thể tạo file. Vui lòng khắc phục ${invalidCount} lỗi trước khi tải.`, 'error');
      return;
    }

    if (bankTemplate === 'vib') {
      handleExportExcelVib();
    } else {
      handleExportExcelVcb();
    }
  };

  // Quick select bank handler
  const handleSelectBank = (codeName: string) => {
    if (showBankSelectorForId === 'active-edit' && activeEmployeeEdit) {
      setActiveEmployeeEdit(prev => ({
        ...prev!,
        bankCodeName: codeName
      }));
    } else if (showBankSelectorForId) {
      setEmployees(prev => prev.map(e => {
        if (e.id === showBankSelectorForId) {
          const updated = { ...e, bankCodeName: codeName };
          const validated = validateRecord(updated);
          return {
            ...updated,
            isValid: validated.isValid,
            errors: validated.errors
          };
        }
        return e;
      }));
    }
    setShowBankSelectorForId(null);
    setBankSearchQuery('');
  };

  const [showMemoConfig, setShowMemoConfig] = useState(false);

  return (
    <div className="transfer-file-tool">
      
      {/* HEADER SECTION */}
      <PageHeader
        icon={<FileSpreadsheet size={22} />}
        title="Chuyển Khoản Theo Lô (MyVIB / VCB)"
        subtitle="Nạp danh sách từ Bảng lương hoặc Excel, đối soát STK & mã ngân hàng và xuất file chuẩn nạp cổng ngân hàng."
        badgeText={bankTemplate === 'vib' ? 'MyVIB 2.0' : 'Vietcombank A222'}
        badgeVariant={bankTemplate === 'vib' ? 'info' : 'success'}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="studio-seg-bar" role="group" aria-label="Mẫu ngân hàng xuất file">
              <button
                type="button"
                className={bankTemplate === 'vib' ? 'active' : ''}
                onClick={() => handleSwitchBankTemplate('vib')}
              >
                <Landmark size={14} />
                <span>MyVIB 2.0</span>
              </button>
              <button
                type="button"
                className={bankTemplate === 'vcb' ? 'active' : ''}
                onClick={() => handleSwitchBankTemplate('vcb')}
              >
                <Landmark size={14} />
                <span>Vietcombank (A222)</span>
              </button>
            </div>
            <button 
              type="button"
              className="primary" 
              onClick={handleExportClick}
              disabled={employees.length === 0 || stats.invalidCount > 0 || isExporting}
            >
              {isExporting ? <RefreshCw className="spinner" size={15} /> : <Download size={15} />}
              <span>Xuất File Ngân Hàng</span>
            </button>
          </div>
        }
      />

      {/* STAT CARDS SECTION */}
      <div className="kpis" style={{ marginBottom: '1rem' }}>
        <StatCard 
          icon={<FileSpreadsheet size={18} />} 
          label="Tổng tiền chuyển" 
          value={`${stats.totalAmount.toLocaleString('vi-VN')} đ`} 
          subtext={`Chi cho ${stats.total} nhân viên`}
          hasData={employees.length > 0} 
        />
        <StatCard 
          icon={<CheckCircle size={18} />} 
          label="Thụ hưởng hợp lệ" 
          value={`${stats.validCount} / ${stats.total}`} 
          subtext={`Đạt chuẩn mẫu ${bankTemplate === 'vib' ? 'MyVIB 2.0' : 'VCB A222'}`}
          hasData={employees.length > 0} 
        />
        <StatCard 
          icon={<AlertTriangle size={18} />} 
          label="Dòng cần kiểm tra" 
          value={`${stats.invalidCount} dòng`} 
          subtext={stats.invalidCount > 0 ? 'Cần sửa trước khi xuất' : 'Sẵn sàng xuất file'}
          hasData={employees.length > 0}
          accentColor={stats.invalidCount > 0 ? 'var(--status-danger)' : 'var(--status-success)'}
        />
      </div>

      {/* SINGLE-ROW STUDIO ACTION BAR */}
      <div className="studio-action-bar">
        <div className="studio-bar-group">
          <button 
            type="button"
            className="primary" 
            onClick={handleLoadFromPayroll} 
          >
            <Sparkles size={15} />
            <span>Lấy từ Bảng lương</span>
          </button>

          <button 
            type="button"
            className="btn-outline" 
            onClick={handleTriggerFileInput} 
            disabled={isImporting}
          >
            {isImporting ? <RefreshCw className="spinner" size={14} /> : <Upload size={14} />}
            <span>Nhập Excel/CSV</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept=".xlsx,.csv" 
            onChange={handleImportFileChange}
          />

          <button 
            type="button"
            className="btn-outline" 
            onClick={() => setShowBulkModal(true)}
          >
            <ClipboardCheck size={14} />
            <span>Dán nhanh</span>
          </button>

          <button 
            type="button"
            className="btn-outline" 
            onClick={handleAddManualRow}
          >
            <Plus size={14} />
            <span>Thêm dòng</span>
          </button>
        </div>

        <div className="studio-bar-group">
          <button 
            type="button"
            className="btn-outline" 
            onClick={handleNormalizeAllNames}
            disabled={employees.length === 0}
            title="Chuẩn hóa toàn bộ họ tên thụ hưởng sang IN HOA KHÔNG DẤU"
          >
            <Sparkles size={14} />
            <span>Chuẩn hóa Tên</span>
          </button>

          <button 
            type="button"
            className="btn-outline" 
            onClick={handleBulkFillMissingBank}
            disabled={employees.length === 0}
            title="Gán nhanh ngân hàng mặc định cho các dòng đang trống"
          >
            <CheckCircle size={14} />
            <span>Gán NH trống</span>
          </button>

          <button
            type="button"
            className={showMemoConfig ? 'primary' : 'btn-outline'}
            onClick={() => setShowMemoConfig((v) => !v)}
          >
            <SlidersHorizontal size={14} />
            <span>Mẫu nội dung</span>
          </button>

          {employees.length > 0 && (
            <button 
              type="button"
              className="btn-ghost" 
              onClick={handleClearAll}
              style={{ color: 'var(--status-danger)' }}
              title="Xóa toàn bộ danh sách để nạp lại"
            >
              <Trash2 size={14} />
              <span>Xóa hết</span>
            </button>
          )}
        </div>
      </div>

      {/* COLLAPSIBLE MEMO & TEMPLATE CONFIG */}
      {showMemoConfig && (
        <div className="studio-collapsible-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '8px' }}>
            <h3 className="studio-section-title" style={{ margin: 0 }}>
              <SlidersHorizontal size={16} color="var(--accent-primary)" />
              Mẫu nội dung chuyển khoản ({bankTemplate === 'vib' ? 'MyVIB 2.0' : 'Vietcombank A222'})
            </h3>
            <button type="button" className="btn-ghost" onClick={() => setShowMemoConfig(false)}>
              <X size={14} />
              <span>Thu gọn</span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder={bankTemplate === 'vib' ? "VD: KINGS GRILL thanh toan luong {ten_nhan_vien} {thang_luong}" : "VD: KG LUONG NV T{thang_luong}"}
              value={bankTemplate === 'vib' ? defaultMemoTemplate : vcbMemoTemplate}
              onChange={e => {
                if (bankTemplate === 'vib') {
                  setDefaultMemoTemplate(e.target.value);
                } else {
                  setVcbMemoTemplate(e.target.value);
                }
              }}
              style={{ flex: '1 1 280px' }}
            />
            <button 
              type="button"
              className="primary"
              onClick={() => {
                if (confirm('Bạn có muốn áp dụng nội dung mẫu này cho toàn bộ dòng hiện có?')) {
                  const templateToUse = bankTemplate === 'vib' ? defaultMemoTemplate : vcbMemoTemplate;
                  const updated = employees.map(emp => {
                    const payMonthVal = emp.payMonth || '06-2026';
                    const compiled = compileMemo(templateToUse, emp.name, payMonthVal, emp.dept || '');
                    const newMemo = bankTemplate === 'vcb' ? compiled.toUpperCase() : compiled;
                    const updatedEmp = { ...emp, memo: newMemo };
                    const validation = validateRecord(updatedEmp);
                    return {
                      ...updatedEmp,
                      isValid: validation.isValid,
                      errors: validation.errors
                    };
                  });
                  setEmployees(updated);
                  showToast('Đã áp dụng mẫu nội dung chuyển khoản cho danh sách!', 'success');
                }
              }}
            >
              Áp dụng cho toàn bảng
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between' }}>
            <span>Biến hỗ trợ: <code>&#123;ten_nhan_vien&#125;</code>, <code>&#123;thang_luong&#125;</code>, <code>&#123;bo_phan&#125;</code></span>
            {bankTemplate === 'vcb' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)' }}>
                <Info size={13} />
                Nếu cổng VCB yêu cầu định dạng .xls cũ, mở file .xlsx bằng Excel rồi Save As *.xls.
              </span>
            )}
          </div>
        </div>
      )}

      {/* COMPACT VALIDATION BANNER */}
      {stats.invalidCount > 0 && (
        <div style={{
          marginBottom: '1rem',
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--status-danger-bg)',
          border: '1px solid var(--status-danger-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-danger)', fontSize: '0.82rem', fontWeight: 600 }}>
            <AlertTriangle size={16} />
            <span>Phát hiện {stats.invalidCount} dòng thiếu thông tin hoặc chưa khớp mã ngân hàng {bankTemplate.toUpperCase()}.</span>
          </div>
          <button
            type="button"
            className="btn-outline"
            onClick={() => setTableFilter(tableFilter === 'invalid' ? 'all' : 'invalid')}
            style={{ height: '32px', padding: '0 10px', fontSize: '0.76rem', borderColor: 'var(--status-danger)', color: 'var(--status-danger)' }}
          >
            {tableFilter === 'invalid' ? 'Hiện tất cả' : 'Lọc dòng cần sửa'}
          </button>
        </div>
      )}

      {/* TABLE VIEW OF ENTRIES */}
      <div className="card panel" style={{ padding: '1rem 0', overflow: 'visible' }}>
        <div style={{ padding: '0 1.15rem', marginBottom: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 className="studio-section-title" style={{ margin: 0 }}>
              <FileSpreadsheet size={17} color="var(--accent-primary)" />
              Danh sách chuyển khoản ({filteredEmployees.length}/{employees.length})
            </h2>
            <Badge variant="neutral">Ghi từ hàng {bankTemplate === 'vib' ? '5' : '2'}</Badge>
          </div>

          {employees.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className="studio-search-box" style={{ minWidth: '210px' }}>
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Tìm tên, số TK, ngân hàng..."
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                />
                {tableSearch && (
                  <button
                    type="button"
                    onClick={() => setTableSearch('')}
                    aria-label="Xóa tìm kiếm"
                    style={{ position: 'absolute', right: '6px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', height: 'auto', minHeight: 'auto' }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="studio-seg-bar">
                <button
                  type="button"
                  className={tableFilter === 'all' ? 'active' : ''}
                  onClick={() => setTableFilter('all')}
                >
                  Tất cả ({stats.total})
                </button>
                <button
                  type="button"
                  className={tableFilter === 'valid' ? 'active' : ''}
                  onClick={() => setTableFilter('valid')}
                >
                  Hợp lệ ({stats.validCount})
                </button>
                <button
                  type="button"
                  className={tableFilter === 'invalid' ? 'active' : ''}
                  onClick={() => setTableFilter('invalid')}
                >
                  Cần sửa ({stats.invalidCount})
                </button>
              </div>
            </div>
          )}
        </div>

        {employees.length === 0 ? (
          <EmptyState 
            icon={<FileSpreadsheet size={30} />}
            title="Chưa có dữ liệu chuyển tiền"
            description="Nạp danh sách trực tiếp từ module Bảng Lương hoặc nhập file Excel/CSV để bắt đầu đối soát và xuất file ngân hàng."
            actionLabel="Lấy từ Bảng lương"
            onAction={handleLoadFromPayroll}
          />
        ) : isMobileScreen ? (
          /* Mobile Card list view */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0 1rem' }}>
            {filteredEmployees.map((emp, idx) => {
              const hasSelector = showBankSelectorForId === emp.id;

              return (
                <div 
                  key={emp.id} 
                  style={{ 
                    background: 'var(--bg-subtle)', 
                    border: `1px solid ${emp.isValid ? 'var(--border-default)' : 'var(--status-danger-border)'}`, 
                    borderRadius: 'var(--radius-md)', 
                    padding: '0.9rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.65rem',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>#{idx + 1}</span>
                    {emp.isValid ? (
                      <Badge variant="success">Hợp lệ</Badge>
                    ) : (
                      <Badge variant="danger">Lỗi</Badge>
                    )}
                  </div>

                  <div>
                    {bankTemplate === 'vcb' ? (
                      <>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{normalizeVietnameseName(emp.name)}</h4>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>Tên gốc: {emp.name}</span>
                      </>
                    ) : (
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</h4>
                    )}
                    {emp.source === 'payroll' && (
                      <div style={{ marginTop: '4px' }}>
                        <Badge variant="info">Từ Phiếu lương</Badge>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem' }}>Số tài khoản</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{emp.accountNo || <span style={{ color: 'var(--status-danger)' }}>Trống</span>}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem' }}>Số tiền</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--accent-primary)' }}>{emp.amount.toLocaleString('vi-VN')} đ</span>
                    </div>
                  </div>

                  {bankTemplate === 'vcb' && (emp.idNo || emp.refNo) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', borderTop: '1px solid var(--border-default)', paddingTop: '6px' }}>
                      {emp.idNo && (
                        <div>
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem' }}>CMND/CCCD</span>
                          <span>{emp.idNo}</span>
                        </div>
                      )}
                      {emp.refNo && (
                        <div>
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem' }}>Số Ref</span>
                          <span>{emp.refNo}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: '0.82rem' }}>
                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem' }}>Ngân hàng nhận</span>
                    <div 
                      onClick={() => {
                        setShowBankSelectorForId(emp.id);
                        setBankSearchQuery('');
                      }}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '8px 10px', 
                        minHeight: '40px',
                        background: 'var(--bg-surface)', 
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        marginTop: '4px'
                      }}
                    >
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                        {emp.bankCodeName || <span style={{ color: 'var(--status-danger)' }}>Chưa chọn ngân hàng</span>}
                      </span>
                      <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    
                    {hasSelector && (
                      <div 
                        ref={bankDropdownRef}
                        style={{ 
                          position: 'absolute', 
                          top: '100%', 
                          left: '12px', 
                          right: '12px', 
                          zIndex: 1000, 
                          background: 'var(--bg-elevated)', 
                          border: '1px solid var(--border-strong)', 
                          boxShadow: 'var(--shadow-lg)',
                          borderRadius: 'var(--radius-md)',
                          padding: '8px',
                          maxHeight: '220px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}>
                          <Search size={13} style={{ color: 'var(--text-muted)' }} />
                          <input 
                            type="text" 
                            placeholder="Tìm ngân hàng..."
                            value={bankSearchQuery}
                            onChange={e => setBankSearchQuery(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '0.8rem', outline: 'none', height: '30px', padding: 0 }}
                            autoFocus
                          />
                        </div>
                        <div style={{ overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {filteredBanks.slice(0, 10).map(bank => (
                            <button 
                              key={bank.codeName}
                              type="button"
                              onClick={() => handleSelectBank(bank.codeName)}
                              style={{ 
                                width: '100%', 
                                textAlign: 'left', 
                                padding: '6px 8px', 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'var(--text-primary)', 
                                fontSize: '0.76rem',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                justifyContent: 'flex-start'
                              }}
                            >
                              <strong>{bank.codeName}</strong> — <span style={{ color: 'var(--text-muted)' }}>{bank.fullName}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '0.8rem' }}>
                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem' }}>Nội dung chuyển</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{emp.memo}</span>
                  </div>

                  {!emp.isValid && (
                    <div style={{ background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger-border)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--status-danger)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {emp.errors.map((err, errIdx) => (
                        <span key={errIdx}>• {err}</span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button 
                      type="button"
                      className="btn-outline" 
                      onClick={() => handleEditRowClick(emp)}
                      style={{ flexGrow: 1 }}
                    >
                      <Edit2 size={14} />
                      Sửa
                    </button>
                    <button 
                      type="button"
                      className="btn-outline" 
                      onClick={() => handleDeleteRow(emp.id)}
                      style={{ flexGrow: 1, color: 'var(--status-danger)', borderColor: 'var(--status-danger-border)' }}
                    >
                      <Trash2 size={14} />
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', position: 'relative' }}>
            
            {/* Desktop Table View */}
            <table className="datagrid-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '50px' }}>STT</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Người nhận (Gốc)</th>
                  {bankTemplate === 'vcb' && <th style={{ padding: '10px 14px', textAlign: 'left' }}>Tên xuất file (IN HOA)</th>}
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Số tài khoản</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Số tiền</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Nội dung</th>
                  {bankTemplate === 'vcb' && <th style={{ padding: '10px 14px', textAlign: 'left' }}>CMND</th>}
                  {bankTemplate === 'vcb' && <th style={{ padding: '10px 14px', textAlign: 'left' }}>Ref</th>}
                  <th style={{ padding: '10px 14px', textAlign: 'left', width: '220px' }}>Ngân hàng xuất</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '100px' }}>Trạng thái</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '90px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, idx) => {
                  const hasSelector = showBankSelectorForId === emp.id;
                  
                  return (
                    <tr key={emp.id} style={{ background: emp.isValid ? 'transparent' : 'var(--status-danger-bg)' }}>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{idx + 1}</td>
                      
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                        <input
                          type="text"
                          value={emp.name}
                          onChange={e => handleInlineFieldChange(emp.id, 'name', e.target.value)}
                          style={{
                            height: '34px',
                            fontWeight: 600,
                            fontSize: '0.83rem',
                            minWidth: '145px'
                          }}
                        />
                        {emp.source === 'payroll' && (
                          <div style={{ marginTop: '3px' }}>
                            <Badge variant="info">Phiếu lương</Badge>
                          </div>
                        )}
                      </td>

                      {bankTemplate === 'vcb' && (
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.82rem' }}>
                          {normalizeVietnameseName(emp.name)}
                        </td>
                      )}

                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          value={emp.accountNo}
                          placeholder="Nhập số TK..."
                          onChange={e => handleInlineFieldChange(emp.id, 'accountNo', e.target.value)}
                          style={{
                            height: '34px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            borderColor: !emp.accountNo ? 'var(--status-danger)' : 'var(--border-default)',
                            minWidth: '135px'
                          }}
                        />
                      </td>

                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <input
                          type="text"
                          value={emp.amount ? emp.amount.toLocaleString('vi-VN') : ''}
                          placeholder="0"
                          onChange={e => handleInlineFieldChange(emp.id, 'amount', e.target.value)}
                          style={{
                            height: '34px',
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 700,
                            color: 'var(--accent-primary)',
                            fontSize: '0.84rem',
                            minWidth: '115px'
                          }}
                        />
                      </td>

                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          value={emp.memo}
                          onChange={e => handleInlineFieldChange(emp.id, 'memo', e.target.value)}
                          style={{
                            height: '34px',
                            fontSize: '0.8rem',
                            minWidth: '170px'
                          }}
                        />
                      </td>

                      {bankTemplate === 'vcb' && (
                        <>
                          <td style={{ padding: '10px 14px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>{emp.idNo || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>{emp.refNo || '—'}</td>
                        </>
                      )}

                      {/* Bank selection dropdown */}
                      <td style={{ padding: '8px 10px', position: 'relative' }}>
                        <div 
                          className={`select-trigger ${!emp.bankCodeName ? 'error' : ''}`}
                          onClick={() => {
                            setShowBankSelectorForId(emp.id);
                            setBankSearchQuery('');
                          }}
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            height: '34px',
                            padding: '0 10px', 
                            background: 'var(--bg-subtle)', 
                            border: `1px solid ${!emp.bankCodeName ? 'var(--status-danger)' : 'var(--border-default)'}`,
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                            {emp.bankCodeName || <span style={{ color: 'var(--status-danger)' }}>Chưa chọn ngân hàng</span>}
                          </span>
                          <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        </div>

                        {hasSelector && (
                          <div 
                            ref={bankDropdownRef}
                            style={{ 
                              position: 'absolute', 
                              top: '100%', 
                              left: '10px', 
                              right: '10px', 
                              zIndex: 1000, 
                              background: 'var(--bg-elevated)', 
                              border: '1px solid var(--border-strong)', 
                              boxShadow: 'var(--shadow-lg)',
                              borderRadius: 'var(--radius-md)',
                              padding: '8px',
                              maxHeight: '280px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}>
                              <Search size={14} style={{ color: 'var(--text-muted)' }} />
                              <input 
                                type="text" 
                                placeholder="Tìm mã hoặc tên..."
                                value={bankSearchQuery}
                                onChange={e => setBankSearchQuery(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '0.8rem', outline: 'none', height: '28px', padding: 0 }}
                                autoFocus
                              />
                            </div>
                            <div style={{ overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {filteredBanks.slice(0, 15).map(bank => (
                                <button 
                                  key={bank.codeName}
                                  type="button"
                                  onClick={() => handleSelectBank(bank.codeName)}
                                  style={{ 
                                    width: '100%', 
                                    textAlign: 'left', 
                                    justifyContent: 'flex-start',
                                    padding: '6px 8px', 
                                    height: 'auto',
                                    background: 'transparent', 
                                    border: 'none', 
                                    color: 'var(--text-primary)', 
                                    fontSize: '0.76rem',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <strong>{bank.codeName}</strong> — <span style={{ color: 'var(--text-muted)' }}>{bank.fullName}</span>
                                </button>
                              ))}
                              {filteredBanks.length === 0 && (
                                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', display: 'block', padding: '8px' }}>Không tìm thấy ngân hàng.</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {emp.isValid ? (
                          <Badge variant="success">Hợp lệ</Badge>
                        ) : (
                          <span title={emp.errors.join('\n')} style={{ cursor: 'help' }}>
                            <Badge variant="danger">
                              <XCircle size={11} style={{ marginRight: '3px' }} />
                              Lỗi
                            </Badge>
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            type="button"
                            className="btn-outline" 
                            onClick={() => handleEditRowClick(emp)}
                            aria-label="Sửa dòng"
                            style={{ padding: '0 8px', minWidth: '32px', height: '32px' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button 
                            type="button"
                            className="btn-outline" 
                            onClick={() => handleDeleteRow(emp.id)}
                            aria-label="Xóa dòng"
                            style={{ padding: '0 8px', minWidth: '32px', height: '32px', color: 'var(--status-danger)', borderColor: 'var(--status-danger-border)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL FOR BULK DATA PASTE */}
      {showBulkModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15, 28, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card panel modal-box" style={{ maxWidth: '640px', width: '100%', padding: '1.35rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 className="studio-section-title" style={{ margin: 0 }}>
                <ClipboardCheck size={18} color="var(--accent-primary)" />
                Dán dữ liệu hàng loạt (Copy từ Excel)
              </h3>
              <button type="button" className="btn-ghost" onClick={() => setShowBulkModal(false)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
            
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.9rem', lineHeight: 1.5 }}>
              Dán các cột phân cách bằng phím Tab theo thứ tự:<br />
              <strong style={{ color: 'var(--accent-primary)' }}>Tên nhân viên | Số tài khoản | Số tiền chuyển | Nội dung (tùy chọn) | Ngân hàng (tùy chọn)</strong>
            </p>

            <textarea 
              placeholder="VD: Nguyen Van A	0000000001	100000	Thanh toan luong	(ACB) Á Châu"
              style={{ width: '100%', height: '200px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', marginBottom: '1rem', padding: '10px' }}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-outline" onClick={() => setShowBulkModal(false)}>Hủy bỏ</button>
              <button type="button" className="primary" onClick={handleBulkPasteSave} disabled={!bulkText.trim()}>Nạp dữ liệu</button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL FOR ADD/EDIT EMPLOYEE */}
      {activeEmployeeEdit && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15, 28, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card panel modal-box" style={{ maxWidth: '480px', width: '100%', padding: '1.35rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', overflow: 'visible' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="studio-section-title" style={{ margin: 0 }}>
                {isAdding ? <Plus size={18} color="var(--accent-primary)" /> : <Edit2 size={17} color="var(--accent-primary)" />}
                {isAdding ? 'Thêm nhân viên chuyển tiền' : 'Sửa thông tin chuyển tiền'}
              </h3>
              <button type="button" className="btn-ghost" onClick={() => setActiveEmployeeEdit(null)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
              <div className="field">
                <label>Họ và tên người nhận</label>
                <input 
                  type="text" 
                  value={activeEmployeeEdit.name}
                  onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, name: e.target.value }))}
                />
                {bankTemplate === 'vcb' && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--accent-primary)' }}>
                    Sẽ xuất file: {normalizeVietnameseName(activeEmployeeEdit.name)}
                  </span>
                )}
              </div>

              <div className="field">
                <label>Số tài khoản nhận</label>
                <input 
                  type="text" 
                  value={activeEmployeeEdit.accountNo}
                  onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, accountNo: e.target.value.replace(/\s+/g, '') }))}
                />
              </div>

              <div className="field">
                <label>Số tiền chuyển (đ)</label>
                <input 
                  type="number" 
                  value={activeEmployeeEdit.amount || ''}
                  onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, amount: Number(e.target.value) || 0 }))}
                />
              </div>

              <div className="field">
                <label>Nội dung chuyển khoản</label>
                <input 
                  type="text" 
                  value={activeEmployeeEdit.memo}
                  onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, memo: bankTemplate === 'vcb' ? e.target.value.toUpperCase() : e.target.value }))}
                />
              </div>

              {/* Extra VCB columns in modal */}
              {bankTemplate === 'vcb' && (
                <>
                  <div className="field">
                    <label>Số CMND/CCCD (D)</label>
                    <input 
                      type="text" 
                      value={activeEmployeeEdit.idNo || ''}
                      onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, idNo: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Ngày cấp (E)</label>
                    <input 
                      type="text" 
                      value={activeEmployeeEdit.issuedDate || ''}
                      placeholder="VD: 15/06/2020"
                      onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, issuedDate: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Nơi cấp (F)</label>
                    <input 
                      type="text" 
                      value={activeEmployeeEdit.issuedPlace || ''}
                      placeholder="VD: CA HA NOI"
                      onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, issuedPlace: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Số Ref (B)</label>
                    <input 
                      type="text" 
                      value={activeEmployeeEdit.refNo || ''}
                      onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, refNo: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Địa chỉ người thụ hưởng (H)</label>
                    <input 
                      type="text" 
                      value={activeEmployeeEdit.address || ''}
                      onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, address: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Bank selector */}
              <div className="field" style={{ position: 'relative' }}>
                <label>Ngân hàng nhận</label>
                <div 
                  className="select-trigger"
                  onClick={() => {
                    setShowBankSelectorForId('active-edit');
                    setBankSearchQuery('');
                  }}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    height: '40px',
                    padding: '0 12px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '0.84rem'
                  }}
                >
                  <span>{activeEmployeeEdit.bankCodeName || 'Chọn ngân hàng...'}</span>
                  <ChevronDown size={15} />
                </div>

                {showBankSelectorForId === 'active-edit' && (
                  <div 
                    ref={bankDropdownRef}
                    style={{ 
                      position: 'absolute', 
                      bottom: '100%', 
                      left: 0, 
                      right: 0, 
                      zIndex: 3000, 
                      background: 'var(--bg-elevated)', 
                      border: '1px solid var(--border-strong)', 
                      boxShadow: 'var(--shadow-lg)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      maxHeight: '220px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}>
                      <Search size={14} style={{ color: 'var(--text-muted)' }} />
                      <input 
                        type="text" 
                        placeholder="Tìm mã hoặc tên..."
                        value={bankSearchQuery}
                        onChange={e => setBankSearchQuery(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '0.8rem', outline: 'none', height: '28px', padding: 0 }}
                        autoFocus
                      />
                    </div>
                    <div style={{ overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {filteredBanks.slice(0, 15).map(bank => (
                        <button 
                          key={bank.codeName}
                          type="button"
                          onClick={() => handleSelectBank(bank.codeName)}
                          style={{ 
                            width: '100%', 
                            textAlign: 'left', 
                            justifyContent: 'flex-start',
                            padding: '6px 8px', 
                            height: 'auto',
                            background: 'transparent', 
                            border: 'none', 
                            color: 'var(--text-primary)', 
                            fontSize: '0.76rem',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer'
                          }}
                        >
                          <strong>{bank.codeName}</strong> — <span style={{ color: 'var(--text-muted)' }}>{bank.fullName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button type="button" className="btn-outline" onClick={() => setActiveEmployeeEdit(null)}>Hủy</button>
              <button type="button" className="primary" onClick={handleSaveActiveEdit}>Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
