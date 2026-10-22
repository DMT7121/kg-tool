import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Inbox, CheckCircle2 } from 'lucide-react';

// ==========================================
// 0. PAGE HEADER & SEMANTIC BADGE
// ==========================================
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, dot = false, style }) => {
  return (
    <span className={`badge badge-${variant}`} style={style}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
};

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeVariant?: BadgeVariant;
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
    <div className="page-header-bar">
      <div className="page-header-left">
        {icon && <div className="page-header-icon">{icon}</div>}
        <div className="page-header-titles">
          <div className="page-header-title-row">
            <h1 className="page-header-title">{title}</h1>
            {badgeText && (
              <Badge variant={badgeVariant} dot>
                {badgeText}
              </Badge>
            )}
          </div>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
};

// ==========================================
// 1. STAT CARD COMPONENT (Executive SaaS KPI Card)
// ==========================================
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext: string;
  hasData?: boolean;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  icon, 
  label, 
  value, 
  subtext, 
  hasData = false,
  accentColor = 'var(--green)'
}) => {
  return (
    <div className="card kpi">
      <div className="kpi-top-row">
        <small>{label}</small>
        <div className="kpi-icon-badge">
          {icon}
        </div>
      </div>
      <b className="tabular-nums">{value}</b>
      <span style={{ color: hasData ? accentColor : 'var(--text-muted)' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: hasData ? accentColor : 'var(--text-disabled)',
            display: 'inline-block',
            flexShrink: 0
          }}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtext}
        </span>
      </span>
    </div>
  );
};

// ==========================================
// 2. EMPTY STATE COMPONENT
// ==========================================
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon = <Inbox size={32} />, 
  title, 
  description, 
  actionLabel, 
  onAction,
  style
}) => {
  return (
    <div style={{ 
      padding: '2.75rem 1.5rem', 
      textAlign: 'center', 
      background: 'var(--surface-subtle)', 
      border: '1px dashed var(--border-strong)', 
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.6rem',
      margin: '0.5rem 0',
      ...style
    }}>
      <div style={{ 
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        background: 'var(--accent-primary-subtle)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        color: 'var(--accent-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        marginBottom: '0.25rem'
      }}>
        {icon}
      </div>
      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h4>
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button 
          className="primary" 
          onClick={onAction} 
          style={{ marginTop: '0.6rem', height: '36px', padding: '0 16px', fontSize: '12.5px' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// ==========================================
// 3. LOADING STATE COMPONENT
// ==========================================
interface LoadingStateProps {
  message?: string;
  style?: React.CSSProperties;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Đang xử lý dữ liệu...',
  style 
}) => {
  return (
    <div style={{ 
      padding: '2.75rem 1.5rem', 
      textAlign: 'center', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '0.85rem',
      background: 'var(--surface-subtle)',
      borderRadius: '12px',
      border: '1px solid var(--border-default)',
      ...style
    }}>
      <RefreshCw className="spinner" size={26} style={{ color: 'var(--accent-primary)' }} />
      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>{message}</span>
    </div>
  );
};

// ==========================================
// 4. ERROR STATE COMPONENT
// ==========================================
interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  style?: React.CSSProperties;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  title = 'Đã xảy ra lỗi', 
  message, 
  onRetry,
  style 
}) => {
  return (
    <div style={{ 
      padding: '1.5rem', 
      background: 'var(--status-danger-bg)', 
      border: '1px solid var(--status-danger-border)', 
      borderRadius: '12px', 
      color: 'var(--status-danger)', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      textAlign: 'center',
      gap: '0.65rem',
      margin: '0.75rem 0',
      ...style
    }}>
      <AlertCircle size={26} />
      <div>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h4>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.45 }}>{message}</p>
      </div>
      {onRetry && (
        <button 
          type="button" 
          className="btn-outline" 
          onClick={onRetry}
          style={{ marginTop: '0.25rem', height: '32px', fontSize: '12px', borderColor: 'var(--status-danger-border)', color: 'var(--status-danger)' }}
        >
          Thử lại ngay
        </button>
      )}
    </div>
  );
};

// ==========================================
// 5. GUIDE PANEL COMPONENT (ACCORDION)
// ==========================================
interface GuidePanelProps {
  title: string;
  purpose: string;
  steps: string[];
  notes?: string[];
  errors?: string[];
}

export const GuidePanel: React.FC<GuidePanelProps> = ({ 
  title, 
  purpose, 
  steps, 
  notes = [], 
  errors = [] 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="card guide-panel-card" style={{ 
      marginBottom: '1.25rem', 
      background: 'var(--bg-elevated)', 
      border: '1px solid var(--border-default)',
      borderRadius: '10px',
      overflow: 'hidden'
    }}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        style={{ 
          padding: '0.75rem 1.1rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          cursor: 'pointer',
          userSelect: 'none',
          background: isOpen ? 'var(--surface-hover)' : 'transparent'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HelpCircle size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Hướng dẫn vận hành: <strong style={{ color: 'var(--text-primary)' }}>{title}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>
          <span>{isOpen ? 'Thu gọn' : 'Xem chi tiết'}</span>
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {isOpen && (
        <div style={{ 
          padding: '1.1rem 1.25rem', 
          borderTop: '1px solid var(--border-default)',
          fontSize: '0.82rem',
          lineHeight: 1.55,
          color: 'var(--text-secondary)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          background: 'var(--bg-panel)'
        }}>
          <div>
            <h5 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--accent-primary)' }} /> Mục đích & Quy trình
            </h5>
            <p style={{ margin: '0 0 10px 0', color: 'var(--text-muted)' }}>{purpose}</p>
            
            <ol style={{ margin: 0, paddingLeft: '1.15rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          {(notes.length > 0 || errors.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {notes.length > 0 && (
                <div style={{ background: 'var(--surface-subtle)', padding: '0.75rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                  <h5 style={{ margin: '0 0 4px 0', color: 'var(--status-warning)', fontSize: '0.78rem', fontWeight: 700 }}>
                    Lưu ý dữ liệu
                  </h5>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {notes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}

              {errors.length > 0 && (
                <div style={{ background: 'var(--status-danger-bg)', padding: '0.75rem 0.9rem', borderRadius: '8px', border: '1px solid var(--status-danger-border)' }}>
                  <h5 style={{ margin: '0 0 4px 0', color: 'var(--status-danger)', fontSize: '0.78rem', fontWeight: 700 }}>
                    Xử lý sự cố thường gặp
                  </h5>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
