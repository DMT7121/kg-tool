import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badgeText?: string;
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badgeText,
  width = '480px',
  children,
  footer
}) => {
  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="drawer-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 12, 30, 0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9998,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        className="drawer-panel"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: width,
          height: '100%',
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          color: 'var(--text)'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          background: 'var(--surface-subtle)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {title}
              </h2>
              {badgeText && (
                <span className="badge badge-info" style={{ fontSize: '10px', padding: '2px 8px' }}>
                  {badgeText}
                </span>
              )}
            </div>
            {subtitle && (
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
                {subtitle}
              </p>
            )}
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="btn-ghost"
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              borderRadius: '6px',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="Đóng (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {children}
        </div>

        {/* Drawer Footer */}
        {footer && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px'
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
