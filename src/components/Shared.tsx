import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, AlertCircle, RefreshCw } from 'lucide-react';

// 1. PAGE HEADER COMPONENT
interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badgeText?: string;
  badgeVariant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  subtitle,
  badgeText,
  badgeVariant = 'info',
  actions
}) => {
  return (
    <div className="module-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.15rem' }}>
      <div className="module-header-left" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <div className="module-header-icon" style={{ width: '42px', height: '42px', borderRadius: '11px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <div className="module-header-title-group">
          <div className="module-header-top-row" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 className="module-header-title" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{title}</h1>
            {badgeText && (
              <Badge variant={badgeVariant}>{badgeText}</Badge>
            )}
          </div>
          <p className="module-header-subtitle" style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>{subtitle}</p>
        </div>
      </div>
      {actions && (
        <div className="module-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  );
};

// 2. BADGE COMPONENT
interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';
  children: React.ReactNode;
  icon?: React.ReactNode;
  dot?: boolean;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'info', children, icon, dot, style }) => {
  const variantColors: Record<string, { bg: string; color: string; border: string }> = {
    success: { bg: 'rgba(34, 197, 94, 0.12)', color: 'var(--green)', border: 'rgba(34, 197, 94, 0.28)' },
    warning: { bg: 'rgba(245, 158, 11, 0.14)', color: 'var(--accent)', border: 'rgba(245, 158, 11, 0.32)' },
    danger: { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--red)', border: 'rgba(239, 68, 68, 0.28)' },
    info: { bg: 'rgba(16, 185, 129, 0.12)', color: 'var(--primary)', border: 'rgba(16, 185, 129, 0.28)' },
    neutral: { bg: 'var(--surface-subtle)', color: 'var(--muted)', border: 'var(--border)' },
    purple: { bg: 'rgba(245, 158, 11, 0.12)', color: 'var(--accent)', border: 'rgba(245, 158, 11, 0.28)' }
  };
  const v = variantColors[variant] || variantColors.info;

  return (
    <span
      className={`ui-badge badge-${variant}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 9px',
        borderRadius: '999px',
        fontSize: '0.72rem',
        fontWeight: 700,
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        ...style
      }}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'currentColor',
            display: 'inline-block'
          }}
        />
      )}
      {icon && <span className="badge-icon" style={{ display: 'inline-flex' }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

// 3. STAT CARD COMPONENT
interface StatCardProps {
  icon: string | React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  hasData?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtext, hasData = true }) => {
  return (
    <div
      className={`kpi stat-card ${hasData ? 'has-data' : 'is-empty empty'}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        padding: '0.9rem 1.05rem',
        background: 'var(--card-bg)',
        border: `1px solid ${hasData ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: '13px',
        boxShadow: 'var(--shadow)'
      }}
    >
      <div
        className="icon"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: hasData ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-subtle)',
          border: `1px solid ${hasData ? 'rgba(16, 185, 129, 0.25)' : 'var(--border)'}`,
          color: hasData ? 'var(--primary)' : 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.15rem',
          flexShrink: 0
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="kpi-label" style={{ fontSize: '0.71rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)' }}>
          {label}
        </div>
        <b className="kpi-value tabular-nums" style={{ display: 'block', fontSize: '1.08rem', fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '1px 0' }}>
          {hasData ? value : 'Chưa có dữ liệu'}
        </b>
        <span className="kpi-subtext" style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {subtext || (hasData ? 'Sẵn sàng' : 'Đang chờ dữ liệu')}
        </span>
      </div>
    </div>
  );
};

// 4. EMPTY STATE COMPONENT
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
    <div className="card upload empty-state-card unified-empty-state" style={style}>
      <div className="upload-content" style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <div className="empty-state-icon">
          {icon}
        </div>
        <h2 className="empty-state-title">{title}</h2>
        <p className="empty-state-desc">{description}</p>
        {actionLabel && onAction && (
          <button className="primary" onClick={onAction} style={{ minWidth: '160px', height: '38px', marginTop: '0.35rem' }}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

// 5. GUIDE PANEL COMPONENT
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
    <div
      className={`card guide-panel-container ${isOpen ? 'open' : ''}`}
      style={{
        marginBottom: '1.1rem',
        padding: 0,
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--primary)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}
    >
      <div
        className="guide-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.7rem 1.1rem',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)', fontWeight: 700, fontSize: '0.83rem' }}>
          <HelpCircle size={16} style={{ color: 'var(--primary)' }} />
          <span>Hướng dẫn vận hành nhanh: {title}</span>
        </div>
        <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 600 }}>
          <span>{isOpen ? 'Thu gọn' : 'Xem quy trình'}</span>
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {isOpen && (
        <div
          className="guide-body"
          style={{
            padding: '0.95rem 1.15rem 1.15rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-subtle)',
            fontSize: '0.82rem',
            color: 'var(--text)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          <div>
            <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '3px', fontSize: '0.8rem' }}>🎯 Mục tiêu nghiệp vụ:</strong>
            <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>{purpose}</p>
          </div>

          <div>
            <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '5px', fontSize: '0.8rem' }}>📋 Thao tác chuẩn:</strong>
            <ol style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {steps.map((step, idx) => (
                <li key={idx} style={{ lineHeight: 1.45 }}>{step}</li>
              ))}
            </ol>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
            <div style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '9px', padding: '0.7rem 0.9rem' }}>
              <strong style={{ color: 'var(--green)', display: 'block', marginBottom: '4px', fontSize: '0.78rem' }}>💡 Mẹo tăng tốc:</strong>
              <ul style={{ margin: 0, paddingLeft: '1.15rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.78rem' }}>
                {notes.map((note, idx) => (
                  <li key={idx} style={{ lineHeight: 1.4 }}>{note}</li>
                ))}
              </ul>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '9px', padding: '0.7rem 0.9rem' }}>
              <strong style={{ color: 'var(--red)', display: 'block', marginBottom: '4px', fontSize: '0.78rem' }}>⚠️ Lưu ý kiểm soát lỗi:</strong>
              <ul style={{ margin: 0, paddingLeft: '1.15rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.78rem' }}>
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

// 6. LOADING STATE COMPONENT
interface LoadingStateProps {
  message?: string;
  style?: React.CSSProperties;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Đang tải dữ liệu...', style }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1.5rem', gap: '0.85rem', color: 'var(--muted)', width: '100%', ...style }}>
      <RefreshCw className="spinner" size={28} style={{ color: 'var(--primary)' }} />
      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{message}</span>
    </div>
  );
};

// 7. ERROR STATE COMPONENT
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  style?: React.CSSProperties;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, style }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1.5rem', gap: '0.85rem', color: 'var(--red)', textAlign: 'center', width: '100%', border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', ...style }}>
      <AlertCircle size={28} />
      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{message}</span>
      {onRetry && (
        <button className="btn-danger small-btn" onClick={onRetry} style={{ minWidth: '100px' }}>
          Thử lại
        </button>
      )}
    </div>
  );
};

// 8. SEGMENTED CONTROL COMPONENT
interface SegmentedControlProps<T extends string> {
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  value: T;
  onChange: (val: T) => void;
  style?: React.CSSProperties;
}

export function SegmentedControl<T extends string>({ options, value, onChange, style }: SegmentedControlProps<T>) {
  return (
    <div className="segmented-control" style={style}>
      {options.map(opt => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`segmented-item ${isActive ? 'active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon && <span style={{ marginRight: '5px', display: 'inline-flex', verticalAlign: 'middle' }}>{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
