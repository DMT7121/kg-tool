import React, { useState, useEffect, useMemo } from 'react';
import { 
  RefreshCw, 
  HelpCircle, 
  Copy, 
  Check, 
  Wifi, 
  Cpu, 
  Users, 
  Clock, 
  AlertCircle,
  Search
} from 'lucide-react';
import { StatCard, EmptyState, LoadingState, ErrorState, GuidePanel } from './Shared';

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
}

export default function HikvisionSync({ gasUrl, spreadsheetId, showToast }: HikvisionSyncProps) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Webhook settings variables
  const [workerUrl, setWorkerUrl] = useState(() => localStorage.getItem('kg_tool_worker_url') || 'https://kingsgrill-hikvision-sync.username.workers.dev');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const secretKey = 'KINGS_GRILL_HIKVISION_SECRET_2026';

  const fetchLogs = async () => {
    if (!gasUrl) {
      setErrorMsg('Vui lòng cấu hình URL Google Apps Script trong phần Cài đặt trước!');
      return;
    }
    
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
      const url = `${gasUrl}?action=getAttendanceLogs&ssId=${encodeURIComponent(spreadsheetId)}`;
      const res = await fetch(url);
      const result = await res.json();
      
      if (result.success && Array.isArray(result.data)) {
        setLogs(result.data);
      } else {
        throw new Error(result.error || 'Dữ liệu phản hồi sai định dạng.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Không thể tải lịch sử chấm công: ${err.message || 'Lỗi mạng'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [gasUrl, spreadsheetId]);

  const handleSaveWorkerUrl = () => {
    localStorage.setItem('kg_tool_worker_url', workerUrl);
    showToast('Đã lưu URL Cloudflare Worker của bạn!', 'success');
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

  // KPIs Calculations
  const todayStr = useMemo(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }, []);

  const todayLogs = useMemo(() => {
    return logs.filter(log => log.date === todayStr);
  }, [logs, todayStr]);

  const uniqueEmpsToday = useMemo(() => {
    return new Set(todayLogs.map(log => log.name)).size;
  }, [todayLogs]);

  // Filter logs by search query
  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter(log => 
      log.name.toLowerCase().includes(query) ||
      log.date.includes(query) ||
      (log.notes && log.notes.toLowerCase().includes(query))
    );
  }, [logs, searchQuery]);

  return (
    <div className="screen active">
      <div className="head">
        <div className="title">
          <h1>Đồng Bộ Máy Chấm Công (Hikvision) <span className="blue-dot"></span></h1>
          <p>Nhận dữ liệu chấm công từ thiết bị Hikvision thông qua Cloudflare Worker, ghi tự động vào Google Sheets</p>
        </div>
        
        <div className="kpis">
          <StatCard 
            icon={<Clock size={20} />} 
            label="Lượt chấm hôm nay" 
            value={todayLogs.length} 
            subtext={`Ngày ${todayStr}`}
            hasData={logs.length > 0} 
          />
          <StatCard 
            icon={<Users size={20} />} 
            label="Nhân viên đi làm hôm nay" 
            value={uniqueEmpsToday} 
            subtext="Số người đã quét vân tay/mặt"
            hasData={logs.length > 0} 
          />
          <StatCard 
            icon={<Cpu size={20} />} 
            label="Trạng thái Webhook" 
            value={gasUrl ? "Đã liên kết" : "Chưa cấu hình"} 
            subtext={gasUrl ? "Đang chờ tín hiệu..." : "Vui lòng cài đặt GAS"}
            hasData={!!gasUrl} 
          />
          <StatCard 
            icon={<Wifi size={20} />} 
            label="Kết nối thiết bị" 
            value={logs.length > 0 ? "Trực tuyến" : "Chờ đồng bộ"} 
            subtext={logs.length > 0 ? `Lượt cuối: ${logs[0]?.name}` : "Chưa có log đẩy lên"}
            hasData={logs.length > 0} 
          />
        </div>
      </div>

      <GuidePanel 
        title="Đồng Bộ Máy Chấm Công"
        purpose="Module này kết nối trực tuyến với máy chấm công Hikvision DS-K1T320MX đặt tại cửa hàng thông qua Cloudflare Worker để nhận tín hiệu chấm công tự động mà không cần máy tính POS chạy ngầm."
        steps={[
          "Mở trình quản lý Cloudflare Worker của bạn và deploy file 'CloudflareWorkerHikvision.js' được đính kèm ở thư mục gốc dự án.",
          "Điền URL của Worker đã deploy vào ô cấu hình 'Đường dẫn Cloudflare Worker' bên dưới.",
          "Sao chép link Cloudflare Worker của bạn và dán vào mục cấu hình HTTP Host / HTTP Listening trên trang quản trị IP máy chấm công tại quán.",
          "Đảm bảo đã set đúng mật khẩu bảo mật (Secret Key) tương ứng.",
          "Mỗi khi nhân viên chấm công, dữ liệu sẽ tự động đẩy lên Google Sheet và hiển thị ngay lập tức tại bảng bên dưới."
        ]}
        notes={[
          "Mã nhân viên (Employee ID) trên máy chấm công nên khớp hoặc ghi nhận đúng tên họ nhân viên để tính ca chính xác.",
          "Khoảng cách thời gian đẩy dữ liệu là thời gian thực (Real-time) ngay sau khi quét."
        ]}
        errors={[
          "Lỗi 'Không kết nối được' -> Kiểm tra xem máy chấm công tại nhà hàng có kết nối mạng Internet ổn định không.",
          "Lỗi 'Sai mã bảo mật' -> Đảm bảo trường secret_key trên Cloudflare Worker khớp với Apps Script."
        ]}
      />

      <div className="two-col">
        {/* LEFT COLUMN: Configurations */}
        <div className="card panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2>⚙️ Cấu hình Webhook</h2>
          <p className="sub" style={{ margin: 0 }}>Cài đặt đường link nhận dữ liệu từ Cloudflare Worker để dán vào máy chấm công Hikvision.</p>
          
          <div className="field full" style={{ marginTop: '0.5rem' }}>
            <label>Đường dẫn Cloudflare Worker của bạn</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="form-control" 
                value={workerUrl}
                onChange={(e) => setWorkerUrl(e.target.value)}
                placeholder="https://kingsgrill-attendance-webhook.username.workers.dev"
                style={{ width: '100%', height: '44px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: 'white', padding: '0 12px' }}
              />
              <button 
                className="primary" 
                onClick={handleSaveWorkerUrl}
                style={{ height: '44px', padding: '0 16px', borderRadius: '8px', minWidth: '80px', flexShrink: 0 }}
              >
                Lưu
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <small style={{ color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>1. Đường dẫn dán vào máy chấm công (HTTP Host URL):</small>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
                <code style={{ fontSize: '0.85rem', color: 'var(--cyan)', wordBreak: 'break-all' }}>{workerUrl}</code>
                <button 
                  type="button" 
                  onClick={() => handleCopy(workerUrl, 'url')}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}
                >
                  {copiedUrl ? <Check size={16} color="var(--green)" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div>
              <small style={{ color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>2. Khóa bảo mật Webhook (Secret Key):</small>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
                <code style={{ fontSize: '0.85rem', color: 'var(--cyan)' }}>{secretKey}</code>
                <button 
                  type="button" 
                  onClick={() => handleCopy(secretKey, 'secret')}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}
                >
                  {copiedSecret ? <Check size={16} color="var(--green)" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>
          
          <div style={{ background: 'rgba(34, 211, 238, 0.04)', border: '1px solid rgba(34, 211, 238, 0.15)', borderRadius: '10px', padding: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertCircle size={18} style={{ color: 'var(--cyan)', flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
              <strong>Hướng dẫn nhanh:</strong> Mở trình duyệt truy cập vào IP máy chấm công, vào <strong>Configuration -> Network -> Advanced Settings -> HTTP Listening</strong>. Điền địa chỉ Worker URL và đặt cổng là <code>443</code>, phương thức gửi là <code>HTTPS</code>.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Logs list */}
        <div className="card panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flexGrow: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>📋 Nhật ký chấm công online</h2>
            <button 
              className="btn-outline" 
              onClick={fetchLogs} 
              disabled={isLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 12px', borderRadius: '8px' }}
            >
              <RefreshCw className={isLoading ? "spinner" : ""} size={14} />
              Tải lại
            </button>
          </div>

          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--muted)' }}><Search size={16} /></span>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Tìm kiếm theo tên nhân viên, ngày hoặc ghi chú..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: 'white', padding: '0 12px 0 36px', fontSize: '0.9rem' }}
            />
          </div>

          {isLoading ? (
            <LoadingState message="Đang tải dữ liệu từ Google Sheets..." />
          ) : errorMsg ? (
            <ErrorState message={errorMsg} onRetry={fetchLogs} />
          ) : filteredLogs.length === 0 ? (
            <EmptyState 
              icon="📟" 
              title="Không có log chấm công nào" 
              description={searchQuery ? "Không tìm thấy dữ liệu phù hợp với tìm kiếm của bạn." : "Chưa có lượt chấm công nào từ máy Hikvision được đồng bộ lên Google Sheets."} 
            />
          ) : (
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Họ tên nhân viên</th>
                    <th style={{ padding: '10px 12px' }}>Ngày</th>
                    <th style={{ padding: '10px 12px' }}>Giờ vào</th>
                    <th style={{ padding: '10px 12px' }}>Giờ ra</th>
                    <th style={{ padding: '10px 12px' }}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'white' }}>{log.name}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{log.date}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {log.checkIn ? <span style={{ color: 'var(--green)', background: 'rgba(48,231,151,0.08)', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>{log.checkIn}</span> : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {log.checkOut ? <span style={{ color: 'var(--red)', background: 'rgba(255,92,122,0.08)', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>{log.checkOut}</span> : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: '0.8rem' }}>{log.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
