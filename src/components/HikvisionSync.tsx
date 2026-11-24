import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Copy,
  Check,
  Wifi,
  Cpu,
  Users,
  Clock,
  AlertCircle,
  Search,
  Settings2,
  CloudDownload,
  ArrowLeft,
  ClipboardList,
  X
} from 'lucide-react';
import { StatCard, EmptyState, LoadingState, ErrorState, PageHeader, Badge } from './Shared';
import { getLocalYMD } from '../utils/numberUtils';

interface AttendanceLog {
  name: string;
  date: string;
  checkIn: string;
  checkOut: string;
  notes: string;
}

interface HikvisionSyncProps {
  gasUrl: string;
  spreadsheetId: string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onNavigate?: (view: 'attendance' | 'payroll' | 'vietqr' | 'tts' | 'settings' | 'transfer' | 'hikvision') => void;
}

function loadSessionPassword(): string {
  try {
    const fromSession = sessionStorage.getItem('kg_tool_sync_password');
    if (fromSession !== null) return fromSession;
    // Migrate and purge legacy plaintext password from persistent localStorage
    const legacy = localStorage.getItem('kg_tool_sync_password');
    if (legacy) {
      sessionStorage.setItem('kg_tool_sync_password', legacy);
      localStorage.removeItem('kg_tool_sync_password');
      return legacy;
    }
  } catch {
    // Ignore storage access errors
  }
  return '';
}

