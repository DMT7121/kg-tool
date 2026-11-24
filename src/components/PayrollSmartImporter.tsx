import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Image as ImageIcon,
  FileText,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  X,
  Loader2,
  Wand2,
  Trash2,
  AlertCircle,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import {
  type PayrollEmployee,
  type PayrollRoundMode,
  type PayrollSalaryMode,
  type ParsedPayrollResult,
  computeDynamicEmployeeTotals,
  parsePayrollExcelFile,
  parseSmartPayrollText,
  normalizeEmployeeSlip
} from '../utils/payrollParser';

interface PayrollSmartImporterProps {
  isOpen: boolean;
  onClose: () => void;
  salaryMode: PayrollSalaryMode;
  standardDays: number;
  roundMode: PayrollRoundMode;
  payMonth: string;
  formatMoney: (n: number) => string;
  onApplyEmployees: (employees: PayrollEmployee[], mode: 'replace' | 'append', detectedMode?: PayrollSalaryMode) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  initialTab?: 'excel' | 'image' | 'text';
  droppedFile?: File | null;
  onClearDroppedFile?: () => void;
}

const SAMPLE_SMART_TEXT = `Nguyễn Minh Anh | Chức vụ: Bếp trưởng | Công: 26 | Lương: 9.000.000 | Tiền cơm +520k | Thưởng KPI +600k | Tăng ca +350k | Tạm ứng -1.000.000
Trần Thu Hà | Chức vụ: Thu ngân | Công: 25.5 | Lương: 7.800.000 | Tiền cơm +510k | Phụ cấp gửi xe +200k | Phạt đi trễ -100k
Lê Hoàng Nam | Chức vụ: Phụ bếp | Công: 24 | Lương: 7.200.000 | Tiền cơm +480k | Đổ bể ly -150k | Đồng phục -200k | Tạm ứng -500k`;

