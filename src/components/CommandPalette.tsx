import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Calendar,
  CreditCard,
  QrCode,
  Volume2,
  Settings,
  ArrowRight,
  Command,
  Sparkles,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  SunMedium,
  PanelRight,
  Puzzle
} from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'navigation' | 'action' | 'preset';
  icon: React.ReactNode;
  keywords: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: any) => void;
  onTriggerAction?: (actionId: string) => void;
}

const stripAccents = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onTriggerAction
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = useMemo(() => [
    // 1. Navigation
    {
      id: 'nav_attendance',
      title: 'Đi tới: Xử lý Chấm công Excel',
      subtitle: 'Tải lên và tổng hợp bảng công từ máy chấm công',
      category: 'navigation',
      icon: <Calendar size={16} />,
      keywords: 'cham cong attendance excel bang cong ngay cong',
      onSelect: () => {
        onNavigateTab('attendance');
        onClose();
      }
    },
    {
      id: 'nav_hikvision',
      title: 'Đi tới: Đồng bộ Máy chấm công Hikvision',
      subtitle: 'Kết nối thiết bị Hikvision qua Cloudflare Worker API',
      category: 'navigation',
      icon: <RefreshCw size={16} />,
      keywords: 'hikvision may cham cong dong bo thiet bi van tay',
      onSelect: () => {
        onNavigateTab('hikvision');
        onClose();
      }
    },
    {
      id: 'nav_payroll',
      title: 'Đi tới: Quản lý & In Phiếu Lương',
      subtitle: 'Tính lương F&B, theo tháng, theo giờ và xuất hóa đơn K80/A4',
      category: 'navigation',
      icon: <CreditCard size={16} />,
      keywords: 'phieu luong payroll bang luong k80 a4 nhan vien',
      onSelect: () => {
        onNavigateTab('payroll');
        onClose();
      }
    },
    {
      id: 'nav_transfer',
      title: 'Đi tới: Lập Lệnh Chuyển Khoản Lô (MyVIB / VCB)',
      subtitle: 'Tạo file Excel chuyển khoản lương hàng loạt chuẩn ngân hàng',
      category: 'navigation',
      icon: <FileSpreadsheet size={16} />,
      keywords: 'chuyen khoan lo transfer myvib vcb vietcombank ngan hang',
      onSelect: () => {
        onNavigateTab('transfer');
        onClose();
      }
    },
    {
      id: 'nav_qr',
      title: 'Đi tới: Tạo Mã VietQR & Chia Tiền Hóa Đơn POS',
      subtitle: 'Tạo mã QR thanh toán nhanh và chia bill thông minh',
      category: 'navigation',
      icon: <QrCode size={16} />,
      keywords: 'vietqr qr code chia tien bill thanh toan ngan hang',
      onSelect: () => {
        onNavigateTab('qr');
        onClose();
      }
    },
    {
      id: 'nav_tts',
      title: 'Đi tới: Đọc Văn Bản & Phát Thanh AI (TTS)',
      subtitle: 'Tạo âm thanh thông báo tự động đa giọng đọc (Google, FPT, Viettel, Zalo)',
      category: 'navigation',
      icon: <Volume2 size={16} />,
      keywords: 'tts giong doc ai phat thanh thong bao am thanh',
      onSelect: () => {
        onNavigateTab('tts');
        onClose();
      }
    },
    {
      id: 'nav_settings',
      title: 'Đi tới: Cài Đặt Hệ Thống & Cloud Sync',
      subtitle: 'Quản lý Google Apps Script URL, Spreadsheet ID và sao lưu cấu hình',
      category: 'navigation',
      icon: <Settings size={16} />,
      keywords: 'cai dat settings cau hinh google sheets gas backup sao luu',
      onSelect: () => {
        onNavigateTab('settings');
        onClose();
      }
    },

    // 2. Quick Operational Pipelines & Actions
    {
      id: 'act_pipe_attendance_payroll',
      title: 'Liên thông: Chuyển dữ liệu Chấm công sang Tính Lương',
      subtitle: 'Tự động tổng hợp số ngày công & giờ làm từ bảng chấm công sang Phiếu lương',
      category: 'action',
      icon: <Sparkles size={16} />,
      keywords: 'lien thong chuyen cham cong sang tinh luong pipe attendance payroll',
      onSelect: () => {
        onTriggerAction?.('act_pipe_attendance_payroll');
        onClose();
      }
    },
    {
      id: 'act_pipe_payroll_transfer',
      title: 'Liên thông: Chuyển Bảng Lương sang Lập Lệnh Chuyển Khoản',
      subtitle: 'Đẩy danh sách nhân viên và số tiền thực nhận sang công cụ MyVIB / VCB',
      category: 'action',
      icon: <FileSpreadsheet size={16} />,
      keywords: 'lien thong chuyen luong sang chuyen khoan myvib vcb transfer',
      onSelect: () => {
        onTriggerAction?.('act_pipe_payroll_transfer');
        onClose();
      }
    },
    {
      id: 'act_print_k80',
      title: 'Thao tác: Chuyển sang Chế độ In Nhiệt K80',
      subtitle: 'Mở quản lý lương và kích hoạt mẫu hóa đơn nhiệt 80mm',
      category: 'action',
      icon: <Printer size={16} />,
      keywords: 'in nhiet k80 thermal printer hoa don 80mm',
      onSelect: () => {
        onNavigateTab('payroll');
        onTriggerAction?.('preset_k80');
        onClose();
      }
    },
    {
      id: 'act_normalize_names',
      title: 'Thao tác: Chuẩn hóa Tên không dấu & IN HOA',
      subtitle: 'Làm sạch danh sách tên người thụ hưởng trong công cụ Chuyển khoản',
      category: 'action',
      icon: <Sparkles size={16} />,
      keywords: 'chuan hoa ten in hoa khong dau normalize names',
      onSelect: () => {
        onNavigateTab('transfer');
        onTriggerAction?.('normalize_names');
        onClose();
      }
    },
    {
      id: 'act_toggle_theme',
      title: 'Giao diện: Đổi chế độ Sáng / Tối (Dark / Light Studio)',
      subtitle: 'Chuyển đổi nhanh giữa Carbon Studio (Tối) và Daylight Alabaster (Sáng)',
      category: 'preset',
      icon: <SunMedium size={16} />,
      keywords: 'theme giao dien sang toi dark light mode',
      onSelect: () => {
        onTriggerAction?.('toggle_theme');
        onClose();
      }
    },
    {
      id: 'act_toggle_extension_mode',
      title: 'Chế độ: Bật / Tắt giao diện Extension Companion thu gọn',
      subtitle: 'Chuyển sang bố cục Side Panel / Popup tối ưu thao tác nhanh 1 cột',
      category: 'preset',
      icon: <PanelRight size={16} />,
      keywords: 'extension companion side panel popup thu gon mini',
      onSelect: () => {
        onTriggerAction?.('toggle_extension_mode');
        onClose();
      }
    },
    {
      id: 'act_open_extension_guide',
      title: 'Tiện ích: Hướng dẫn cài đặt Chrome / Edge Extension',
      subtitle: 'Xem cách gắn KG Studio lên thanh trình duyệt và menu chuột phải',
      category: 'preset',
      icon: <Puzzle size={16} />,
      keywords: 'cai dat extension tien ich mo rong chrome edge sidepanel',
      onSelect: () => {
        onTriggerAction?.('open_extension_guide');
        onClose();
      }
    }
  ], [onNavigateTab, onTriggerAction, onClose]);

  const filteredCommands = useMemo(() => {
    const q = stripAccents(query).trim();
    if (!q) return commands;
    return commands.filter(cmd => {
      const haystack = stripAccents(`${cmd.title} ${cmd.subtitle} ${cmd.keywords}`);
      return haystack.includes(q);
    });
  }, [commands, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          filteredCommands.length > 0 ? (prev + 1) % filteredCommands.length : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev =>
          filteredCommands.length > 0
            ? (prev - 1 + filteredCommands.length) % filteredCommands.length
            : 0
        );
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].onSelect();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="cmd-palette-backdrop" onClick={onClose}>
      <div
        className="cmd-palette-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Bảng điều khiển nhanh Command Palette"
      >
        <div className="cmd-palette-search-bar">
          <Search size={18} style={{ color: 'var(--primary)' }} />
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Gõ lệnh hoặc tìm công cụ (VD: tính lương, chuyển khoản, vietqr, sáng/tối)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd
            style={{
              fontSize: '0.68rem',
              padding: '2px 6px',
              borderRadius: '5px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              cursor: 'pointer'
            }}
            onClick={onClose}
          >
            ESC
          </kbd>
        </div>

        <div className="cmd-palette-list" ref={listRef}>
          {filteredCommands.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>
              <Command size={26} style={{ opacity: 0.4, marginBottom: '0.4rem' }} />
              <p style={{ fontSize: '0.84rem' }}>Không tìm thấy lệnh phù hợp với "{query}"</p>
            </div>
          ) : (
            <>
              {(['navigation', 'action', 'preset'] as const).map(cat => {
                const groupItems = filteredCommands.filter(c => c.category === cat);
                if (groupItems.length === 0) return null;
                const catLabel =
                  cat === 'navigation'
                    ? 'ĐIỀU HƯỚNG PHÂN HỆ'
                    : cat === 'action'
                    ? 'LIÊN THÔNG & TÁC VỤ NHANH'
                    : 'GIAO DIỆN & TIỆN ÍCH MỞ RỘNG';

                return (
                  <div key={cat} className="cmd-palette-group">
                    <div className="cmd-palette-group-title">{catLabel}</div>
                    {groupItems.map(item => {
                      const globalIndex = filteredCommands.findIndex(c => c.id === item.id);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <div
                          key={item.id}
                          className={`cmd-palette-item ${isSelected ? 'selected' : ''}`}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          onClick={item.onSelect}
                        >
                          <div className="cmd-palette-item-left">
                            <div className="cmd-palette-icon-box">{item.icon}</div>
                            <div className="cmd-palette-item-text">
                              <div className="cmd-palette-item-title">{item.title}</div>
                              <div className="cmd-palette-item-sub">{item.subtitle}</div>
                            </div>
                          </div>
                          <ArrowRight size={14} style={{ color: isSelected ? 'var(--primary)' : 'var(--muted)' }} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="cmd-palette-footer">
          <div className="cmd-palette-hints">
            <span><kbd>↑</kbd> <kbd>↓</kbd> Di chuyển</span>
            <span><kbd>Enter</kbd> Thực thi</span>
            <span><kbd>Esc</kbd> Đóng</span>
          </div>
          <div className="cmd-palette-brand">KG Studio • Command Center</div>
        </div>
      </div>
    </div>
  );
};