export default function HikvisionSync({ gasUrl, spreadsheetId, showToast, onNavigate }: HikvisionSyncProps) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(gasUrl));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [logScope, setLogScope] = useState<'all' | 'today'>('all');
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [showOfflineSync, setShowOfflineSync] = useState(false);

  // Webhook settings variables
  const [workerUrl, setWorkerUrl] = useState(
    () => localStorage.getItem('kg_tool_worker_url') || 'https://kingsgrill-hikvision-sync.dmt-kgwork.workers.dev'
  );
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const secretKey = 'KINGS_GRILL_HIKVISION_SECRET_2026';

  const [syncDeviceUrl, setSyncDeviceUrl] = useState(() => localStorage.getItem('kg_tool_sync_device_url') || '');
  const [syncUsername, setSyncUsername] = useState('admin');
  const [syncPassword, setSyncPassword] = useState(loadSessionPassword);
  const [syncFromDate, setSyncFromDate] = useState(() => getLocalYMD());
  const [syncToDate, setSyncToDate] = useState(() => getLocalYMD());
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [syncResultMsg, setSyncResultMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadAttendanceLogs = useCallback(async (signal?: AbortSignal) => {
    if (!gasUrl) {
      setErrorMsg('Vui lòng cấu hình URL Google Apps Script trong phần Cài đặt trước!');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const url = `${gasUrl}?action=getAttendanceLogs&ssId=${encodeURIComponent(spreadsheetId)}`;
      const res = await fetch(url, { signal });
      const result = (await res.json()) as { success?: boolean; data?: AttendanceLog[]; error?: string };

      if (signal?.aborted) return;

      if (result.success && Array.isArray(result.data)) {
        setLogs(result.data);
      } else {
        throw new Error(result.error || 'Dữ liệu phản hồi sai định dạng.');
      }
    } catch (err: unknown) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi mạng';
      setErrorMsg(`Không thể tải lịch sử chấm công: ${message}`);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [gasUrl, spreadsheetId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadAttendanceLogs(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadAttendanceLogs]);

  const handleSaveWorkerUrl = () => {
    localStorage.setItem('kg_tool_worker_url', workerUrl.trim());
    showToast('Đã lưu URL Cloudflare Worker của bạn!', 'success');
  };

  const handleOfflineSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerUrl) {
      showToast('Vui lòng nhập đường dẫn Cloudflare Worker trước!', 'error');
      return;
    }
    if (!syncDeviceUrl) {
      showToast('Vui lòng nhập địa chỉ kết nối máy chấm công!', 'error');
      return;
    }

    setIsSyncingOffline(true);
    setSyncResultMsg(null);
    localStorage.setItem('kg_tool_sync_device_url', syncDeviceUrl.trim());
    try {
      sessionStorage.setItem('kg_tool_sync_password', syncPassword);
      localStorage.removeItem('kg_tool_sync_password');
    } catch {
      // Ignore sessionStorage restrictions
    }

    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'sync_offline_logs',
          tunnelUrl: syncDeviceUrl.trim(),
          username: syncUsername.trim(),
          password: syncPassword,
          fromDate: syncFromDate,
          toDate: syncToDate,
          secret_key: secretKey
        })
      });

      const result = (await response.json()) as { success?: boolean; message?: string };
      if (result.success) {
        setSyncResultMsg({
          text: result.message || 'Đồng bộ bổ sung hoàn tất thành công.',
          type: 'success'
        });
        showToast(result.message || 'Đồng bộ bổ sung hoàn tất!', 'success');
        void loadAttendanceLogs();
      } else {
        setSyncResultMsg({
          text: result.message || 'Đồng bộ thất bại. Vui lòng kiểm tra lại thông tin cấu hình.',
          type: 'error'
        });
        showToast(result.message || 'Lỗi đồng bộ bổ sung!', 'error');
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi mạng';
      setSyncResultMsg({
        text: `Lỗi kết nối tới Cloudflare Worker: ${message}`,
        type: 'error'
      });
      showToast('Lỗi kết nối tới Worker!', 'error');
    } finally {
      setIsSyncingOffline(false);
    }
  };

  const handleCopy = (text: string, type: 'url' | 'secret') => {
    navigator.clipboard.writeText(text)
      .then(() => {
        if (type === 'url') {
          setCopiedUrl(true);
          setTimeout(() => setCopiedUrl(false), 2000);
        } else {
          setCopiedSecret(true);
          setTimeout(() => setCopiedSecret(false), 2000);
        }
        showToast('Đã sao chép vào bộ nhớ tạm!', 'success');
      })
      .catch(() => showToast('Không thể sao chép!', 'error'));
  };

  const todayStr = useMemo(() => {
    const [yyyy, mm, dd] = getLocalYMD().split('-');
    return `${dd}/${mm}/${yyyy}`;
  }, []);

  const todayLogs = useMemo(() => {
    return logs.filter(log => log.date === todayStr);
  }, [logs, todayStr]);

  const uniqueEmpsToday = useMemo(() => {
    return new Set(todayLogs.map(log => log.name)).size;
  }, [todayLogs]);

  const filteredLogs = useMemo(() => {
    const base = logScope === 'today' ? todayLogs : logs;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return base;
    return base.filter(log =>
      log.name.toLowerCase().includes(query) ||
      log.date.includes(query) ||
      (log.notes && log.notes.toLowerCase().includes(query))
    );
  }, [logs, todayLogs, logScope, searchQuery]);

  const effectiveError = !gasUrl
    ? 'Vui lòng cấu hình URL Google Apps Script trong phần Cài đặt trước!'
    : errorMsg;

  return (
    <div className="screen active">
      <PageHeader
        icon={<Cpu size={22} />}
        title="Máy Chấm Công Cloud (Hikvision)"
        subtitle="Theo dõi nhật ký quét vân tay/khuôn mặt theo thời gian thực và đồng bộ bù trực tiếp từ thiết bị qua Cloudflare Worker."
        badgeText={logs.length > 0 ? 'Trực tuyến' : 'Hikvision Sync'}
        badgeVariant={logs.length > 0 ? 'success' : 'info'}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-outline"
              onClick={() => onNavigate?.('attendance')}
            >
              <ArrowLeft size={14} />
              <span>Về Chấm công</span>
            </button>
            <button
              type="button"
              className={showOfflineSync ? 'primary' : 'btn-outline'}
              onClick={() => {
                setShowOfflineSync((v) => !v);
                if (!showOfflineSync) setShowWebhookConfig(false);
              }}
            >
              <CloudDownload size={15} />
              <span>Kéo log bù</span>
            </button>
            <button
              type="button"
              className={showWebhookConfig ? 'primary' : 'btn-outline'}
              onClick={() => {
                setShowWebhookConfig((v) => !v);
                if (!showWebhookConfig) setShowOfflineSync(false);
              }}
            >
              <Settings2 size={15} />
              <span>Cấu hình Webhook</span>
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => void loadAttendanceLogs()}
              disabled={isLoading}
            >
              <RefreshCw className={isLoading ? 'spinner' : ''} size={14} />
              <span>Làm mới</span>
            </button>
          </div>
        }
      />

      <div className="head" style={{ marginBottom: '1rem' }}>
        <div className="kpis">
          <StatCard
            icon={<Clock size={18} />}
            label="Lượt chấm hôm nay"
            value={todayLogs.length}
            subtext={`Ngày ${todayStr}`}
            hasData={logs.length > 0}
          />
          <StatCard
            icon={<Users size={18} />}
            label="Nhân viên đi làm hôm nay"
            value={uniqueEmpsToday}
            subtext="Số người đã quét máy"
            hasData={logs.length > 0}
          />
          <StatCard
            icon={<Cpu size={18} />}
            label="Trạng thái Webhook"
            value={gasUrl ? 'Đã liên kết' : 'Chưa cấu hình'}
            subtext={gasUrl ? 'Sẵn sàng nhận tín hiệu' : 'Vui lòng cài đặt GAS'}
            hasData={!!gasUrl}
          />
          <StatCard
            icon={<Wifi size={18} />}
            label="Kết nối thiết bị"
            value={logs.length > 0 ? 'Trực tuyến' : 'Chờ đồng bộ'}
            subtext={logs.length > 0 ? `Lượt cuối: ${logs[0]?.name}` : 'Chưa có log đẩy lên'}
            hasData={logs.length > 0}
          />
        </div>
      </div>

      {/* COLLAPSIBLE PANEL 1: WEBHOOK SETUP */}
      {showWebhookConfig && (
        <div className="studio-collapsible-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '8px' }}>
            <h2 className="studio-section-title" style={{ margin: 0 }}>
              <Settings2 size={17} color="var(--accent-primary)" />
              Cấu hình Cloudflare Worker Webhook
            </h2>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowWebhookConfig(false)}
              aria-label="Đóng cấu hình Webhook"
            >
              <X size={15} />
              <span>Thu gọn</span>
            </button>
          </div>

          <div className="two-col" style={{ gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="field full" style={{ margin: 0 }}>
                <label>Đường dẫn Cloudflare Worker của bạn</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={workerUrl}
                    onChange={(e) => setWorkerUrl(e.target.value)}
                    placeholder="https://kingsgrill-hikvision-sync.workers.dev"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="primary"
                    onClick={handleSaveWorkerUrl}
                    style={{ flexShrink: 0, padding: '0 16px' }}
                  >
                    Lưu URL
                  </button>
                </div>
              </div>

              <div style={{ background: 'var(--accent-primary-subtle)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <AlertCircle size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  Trên trang quản trị máy Hikvision, vào <strong>Configuration &rarr; Network &rarr; Advanced Settings &rarr; HTTP Listening</strong>, dán Worker URL bên cạnh, đặt cổng <code>443</code> và giao thức <code>HTTPS</code>.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>1. HTTP Host URL (dán vào máy chấm công)</small>
                <div className="studio-code-row">
                  <code>{workerUrl}</code>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => handleCopy(workerUrl, 'url')}
                    style={{ height: '32px', padding: '0 10px', fontSize: '0.76rem', flexShrink: 0 }}
                  >
                    {copiedUrl ? <><Check size={13} /> Đã chép</> : <><Copy size={13} /> Chép</>}
                  </button>
                </div>
              </div>

              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>2. Khóa bảo mật (Secret Key)</small>
                <div className="studio-code-row">
                  <code>{secretKey}</code>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => handleCopy(secretKey, 'secret')}
                    style={{ height: '32px', padding: '0 10px', fontSize: '0.76rem', flexShrink: 0 }}
                  >
                    {copiedSecret ? <><Check size={13} /> Đã chép</> : <><Copy size={13} /> Chép</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COLLAPSIBLE PANEL 2: OFFLINE LOG SYNC */}
      {showOfflineSync && (
        <form onSubmit={handleOfflineSync} className="studio-collapsible-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '8px' }}>
            <h2 className="studio-section-title" style={{ margin: 0 }}>
              <CloudDownload size={17} color="var(--accent-primary)" />
              Đồng bộ bổ sung từ máy chấm công
            </h2>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowOfflineSync(false)}
              aria-label="Đóng kéo log bù"
            >
              <X size={15} />
              <span>Thu gọn</span>
            </button>
          </div>

          <div className="form-grid">
            <div className="field full">
              <label>Địa chỉ máy chấm công (IP nội bộ / Tunnel URL)</label>
              <input
                type="text"
                value={syncDeviceUrl}
                onChange={(e) => setSyncDeviceUrl(e.target.value)}
                placeholder="Ví dụ: http://192.168.1.3 hoặc https://xyz.trycloudflare.com"
                required
              />
            </div>

            <div className="field">
              <label>Tài khoản máy</label>
              <input
                type="text"
                value={syncUsername}
                onChange={(e) => setSyncUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>

            <div className="field">
              <label>Mật khẩu máy (chỉ lưu trong phiên)</label>
              <input
                type="password"
                value={syncPassword}
                onChange={(e) => setSyncPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <div className="field">
              <label>Từ ngày</label>
              <input
                type="date"
                value={syncFromDate}
                onChange={(e) => setSyncFromDate(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>Đến ngày</label>
              <input
                type="date"
                value={syncToDate}
                onChange={(e) => setSyncToDate(e.target.value)}
                required
              />
            </div>
          </div>

          {syncResultMsg && (
            <div style={{
              marginTop: '0.75rem',
              background: syncResultMsg.type === 'success' ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
              border: `1px solid ${syncResultMsg.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              fontSize: '0.8rem',
              color: syncResultMsg.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)',
              fontWeight: 600,
              lineHeight: 1.4
            }}>
              {syncResultMsg.text}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
            <button
              type="submit"
              className="primary"
              disabled={isSyncingOffline}
              style={{ height: '42px', padding: '0 1.35rem' }}
            >
              <RefreshCw className={isSyncingOffline ? 'spinner' : ''} size={15} />
              <span>{isSyncingOffline ? 'Đang đồng bộ...' : 'Bắt đầu kéo log từ máy'}</span>
            </button>
          </div>
        </form>
      )}

      {/* MAIN WORKSPACE: FULL-WIDTH LIVE ATTENDANCE LOGS */}
      <div className="studio-action-bar">
        <div className="studio-bar-group">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            <ClipboardList size={17} color="var(--accent-primary)" />
            Nhật ký chấm công trực tuyến
          </span>
          <Badge variant="info">{filteredLogs.length} dòng</Badge>
        </div>

        <div className="studio-bar-group">
          <div className="studio-seg-bar" role="group" aria-label="Phạm vi nhật ký">
            <button
              type="button"
              className={logScope === 'all' ? 'active' : ''}
              onClick={() => setLogScope('all')}
            >
              Tất cả ({logs.length})
            </button>
            <button
              type="button"
              className={logScope === 'today' ? 'active' : ''}
              onClick={() => setLogScope('today')}
            >
              Hôm nay ({todayLogs.length})
            </button>
          </div>

          <div className="studio-search-box" style={{ minWidth: '240px' }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Tìm tên nhân viên, ngày, ghi chú..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card panel" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <LoadingState message="Đang tải dữ liệu từ Google Sheets..." />
        ) : effectiveError ? (
          <ErrorState message={effectiveError} onRetry={() => void loadAttendanceLogs()} />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={<Cpu size={28} />}
            title="Chưa có nhật ký chấm công"
            description={searchQuery ? 'Không tìm thấy dữ liệu phù hợp với từ khóa tìm kiếm.' : 'Chưa có lượt chấm công nào từ máy Hikvision được đồng bộ lên Google Sheets.'}
            actionLabel={!showOfflineSync ? 'Kéo log bù từ máy chấm công' : undefined}
            onAction={!showOfflineSync ? () => setShowOfflineSync(true) : undefined}
          />
        ) : (
          <div className="table-container datagrid-table-wrapper" style={{ maxHeight: '540px', overflowY: 'auto' }}>
            <table className="datagrid-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '11px 14px', width: '56px', textAlign: 'center' }}>STT</th>
                  <th style={{ padding: '11px 14px' }}>Họ tên nhân viên</th>
                  <th style={{ padding: '11px 14px', width: '130px' }}>Ngày công</th>
                  <th style={{ padding: '11px 14px', width: '130px' }}>Giờ vào</th>
                  <th style={{ padding: '11px 14px', width: '130px' }}>Giờ ra</th>
                  <th style={{ padding: '11px 14px' }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, idx) => {
                  const cleanDate = log.date?.includes('T') ? log.date.split('T')[0] : (log.date || '—');
                  const formatTime = (t: string) => {
                    if (!t) return null;
                    if (t.includes('T')) {
                      const timePart = t.split('T')[1];
                      return timePart ? timePart.replace(/\.000Z|Z/g, '').substring(0, 8) : t;
                    }
                    return t;
                  };
                  const cleanIn = formatTime(log.checkIn);
                  const cleanOut = formatTime(log.checkOut);

                  return (
                    <tr key={`${log.name}-${log.date}-${idx}`}>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.name}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' }}>
                        {cleanDate}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                        {cleanIn ? <Badge variant="success" dot>{cleanIn}</Badge> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                        {cleanOut ? <Badge variant="warning" dot>{cleanOut}</Badge> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {log.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
