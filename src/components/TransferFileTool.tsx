import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Info
} from 'lucide-react';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { VIB_BANKS } from '../constants/vibBanks';
import { VCB_BANKS } from '../constants/vcbBanks';
import { StatCard, GuidePanel, EmptyState, PageHeader } from './Shared';

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

// Accent removal utility
export function removeVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Strict name normalization for Vietcombank
export function normalizeVietnameseName(name: string): string {
  if (!name) return '';
  const noAccents = removeVietnameseAccents(name);
  return noAccents
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9\s]/g, ''); // strip any strange non-alpha characters for bank safety
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
  const stripTones = (str: string): string => {
    return removeVietnameseAccents(str).toLowerCase();
  };

  // Filter banks for selection
  const filteredBanks = useMemo(() => {
    const q = stripTones(bankSearchQuery.trim());
    const currentBankList = bankTemplate === 'vib' ? VIB_BANKS : VCB_BANKS;
    if (!q) return currentBankList;
    return currentBankList.filter(b => 
      stripTones(b.codeName).includes(q) || 
      stripTones(b.fullName).includes(q)
    );
  }, [bankSearchQuery, bankTemplate]);

  // Map arbitrary bank name to VIB codeName
  const resolveVibBankName = (rawBank: string): string => {
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
  };

  // Map arbitrary bank name to Vietcombank format (e.g. "(ACB) Á Châu")
  const resolveVcbBankName = (rawBank: string): string => {
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
  };

  // Validation function
  const validateRecord = (emp: Partial<TransferEmployee>, activeBank: 'vib' | 'vcb' = bankTemplate): { isValid: boolean; errors: string[] } => {
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
        const allowedRegex = /^[a-zA-Z0-9aAàÀảẢãÃáÁạẠăĂằẰẳẲẵẴắẮặẶâÂầẦẩẨẫẪấẤậẬeEèÈẻẺẽẼéÉẹẸêÊềỀểỂễỄếẾệỆiIìÌỉỈĩĨíÍịỊoOòÒỏỎõÕóÓọỌôÔồỒổỔỗỖốỐộỘơƠờỜởỞỡỠớỚợỢuUùÙủỦũŨúÚụỤưƯừỪửỬữỮứỨựỰyYỳỲỷỶỹỸýÝỵYđĐ\s,.\-+\(\):_&?]*$/;
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
        const vcbMemoRegex = /^[A-Z0-9\s,\.\-+\(\):_&?]*$/;
        if (!vcbMemoRegex.test(memoText.toUpperCase())) {
          errors.push('Nội dung chuyển khoản chứa ký tự lạ không được Vietcombank hỗ trợ.');
        }
      } else {
        const allowedRegex = /^[a-zA-Z0-9aAàÀảẢãÃáÁạẠăĂằẰẳẲẵẴắẮặẶâÂầẦẩẨẫẪấẤậẬeEèÈẻẺẽẼéÉẹẸêÊềỀểỂễỄếẾệỆiIìÌỉỈĩĨíÍịỊoOòÒỏỎõÕóÓọỌôÔồỒổỔỗỖốỐộỘơƠờỜởỞỡỠớỚợỢuUùÙủỦũŨúÚụỤưƯừỪửỬữỮứỨựỰyYỳỲỷỶỹỸýÝỵYđĐ\s,.\-+\(\):_&?]*$/;
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
  };

  // Run validation on all records
  const revalidateAll = (list: TransferEmployee[], activeBank: 'vib' | 'vcb' = bankTemplate): TransferEmployee[] => {
    return list.map(item => {
      const res = validateRecord(item, activeBank);
      return {
        ...item,
        isValid: res.isValid,
        errors: res.errors
      };
    });
  };

  // Trigger validation immediately when template bank changes
  useEffect(() => {
    if (employees.length > 0) {
      // Map banks and validate
      const converted = employees.map(emp => {
        let bankCodeName = emp.bankCodeName;
        // Re-resolve bank format
        if (bankTemplate === 'vcb') {
          bankCodeName = resolveVcbBankName(emp.bankCodeName);
        } else {
          bankCodeName = resolveVibBankName(emp.bankCodeName);
        }
        return {
          ...emp,
          bankCodeName
        };
      });
      setEmployees(revalidateAll(converted, bankTemplate));
    }
  }, [bankTemplate]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = employees.length;
    const validCount = employees.filter(e => e.isValid).length;
    const invalidCount = total - validCount;
    const totalAmount = employees.reduce((sum, e) => sum + (e.amount || 0), 0);
    return { total, validCount, invalidCount, totalAmount };
  }, [employees]);

  // Helper to compile transaction memo with variables
  const compileMemo = (template: string, name: string, month: string, dept: string = ''): string => {
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
  };

  // 1. LOAD FROM PAYROLL (Accent-insensitive & preserves existing account numbers)
  const handleLoadFromPayroll = () => {
    const rawPayroll = localStorage.getItem('kg_tool_payroll_state');
    if (!rawPayroll) {
      showToast('Không tìm thấy dữ liệu Phiếu Lương nháp nào trong hệ thống.', 'error');
      return;
    }

    try {
      const payrollData = JSON.parse(rawPayroll);
      const payrollEmployees = payrollData.employees || [];
      const payMonth = payrollData.payMonth || '06-2026';
      
      if (payrollEmployees.length === 0) {
        showToast('Module Phiếu Lương hiện tại đang trống. Vui lòng nhập dữ liệu tính lương trước.', 'info');
        return;
      }

      const rawAccounts = localStorage.getItem('kg_tool_saved_accounts');
      const savedAccountsList = rawAccounts ? JSON.parse(rawAccounts) : [];

      const cleanMatchKey = (str: string) =>
        normalizeVietnameseName(String(str || '').replace(/\(.*?\)/g, ''));

      const newEntries: TransferEmployee[] = payrollEmployees.map((pe: any, idx: number) => {
        const cleanPeName = cleanMatchKey(pe.name);
        const accountMatch = savedAccountsList.find((acc: any) => {
          const holderKey = cleanMatchKey(acc.accountHolder || '');
          const labelKey = cleanMatchKey(acc.label || '');
          return (holderKey && holderKey === cleanPeName) || (labelKey && labelKey.includes(cleanPeName));
        });

        const existingEmp = employees.find(e => cleanMatchKey(e.name) === cleanPeName);

        let bankCodeName = existingEmp?.bankCodeName || '';
        let accountNo = existingEmp?.accountNo || '';
        if (accountMatch) {
          accountNo = accountMatch.accountNo || accountNo;
          bankCodeName = bankTemplate === 'vib' 
            ? resolveVibBankName(accountMatch.bankName || accountMatch.bankCode || '')
            : resolveVcbBankName(accountMatch.bankName || accountMatch.bankCode || '');
        }

        const templateToUse = bankTemplate === 'vib' ? defaultMemoTemplate : vcbMemoTemplate;
        const compiled = compileMemo(templateToUse, pe.name, payMonth);
        const finalMemo = bankTemplate === 'vcb' ? compiled.toUpperCase() : compiled;

        return {
          id: 'payroll-' + (pe.id || idx) + '-' + Date.now(),
          name: pe.name.trim().replace(/\s+/g, ' '),
          accountNo: accountNo,
          bankCodeName: bankCodeName,
          amount: Math.round(pe.amount || 0),
          memo: finalMemo,
          payMonth: payMonth,
          source: 'payroll',
          isValid: false,
          errors: []
        };
      });

      const validated = revalidateAll(newEntries, bankTemplate);
      setEmployees(validated);
      showToast(`Đã đồng bộ ${validated.length} nhân viên từ Bảng Lương sang Lệnh Chuyển Khoản!`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Lỗi phân tích dữ liệu Bảng Lương.', 'error');
    }
  };

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
    if (localStorage.getItem('kg_tool_pending_payroll_transfer') === '1') {
      localStorage.removeItem('kg_tool_pending_payroll_transfer');
      handleLoadFromPayroll();
    }
    const onImportEvent = () => handleLoadFromPayroll();
    const onNormalizeEvent = () => handleNormalizeAllNames();
    window.addEventListener('kg-import-payroll-to-transfer', onImportEvent);
    window.addEventListener('kg-normalize-transfer-names', onNormalizeEvent);
    return () => {
      window.removeEventListener('kg-import-payroll-to-transfer', onImportEvent);
      window.removeEventListener('kg-normalize-transfer-names', onNormalizeEvent);
    };
  }, [bankTemplate, employees.length]);

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
        Papa.parse(file, {
          complete: (results) => {
            processParsedData(results.data);
          },
          error: (err) => {
            showToast(`Lỗi đọc file CSV: ${err.message}`, 'error');
            setIsImporting(false);
          },
          header: false,
          skipEmptyLines: true
        });
      } else if (extension === 'xlsx') {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const buffer = evt.target?.result as ArrayBuffer;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const sheet = workbook.worksheets[0];
            const rowsData: any[] = [];
            sheet.eachRow({ includeEmpty: false }, (row) => {
              const vals: any[] = [];
              row.eachCell({ includeEmpty: true }, (cell) => {
                vals.push(cell.value);
              });
              rowsData.push(vals);
            });
            processParsedData(rowsData);
          } catch (ex: any) {
            showToast(`Lỗi phân tích Excel: ${ex.message}`, 'error');
            setIsImporting(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        showToast('Định dạng tệp không được hỗ trợ. Chỉ nhận file .xlsx hoặc .csv', 'error');
        setIsImporting(false);
      }
    } catch (err: any) {
      showToast(`Không thể đọc file: ${err.message}`, 'error');
      setIsImporting(false);
    }
  };

  const processParsedData = (rows: any[]) => {
    if (rows.length === 0) {
      showToast('Tệp rỗng hoặc không đọc được dữ liệu.', 'error');
      setIsImporting(false);
      return;
    }

    let startIdx = 0;
    const headerSample = String(rows[0][0] || '').toLowerCase();
    if (headerSample.includes('stt') || headerSample.includes('họ tên') || headerSample.includes('tên') || isNaN(Number(rows[0][0]))) {
      startIdx = 1;
    }

    const importedEntries: TransferEmployee[] = [];
    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 3) continue;

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

      if (bankTemplate === 'vcb') {
        // VCB template layout mapping:
        // Col A: STT, Col B: Ref, Col C: Account, Col D: CMND, Col E: Issued Date, Col F: Issued Place, Col G: Name, Col H: Address, Col I: Bank, Col J: Amount, Col K: Currency, Col L: Content
        const col0IsNum = !isNaN(Number(row[0])) && String(row[0]).trim() !== '';
        if (col0IsNum && row.length >= 10) {
          refNo = String(row[1] || '').trim();
          accountNo = String(row[2] || '').trim();
          idNo = String(row[3] || '').trim();
          issuedDate = String(row[4] || '').trim();
          issuedPlace = String(row[5] || '').trim();
          name = String(row[6] || '').trim();
          address = String(row[7] || '').trim();
          bankCodeName = resolveVcbBankName(String(row[8] || ''));
          amount = Math.round(Number(String(row[9] || '').replace(/[^0-9.-]+/g, '')) || 0);
          memo = String(row[11] || '').trim();
        } else {
          name = String(row[0] || '').trim();
          accountNo = String(row[1] || '').trim();
          amount = Math.round(Number(String(row[2] || '').replace(/[^0-9.-]+/g, '')) || 0);
          memo = String(row[3] || '').trim();
        }
      } else {
        // VIB template layout
        const col0IsNum = !isNaN(Number(row[0])) && String(row[0]).trim() !== '';
        if (col0IsNum && row.length >= 6) {
          name = String(row[1] || '').trim();
          accountNo = String(row[2] || '').trim();
          amount = Math.round(Number(String(row[3] || '').replace(/[^0-9.-]+/g, '')) || 0);
          memo = String(row[4] || '').trim();
          bankCodeName = resolveVibBankName(String(row[5] || ''));
        } else {
          name = String(row[0] || '').trim();
          accountNo = String(row[1] || '').trim();
          amount = Math.round(Number(String(row[2] || '').replace(/[^0-9.-]+/g, '')) || 0);
          memo = String(row[3] || '').trim();
          bankCodeName = resolveVibBankName(String(row[4] || ''));
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
      const amount = Math.round(Number(cleanRow[2].replace(/[^0-9.-]+/g, '')) || 0);
      
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

    // Capitalize name if VCB
    if (bankTemplate === 'vcb') {
      activeEmployeeEdit.name = normalizeVietnameseName(activeEmployeeEdit.name);
      activeEmployeeEdit.memo = activeEmployeeEdit.memo.toUpperCase();
    }

    const validated = validateRecord(activeEmployeeEdit, bankTemplate);
    const updated: TransferEmployee = {
      ...activeEmployeeEdit,
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
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Đã xuất file chuyển tiền MyVIB thành công!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Lỗi xuất file Excel: ${err.message}`, 'error');
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
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Đã xuất file chuyển tiền Vietcombank thành công! (Tải tệp .xlsx, tự đổi đuôi thành .xls nếu cổng VCB yêu cầu định dạng cũ)', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Lỗi xuất file Vietcombank: ${err.message}`, 'error');
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

  // Normalize all names to uppercase non-accented
  const handleNormalizeAllNames = () => {
    if (employees.length === 0) {
      showToast('Chưa có nhân viên nào trong danh sách để chuẩn hóa.', 'info');
      return;
    }
    const updated = employees.map(emp => {
      const normalizedName = normalizeVietnameseName(emp.name);
      const updatedEmp = { ...emp, name: normalizedName };
      const validation = validateRecord(updatedEmp);
      return {
        ...updatedEmp,
        isValid: validation.isValid,
        errors: validation.errors
      };
    });
    setEmployees(updated);
    showToast(`Đã tự động chuẩn hóa ${updated.length} tên nhân viên sang IN HOA KHÔNG DẤU!`, 'success');
  };

  return (
    <div className="transfer-file-tool">
      
      {/* HEADER SECTION */}
      <PageHeader
        icon={<FileSpreadsheet size={26} />}
        title="Tạo File Chuyển Tiền Hàng Loạt"
        subtitle="Tạo file chuyển tiền hàng loạt theo đúng khuôn mẫu chuẩn của các ngân hàng (MyVIB, Vietcombank)"
        badgeText="Chuyển khoản"
        badgeVariant="info"
        actions={
          <button 
            className="primary" 
            onClick={handleExportClick}
            disabled={employees.length === 0 || stats.invalidCount > 0 || isExporting}
            style={{ height: '40px', padding: '0 20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isExporting ? <RefreshCw className="spinner" size={16} /> : <Download size={16} />}
            <span>Tải File Chuyển Tiền</span>
          </button>
        }
      />

      {/* BANK TEMPLATE SELECTOR TABS */}
      <div className="card panel" style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
          <button 
            type="button" 
            onClick={() => setBankTemplate('vib')}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px', 
              borderRadius: '10px', 
              background: bankTemplate === 'vib' 
                ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.25), rgba(3, 105, 161, 0.35))' 
                : 'rgba(255,255,255,0.02)',
              border: bankTemplate === 'vib' ? '1.5px solid #0284c7' : '1px solid rgba(255,255,255,0.07)',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              boxShadow: bankTemplate === 'vib' ? '0 4px 16px rgba(2, 132, 199, 0.2)' : 'none'
            }}
          >
            <div style={{ fontSize: '24px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2, 132, 199, 0.2)', borderRadius: '8px' }}>
              🏦
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Mẫu MyVIB 2.0 (iVIB)</span>
                {bankTemplate === 'vib' && <span className="badge badge-info" style={{ fontSize: '10px', padding: '2px 6px' }}>Đang chọn</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Chuẩn hóa STK text, chi lương lô VIB Doanh Nghiệp
              </div>
            </div>
          </button>

          <button 
            type="button" 
            onClick={() => setBankTemplate('vcb')}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px', 
              borderRadius: '10px', 
              background: bankTemplate === 'vcb' 
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.35))' 
                : 'rgba(255,255,255,0.02)',
              border: bankTemplate === 'vcb' ? '1.5px solid #10b981' : '1px solid rgba(255,255,255,0.07)',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              boxShadow: bankTemplate === 'vcb' ? '0 4px 16px rgba(16, 185, 129, 0.2)' : 'none'
            }}
          >
            <div style={{ fontSize: '24px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '8px' }}>
              💚
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Mẫu Vietcombank (A222)</span>
                {bankTemplate === 'vcb' && <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>Đang chọn</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Bắt buộc IN HOA KHÔNG DẤU, mã liên ngân hàng VCB
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* STAT CARDS SECTION */}
      <div className="kpis" style={{ marginBottom: '1.5rem' }}>
        <StatCard 
          icon={<FileSpreadsheet size={18} />} 
          label="Tổng tiền chuyển" 
          value={`${stats.totalAmount.toLocaleString('vi-VN')} đ`} 
          subtext={`Chuyển khoản cho ${stats.total} dòng nhân viên`}
          hasData={employees.length > 0} 
        />
        <StatCard 
          icon={<CheckCircle size={18} />} 
          label="Người thụ hưởng hợp lệ" 
          value={`${stats.validCount} / ${stats.total}`} 
          subtext={`Đạt chuẩn mẫu ${bankTemplate.toUpperCase()}`}
          hasData={employees.length > 0} 
        />
        <StatCard 
          icon={<AlertTriangle size={18} />} 
          label="Số dòng bị lỗi" 
          value={`${stats.invalidCount} dòng`} 
          subtext="Cần chỉnh sửa ngay"
          hasData={employees.length > 0}
          accentColor={stats.invalidCount > 0 ? 'var(--red)' : 'var(--green)'}
        />
      </div>

      {/* INSTRUCTIONS PANEL */}
      {bankTemplate === 'vib' ? (
        <GuidePanel 
          title="File Chuyển Tiền MyVIB 2.0"
          purpose="Module hỗ trợ kết hợp bảng tính lương, tự động phân tích và chuyển định dạng số tài khoản/ngân hàng thành định dạng bảng nạp tiền chuẩn của Ngân hàng Quốc tế VIB."
          steps={[
            "Bấm 'Lấy từ Phiếu Lương' để tự động nạp danh sách thực nhận và đối chiếu tài khoản đã lưu, hoặc bấm 'Import Excel/CSV' để tải danh sách khác.",
            "Kiểm tra cột 'Trạng thái' trong bảng. Bất kỳ dòng nào báo đỏ (Thiếu thông tin hoặc Ngân hàng không khớp mẫu VIB) cần được cập nhật.",
            "Nhấp 'Tải File Chuyển Tiền' để xuất tệp Excel nạp vào cổng ngân hàng VIB."
          ]}
          notes={[
            "Số tài khoản nhận luôn được lưu dưới dạng text để không làm mất số 0 ở đầu (ví dụ: '0200...').",
            "Ký tự đặc biệt cho phép trong Tên và Nội dung bao gồm: , . - + ( ) : _ & ?"
          ]}
          errors={[
            "Mã lỗi 'Ngân hàng không khớp danh mục': VIB yêu cầu điền đúng chuỗi dạng 'Mã - Tên ngắn' (ví dụ: '203 - Vietcombank'). Hãy nhấp vào ô ngân hàng bị lỗi và chọn lại từ Bank Selector."
          ]}
        />
      ) : (
        <GuidePanel 
          title="File Chuyển Tiền Vietcombank A222"
          purpose="Tự động chuẩn hóa toàn bộ họ tên thụ hưởng sang chữ IN HOA KHÔNG DẤU, map mã ngân hàng interbank (ACB, MB, VIB...) theo định dạng Vietcombank yêu cầu và xuất tệp Excel nạp cổng."
          steps={[
            "Nạp danh sách nhân viên từ Phiếu Lương hoặc tệp CSV/Excel.",
            "Tất cả họ tên sẽ được chuẩn hóa sang định dạng IN HOA KHÔNG DẤU (ví dụ: 'DAO MINH TRI') tự động khi ghi file.",
            "Kiểm tra cột lỗi và sử dụng Bank Selector của Vietcombank để chọn đúng format (ví dụ: '(ACB) Á Châu').",
            "Bấm 'Tải File Chuyển Tiền' để download tệp tin mẫu đã được điền đầy đủ."
          ]}
          notes={[
            "Định dạng xuất file là .xlsx. Nếu cổng Vietcombank yêu cầu file .xls nhị phân nguyên bản, bạn hãy đổi tên đuôi file hoặc mở bằng Excel và lưu lại dạng Excel 97-2003 (.xls).",
            "Cột 'ten nguoi huong' (tên người hưởng) bắt buộc là chữ viết hoa không có dấu."
          ]}
          errors={[
            "Lỗi 'Ngân hàng không khớp danh mục VCB': Yêu cầu đúng chuỗi dạng '(ShortName) FullName' (ví dụ: '(MB) Quân Đội'). Hãy nhấp ô ngân hàng và chỉnh lại."
          ]}
        />
      )}

      {/* OPERATIONS & ACTION BUTTONS PANEL */}
      <div className="card panel" style={{ marginBottom: '1.5rem', background: 'var(--panel-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', margin: 0 }}>
            <span>🛠️ Thao Tác Xử Lý Dữ Liệu</span>
            <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--muted)' }}>
              ({employees.length} nhân viên)
            </span>
          </h2>
          {employees.length > 0 && (
            <button 
              type="button"
              className="btn-ghost" 
              onClick={handleClearAll}
              style={{ color: '#f87171', fontSize: '12px', padding: '4px 10px', height: '28px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Xóa toàn bộ danh sách để nạp lại"
            >
              <Trash2 size={14} />
              <span>Xóa tất cả</span>
            </button>
          )}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
          {/* Nhóm 1: Nạp nguồn */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>BƯỚC 1: NẠP DỮ LIỆU ĐẦU VÀO</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button 
                type="button"
                className="primary" 
                onClick={handleLoadFromPayroll} 
                style={{ 
                  flex: '1 1 auto',
                  minWidth: '150px',
                  background: bankTemplate === 'vib' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'linear-gradient(135deg, #10b981, #059669)',
                  height: '38px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Sparkles size={16} />
                <span>Lấy từ Phiếu Lương</span>
              </button>

              <button 
                type="button"
                className="btn-outline" 
                onClick={handleTriggerFileInput} 
                disabled={isImporting}
                style={{ height: '38px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isImporting ? <RefreshCw className="spinner" size={15} /> : <Upload size={15} />}
                <span>Import Excel/CSV</span>
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
                style={{ height: '38px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ClipboardCheck size={15} />
                <span>Dán dữ liệu</span>
              </button>
            </div>
          </div>

          {/* Nhóm 2: Tinh chỉnh & Chuẩn hóa */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>BƯỚC 2: CHUẨN HÓA & TINH CHỈNH</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button 
                type="button"
                className="btn-outline" 
                onClick={handleNormalizeAllNames}
                disabled={employees.length === 0}
                title="Chuẩn hóa toàn bộ họ tên thụ hưởng sang IN HOA KHÔNG DẤU (Khuyến nghị cho cổng Vietcombank & VIB)"
                style={{ 
                  flex: '1 1 auto',
                  height: '38px', 
                  fontSize: '12px',
                  fontWeight: 600,
                  borderColor: 'rgba(234, 179, 8, 0.4)', 
                  background: 'rgba(234, 179, 8, 0.08)',
                  color: '#fef08a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Sparkles size={15} style={{ color: 'var(--gold)' }} />
                <span>Chuẩn hóa Tên (IN HOA)</span>
              </button>

              <button 
                type="button"
                className="btn-outline" 
                onClick={handleBulkFillMissingBank}
                disabled={employees.length === 0}
                title="Gán nhanh ngân hàng mặc định (Vietcombank) cho các dòng đang bị trống ngân hàng"
                style={{ height: '38px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle size={15} style={{ color: 'var(--green)' }} />
                <span>Gán NH dòng trống</span>
              </button>

              <button 
                type="button"
                className="btn-outline" 
                onClick={handleAddManualRow}
                style={{ height: '38px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} />
                <span>Thêm nhân viên</span>
              </button>
            </div>
          </div>
        </div>

        {/* MEMO CONFIGURATION ROW */}
        <div className="form-group" style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Nội dung chuyển khoản mặc định ({bankTemplate === 'vib' ? 'MyVIB' : 'Vietcombank'})</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Các biến hỗ trợ: &#123;ten_nhan_vien&#125;, &#123;thang_luong&#125;, &#123;bo_phan&#125;</span>
          </label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder={bankTemplate === 'vib' ? "VD: KINGS GRILL thanh toan luong {ten_nhan_vien} {thang_luong}" : "VD: KG LUONG NV T{thang_luong}"}
              value={bankTemplate === 'vib' ? defaultMemoTemplate : vcbMemoTemplate}
              onChange={e => {
                if (bankTemplate === 'vib') {
                  setDefaultMemoTemplate(e.target.value);
                } else {
                  setVcbMemoTemplate(e.target.value);
                }
              }}
              style={{ flexGrow: 1 }}
            />
            <button 
              className="btn-outline"
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
              Áp dụng tất cả
            </button>
          </div>
        </div>
      </div>

      {/* TECHNICAL WARNING FOR VIETCOMBANK */}
      {bankTemplate === 'vcb' && (
        <div className="card panel" style={{ marginBottom: '1.5rem', background: 'rgba(2, 132, 199, 0.05)', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={16} />
            <span>Thông báo định dạng Vietcombank (.xls / .xlsx)</span>
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.45 }}>
            Do giới hạn kỹ thuật phía client, file xuất ra từ webapp sẽ có định dạng hiện đại **.xlsx**. Nếu trang tải file của Vietcombank báo lỗi hoặc từ chối do bắt buộc định dạng **.xls** cũ, bạn chỉ cần mở file đã tải bằng ứng dụng Excel trên máy tính, bấm **File &rarr; Save As** và chọn lưu lại dưới định dạng **Excel 97-2003 Workbook (*.xls)** là có thể upload bình thường.
          </p>
        </div>
      )}

      {/* DATA VALIDATION & ERROR REPORT PANEL */}
      {stats.invalidCount > 0 && (
        <div className="card panel" style={{ marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>Phát hiện {stats.invalidCount} lỗi dữ liệu chuyển khoản</span>
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.4 }}>
            Vui lòng kiểm tra các dòng bị lỗi đỏ dưới đây và cập nhật lại thông tin tài khoản, hoặc sửa ngân hàng tương ứng để đạt điều kiện xuất file.
          </p>
        </div>
      )}

      {/* TABLE VIEW OF ENTRIES */}
      <div className="card panel" style={{ padding: '1rem 0', background: 'var(--panel-bg)', overflow: 'visible' }}>
        <div style={{ padding: '0 1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>📋 Preview danh sách xuất file ({filteredEmployees.length}/{employees.length})</h2>
            <span style={{ fontSize: '0.78rem', opacity: 0.6, fontStyle: 'italic' }}>
              * Ghi từ hàng {bankTemplate === 'vib' ? '5' : '2'} của Sheet
            </span>
          </div>

          {employees.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '210px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input
                  type="text"
                  placeholder="Tìm tên, số TK, ngân hàng..."
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  style={{ height: '32px', fontSize: '12px', paddingLeft: '30px', paddingRight: '24px' }}
                />
                {tableSearch && (
                  <button
                    type="button"
                    onClick={() => setTableSearch('')}
                    style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className={`filter-tag ${tableFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTableFilter('all')}
                  style={{ padding: '4px 10px', fontSize: '11.5px' }}
                >
                  Tất cả ({stats.total})
                </button>
                <button
                  type="button"
                  className={`filter-tag ${tableFilter === 'valid' ? 'active' : ''}`}
                  onClick={() => setTableFilter('valid')}
                  style={{ padding: '4px 10px', fontSize: '11.5px' }}
                >
                  ✅ Hợp lệ ({stats.validCount})
                </button>
                <button
                  type="button"
                  className={`filter-tag ${tableFilter === 'invalid' ? 'active' : ''}`}
                  onClick={() => setTableFilter('invalid')}
                  style={{ padding: '4px 10px', fontSize: '11.5px' }}
                >
                  ⚠️ Cần sửa ({stats.invalidCount})
                </button>
              </div>
            </div>
          )}
        </div>

        {employees.length === 0 ? (
          <EmptyState 
            icon={<FileSpreadsheet size={32} />}
            title="Chưa có dữ liệu chuyển tiền"
            description="Hãy nạp dữ liệu từ module Phiếu Lương hiện tại hoặc import file excel để bắt đầu tạo hồ sơ chuyển khoản."
            actionLabel="Lấy từ Phiếu Lương"
            onAction={handleLoadFromPayroll}
          />
        ) : isMobileScreen ? (
          /* Mobile Card list view */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem' }}>
            {filteredEmployees.map((emp, idx) => {
              const hasSelector = showBankSelectorForId === emp.id;

              return (
                <div 
                  key={emp.id} 
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.01)', 
                    border: '1px solid rgba(255, 255, 255, 0.05)', 
                    borderRadius: '12px', 
                    padding: '1rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.75rem',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>#{idx + 1}</span>
                    {emp.isValid ? (
                      <span style={{ color: 'var(--green)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: '12px' }}>
                        <CheckCircle size={10} /> Hợp lệ
                      </span>
                    ) : (
                      <span 
                        title={emp.errors.join('\n')}
                        style={{ color: 'var(--red)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.08)', padding: '2px 8px', borderRadius: '12px' }}
                      >
                        <XCircle size={10} /> Lỗi
                      </span>
                    )}
                  </div>

                  <div>
                    {bankTemplate === 'vcb' ? (
                      <>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{normalizeVietnameseName(emp.name)}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', fontStyle: 'italic' }}>Tên gốc: {emp.name}</span>
                      </>
                    ) : (
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{emp.name}</h4>
                    )}
                    {emp.source === 'payroll' && (
                      <span className="badge" style={{ display: 'inline-block', fontSize: '9px', padding: '1px 4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--green)', borderRadius: '4px', marginTop: '2px' }}>
                        Phiếu lương
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem' }}>Số tài khoản:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{emp.accountNo || <span style={{ color: 'var(--red)', fontStyle: 'italic' }}>Trống</span>}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem' }}>Số tiền:</span>
                      <span style={{ fontWeight: 700, color: 'var(--cyan)' }}>{emp.amount.toLocaleString('vi-VN')} đ</span>
                    </div>
                  </div>

                  {bankTemplate === 'vcb' && (emp.idNo || emp.refNo) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px' }}>
                      {emp.idNo && (
                        <div>
                          <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem' }}>CMND/CCCD:</span>
                          <span>{emp.idNo}</span>
                        </div>
                      )}
                      {emp.refNo && (
                        <div>
                          <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem' }}>Số Ref:</span>
                          <span>{emp.refNo}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: '0.85rem' }}>
                    <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem' }}>Ngân hàng nhận:</span>
                    <div 
                      onClick={() => {
                        setShowBankSelectorForId(emp.id);
                        setBankSearchQuery('');
                      }}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '6px 10px', 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        marginTop: '4px'
                      }}
                    >
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {emp.bankCodeName || <span style={{ color: 'var(--red)', fontStyle: 'italic' }}>Chưa chọn ngân hàng</span>}
                      </span>
                      <ChevronDown size={14} style={{ opacity: 0.5 }} />
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
                          borderRadius: '8px',
                          padding: '8px',
                          maxHeight: '200px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '4px 8px' }}>
                          <Search size={12} style={{ opacity: 0.5 }} />
                          <input 
                            type="text" 
                            placeholder="Tìm ngân hàng..."
                            value={bankSearchQuery}
                            onChange={e => setBankSearchQuery(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', fontSize: '0.75rem', outline: 'none' }}
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
                                color: 'white', 
                                fontSize: '0.7rem',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              <strong>{bank.codeName}</strong> - <span style={{ opacity: 0.7 }}>{bank.fullName}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '0.85rem' }}>
                    <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem' }}>Nội dung chuyển:</span>
                    <span style={{ color: 'var(--text-muted)' }}>{emp.memo}</span>
                  </div>

                  {!emp.isValid && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '6px', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--red)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {emp.errors.map((err, errIdx) => (
                        <span key={errIdx}>• {err}</span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button 
                      className="btn-outline" 
                      onClick={() => handleEditRowClick(emp)}
                      style={{ flexGrow: 1, fontSize: '0.8rem', padding: '6px', height: '32px' }}
                    >
                      Sửa
                    </button>
                    <button 
                      className="btn-outline" 
                      onClick={() => handleDeleteRow(emp.id)}
                      style={{ flexGrow: 1, fontSize: '0.8rem', padding: '6px', height: '32px', color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    >
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
            <table className="emp-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', width: '50px' }}>STT</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Người nhận (Gốc)</th>
                  {bankTemplate === 'vcb' && <th style={{ padding: '12px 16px', textAlign: 'left' }}>Tên xuất file (IN HOA)</th>}
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Số tài khoản</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Số tiền</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nội dung</th>
                  {bankTemplate === 'vcb' && <th style={{ padding: '12px 16px', textAlign: 'left' }}>CMND</th>}
                  {bankTemplate === 'vcb' && <th style={{ padding: '12px 16px', textAlign: 'left' }}>Ref</th>}
                  <th style={{ padding: '12px 16px', textAlign: 'left', width: '220px' }}>Ngân hàng xuất</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: '100px' }}>Trạng thái</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', width: '90px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, idx) => {
                  const hasSelector = showBankSelectorForId === emp.id;
                  
                  return (
                    <tr key={emp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: emp.isValid ? 'transparent' : 'rgba(239, 68, 68, 0.02)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{idx + 1}</td>
                      
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                        <input
                          type="text"
                          value={emp.name}
                          onChange={e => handleInlineFieldChange(emp.id, 'name', e.target.value)}
                          style={{
                            height: '32px',
                            fontWeight: 600,
                            fontSize: '0.84rem',
                            minWidth: '145px'
                          }}
                        />
                        {emp.source === 'payroll' && <span className="badge" style={{ display: 'inline-block', fontSize: '10px', padding: '1px 4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--green)', borderRadius: '4px', marginTop: '2px' }}>Phiếu lương</span>}
                      </td>

                      {bankTemplate === 'vcb' && (
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--cyan)' }}>
                          {normalizeVietnameseName(emp.name)}
                        </td>
                      )}

                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          value={emp.accountNo}
                          placeholder="Nhập số TK..."
                          onChange={e => handleInlineFieldChange(emp.id, 'accountNo', e.target.value)}
                          style={{
                            height: '32px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            borderColor: !emp.accountNo ? 'rgba(239, 68, 68, 0.45)' : 'var(--border)',
                            minWidth: '135px'
                          }}
                        />
                      </td>

                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <input
                          type="text"
                          value={emp.amount ? emp.amount.toLocaleString('vi-VN') : ''}
                          placeholder="0"
                          onChange={e => handleInlineFieldChange(emp.id, 'amount', e.target.value)}
                          style={{
                            height: '32px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            fontSize: '0.84rem',
                            minWidth: '115px'
                          }}
                        />
                      </td>

                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          value={emp.memo}
                          onChange={e => handleInlineFieldChange(emp.id, 'memo', e.target.value)}
                          style={{
                            height: '32px',
                            fontSize: '0.8rem',
                            color: 'var(--text)',
                            minWidth: '170px'
                          }}
                        />
                      </td>

                      {bankTemplate === 'vcb' && (
                        <>
                          <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{emp.idNo || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{emp.refNo || '-'}</td>
                        </>
                      )}

                      {/* Bank selection dropdown */}
                      <td style={{ padding: '12px 16px', position: 'relative' }}>
                        <div 
                          className={`form-control select-trigger ${!emp.bankCodeName ? 'error' : ''}`}
                          onClick={() => {
                            setShowBankSelectorForId(emp.id);
                            setBankSearchQuery('');
                          }}
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '6px 10px', 
                            background: 'rgba(255,255,255,0.02)', 
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {emp.bankCodeName || <span style={{ color: 'var(--red)', fontStyle: 'italic' }}>Chưa chọn ngân hàng</span>}
                          </span>
                          <ChevronDown size={14} style={{ opacity: 0.5 }} />
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
                              background: '#111827', 
                              border: '1px solid var(--glass-border)', 
                              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
                              borderRadius: '8px',
                              padding: '8px',
                              maxHeight: '280px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '4px 8px' }}>
                              <Search size={14} style={{ opacity: 0.5 }} />
                              <input 
                                type="text" 
                                placeholder="Tìm mã hoặc tên..."
                                value={bankSearchQuery}
                                onChange={e => setBankSearchQuery(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', fontSize: '0.8rem', outline: 'none' }}
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
                                    padding: '6px 8px', 
                                    background: 'transparent', 
                                    border: 'none', 
                                    color: 'var(--text)', 
                                    fontSize: '0.75rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <strong>{bank.codeName}</strong> - <span style={{ opacity: 0.7 }}>{bank.fullName}</span>
                                </button>
                              ))}
                              {filteredBanks.length === 0 && (
                                <span style={{ fontSize: '0.75rem', opacity: 0.5, textAlign: 'center', display: 'block', padding: '8px' }}>Không tìm thấy ngân hàng.</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {emp.isValid ? (
                          <span style={{ color: 'var(--green)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: '12px' }}>
                            <CheckCircle size={12} /> Hợp lệ
                          </span>
                        ) : (
                          <span 
                            title={emp.errors.join('\n')}
                            style={{ color: 'var(--red)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.08)', padding: '2px 8px', borderRadius: '12px', cursor: 'help' }}
                          >
                            <XCircle size={12} /> Bị lỗi
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            className="btn-outline" 
                            onClick={() => handleEditRowClick(emp)}
                            style={{ padding: '4px 8px', minWidth: '0', fontSize: '11px', height: '28px' }}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            className="btn-outline" 
                            onClick={() => handleDeleteRow(emp.id)}
                            style={{ padding: '4px 8px', minWidth: '0', fontSize: '11px', height: '28px', color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                          >
                            <Trash2 size={12} />
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
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card panel modal-box" style={{ maxWidth: '640px', width: '100%', padding: '1.5rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📋 Dán dữ liệu hàng loạt</span>
              <button onClick={() => setShowBulkModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
              Dán các cột dữ liệu phân cách bằng phím Tab (copy từ Excel) theo định dạng thứ tự: <br />
              <strong style={{ color: 'var(--cyan)' }}>Tên nhân viên | Số tài khoản | Số tiền chuyển | Nội dung (tùy chọn) | Ngân hàng (tùy chọn)</strong>
            </p>

            <textarea 
              className="form-control"
              placeholder="VD: Nguyen Van A	0000000001	100000	Thanh toan luong	(ACB) Á Châu"
              style={{ width: '100%', height: '200px', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '1rem', background: 'var(--surface-input)', color: 'var(--text)' }}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-outline" onClick={() => setShowBulkModal(false)}>Hủy bỏ</button>
              <button className="primary" onClick={handleBulkPasteSave} disabled={!bulkText.trim()}>Nạp dữ liệu</button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL FOR ADD/EDIT EMPLOYEE */}
      {activeEmployeeEdit && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card panel modal-box" style={{ maxWidth: '480px', width: '100%', padding: '1.5rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', overflow: 'visible' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{isAdding ? '➕ Thêm nhân viên chuyển tiền' : '✏️ Sửa thông tin nhân viên'}</span>
              <button onClick={() => setActiveEmployeeEdit(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
              <div className="form-group">
                <label className="form-label">Họ và tên người nhận</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={activeEmployeeEdit.name}
                  onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, name: e.target.value }))}
                />
                {bankTemplate === 'vcb' && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--cyan)' }}>
                    Sẽ xuất file: {normalizeVietnameseName(activeEmployeeEdit.name)}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Số tài khoản nhận</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={activeEmployeeEdit.accountNo}
                  onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, accountNo: e.target.value.replace(/\s+/g, '') }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Số tiền chuyển (đ)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={activeEmployeeEdit.amount || ''}
                  onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, amount: Number(e.target.value) || 0 }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nội dung chuyển khoản</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={activeEmployeeEdit.memo}
                  onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, memo: bankTemplate === 'vcb' ? e.target.value.toUpperCase() : e.target.value }))}
                />
              </div>

              {/* Extra VCB columns in modal */}
              {bankTemplate === 'vcb' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Số CMND/CCCD (D)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={activeEmployeeEdit.idNo || ''}
                      onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, idNo: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ngày cấp (E)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={activeEmployeeEdit.issuedDate || ''}
                      placeholder="VD: 15/06/2020"
                      onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, issuedDate: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nơi cấp (F)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={activeEmployeeEdit.issuedPlace || ''}
                      placeholder="VD: CA HA NOI"
                      onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, issuedPlace: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số Ref (B)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={activeEmployeeEdit.refNo || ''}
                      onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, refNo: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Địa chỉ người thụ hưởng (H)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={activeEmployeeEdit.address || ''}
                      onChange={e => setActiveEmployeeEdit(prev => ({ ...prev!, address: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Bank selector */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Ngân hàng nhận</label>
                <div 
                  className="form-control select-trigger"
                  onClick={() => {
                    setShowBankSelectorForId('active-edit');
                    setBankSearchQuery('');
                  }}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer'
                  }}
                >
                  <span>{activeEmployeeEdit.bankCodeName || 'Chọn ngân hàng...'}</span>
                  <ChevronDown size={16} />
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
                      background: '#111827', 
                      border: '1px solid var(--glass-border)', 
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
                      borderRadius: '8px',
                      padding: '8px',
                      maxHeight: '220px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '4px 8px' }}>
                      <Search size={14} style={{ opacity: 0.5 }} />
                      <input 
                        type="text" 
                        placeholder="Tìm mã hoặc tên..."
                        value={bankSearchQuery}
                        onChange={e => setBankSearchQuery(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', fontSize: '0.8rem', outline: 'none' }}
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
                            padding: '6px 8px', 
                            background: 'transparent', 
                            border: 'none', 
                            color: 'var(--text)', 
                            fontSize: '0.75rem',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <strong>{bank.codeName}</strong> - <span style={{ opacity: 0.7 }}>{bank.fullName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn-outline" onClick={() => setActiveEmployeeEdit(null)}>Hủy</button>
              <button className="primary" onClick={handleSaveActiveEdit}>Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
