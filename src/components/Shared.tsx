import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, AlertCircle, RefreshCw } from 'lucide-react';

// 1. STAT CARD COMPONENT
interface StatCardProps {
  icon: string | React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  hasData?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtext, hasData = true }) => {
  return (
    <div className={`kpi ${!hasData ? 'empty' : ''}`}>
      <div className="icon">{icon}</div>
      <div>
        {label}
        <b>{hasData ? value : 'Chưa có dữ liệu'}</b>
        <span>{subtext || (hasData ? 'Hoạt động' : 'Đang chờ dữ liệu')}</span>
      </div>
    </div>
  );
};

// 2. EMPTY STATE COMPONENT
interface EmptyStateProps {
  icon: string | React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, actionLabel, onAction, style }) => {
  return (
    <div className="card upload empty-state-card" style={{ height: 'auto', padding: '3rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--glass-border)', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', ...style }}>
      <div className="upload-content" style={{ maxWidth: '450px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div className="file-icon" style={{ fontSize: '2.5rem', width: '70px', height: '70px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(22, 119, 255, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan)', border: '1px solid rgba(34, 211, 238, 0.3)', marginBottom: '0.5rem' }}>
          {icon}
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{description}</p>
        {actionLabel && onAction && (
          <button className="primary" onClick={onAction} style={{ minWidth: '180px', height: '44px', marginTop: '1rem' }}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

// 3. GUIDE PANEL COMPONENT
interface GuidePanelProps {
  title: string;
  purpose: string;
  steps: string[];
  notes: string[];
  errors: string[];
}

export const GuidePanel: React.FC<GuidePanelProps> = ({ title, purpose, steps, notes, errors }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`card guide-panel-container ${isOpen ? 'open' : ''}`} style={{ marginBottom: '1.5rem', background: 'rgba(11, 22, 51, 0.6)', border: '1px solid var(--glass-border)' }}>
      <div 
        className="guide-header" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan)', fontWeight: 600 }}>
          <HelpCircle size={18} />
          <span>Hướng dẫn sử dụng: {title}</span>
        </div>
        <div style={{ color: 'var(--muted)' }}>
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {isOpen && (
        <div className="guide-body" style={{ padding: '0 1.25rem 1.25rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
          <div>
            <strong style={{ color: 'var(--cyan)', display: 'block', marginBottom: '4px' }}>🎯 Mục đích:</strong>
            <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>{purpose}</p>
          </div>

          <div>
            <strong style={{ color: 'var(--cyan)', display: 'block', marginBottom: '6px' }}>📋 Các bước thực hiện:</strong>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {steps.map((step, idx) => (
                <li key={idx} style={{ lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{ background: 'rgba(48, 231, 151, 0.04)', border: '1px solid rgba(48, 231, 151, 0.15)', borderRadius: '8px', padding: '0.75rem' }}>
              <strong style={{ color: 'var(--green)', display: 'block', marginBottom: '4px' }}>💡 Lưu ý quan trọng:</strong>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                {notes.map((note, idx) => (
                  <li key={idx} style={{ lineHeight: 1.4 }}>{note}</li>
                ))}
              </ul>
            </div>

            <div style={{ background: 'rgba(255, 92, 122, 0.04)', border: '1px solid rgba(255, 92, 122, 0.15)', borderRadius: '8px', padding: '0.75rem' }}>
              <strong style={{ color: 'var(--red)', display: 'block', marginBottom: '4px' }}>⚠️ Lỗi thường gặp & Cách xử lý:</strong>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                {errors.map((err, idx) => (
                  <li key={idx} style={{ lineHeight: 1.4 }}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 4. LOADING STATE COMPONENT
interface LoadingStateProps {
  message?: string;
  style?: React.CSSProperties;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Đang tải dữ liệu...', style }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', gap: '1rem', color: 'var(--muted)', width: '100%', ...style }}>
      <RefreshCw className="spinner" size={32} style={{ color: 'var(--cyan)' }} />
      <span style={{ fontSize: '0.9rem' }}>{message}</span>
    </div>
  );
};

// 5. ERROR STATE COMPONENT
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  style?: React.CSSProperties;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, style }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', gap: '1rem', color: 'var(--red)', textAlign: 'center', width: '100%', border: '1px solid rgba(255, 92, 122, 0.2)', background: 'rgba(255, 92, 122, 0.02)', borderRadius: '12px', ...style }}>
      <AlertCircle size={32} />
      <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{message}</span>
      {onRetry && (
        <button className="primary" onClick={onRetry} style={{ background: 'rgba(255, 92, 122, 0.1)', border: '1px solid var(--red)', color: 'white', height: '38px', padding: '0 1.25rem', boxShadow: 'none' }}>
          Thử lại
        </button>
      )}
    </div>
  );
};