export const PayrollSmartImporter: React.FC<PayrollSmartImporterProps> = ({
  isOpen,
  onClose,
  salaryMode,
  standardDays,
  roundMode,
  payMonth,
  formatMoney,
  onApplyEmployees,
  showToast,
  initialTab = 'excel',
  droppedFile,
  onClearDroppedFile
}) => {
  const [activeTab, setActiveTab] = useState<'excel' | 'image' | 'text'>(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (prevInitialTab !== initialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('replace');

  // Text & OCR state
  const [rawText, setRawText] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isParsingFile, setIsParsingFile] = useState(false);

  // Parsed staging table
  const [stagedResult, setStagedResult] = useState<ParsedPayrollResult | null>(null);
  const [stagedEmployees, setStagedEmployees] = useState<PayrollEmployee[]>([]);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URL on unmount or image change
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const runOcrOnFile = useCallback(async (file: File) => {
    setIsScanningOcr(true);
    setOcrProgress(5);
    try {
      const TesseractMod = await import('tesseract.js');
      const Tesseract = TesseractMod.default ?? TesseractMod;
      const result = await Tesseract.recognize(file, 'vie+eng', {
        logger: (m: { status?: string; progress?: number }) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setOcrProgress(Math.max(10, Math.round(m.progress * 100)));
          }
        }
      });
      const extracted = (result?.data?.text || '').trim();
      setRawText(extracted);
      if (extracted) {
        const parsed = parseSmartPayrollText(extracted, salaryMode, standardDays, roundMode, payMonth, 'image');
        setStagedResult(parsed);
        setStagedEmployees(parsed.employees);
        if (parsed.employees.length > 0) {
          showToast(`OCR đã quét và dựng bảng cấu hình cho ${parsed.employees.length} phiếu lương!`, 'success');
        } else {
          showToast('Đã trích xuất chữ từ ảnh. Bạn có thể chỉnh nhẹ văn bản rồi bấm "Phân tích thành bảng".', 'info');
        }
      } else {
        showToast('Không đọc được chữ rõ từ ảnh. Hãy thử ảnh nét hơn hoặc nhập nhanh cạnh ảnh.', 'info');
      }
    } catch (err) {
      console.error('OCR error:', err);
      showToast('Trình quét OCR cục bộ gặp lỗi tải gói ngôn ngữ. Bạn vẫn có thể xem ảnh bên trái và gõ/dán nội dung bên phải!', 'error');
    } finally {
      setIsScanningOcr(false);
      setOcrProgress(0);
    }
  }, [payMonth, roundMode, salaryMode, showToast, standardDays]);

  const handleImageFile = useCallback((file: File) => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    setImageZoom(1);
    setActiveTab('image');
    void runOcrOnFile(file);
  }, [imagePreviewUrl, runOcrOnFile]);

  const handleExcelFile = useCallback(async (file: File) => {
    setIsParsingFile(true);
    try {
      const parsed = await parsePayrollExcelFile(file, salaryMode, standardDays, roundMode, payMonth);
      setStagedResult(parsed);
      setStagedEmployees(parsed.employees);
      if (parsed.employees.length > 0) {
        showToast(
          `Đã nhận diện ${parsed.employees.length} phiếu lương (${parsed.detectedFormat === 'excel-blocks' ? 'Dạng khối phiếu F&B' : 'Dạng bảng cột động'})!`,
          'success'
        );
      } else {
        showToast(parsed.warnings[0] || 'Không đọc được dòng lương phù hợp trong file.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(`Lỗi đọc file: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsParsingFile(false);
    }
  }, [payMonth, roundMode, salaryMode, showToast, standardDays]);

  // Handle dropped file forwarded from PayrollCreator (async scheduled so no sync setState in effect)
  useEffect(() => {
    if (!droppedFile || !isOpen) return;
    const fileToProcess = droppedFile;
    const timer = window.setTimeout(() => {
      if (fileToProcess.type.startsWith('image/')) {
        handleImageFile(fileToProcess);
      } else {
        setActiveTab('excel');
        void handleExcelFile(fileToProcess);
      }
      onClearDroppedFile?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [droppedFile, isOpen, handleExcelFile, handleImageFile, onClearDroppedFile]);

  // Support Ctrl+V pasting an image directly when importer is open
  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            handleImageFile(blob);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isOpen, handleImageFile]);

  const handleParseTextNow = (source: 'text' | 'image' = 'text') => {
    const parsed = parseSmartPayrollText(rawText, salaryMode, standardDays, roundMode, payMonth, source);
    setStagedResult(parsed);
    setStagedEmployees(parsed.employees);
    if (parsed.employees.length > 0) {
      showToast(`Đã dựng bảng cấu hình cho ${parsed.employees.length} phiếu lương!`, 'success');
    } else {
      showToast(parsed.warnings[0] || 'Chưa nhận diện được nhân viên từ nội dung.', 'info');
    }
  };

  const updateStagedEmp = (id: string, patch: Partial<PayrollEmployee>) => {
    setStagedEmployees(prev => prev.map(emp => {
      if (emp.id !== id) return emp;
      const merged = { ...emp, ...patch };
      return normalizeEmployeeSlip(merged, salaryMode, standardDays, roundMode, { removeZeroRows: false });
    }));
  };

  const removeStagedEmp = (id: string) => {
    setStagedEmployees(prev => prev.filter(e => e.id !== id));
  };

  const handleConfirmApply = () => {
    if (stagedEmployees.length === 0) return;
    const normalizedAll = stagedEmployees.map(emp =>
      normalizeEmployeeSlip(emp, salaryMode, standardDays, roundMode, { removeZeroRows: true })
    );
    const detectedMode: PayrollSalaryMode | undefined =
      stagedResult?.detectedFormat === 'excel-blocks' ? 'restaurant' : undefined;
    onApplyEmployees(normalizedAll, applyMode, detectedMode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="payroll-importer-panel" role="region" aria-label="Nhập dữ liệu đa nguồn tạo bảng cấu hình phiếu lương">
      {/* Importer Header & 3 Source Tabs */}
      <div className="payroll-importer-header">
        <div className="payroll-importer-title-group">
          <span className="payroll-importer-icon">
            <Sparkles size={18} />
          </span>
          <div>
            <h3>Nhập &amp; Dựng Bảng Cấu Hình Phiếu Lương Tự Động</h3>
            <p>Tự động phân tích từ File Excel (.xlsx/.csv), Ảnh chụp phiếu lương (OCR / Ctrl+V) hoặc Nội dung nhập nhanh — giữ nguyên từng khoản cộng/trừ riêng của mỗi nhân viên.</p>
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={onClose} style={{ width: '36px', height: '36px', padding: 0 }} aria-label="Đóng khung nhập">
          <X size={18} />
        </button>
      </div>

      {/* Source Tabs */}
      <div className="payroll-importer-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'excel'}
          className={`payroll-source-tab ${activeTab === 'excel' ? 'active' : ''}`}
          onClick={() => setActiveTab('excel')}
        >
          <FileSpreadsheet size={16} />
          <span>File Excel / CSV (.xlsx, .xls, .csv)</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'image'}
          className={`payroll-source-tab ${activeTab === 'image' ? 'active' : ''}`}
          onClick={() => setActiveTab('image')}
        >
          <ImageIcon size={16} />
          <span>Ảnh phiếu lương (Quét OCR / Dán Ctrl+V)</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'text'}
          className={`payroll-source-tab ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          <FileText size={16} />
          <span>Nhập / Dán nội dung nhanh</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="payroll-importer-body">
        {activeTab === 'excel' && (
          <div className="payroll-dropzone-box">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.tsv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleExcelFile(f);
                if (excelInputRef.current) excelInputRef.current.value = '';
              }}
            />
            <div className="payroll-dropzone-inner" onClick={() => excelInputRef.current?.click()}>
              {isParsingFile ? (
                <>
                  <Loader2 size={28} className="spinner" style={{ color: 'var(--accent-primary)' }} />
                  <strong>Đang đọc cấu trúc file Excel &amp; tách các khoản cộng/trừ...</strong>
                </>
              ) : (
                <>
                  <UploadCloud size={28} style={{ color: 'var(--accent-primary)' }} />
                  <strong>Bấm để chọn File Excel (.xlsx, .xls, .csv) hoặc kéo thả vào màn hình</strong>
                  <span>Hỗ trợ cả <b>Bảng Excel ngang nhiều cột động</b> (Tiền cơm, Thưởng, Phạt, Đổ bể, Tạm ứng...) lẫn <b>Khối phiếu lương F&amp;B</b>.</span>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'image' && (
          <div className="payroll-image-ocr-grid">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageFile(f);
                if (imageInputRef.current) imageInputRef.current.value = '';
              }}
            />

            {/* Left: Image Reference + Upload */}
            <div className="payroll-image-pane">
              <div className="payroll-pane-mini-bar">
                <strong>Ảnh phiếu / bảng lương gốc</strong>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {imagePreviewUrl && (
                    <>
                      <button type="button" className="btn-outline" style={{ height: '30px', padding: '0 8px' }} onClick={() => setImageZoom(z => Math.max(0.75, z - 0.25))} title="Thu nhỏ">
                        <ZoomOut size={14} />
                      </button>
                      <button type="button" className="btn-outline" style={{ height: '30px', padding: '0 8px' }} onClick={() => setImageZoom(z => Math.min(2.25, z + 0.25))} title="Phóng to">
                        <ZoomIn size={14} />
                      </button>
                    </>
                  )}
                  <button type="button" className="primary" style={{ height: '30px', padding: '0 10px', fontSize: '12px' }} onClick={() => imageInputRef.current?.click()}>
                    <UploadCloud size={14} />
                    <span>{imagePreviewUrl ? 'Đổi ảnh' : 'Chọn ảnh'}</span>
                  </button>
                </div>
              </div>

              {imagePreviewUrl ? (
                <div className="payroll-image-viewer">
                  <img
                    src={imagePreviewUrl}
                    alt="Ảnh phiếu lương tham chiếu"
                    style={{ transform: `scale(${imageZoom})`, transformOrigin: 'top left' }}
                  />
                </div>
              ) : (
                <div className="payroll-dropzone-inner compact" onClick={() => imageInputRef.current?.click()}>
                  <ImageIcon size={26} style={{ color: 'var(--accent-primary)' }} />
                  <strong>Chọn ảnh chụp phiếu lương hoặc bấm Ctrl+V để dán ảnh</strong>
                  <span>Hệ thống sẽ tự động quét chữ tiếng Việt (OCR) và dựng bảng cấu hình bên dưới.</span>
                </div>
              )}
            </div>

            {/* Right: OCR Extracted Text (Editable) */}
            <div className="payroll-ocr-text-pane">
              <div className="payroll-pane-mini-bar">
                <strong>
                  {isScanningOcr ? `Đang quét OCR tiếng Việt (${ocrProgress}%)...` : 'Nội dung trích xuất từ ảnh (có thể sửa nhanh)'}
                </strong>
                <button
                  type="button"
                  className="primary"
                  style={{ height: '30px', padding: '0 12px', fontSize: '12px' }}
                  disabled={isScanningOcr || !rawText.trim()}
                  onClick={() => handleParseTextNow('image')}
                >
                  <Wand2 size={14} />
                  <span>Phân tích thành bảng</span>
                </button>
              </div>
              {isScanningOcr && (
                <div className="progress-bar-container" style={{ marginBottom: '6px' }}>
                  <div className="progress-bar-fill" style={{ width: `${ocrProgress}%` }} />
                </div>
              )}
              <textarea
                className="form-control payroll-smart-textarea"
                rows={7}
                placeholder={'Nội dung OCR từ ảnh sẽ hiện ở đây...\nHoặc bạn có thể nhìn ảnh bên trái và gõ/dán nhanh dạng:\nNguyễn Minh Anh | Công: 26 | Lương: 9tr | Thưởng KPI +500k | Đi trễ -100k'}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="payroll-text-import-box">
            <div className="payroll-pane-mini-bar">
              <span>Dán bảng từ Excel/Google Sheets, tin nhắn Zalo hoặc gõ nhanh 1 dòng/nhân viên (hỗ trợ viết tắt <code>9tr</code>, <code>500k</code>, <code>+</code>/<code>-</code>):</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ height: '32px', fontSize: '12px' }}
                  onClick={() => {
                    setRawText(SAMPLE_SMART_TEXT);
                    const parsed = parseSmartPayrollText(SAMPLE_SMART_TEXT, salaryMode, standardDays, roundMode, payMonth, 'text');
                    setStagedResult(parsed);
                    setStagedEmployees(parsed.employees);
                  }}
                >
                  Nạp ví dụ chuẩn
                </button>
                <button
                  type="button"
                  className="primary"
                  style={{ height: '32px', fontSize: '12px' }}
                  disabled={!rawText.trim()}
                  onClick={() => handleParseTextNow('text')}
                >
                  <Wand2 size={14} />
                  <span>Phân tích &amp; Dựng bảng</span>
                </button>
              </div>
            </div>
            <textarea
              className="form-control payroll-smart-textarea"
              rows={6}
              placeholder={SAMPLE_SMART_TEXT}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
          </div>
        )}

        {/* Auto-Generated Staging Table Preview */}
        {stagedEmployees.length > 0 && (
          <div className="payroll-staging-section">
            <div className="payroll-staging-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--status-success)' }} />
                <strong>Bảng cấu hình tự động ({stagedEmployees.length} phiếu lương)</strong>
                {stagedResult?.detectedColumns && stagedResult.detectedColumns.length > 0 && (
                  <span className="payroll-detected-cols">
                    Đã nhận diện: {stagedResult.detectedColumns.slice(0, 6).join(' · ')}
                    {stagedResult.detectedColumns.length > 6 ? ` +${stagedResult.detectedColumns.length - 6} cột` : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="payroll-mode-pills">
                  <button
                    type="button"
                    className={applyMode === 'replace' ? 'active' : ''}
                    onClick={() => setApplyMode('replace')}
                  >
                    Thay danh sách
                  </button>
                  <button
                    type="button"
                    className={applyMode === 'append' ? 'active' : ''}
                    onClick={() => setApplyMode('append')}
                  >
                    Thêm vào danh sách
                  </button>
                </div>
                <button type="button" className="primary" onClick={handleConfirmApply} style={{ height: '36px' }}>
                  <CheckCircle2 size={15} />
                  <span>Áp dụng {stagedEmployees.length} phiếu vào Bảng lương</span>
                </button>
              </div>
            </div>

            <div className="payroll-staging-table-wrap">
              <table className="payroll-staging-table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th style={{ width: '90px', textAlign: 'right' }}>Công/Giờ</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Lương CB</th>
                    <th>Các khoản cộng / trừ riêng trên phiếu</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>Thực nhận</th>
                    <th style={{ width: '44px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {stagedEmployees.map(emp => {
                    const totals = computeDynamicEmployeeTotals(emp, salaryMode, standardDays, roundMode);
                    return (
                      <tr key={emp.id}>
                        <td>
                          <input
                            type="text"
                            className="payroll-inline-cell-input"
                            value={emp.name}
                            onChange={(e) => updateStagedEmp(emp.id, { name: e.target.value })}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.5"
                            className="payroll-inline-cell-input tabular-nums"
                            style={{ textAlign: 'right' }}
                            value={emp.days}
                            onChange={(e) => {
                              const d = Number(e.target.value) || 0;
                              updateStagedEmp(emp.id, { days: d, workedDays: d });
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            className="payroll-inline-cell-input tabular-nums"
                            style={{ textAlign: 'right' }}
                            value={emp.salary}
                            onChange={(e) => updateStagedEmp(emp.id, { salary: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td>
                          <div className="payroll-chip-list">
                            {totals.items.length === 0 ? (
                              <span className="payroll-chip-empty">Chỉ có lương công cơ bản</span>
                            ) : (
                              totals.items.map(it => (
                                <span key={it.id} className={`payroll-item-pill is-${it.type}`}>
                                  {it.label}: {it.type === 'deduct' ? '-' : '+'}{formatMoney(it.amount)}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, color: totals.netPay < 0 ? 'var(--status-danger)' : 'var(--accent-primary)' }}>
                          {formatMoney(totals.netPay)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ width: '32px', height: '32px', padding: 0, color: 'var(--status-danger)' }}
                            onClick={() => removeStagedEmp(emp.id)}
                            title="Bỏ dòng này"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stagedResult && stagedResult.warnings.length > 0 && stagedEmployees.length === 0 && (
          <div className="payroll-importer-warning">
            <AlertCircle size={16} />
            <span>{stagedResult.warnings[0]}</span>
          </div>
        )}
      </div>
    </div>
  );
};
