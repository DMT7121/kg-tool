import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, FileText, Download, Clock, Calendar, ShieldCheck, Loader2 } from 'lucide-react';
import './App.css';
import { parseFile, processRecords, exportToExcel } from './processor';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      // Small artificially delay to show off smooth animation and processing
      await new Promise(r => setTimeout(r, 800));
      const records = await parseFile(file);
      const processed = processRecords(records);
      const blob = await exportToExcel(processed);
      setProcessedBlob(blob);
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra trong quá trình xử lý');
      console.error(err);
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
  };

  const resetState = () => {
    setFile(null);
    setIsSuccess(false);
    setProcessedBlob(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
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
            {errorMsg && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{errorMsg}</p>}
          </div>
        ) : (
          <div className="status-section">
            <div className="file-info">
              <FileText size={32} color="var(--primary-color)" />
              <div>
                <div style={{ fontWeight: 600 }}>{file.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {(file.size / 1024).toFixed(2)} KB
                </div>
              </div>
            </div>

            {errorMsg && <div style={{ color: '#ef4444', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>{errorMsg}</div>}

            {!isSuccess ? (
              <div style={{ display: 'flex', gap: '1rem' }}>
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
              <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '1rem' }}>
                  <CheckCircle size={24} />
                  <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Xử lý hoàn tất!</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn-outline" onClick={resetState}>
                    Xử lý file khác
                  </button>
                  <button className="btn-primary btn-success" onClick={handleDownload}>
                    <Download size={20} />
                    Tải File Kết Quả
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
  );
}

export default App;
