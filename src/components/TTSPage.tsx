import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Volume2, 
  Square, 
  Save, 
  Trash2, 
  RefreshCw, 
  Play, 
  Sparkles, 
  BookOpen, 
  History, 
  Search, 
  Star, 
  Database,
  ShieldAlert,
  SlidersHorizontal,
  Key,
  Info
} from 'lucide-react';
import { StatCard, EmptyState, PageHeader } from './Shared';
import {
  EDGE_VOICES,
  CAPCUT_VOICES,
  OPENAIFM_VOICES,
  DEFAULT_OPENAIFM_PROMPT,
  synthesizeReverseEngineeredTTS
} from '../utils/ttsReverseEngineered';

export interface TTSTemplate {
  id: string;
  title: string;
  category: string;
  text: string;
  variables: string[];
  providerId: string;
  voiceId: string;
  gender: 'female' | 'male' | 'neutral' | 'auto';
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  note?: string;
}

export interface TTSHistoryItem {
  id: string;
  templateId?: string;
  text: string;
  normalizedText: string;
  providerId: string;
  voiceId: string;
  gender: string;
  rate: number;
  pitch: number;
  volume: number;
  playedAt: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export interface TTSProvider {
  id: string;
  name: string;
  type: 'browser' | 'cloud' | 'local' | 'custom';
  isFree: boolean;
  requiresApiKey: boolean;
  supportsVoiceList: boolean;
  supportsGender: boolean;
  supportsRate: boolean;
  supportsPitch: boolean;
  supportsVolume: boolean;
  supportsAudioExport: boolean;
  maxTextLength?: number;
}

interface TTSPageProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  gasUrl: string;
  spreadsheetId: string;
}

// 15 Default suggestion templates
const DEFAULT_SUGGESTIONS: Omit<TTSTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: "Thông báo đặt bàn mới",
    category: "Đặt bàn",
    text: "Có khách đặt bàn mới. Khách tên {ten_khach}, {so_khach} khách, nhận bàn lúc {gio_nhan_ban}.",
    variables: ["ten_khach", "so_khach", "gio_nhan_ban"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false,
    note: "Dùng để phát thông báo tại quầy lễ tân"
  },
  {
    title: "Đặt tiệc VIP",
    category: "Đặt bàn",
    text: "Có khách đặt tiệc {loai_tiec} tại phòng VIP, vui lòng kiểm tra món đặt trước.",
    variables: ["loai_tiec"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 0.9,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Ra món bàn mới",
    category: "Nhà hàng/Vận hành",
    text: "Có món mới cần ra bàn số {so_ban}.",
    variables: ["so_ban"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.1,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Bàn yêu cầu hỗ trợ",
    category: "Nhà hàng/Vận hành",
    text: "Bàn số {so_ban} đang cần hỗ trợ phục vụ gấp.",
    variables: ["so_ban"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Kiểm tra khu vực",
    category: "Nhà hàng/Vận hành",
    text: "Vui lòng kiểm tra khu vực {khu_vuc} ngay lập tức.",
    variables: ["khu_vuc"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Chuyển khoản mới",
    category: "Thu ngân",
    text: "Có giao dịch chuyển khoản mới số tiền {so_tien} đồng cần kiểm tra.",
    variables: ["so_tien"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Tạo QR bàn",
    category: "Thu ngân",
    text: "Đã tạo mã QR thanh toán thành công cho bàn {so_ban}.",
    variables: ["so_ban"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Hóa đơn thanh toán",
    category: "Thu ngân",
    text: "Vui lòng kiểm tra hóa đơn bàn {so_ban} trước khi thanh toán.",
    variables: ["so_ban"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Thông báo lương nhân viên",
    category: "Lương/Nhân sự",
    text: "Đã tạo phiếu lương cho nhân viên {ten_nhan_vien}.",
    variables: ["ten_nhan_vien"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Bảng lương sẵn sàng",
    category: "Lương/Nhân sự",
    text: "Danh sách lương tháng {thang_luong} đã sẵn sàng phê duyệt.",
    variables: ["thang_luong"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Chấm công hoàn tất",
    category: "Chấm công",
    text: "File chấm công ngày {ngay} đã được xử lý hoàn tất.",
    variables: ["ngay"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Thiếu giờ vào ra",
    category: "Chấm công",
    text: "Nhân viên {ten_nhan_vien} bị thiếu giờ vào hoặc giờ ra ca ngày {ngay}.",
    variables: ["ten_nhan_vien", "ngay"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 0.95,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Thông báo việc gấp",
    category: "Thông báo nhanh",
    text: "Có việc cần xử lý gấp. Vui lòng kiểm tra màn hình hệ thống.",
    variables: [],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Lưu dữ liệu thành công",
    category: "Thông báo nhanh",
    text: "Dữ liệu chấm công đã được lưu thành công vào bảng tính.",
    variables: [],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Thông báo đóng cửa",
    category: "Nhà hàng/Vận hành",
    text: "Nhà hàng chuẩn bị đóng cửa trong 30 phút nữa. Vui lòng dọn dẹp bàn làm việc.",
    variables: [],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 0.95,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false
  },
  {
    title: "Dời xe",
    category: "Thông báo nhanh",
    text: "Xin thông báo, Quý khách hàng có biển số xe {bien_so_xe}, vui lòng gặp bảo vệ để di chuyển xe đến vị trí khác. Xin cảm ơn quý khách!",
    variables: ["bien_so_xe"],
    providerId: "browser",
    voiceId: "",
    gender: "auto",
    lang: "vi-VN",
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    isFavorite: false,
    note: "Thông báo di dời xe của khách hàng"
  }
];

// FPT.AI Voices Configuration
const FPT_VOICES = [
  { id: 'banmai', name: 'Ban Mai (Nữ miền Bắc)' },
  { id: 'lannhi', name: 'Lan Nhi (Nữ miền Nam)' },
  { id: 'leminh', name: 'Lê Minh (Nam miền Bắc)' },
  { id: 'myan', name: 'Mỹ An (Nữ miền Trung)' },
  { id: 'thuminh', name: 'Thu Minh (Nữ miền Bắc)' },
  { id: 'giahuy', name: 'Gia Huy (Nam miền Trung)' },
  { id: 'linhsan', name: 'Linh San (Nữ miền Nam)' },
  { id: 'caoanh', name: 'Cao Anh (Nữ miền Nam - Cao cấp)' },
  { id: 'ngoclam', name: 'Ngọc Lam (Nữ miền Nam - Mới)' },
  { id: 'duyphuong', name: 'Duy Phương (Nam miền Nam)' },
  { id: 'thuha', name: 'Thu Hà (Nữ miền Bắc - Ấm áp)' },
  { id: 'minhquang', name: 'Minh Quang (Nam miền Bắc)' },
  { id: 'haicam', name: 'Hải Cẩm (Nữ miền Trung)' }
];

// Viettel AI Voices Configuration
const VIETTEL_VOICES = [
  { id: 'huyenchi', name: 'Huyền Chi (Nữ miền Bắc)' },
  { id: 'diemmy', name: 'Diễm My (Nữ miền Nam)' },
  { id: 'maihoa', name: 'Mai Hoa (Nữ miền Trung)' },
  { id: 'duongphuong', name: 'Phương Phương (Nam miền Bắc)' },
  { id: 'quangtuyen', name: 'Quang Tuyên (Nam miền Nam)' },
  { id: 'hn-quynhanh', name: 'Quỳnh Anh (Nữ miền Bắc - Mới)' },
  { id: 'hcm-diemmy', name: 'Diễm My (Nữ miền Nam - Cao cấp)' },
  { id: 'hue-maingoc', name: 'Mai Ngọc (Nữ miền Trung - Mới)' },
  { id: 'hn-phuongtrang', name: 'Phương Trang (Nữ miền Bắc)' },
  { id: 'hn-thaochi', name: 'Thảo Chi (Nữ miền Bắc)' },
  { id: 'hn-thanhha', name: 'Thanh Hà (Nữ miền Bắc)' },
  { id: 'hcm-phuongly', name: 'Phương Ly (Nữ miền Nam)' },
  { id: 'hcm-thuydung', name: 'Thùy Dung (Nữ miền Nam)' },
  { id: 'hn-thanhtung', name: 'Thanh Tùng (Nam miền Bắc)' },
  { id: 'hue-baoquoc', name: 'Bảo Quốc (Nam miền Trung)' },
  { id: 'hcm-minhquan', name: 'Minh Quân (Nam miền Nam)' },
  { id: 'hn-thanhphuong', name: 'Thanh Phương (Nữ miền Bắc)' },
  { id: 'hn-namkhanh', name: 'Nam Khánh (Nam miền Bắc)' },
  { id: 'hn-leyen', name: 'Lê Yên (Nữ miền Nam)' },
  { id: 'hn-tienquan', name: 'Tiến Quân (Nam miền Bắc)' },
  { id: 'hcm-thuyduyen', name: 'Thúy Duyên (Nữ miền Nam)' }
];

// Zalo AI Voices Configuration
const ZALO_VOICES = [
  { id: '1', name: 'Nữ miền Nam 1' },
  { id: '2', name: 'Nữ miền Bắc 1' },
  { id: '3', name: 'Nam miền Nam' },
  { id: '4', name: 'Nam miền Bắc' },
  { id: '5', name: 'Nữ miền Bắc 2' },
  { id: '6', name: 'Nữ miền Nam 2' }
];

// Helper to normalize numbers to words for natural Vietnamese speech
export function normalizeTextForVietnameseTTS(text: string): string {
  if (!text) return '';
  let str = text.trim().replace(/\s+/g, ' ');

  // 1. Convert currencies, e.g. "12000000đ" or "10.000 đ"
  str = str.replace(/(\d+[\d.,]*)\s*(đ|vnd|VND|đồng)/gi, (_match, amount) => {
    const cleanAmount = amount.replace(/[.,]/g, '');
    const num = parseInt(cleanAmount, 10);
    if (!isNaN(num)) {
      return numToVietnameseWords(num) + " đồng";
    }
    return _match;
  });

  // 2. Convert times, e.g. "18h30" or "18:30"
  str = str.replace(/(\d{1,2})[h:](\d{2})/gi, (_match, hour, minute) => {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (!isNaN(h) && !isNaN(m)) {
      return `${h} giờ ${m} phút`;
    }
    return _match;
  });
  str = str.replace(/(\d{1,2})h/gi, (_match, hour) => {
    const h = parseInt(hour, 10);
    if (!isNaN(h)) return `${h} giờ`;
    return _match;
  });

  // 3. Convert dates, e.g. "28/06/2026"
  str = str.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (_match, d, m, y) => {
    return `ngày ${d} tháng ${m} năm ${y}`;
  });

  // 4. Common abbreviations
  const abbrevs: { [key: string]: string } = {
    "QR": "kiu rờ",
    "TTS": "ti ti ét",
    "STT": "số thứ tự",
    "CMND": "chứng minh nhân dân",
    "CCCD": "căn cước công dân",
    "VIB": "vi ai bi",
    "VCB": "vi ét xi bi",
    "VIP": "víp",
    "NV": "nhân viên",
    "KH": "khách hàng",
    "GP": "giờ phát",
    "VD": "ví dụ"
  };

  Object.keys(abbrevs).forEach(key => {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    str = str.replace(regex, abbrevs[key]);
  });

  return str;
}

// Convert small/medium integers to Vietnamese words
function numToVietnameseWords(num: number): string {
  if (num === 0) return 'không';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  
  if (num < 10) return units[num];
  if (num === 10) return 'mười';
  if (num < 20) return 'mười ' + (num % 10 === 5 ? 'lăm' : units[num % 10]);
  
  const tram = Math.floor(num / 100);
  const chuc = Math.floor((num % 100) / 10);
  const dv = num % 10;
  
  if (num < 100) {
    let str = units[chuc] + ' mươi';
    if (dv === 1) str += ' mốt';
    else if (dv === 5) str += ' lăm';
    else if (dv > 0) str += ' ' + units[dv];
    return str;
  }

  // Handle larger values roughly
  if (num < 1000) {
    let str = units[tram] + ' trăm';
    if (chuc === 0 && dv > 0) str += ' lẻ ' + units[dv];
    else if (chuc > 0) {
      str += ' ' + units[chuc] + ' mươi';
      if (dv === 1) str += ' mốt';
      else if (dv === 5) str += ' lăm';
      else if (dv > 0) str += ' ' + units[dv];
    }
    return str;
  }

  if (num < 1000000) {
    const nghin = Math.floor(num / 1000);
    const du = num % 1000;
    let str = numToVietnameseWords(nghin) + ' nghìn';
    if (du > 0) {
      if (du < 100) str += ' không trăm';
      str += ' ' + numToVietnameseWords(du);
    }
    return str;
  }

  if (num < 1000000000) {
    const trieu = Math.floor(num / 1000000);
    const du = num % 1000000;
    let str = numToVietnameseWords(trieu) + ' triệu';
    if (du > 0) {
      str += ' ' + numToVietnameseWords(du);
    }
    return str;
  }

  return num.toLocaleString('vi-VN');
}

export default function TTSPage({ showToast, gasUrl, spreadsheetId }: TTSPageProps) {
  // TTS State
  const [templates, setTemplates] = useState<TTSTemplate[]>(() => {
    const saved = localStorage.getItem('kg_tool_tts_templates');
    return saved ? JSON.parse(saved) : [];
  });

  const [history, setHistory] = useState<TTSHistoryItem[]>(() => {
    const saved = localStorage.getItem('kg_tool_tts_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Providers & active configurations
  const [providerSettings, setProviderSettings] = useState(() => {
    const saved = localStorage.getItem('kg_tool_tts_provider_settings');
    const defaultSettings = {
      activeProvider: 'browser',
      browserVoiceURI: '',
      browserGender: 'auto',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      customEndpoint: 'http://localhost:5000/tts',
      fptApiKey: '',
      fptVoiceId: 'banmai',
      fptSpeed: 0,
      fptFormat: 'mp3',
      fptEndpoint: 'https://api.fpt.ai/hmi/tts/v5',
      viettelToken: '',
      viettelEndpoint: 'https://viettelai.vn/tts/v1/synthesis',
      viettelVoiceId: 'huyenchi',
      viettelSpeed: 1.0,
      viettelFormat: 'mp3',
      viettelReturnOption: 2,
      zaloApiKey: '',
      zaloVoiceId: '1',
      zaloSpeed: 1.0,
      zaloEndpoint: 'https://api.zalo.ai/v1/tts/synthesize',
      zaloDailyLimit: 5000,
      googleDailyLimit: 50000,
      googleSpeed: 1.0,
      edgeVoiceId: 'vi-VN-HoaiMyNeural',
      edgeRate: 1.0,
      edgePitch: 1.0,
      edgeDailyLimit: 100000,
      capcutVoiceId: 'BV074_streaming',
      capcutSpeed: 10,
      capcutPitch: 10,
      capcutDailyLimit: 100000,
      openaifmVoiceId: 'nova',
      openaifmSpeed: 1.0,
      openaifmPrompt: DEFAULT_OPENAIFM_PROMPT,
      openaifmEndpoint: 'https://www.openai.fm/api/generate',
      openaifmApiKey: '',
      openaifmDailyLimit: 50000,
      reverseProxyUrl: '',
      autoFallback: true,
      fptDailyLimit: 5000,
      viettelDailyLimit: 5000,
      autoOptimize: true
    };
    if (!saved) return defaultSettings;
    try {
      return { ...defaultSettings, ...JSON.parse(saved) };
    } catch (e) {
      return defaultSettings;
    }
  });

  // Consolidated Quota Initialization
  const initialQuotas = useMemo(() => {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('kg_tool_tts_quota_date');
    if (savedDate !== today) {
      localStorage.setItem('kg_tool_tts_quota_date', today);
      localStorage.setItem('kg_tool_tts_quota_fpt_today', '0');
      localStorage.setItem('kg_tool_tts_quota_viettel_today', '0');
      localStorage.setItem('kg_tool_tts_quota_zalo_today', '0');
      localStorage.setItem('kg_tool_tts_quota_google_today', '0');
      localStorage.setItem('kg_tool_tts_quota_edge_today', '0');
      localStorage.setItem('kg_tool_tts_quota_capcut_today', '0');
      localStorage.setItem('kg_tool_tts_quota_openaifm_today', '0');
      return { fpt: 0, viettel: 0, zalo: 0, google: 0, edge: 0, capcut: 0, openaifm: 0 };
    }
    return {
      fpt: parseInt(localStorage.getItem('kg_tool_tts_quota_fpt_today') || '0', 10),
      viettel: parseInt(localStorage.getItem('kg_tool_tts_quota_viettel_today') || '0', 10),
      zalo: parseInt(localStorage.getItem('kg_tool_tts_quota_zalo_today') || '0', 10),
      google: parseInt(localStorage.getItem('kg_tool_tts_quota_google_today') || '0', 10),
      edge: parseInt(localStorage.getItem('kg_tool_tts_quota_edge_today') || '0', 10),
      capcut: parseInt(localStorage.getItem('kg_tool_tts_quota_capcut_today') || '0', 10),
      openaifm: parseInt(localStorage.getItem('kg_tool_tts_quota_openaifm_today') || '0', 10)
    };
  }, []);

  // Quota usage states
  const [fptUsedToday, setFptUsedToday] = useState<number>(initialQuotas.fpt);
  const [viettelUsedToday, setViettelUsedToday] = useState<number>(initialQuotas.viettel);
  const [zaloUsedToday, setZaloUsedToday] = useState<number>(initialQuotas.zalo);
  const [googleUsedToday, setGoogleUsedToday] = useState<number>(initialQuotas.google);
  const [edgeUsedToday, setEdgeUsedToday] = useState<number>(initialQuotas.edge);
  const [capcutUsedToday, setCapcutUsedToday] = useState<number>(initialQuotas.capcut);
  const [openaifmUsedToday, setOpenaifmUsedToday] = useState<number>(initialQuotas.openaifm);

  const addQuotaUsage = (provider: 'fpt' | 'viettel' | 'zalo' | 'google' | 'edge' | 'capcut' | 'openaifm', charCount: number) => {
    if (provider === 'fpt') {
      setFptUsedToday(prev => {
        const next = prev + charCount;
        localStorage.setItem('kg_tool_tts_quota_fpt_today', next.toString());
        return next;
      });
    } else if (provider === 'viettel') {
      setViettelUsedToday(prev => {
        const next = prev + charCount;
        localStorage.setItem('kg_tool_tts_quota_viettel_today', next.toString());
        return next;
      });
    } else if (provider === 'zalo') {
      setZaloUsedToday(prev => {
        const next = prev + charCount;
        localStorage.setItem('kg_tool_tts_quota_zalo_today', next.toString());
        return next;
      });
    } else if (provider === 'google') {
      setGoogleUsedToday(prev => {
        const next = prev + charCount;
        localStorage.setItem('kg_tool_tts_quota_google_today', next.toString());
        return next;
      });
    } else if (provider === 'edge') {
      setEdgeUsedToday(prev => {
        const next = prev + charCount;
        localStorage.setItem('kg_tool_tts_quota_edge_today', next.toString());
        return next;
      });
    } else if (provider === 'capcut') {
      setCapcutUsedToday(prev => {
        const next = prev + charCount;
        localStorage.setItem('kg_tool_tts_quota_capcut_today', next.toString());
        return next;
      });
    } else if (provider === 'openaifm') {
      setOpenaifmUsedToday(prev => {
        const next = prev + charCount;
        localStorage.setItem('kg_tool_tts_quota_openaifm_today', next.toString());
        return next;
      });
    }
  };

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Text composer states
  const [composeText, setComposeText] = useState("Có khách đặt bàn mới. Khách tên {ten_khach}, {so_khach} khách, nhận bàn lúc {gio_nhan_ban}.");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeCategory, setComposeCategory] = useState("Đặt bàn");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Dynamic variables parsed from the text
  const [variablesInputValues, setVariablesInputValues] = useState<{ [key: string]: string }>({
    ten_khach: "Anh Tài",
    so_khach: "4",
    gio_nhan_ban: "18h30",
    so_ban: "5",
    khu_vuc: "Tầng 2",
    loai_tiec: "Sinh nhật",
    ten_nhan_vien: "Nguyễn Văn Sang",
    thang_luong: "06/2026",
    so_tien: "15.000.000đ",
    ngay: "28/06/2026",
    bien_so_xe: "30F - 123.45"
  });

  // System voices list
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused'>('idle');

  // Sidebar search & category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [suggestionCategory, setSuggestionCategory] = useState('all');

  // Main Subtabs Navigation
  const [mainTab, setMainTab] = useState<'broadcast' | 'settings' | 'history'>('broadcast');
  const [mobileBroadcastTab, setMobileBroadcastTab] = useState<'compose' | 'templates'>('compose');

  // Mobile layout state listener
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Support incoming text from Browser Extension context menu (?tab=tts&text=...)
    const params = new URLSearchParams(window.location.search);
    const extText = params.get('text');
    if (extText && extText.trim()) {
      setComposeText(extText.trim());
      setSelectedTemplateId(null);
      setComposeTitle('Phát nhanh từ Tiện ích mở rộng');
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync settings/entries locally
  useEffect(() => {
    localStorage.setItem('kg_tool_tts_templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem('kg_tool_tts_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('kg_tool_tts_provider_settings', JSON.stringify(providerSettings));
  }, [providerSettings]);

  // Load voices for Web Speech API
  const loadVoices = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      let speechVoices = window.speechSynthesis.getVoices();
      setVoices(speechVoices);
    }
  };

  useEffect(() => {
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Load settings from spreadsheet automatically on mount if connected
  const loadSettingsFromSpreadsheet = async () => {
    if (!gasUrl || !spreadsheetId) return;
    try {
      const getUrl = `${gasUrl}?action=get_tts_settings&ssId=${spreadsheetId}`;
      const response = await fetch(getUrl);
      const result = await response.json();
      if (result.success && result.data) {
        const cloudSettings = result.data;
        setProviderSettings((prev: any) => ({
          ...prev,
          fptApiKey: cloudSettings.fptApiKey !== undefined ? cloudSettings.fptApiKey : prev.fptApiKey,
          viettelToken: cloudSettings.viettelToken !== undefined ? cloudSettings.viettelToken : prev.viettelToken,
          zaloApiKey: cloudSettings.zaloApiKey !== undefined ? cloudSettings.zaloApiKey : prev.zaloApiKey,
        }));
      }
    } catch (e) {
      console.warn("Failed to load settings from spreadsheet:", e);
    }
  };

  useEffect(() => {
    if (gasUrl && spreadsheetId) {
      loadSettingsFromSpreadsheet();
    }
  }, [gasUrl, spreadsheetId]);

  const handleSaveSettingsToCloud = async () => {
    if (!gasUrl || !spreadsheetId) {
      showToast('Vui lòng kết nối Google Sheet trong cấu hình hệ thống trước.', 'error');
      return;
    }
    showToast('Đang lưu và đồng bộ cấu hình lên Google Sheets...', 'info');
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          action: 'save_tts_settings',
          spreadsheetId: spreadsheetId,
          settings: [
            { key: 'fptApiKey', value: providerSettings.fptApiKey || '' },
            { key: 'viettelToken', value: providerSettings.viettelToken || '' },
            { key: 'zaloApiKey', value: providerSettings.zaloApiKey || '' }
          ]
        })
      });
      showToast('Đã lưu cấu hình lên Google Sheets thành công!', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(`Không thể đồng bộ cấu hình: ${e.message}`, 'error');
    }
  };

  // Parse variables from composeText, anything inside { }
  const parsedVariables = useMemo(() => {
    const matches = composeText.match(/\{([a-zA-Z0-9_]+)\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map(m => m.slice(1, -1))));
  }, [composeText]);

  // Interpolated string with replacement values
  const interpolatedText = useMemo(() => {
    let result = composeText;
    parsedVariables.forEach(v => {
      const val = variablesInputValues[v] || `{${v}}`;
      result = result.replace(new RegExp(`\\{${v}\\}`, 'g'), val);
    });
    return result;
  }, [composeText, parsedVariables, variablesInputValues]);

  // Clean Normalized text to speak
  const normalizedTextToSpeak = useMemo(() => {
    return providerSettings.autoOptimize 
      ? normalizeTextForVietnameseTTS(interpolatedText)
      : interpolatedText;
  }, [interpolatedText, providerSettings.autoOptimize]);

  // Available Categories in library
  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category));
    return ['All', 'Favorite', ...Array.from(cats)];
  }, [templates]);

  // Filter templates list
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.text.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (activeCategory === 'All') return matchSearch;
      if (activeCategory === 'Favorite') return t.isFavorite && matchSearch;
      return t.category === activeCategory && matchSearch;
    });
  }, [templates, activeCategory, searchQuery]);
 
  // Filter default suggestions by category
  const filteredSuggestions = useMemo(() => {
    if (suggestionCategory === 'all') return DEFAULT_SUGGESTIONS;
    return DEFAULT_SUGGESTIONS.filter(s => s.category.toLowerCase().includes(suggestionCategory.toLowerCase()));
  }, [suggestionCategory]);

  // Play browser speech synthesis
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakBrowser = (textToSpeak: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      showToast('Trình duyệt không hỗ trợ Web Speech API.', 'error');
      return;
    }

    window.speechSynthesis.cancel(); // Stop current speech
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    synthRef.current = utterance;
    
    utterance.lang = 'vi-VN';
    utterance.rate = providerSettings.rate;
    utterance.pitch = providerSettings.pitch;
    utterance.volume = providerSettings.volume;

    // Resolve voice
    if (providerSettings.browserVoiceURI) {
      const selectedVoice = voices.find(v => v.voiceURI === providerSettings.browserVoiceURI);
      if (selectedVoice) utterance.voice = selectedVoice;
    } else {
      // Auto-fallback search vi-VN voice
      const viVoice = voices.find(v => v.lang.startsWith('vi'));
      if (viVoice) utterance.voice = viVoice;
    }

    utterance.onstart = () => {
      setPlaybackState('playing');
    };

    utterance.onend = () => {
      setPlaybackState('idle');
      addHistoryLog(interpolatedText, 'success');
    };

    utterance.onerror = (e) => {
      setPlaybackState('idle');
      console.error(e);
      addHistoryLog(interpolatedText, 'failed', e.error || 'Lỗi phát giọng nói trình duyệt');
      showToast(`Lỗi phát âm: ${e.error || 'Trình duyệt ngắt kết nối'}`, 'error');
    };

    window.speechSynthesis.speak(utterance);
  };

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Play using FPT.AI
  const speakFpt = async (textToSpeak: string) => {
    const charCount = textToSpeak.length;
    if (fptUsedToday + charCount > providerSettings.fptDailyLimit) {
      if (providerSettings.autoFallback) {
        showToast('FPT.AI đã vượt quá hạn mức Quota trong ngày. Đang chuyển sang Web Speech API...', 'info');
        speakBrowser(textToSpeak);
        return;
      } else {
        showToast('Vượt quá hạn mức Quota trong ngày của FPT.AI.', 'error');
        return;
      }
    }

    if (!providerSettings.fptApiKey) {
      if (providerSettings.autoFallback) {
        showToast('Chưa cấu hình API Key cho FPT.AI. Tự động dùng Web Speech API...', 'info');
        speakBrowser(textToSpeak);
        return;
      } else {
        showToast('Vui lòng nhập API Key cho FPT.AI trong Cấu hình.', 'error');
        return;
      }
    }

    setPlaybackState('playing');
    showToast('Đang gửi văn bản tới FPT.AI...', 'info');

    try {
      const response = await fetch(providerSettings.fptEndpoint, {
        method: 'POST',
        headers: {
          'api_key': providerSettings.fptApiKey,
          'speed': String(providerSettings.fptSpeed),
          'voice': providerSettings.fptVoiceId,
          'format': providerSettings.fptFormat
        },
        body: textToSpeak
      });

      if (!response.ok) {
        throw new Error(`FPT.AI trả về lỗi: ${response.status}`);
      }

      const result = await response.json();
      if (result.error !== 0) {
        throw new Error(result.message || 'Lỗi xử lý FPT.AI');
      }

      const asyncUrl = result.async;
      if (!asyncUrl) {
        throw new Error('Không nhận được audio URL từ FPT.AI');
      }

      // Poll URL check availability
      showToast('Đang tạo giọng nói FPT.AI...', 'info');
      let ready = false;
      let retries = 6;
      
      while (retries > 0 && !ready) {
        await new Promise(r => setTimeout(r, 1500));
        try {
          const check = await fetch(asyncUrl, { method: 'HEAD' });
          if (check.ok) {
            ready = true;
          }
        } catch (e) {
          // Retry
        }
        retries--;
      }

      if (!ready) {
        throw new Error('Thời gian tạo file audio của FPT.AI quá lâu, vui lòng phát lại.');
      }

      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }

      const audio = new Audio(asyncUrl);
      activeAudioRef.current = audio;
      audio.volume = providerSettings.volume;

      audio.onplay = () => {
        setPlaybackState('playing');
      };
      audio.onended = () => {
        setPlaybackState('idle');
        addQuotaUsage('fpt', charCount);
        addHistoryLog(interpolatedText, 'success');
      };
      audio.onerror = () => {
        setPlaybackState('idle');
        addHistoryLog(interpolatedText, 'failed', 'Lỗi tải audio từ FPT.AI');
        showToast('Lỗi phát âm thanh từ FPT.AI.', 'error');
      };

      audio.play();

    } catch (err: any) {
      setPlaybackState('idle');
      addHistoryLog(interpolatedText, 'failed', err.message);
      showToast(`FPT.AI lỗi: ${err.message}. Tự động fallback về Browser...`, 'error');
      speakBrowser(textToSpeak);
    }
  };

  // Play using Viettel AI
  const speakViettel = async (textToSpeak: string) => {
    const charCount = textToSpeak.length;
    if (viettelUsedToday + charCount > providerSettings.viettelDailyLimit) {
      if (providerSettings.autoFallback) {
        showToast('Viettel AI đã vượt quá hạn mức Quota trong ngày. Đang chuyển sang Web Speech API...', 'info');
        speakBrowser(textToSpeak);
        return;
      } else {
        showToast('Vượt quá hạn mức Quota trong ngày của Viettel AI.', 'error');
        return;
      }
    }

    if (!providerSettings.viettelToken) {
      if (providerSettings.autoFallback) {
        showToast('Chưa cấu hình Token cho Viettel AI. Tự động dùng Web Speech API...', 'info');
        speakBrowser(textToSpeak);
        return;
      } else {
        showToast('Vui lòng nhập Token cho Viettel AI trong Cấu hình.', 'error');
        return;
      }
    }

    setPlaybackState('playing');
    showToast('Đang gửi văn bản tới Viettel AI...', 'info');

    try {
      const response = await fetch(providerSettings.viettelEndpoint, {
        method: 'POST',
        headers: {
          'token': providerSettings.viettelToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: textToSpeak,
          voice: providerSettings.viettelVoiceId,
          speed: providerSettings.viettelSpeed,
          tts_return_option: providerSettings.viettelReturnOption,
          format: providerSettings.viettelFormat
        })
      });

      if (!response.ok) {
        throw new Error(`Viettel AI trả về lỗi: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let audioUrl = '';

      if (contentType.includes('json')) {
        const result = await response.json();
        audioUrl = result.url || result.audio_url || result.data;
        if (!audioUrl) {
          throw new Error('Không có URL âm thanh trong phản hồi JSON của Viettel AI');
        }
      } else {
        const blob = await response.blob();
        audioUrl = URL.createObjectURL(blob);
      }

      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      audio.volume = providerSettings.volume;

      audio.onplay = () => {
        setPlaybackState('playing');
      };
      audio.onended = () => {
        setPlaybackState('idle');
        addQuotaUsage('viettel', charCount);
        addHistoryLog(interpolatedText, 'success');
      };
      audio.onerror = () => {
        setPlaybackState('idle');
        addHistoryLog(interpolatedText, 'failed', 'Lỗi tải audio từ Viettel AI');
        showToast('Lỗi phát âm thanh từ Viettel AI.', 'error');
      };

      audio.play();

    } catch (err: any) {
      setPlaybackState('idle');
      addHistoryLog(interpolatedText, 'failed', err.message);
      showToast(`Viettel AI lỗi: ${err.message}. Tự động fallback về Browser...`, 'error');
      speakBrowser(textToSpeak);
    }
  };

  // Play using custom API endpoint (Piper / Kokoro / Cloud Proxy)
  const speakCustom = async (textToSpeak: string) => {
    setPlaybackState('playing');
    showToast('Đang tải dữ liệu từ TTS server...', 'info');

    try {
      const url = `${providerSettings.customEndpoint}?text=${encodeURIComponent(textToSpeak)}&rate=${providerSettings.rate}&pitch=${providerSettings.pitch}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Server trả về mã lỗi: ${response.status}`);
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      audio.volume = providerSettings.volume;
      
      audio.onplay = () => {
        setPlaybackState('playing');
      };
      
      audio.onended = () => {
        setPlaybackState('idle');
        addHistoryLog(interpolatedText, 'success');
      };

      audio.onerror = () => {
        setPlaybackState('idle');
        addHistoryLog(interpolatedText, 'failed', 'Lỗi tải tệp âm thanh WAV/MP3');
        showToast('Không thể giải mã tệp âm thanh từ Custom Server.', 'error');
      };

      audio.play();
    } catch (err: any) {
      setPlaybackState('idle');
      addHistoryLog(interpolatedText, 'failed', err.message);
      showToast(`Không kết nối được Custom TTS Server: ${err.message}. Tự động chuyển đổi sang giọng đọc mặc định...`, 'error');
      speakBrowser(textToSpeak);
    }
  };

  // Play using Zalo AI
  const speakZalo = async (textToSpeak: string) => {
    const charCount = textToSpeak.length;
    if (zaloUsedToday + charCount > providerSettings.zaloDailyLimit) {
      if (providerSettings.autoFallback) {
        showToast('Zalo AI đã vượt quá hạn mức Quota trong ngày. Đang chuyển sang Web Speech API...', 'info');
        speakBrowser(textToSpeak);
        return;
      } else {
        showToast('Vượt quá hạn mức Quota trong ngày của Zalo AI.', 'error');
        return;
      }
    }

    if (!providerSettings.zaloApiKey) {
      if (providerSettings.autoFallback) {
        showToast('Chưa cấu hình API Key cho Zalo AI. Tự động dùng Web Speech API...', 'info');
        speakBrowser(textToSpeak);
        return;
      } else {
        showToast('Vui lòng nhập API Key cho Zalo AI trong Cấu hình.', 'error');
        return;
      }
    }

    setPlaybackState('playing');
    showToast('Đang gửi văn bản tới Zalo AI...', 'info');

    try {
      const params = new URLSearchParams();
      params.append('input', textToSpeak);
      params.append('speaker_id', providerSettings.zaloVoiceId);
      params.append('speed', String(providerSettings.zaloSpeed));

      const response = await fetch(providerSettings.zaloEndpoint, {
        method: 'POST',
        headers: {
          'apikey': providerSettings.zaloApiKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        throw new Error(`Zalo AI trả về lỗi: ${response.status}`);
      }

      const result = await response.json();
      if (result.error_code !== 0) {
        throw new Error(result.error_message || 'Lỗi xử lý Zalo AI');
      }

      const audioUrl = result.data?.url;
      if (!audioUrl) {
        throw new Error('Không nhận được audio URL từ Zalo AI');
      }

      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      audio.volume = providerSettings.volume;

      audio.onplay = () => {
        setPlaybackState('playing');
      };
      audio.onended = () => {
        setPlaybackState('idle');
        addQuotaUsage('zalo', charCount);
        addHistoryLog(interpolatedText, 'success');
      };
      audio.onerror = () => {
        setPlaybackState('idle');
        addHistoryLog(interpolatedText, 'failed', 'Lỗi tải audio từ Zalo AI');
        showToast('Lỗi phát âm thanh từ Zalo AI.', 'error');
      };

      audio.play();

    } catch (err: any) {
      setPlaybackState('idle');
      addHistoryLog(interpolatedText, 'failed', err.message);
      showToast(`Zalo AI lỗi: ${err.message}. Tự động fallback về Browser...`, 'error');
      speakBrowser(textToSpeak);
    }
  };

  // Play using Google Translate TTS (Upgraded gTTS / node-gtts chunking & proxy)
  const speakGoogle = async (textToSpeak: string) => {
    const charCount = textToSpeak.length;
    if (googleUsedToday + charCount > providerSettings.googleDailyLimit) {
      if (providerSettings.autoFallback) {
        showToast('Google TTS đã vượt quá hạn mức Quota trong ngày. Đang chuyển sang Web Speech API...', 'info');
        speakBrowser(textToSpeak);
        return;
      } else {
        showToast('Vượt quá hạn mức Quota trong ngày của Google TTS.', 'error');
        return;
      }
    }

    setPlaybackState('playing');
    showToast('Đang tải âm thanh từ Google TTS (gTTS)...', 'info');

    try {
      const result = await synthesizeReverseEngineeredTTS({
        provider: 'google',
        text: textToSpeak,
        rate: providerSettings.googleSpeed || 1.0,
        proxyUrl: providerSettings.reverseProxyUrl,
        gasUrl,
      });

      const audioUrl = result.blob ? URL.createObjectURL(result.blob) : result.audioUrl!;

      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      audio.volume = providerSettings.volume;
      if (providerSettings.googleSpeed && providerSettings.googleSpeed !== 1.0) {
        audio.playbackRate = providerSettings.googleSpeed;
      }

      audio.onplay = () => {
        setPlaybackState('playing');
      };
      audio.onended = () => {
        setPlaybackState('idle');
        if (result.blob) URL.revokeObjectURL(audioUrl);
        addQuotaUsage('google', charCount);
        addHistoryLog(interpolatedText, 'success');
      };
      audio.onerror = () => {
        setPlaybackState('idle');
        if (result.blob) URL.revokeObjectURL(audioUrl);
        addHistoryLog(interpolatedText, 'failed', 'Lỗi tải audio từ Google TTS');
        showToast('Lỗi phát âm thanh từ Google TTS.', 'error');
      };

      await audio.play();
    } catch (err: any) {
      setPlaybackState('idle');
      addHistoryLog(interpolatedText, 'failed', err.message);
      showToast(`Google TTS lỗi: ${err.message}. Tự động fallback về Browser...`, 'error');
      speakBrowser(textToSpeak);
    }
  };

  // Play using Microsoft Edge Neural TTS (hass-edge-tts / rany2/edge-tts Sec-MS-GEC v2)
  const speakEdge = async (textToSpeak: string) => {
    const charCount = textToSpeak.length;
    if (edgeUsedToday + charCount > (providerSettings.edgeDailyLimit || 100000)) {
      if (providerSettings.autoFallback) {
        showToast('Edge Neural TTS đã vượt hạn mức ngày. Đang chuyển sang Web Speech API...', 'info');
        speakBrowser(textToSpeak);
        return;
      } else {
        showToast('Vượt quá hạn mức Quota trong ngày của Edge Neural TTS.', 'error');
        return;
      }
    }

    setPlaybackState('playing');
    const voiceObj = EDGE_VOICES.find(v => v.id === providerSettings.edgeVoiceId);
    showToast(`Đang tạo giọng đọc Edge Neural (${voiceObj ? voiceObj.name.split(' (')[0] : providerSettings.edgeVoiceId})...`, 'info');

    try {
      const result = await synthesizeReverseEngineeredTTS({
        provider: 'edge',
        text: textToSpeak,
        voice: providerSettings.edgeVoiceId || 'vi-VN-HoaiMyNeural',
        rate: providerSettings.edgeRate ?? 1.0,
        pitch: providerSettings.edgePitch ?? 1.0,
        volume: providerSettings.volume ?? 1.0,
        proxyUrl: providerSettings.reverseProxyUrl,
        gasUrl,
      });

      if (!result.blob) throw new Error('Không nhận được dữ liệu MP3 từ Edge TTS');
      const audioUrl = URL.createObjectURL(result.blob);

      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      audio.volume = providerSettings.volume;

      audio.onplay = () => setPlaybackState('playing');
      audio.onended = () => {
        setPlaybackState('idle');
        URL.revokeObjectURL(audioUrl);
        addQuotaUsage('edge', charCount);
        addHistoryLog(interpolatedText, 'success');
      };
      audio.onerror = () => {
        setPlaybackState('idle');
        URL.revokeObjectURL(audioUrl);
        addHistoryLog(interpolatedText, 'failed', 'Lỗi giải mã MP3 từ Edge TTS');
        showToast('Lỗi phát âm thanh từ Edge Neural TTS.', 'error');
      };

      await audio.play();
    } catch (err: any) {
      setPlaybackState('idle');
      addHistoryLog(interpolatedText, 'failed', err.message);
      if (providerSettings.autoFallback) {
        showToast(`Edge TTS lỗi: ${err.message}. Tự động fallback về Browser...`, 'error');
        speakBrowser(textToSpeak);
      } else {
        showToast(`Edge TTS lỗi: ${err.message}`, 'error');
      }
    }
  };

  // Play using CapCut / ByteDance SAMI TTS (CapCut-TTS v1 WS & capcut-tts-api)
  const speakCapCut = async (textToSpeak: string) => {
    const charCount = textToSpeak.length;
    if (capcutUsedToday + charCount > (providerSettings.capcutDailyLimit || 100000)) {
      if (providerSettings.autoFallback) {
        showToast('CapCut TTS đã vượt hạn mức ngày. Đang chuyển sang Web Speech API...', 'info');
        speakBrowser(textToSpeak);
        return;
      } else {
        showToast('Vượt quá hạn mức Quota trong ngày của CapCut TTS.', 'error');
        return;
      }
    }

    setPlaybackState('playing');
    const voiceObj = CAPCUT_VOICES.find(v => v.id === providerSettings.capcutVoiceId);
    showToast(`Đang tạo giọng CapCut AI (${voiceObj ? voiceObj.name.split(' (')[0] : providerSettings.capcutVoiceId})...`, 'info');

    try {
      const result = await synthesizeReverseEngineeredTTS({
        provider: 'capcut',
        text: textToSpeak,
        voice: providerSettings.capcutVoiceId || 'BV074_streaming',
        rate: providerSettings.capcutSpeed ?? 10,
        pitch: providerSettings.capcutPitch ?? 10,
        volume: providerSettings.volume ?? 1.0,
        proxyUrl: providerSettings.reverseProxyUrl,
        gasUrl,
      });

      if (!result.blob) throw new Error('Không nhận được dữ liệu âm thanh từ CapCut TTS');
      const audioUrl = URL.createObjectURL(result.blob);

      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      audio.volume = providerSettings.volume;

      audio.onplay = () => setPlaybackState('playing');
      audio.onended = () => {
        setPlaybackState('idle');
        URL.revokeObjectURL(audioUrl);
        addQuotaUsage('capcut', charCount);
        addHistoryLog(interpolatedText, 'success');
      };
      audio.onerror = () => {
        setPlaybackState('idle');
        URL.revokeObjectURL(audioUrl);
        addHistoryLog(interpolatedText, 'failed', 'Lỗi giải mã WAV từ CapCut TTS');
        showToast('Lỗi phát âm thanh từ CapCut TTS.', 'error');
      };

      await audio.play();
    } catch (err: any) {
      setPlaybackState('idle');
      addHistoryLog(interpolatedText, 'failed', err.message);
      if (providerSettings.autoFallback) {
        showToast(`CapCut TTS lỗi: ${err.message}. Tự động fallback về Browser...`, 'error');
        speakBrowser(textToSpeak);
      } else {
        showToast(`CapCut TTS lỗi: ${err.message}`, 'error');
      }
    }
  };

  // Play using OpenAI.fm / TTSFM (GPT-4o mini TTS)
  const speakOpenAIFm = async (textToSpeak: string) => {
    const charCount = textToSpeak.length;
    if (openaifmUsedToday + charCount > (providerSettings.openaifmDailyLimit || 50000)) {
      if (providerSettings.autoFallback) {
        showToast('OpenAI.fm TTS đã vượt hạn mức ngày. Đang chuyển sang Web Speech API...', 'info');
        speakBrowser(textToSpeak);
        return;
      } else {
        showToast('Vượt quá hạn mức Quota trong ngày của OpenAI.fm TTS.', 'error');
        return;
      }
    }

    setPlaybackState('playing');
    showToast(`Đang tạo giọng đọc AI từ OpenAI.fm (${providerSettings.openaifmVoiceId || 'nova'})...`, 'info');

    try {
      const result = await synthesizeReverseEngineeredTTS({
        provider: 'openaifm',
        text: textToSpeak,
        voice: providerSettings.openaifmVoiceId || 'nova',
        rate: providerSettings.openaifmSpeed ?? 1.0,
        prompt: providerSettings.openaifmPrompt || DEFAULT_OPENAIFM_PROMPT,
        apiKey: providerSettings.openaifmApiKey,
        endpoint: providerSettings.openaifmEndpoint,
        proxyUrl: providerSettings.reverseProxyUrl,
        gasUrl,
      });

      if (!result.blob) throw new Error('Không nhận được dữ liệu âm thanh từ OpenAI.fm');
      if (result.fallbackUsed) {
        showToast(`OpenAI.fm đang bật chống bot, đã tự động chuyển tiếp sang giọng Neural (${result.fallbackUsed})`, 'info');
      }
      const audioUrl = URL.createObjectURL(result.blob);

      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      audio.volume = providerSettings.volume;
      if (providerSettings.openaifmSpeed && providerSettings.openaifmSpeed !== 1.0) {
        audio.playbackRate = providerSettings.openaifmSpeed;
      }

      audio.onplay = () => setPlaybackState('playing');
      audio.onended = () => {
        setPlaybackState('idle');
        URL.revokeObjectURL(audioUrl);
        addQuotaUsage('openaifm', charCount);
        addHistoryLog(interpolatedText, 'success');
      };
      audio.onerror = () => {
        setPlaybackState('idle');
        URL.revokeObjectURL(audioUrl);
        addHistoryLog(interpolatedText, 'failed', 'Lỗi giải mã âm thanh từ OpenAI.fm');
        showToast('Lỗi phát âm thanh từ OpenAI.fm.', 'error');
      };

      await audio.play();
    } catch (err: any) {
      setPlaybackState('idle');
      addHistoryLog(interpolatedText, 'failed', err.message);
      if (providerSettings.autoFallback) {
        showToast(`OpenAI.fm lỗi: ${err.message}. Tự động fallback về Browser...`, 'error');
        speakBrowser(textToSpeak);
      } else {
        showToast(`OpenAI.fm lỗi: ${err.message}`, 'error');
      }
    }
  };

  // Unified dispatcher for all 9 TTS providers
  const dispatchSpeak = async (textToSpeak: string, targetProvider?: string) => {
    const provider = targetProvider || providerSettings.activeProvider;
    if (provider === 'browser') {
      speakBrowser(textToSpeak);
    } else if (provider === 'edge') {
      await speakEdge(textToSpeak);
    } else if (provider === 'capcut') {
      await speakCapCut(textToSpeak);
    } else if (provider === 'openaifm') {
      await speakOpenAIFm(textToSpeak);
    } else if (provider === 'google') {
      await speakGoogle(textToSpeak);
    } else if (provider === 'fpt') {
      await speakFpt(textToSpeak);
    } else if (provider === 'viettel') {
      await speakViettel(textToSpeak);
    } else if (provider === 'zalo') {
      await speakZalo(textToSpeak);
    } else if (provider === 'custom') {
      await speakCustom(textToSpeak);
    } else {
      speakBrowser(textToSpeak);
    }
  };

  const handleSpeak = async () => {
    if (!interpolatedText.trim()) {
      showToast('Vui lòng soạn câu nói trước khi nghe thử.', 'error');
      return;
    }
    await dispatchSpeak(normalizedTextToSpeak);
  };

  const handleStop = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.src = '';
    }
    setPlaybackState('idle');
  };

  // Helper to add history record
  const addHistoryLog = (text: string, status: 'success' | 'failed', errMsg?: string) => {
    const p = providerSettings.activeProvider;
    const newItem: TTSHistoryItem = {
      id: 'hist-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      templateId: selectedTemplateId || undefined,
      text: text,
      normalizedText: normalizedTextToSpeak,
      providerId: p,
      voiceId: p === 'browser'
        ? (providerSettings.browserVoiceURI || 'Default vi-VN')
        : p === 'edge'
        ? providerSettings.edgeVoiceId
        : p === 'capcut'
        ? providerSettings.capcutVoiceId
        : p === 'openaifm'
        ? providerSettings.openaifmVoiceId
        : p === 'fpt'
        ? providerSettings.fptVoiceId
        : p === 'viettel'
        ? providerSettings.viettelVoiceId
        : p === 'zalo'
        ? providerSettings.zaloVoiceId
        : p === 'google'
        ? 'Google Translate vi-VN'
        : 'Custom Voice',
      gender: p === 'browser' ? providerSettings.browserGender : 'auto',
      rate: p === 'browser'
        ? providerSettings.rate
        : p === 'edge'
        ? providerSettings.edgeRate
        : p === 'capcut'
        ? providerSettings.capcutSpeed
        : p === 'openaifm'
        ? providerSettings.openaifmSpeed
        : p === 'google'
        ? providerSettings.googleSpeed
        : p === 'fpt'
        ? providerSettings.fptSpeed
        : p === 'viettel'
        ? providerSettings.viettelSpeed
        : p === 'zalo'
        ? providerSettings.zaloSpeed
        : 1.0,
      pitch: p === 'browser'
        ? providerSettings.pitch
        : p === 'edge'
        ? providerSettings.edgePitch
        : p === 'capcut'
        ? providerSettings.capcutPitch
        : 1.0,
      volume: providerSettings.volume,
      playedAt: new Date().toISOString(),
      status: status,
      errorMessage: errMsg
    };
    setHistory((prev: TTSHistoryItem[]) => [newItem, ...prev].slice(0, 100)); // Keep max 100 items

    // Auto-save history row in Spreadsheet if active connection exists
    if (spreadsheetId && gasUrl) {
      saveHistoryToSpreadsheet(newItem);
    }
  };

  // 1. SAVE NEW / UPDATE TEMPLATE
  const handleSaveTemplate = () => {
    if (!composeText.trim()) {
      showToast('Nội dung mẫu câu trống.', 'error');
      return;
    }

    const title = composeTitle.trim() || `Mẫu câu #${templates.length + 1}`;
    const id = selectedTemplateId || 'tpl-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const p = providerSettings.activeProvider;

    const newTpl: TTSTemplate = {
      id,
      title,
      category: composeCategory,
      text: composeText,
      variables: parsedVariables,
      providerId: p,
      voiceId: p === 'browser'
        ? providerSettings.browserVoiceURI
        : p === 'edge'
        ? providerSettings.edgeVoiceId
        : p === 'capcut'
        ? providerSettings.capcutVoiceId
        : p === 'openaifm'
        ? providerSettings.openaifmVoiceId
        : p === 'fpt'
        ? providerSettings.fptVoiceId
        : p === 'viettel'
        ? providerSettings.viettelVoiceId
        : p === 'zalo'
        ? providerSettings.zaloVoiceId
        : '',
      gender: p === 'browser' ? providerSettings.browserGender : 'auto',
      lang: 'vi-VN',
      rate: p === 'browser'
        ? providerSettings.rate
        : p === 'edge'
        ? providerSettings.edgeRate
        : p === 'capcut'
        ? providerSettings.capcutSpeed
        : p === 'openaifm'
        ? providerSettings.openaifmSpeed
        : p === 'google'
        ? providerSettings.googleSpeed
        : p === 'fpt'
        ? providerSettings.fptSpeed
        : p === 'viettel'
        ? providerSettings.viettelSpeed
        : p === 'zalo'
        ? providerSettings.zaloSpeed
        : 1.0,
      pitch: p === 'browser'
        ? providerSettings.pitch
        : p === 'edge'
        ? providerSettings.edgePitch
        : p === 'capcut'
        ? providerSettings.capcutPitch
        : 1.0,
      volume: providerSettings.volume,
      isFavorite: templates.find(t => t.id === id)?.isFavorite || false,
      createdAt: templates.find(t => t.id === id)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setTemplates((prev: TTSTemplate[]) => {
      const exists = prev.some(t => t.id === id);
      if (exists) {
        return prev.map(t => t.id === id ? newTpl : t);
      } else {
        return [newTpl, ...prev];
      }
    });

    setSelectedTemplateId(id);
    setComposeTitle(title);
    showToast('Đã lưu mẫu câu thành công!', 'success');

    // Sync save to sheet if connected
    if (spreadsheetId && gasUrl) {
      saveTemplateToSpreadsheet(newTpl);
    }
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Bạn có chắc chắn muốn xóa mẫu câu này?')) {
      setTemplates((prev: TTSTemplate[]) => prev.filter(t => t.id !== id));
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
        setComposeTitle('');
      }
      showToast('Đã xóa mẫu câu.', 'info');

      // Sync deletion to sheet
      if (spreadsheetId && gasUrl) {
        deleteTemplateFromSpreadsheet(id);
      }
    }
  };

  const handleSelectTemplate = (tpl: TTSTemplate) => {
    setSelectedTemplateId(tpl.id);
    setComposeText(tpl.text);
    setComposeTitle(tpl.title);
    setComposeCategory(tpl.category);

    // Apply preset synthesis settings if present
    setProviderSettings((prev: any) => {
      const p = tpl.providerId;
      return {
        ...prev,
        activeProvider: p || prev.activeProvider,
        volume: tpl.volume ?? prev.volume,
        rate: p === 'browser' ? tpl.rate : prev.rate,
        browserVoiceURI: p === 'browser' ? tpl.voiceId : prev.browserVoiceURI,
        edgeVoiceId: p === 'edge' && tpl.voiceId ? tpl.voiceId : prev.edgeVoiceId,
        edgeRate: p === 'edge' && tpl.rate ? tpl.rate : prev.edgeRate,
        edgePitch: p === 'edge' && tpl.pitch ? tpl.pitch : prev.edgePitch,
        capcutVoiceId: p === 'capcut' && tpl.voiceId ? tpl.voiceId : prev.capcutVoiceId,
        capcutSpeed: p === 'capcut' && tpl.rate ? tpl.rate : prev.capcutSpeed,
        capcutPitch: p === 'capcut' && tpl.pitch ? tpl.pitch : prev.capcutPitch,
        openaifmVoiceId: p === 'openaifm' && tpl.voiceId ? tpl.voiceId : prev.openaifmVoiceId,
        openaifmSpeed: p === 'openaifm' && tpl.rate ? tpl.rate : prev.openaifmSpeed,
        googleSpeed: p === 'google' && tpl.rate ? tpl.rate : prev.googleSpeed,
        fptVoiceId: p === 'fpt' && tpl.voiceId ? tpl.voiceId : prev.fptVoiceId,
        fptSpeed: p === 'fpt' ? tpl.rate : prev.fptSpeed,
        viettelVoiceId: p === 'viettel' && tpl.voiceId ? tpl.voiceId : prev.viettelVoiceId,
        viettelSpeed: p === 'viettel' ? tpl.rate : prev.viettelSpeed,
        zaloVoiceId: p === 'zalo' && tpl.voiceId ? tpl.voiceId : prev.zaloVoiceId,
        zaloSpeed: p === 'zalo' ? tpl.rate : prev.zaloSpeed
      };
    });

    setMobileBroadcastTab('compose');
  };

  // Ghim yêu thích
  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplates((prev: TTSTemplate[]) => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, isFavorite: !t.isFavorite };
        if (spreadsheetId && gasUrl) saveTemplateToSpreadsheet(updated);
        return updated;
      }
      return t;
    }));
  };

  // Add default suggestions templates into active library
  const handleLoadSuggestion = (sug: Omit<TTSTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTpl: TTSTemplate = {
      ...sug,
      id: 'tpl-sug-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setTemplates((prev: TTSTemplate[]) => [newTpl, ...prev]);
    showToast(`Đã thêm mẫu câu "${sug.title}" vào thư viện cá nhân!`, 'success');

    if (spreadsheetId && gasUrl) {
      saveTemplateToSpreadsheet(newTpl);
    }
  };

  // SPREADSHEET SYNC METHODS
  const handleSpreadsheetSync = async () => {
    if (!gasUrl || !spreadsheetId) {
      showToast('Vui lòng kết nối Google Sheet trong cấu hình hệ thống trước.', 'error');
      return;
    }

    setSyncStatus('syncing');
    showToast('Bắt đầu đồng bộ thư viện mẫu câu với Google Sheets...', 'info');

    try {
      // 1. Fetch remote templates
      const getUrl = `${gasUrl}?action=get_tts_templates&ssId=${spreadsheetId}`;
      const response = await fetch(getUrl);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Không phản hồi kết quả');
      }

      const remoteTemplates: TTSTemplate[] = result.data || [];
      
      // 2. Merge logic: Merge remote and local
      const mergedList = [...templates];
      
      // Remote templates replace local if remote is newer
      remoteTemplates.forEach(rt => {
        const localIdx = mergedList.findIndex(t => t.id === rt.id);
        if (localIdx === -1) {
          mergedList.push(rt);
        } else {
          const localTime = new Date(mergedList[localIdx].updatedAt).getTime();
          const remoteTime = new Date(rt.updatedAt).getTime();
          if (remoteTime > localTime) {
            mergedList[localIdx] = rt;
          }
        }
      });

      // 3. Upload local changes to sheet
      for (const t of templates) {
        const remoteMatch = remoteTemplates.find(rt => rt.id === t.id);
        if (!remoteMatch || new Date(t.updatedAt).getTime() > new Date(remoteMatch.updatedAt).getTime()) {
          await saveTemplateToSpreadsheet(t);
        }
      }

      // 1.1 Fetch remote settings
      try {
        const settingsUrl = `${gasUrl}?action=get_tts_settings&ssId=${spreadsheetId}`;
        const settingsRes = await fetch(settingsUrl);
        const settingsResult = await settingsRes.json();
        if (settingsResult.success && settingsResult.data) {
          const cloudSettings = settingsResult.data;
          setProviderSettings((prev: any) => ({
            ...prev,
            fptApiKey: cloudSettings.fptApiKey !== undefined ? cloudSettings.fptApiKey : prev.fptApiKey,
            viettelToken: cloudSettings.viettelToken !== undefined ? cloudSettings.viettelToken : prev.viettelToken,
            zaloApiKey: cloudSettings.zaloApiKey !== undefined ? cloudSettings.zaloApiKey : prev.zaloApiKey,
          }));
        }
      } catch (err) {
        console.warn("Failed to sync TTS settings:", err);
      }

      setTemplates(mergedList);
      setSyncStatus('synced');
      showToast('Đồng bộ hoàn tất! Dữ liệu đã khớp 100% với Google Sheets.', 'success');
    } catch (e: any) {
      console.error(e);
      setSyncStatus('error');
      showToast(`Đồng bộ thất bại: ${e.message}`, 'error');
    }
  };

  // Sync single template API
  const saveTemplateToSpreadsheet = async (tpl: TTSTemplate) => {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          action: 'save_tts_template',
          spreadsheetId: spreadsheetId,
          template: tpl
        })
      });
    } catch (e) {
      console.warn("Spreadsheet append failed offline, saved locally", e);
    }
  };

  // Sync deletion
  const deleteTemplateFromSpreadsheet = async (id: string) => {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          action: 'delete_tts_template',
          spreadsheetId: spreadsheetId,
          id: id
        })
      });
    } catch (e) {
      console.warn(e);
    }
  };

  // Sync single log row
  const saveHistoryToSpreadsheet = async (log: TTSHistoryItem) => {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          action: 'save_tts_history',
          spreadsheetId: spreadsheetId,
          log: log
        })
      });
    } catch (e) {
      console.warn(e);
    }
  };

  // Description map for Fpt speed sliders (-3 to +3)
  const getFptSpeedDesc = (speed: number) => {
    switch (speed) {
      case -3: return 'Rất chậm';
      case -2: return 'Chậm';
      case -1: return 'Hơi chậm';
      case 0: return 'Bình thường';
      case 1: return 'Hơi nhanh';
      case 2: return 'Nhanh';
      case 3: return 'Rất nhanh';
      default: return 'Bình thường';
    }
  };

  // Description map for Viettel speed sliders (0.8 to 1.2)
  const getViettelSpeedDesc = (speed: number) => {
    if (speed <= 0.8) return 'Chậm rõ';
    if (speed <= 0.9) return 'Hơi chậm';
    if (speed <= 1.0) return 'Bình thường';
    if (speed <= 1.1) return 'Hơi nhanh';
    return 'Nhanh';
  };

  return (
    <div className="tts-page">
      
      {/* PAGE HEADER */}
      <PageHeader
        icon={<Volume2 size={26} />}
        title="Chuyển Văn Bản Thành Giọng Nói (TTS)"
        subtitle="Tạo và phát giọng đọc tự động từ mẫu câu nghiệp vụ nhà hàng Kings Grill hoặc văn bản tùy chỉnh"
        badgeText="Web Speech AI"
        badgeVariant="success"
        actions={
          <button 
            className="btn-outline" 
            onClick={handleSpreadsheetSync}
            disabled={syncStatus === 'syncing'}
            style={{ height: '40px', padding: '0 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {syncStatus === 'syncing' ? <RefreshCw className="spinner" size={16} /> : <Database size={16} />}
            <span>Đồng bộ Spreadsheet</span>
          </button>
        }
      />

      {/* OVERVIEW KPIS */}
      <div className="kpis" style={{ marginBottom: '1.5rem' }}>
        <StatCard 
          icon={<SlidersHorizontal size={18} />} 
          label="Provider chủ đạo" 
          value={
            providerSettings.activeProvider === 'browser' ? 'Browser Native' :
            providerSettings.activeProvider === 'edge' ? 'Edge Neural AI' :
            providerSettings.activeProvider === 'capcut' ? 'CapCut SAMI TTS' :
            providerSettings.activeProvider === 'openaifm' ? 'OpenAI.fm GPT-4o' :
            providerSettings.activeProvider === 'google' ? 'Google TTS Free' :
            providerSettings.activeProvider === 'fpt' ? 'FPT.AI Cloud' :
            providerSettings.activeProvider === 'viettel' ? 'Viettel AI Cloud' :
            providerSettings.activeProvider === 'zalo' ? 'Zalo AI Cloud' : 'Custom Server'
          } 
          subtext={
            providerSettings.activeProvider === 'browser' ? 'Giọng đọc trình duyệt miễn phí' :
            providerSettings.activeProvider === 'edge' ? `${providerSettings.edgeVoiceId || 'vi-VN-HoaiMyNeural'} (Miễn phí)` :
            providerSettings.activeProvider === 'capcut' ? `CapCut (${providerSettings.capcutVoiceId || 'BV074_streaming'})` :
            providerSettings.activeProvider === 'openaifm' ? `OpenAI.fm (${providerSettings.openaifmVoiceId || 'coral'})` :
            providerSettings.activeProvider === 'google' ? 'Google Translate Multi-chunk TTS' :
            providerSettings.activeProvider === 'fpt' ? 'Đã kích hoạt FPT' :
            providerSettings.activeProvider === 'viettel' ? 'Đã kích hoạt Viettel' :
            providerSettings.activeProvider === 'zalo' ? 'Đã kích hoạt Zalo' : providerSettings.customEndpoint
          }
          hasData={true} 
        />
        <StatCard 
          icon={<Database size={18} />} 
          label={
            providerSettings.activeProvider === 'browser' ? 'Browser Quota' :
            providerSettings.activeProvider === 'edge' ? 'Edge Neural Quota' :
            providerSettings.activeProvider === 'capcut' ? 'CapCut TTS Quota' :
            providerSettings.activeProvider === 'openaifm' ? 'OpenAI.fm Quota' :
            providerSettings.activeProvider === 'google' ? 'Google TTS Quota' :
            providerSettings.activeProvider === 'fpt' ? 'FPT.AI Quota' :
            providerSettings.activeProvider === 'viettel' ? 'Viettel AI Quota' :
            providerSettings.activeProvider === 'zalo' ? 'Zalo AI Quota' : 'Custom Server'
          } 
          value={
            providerSettings.activeProvider === 'browser' ? 'Không giới hạn' :
            providerSettings.activeProvider === 'edge' ? `${edgeUsedToday} / ${providerSettings.edgeDailyLimit} kí tự` :
            providerSettings.activeProvider === 'capcut' ? `${capcutUsedToday} / ${providerSettings.capcutDailyLimit} kí tự` :
            providerSettings.activeProvider === 'openaifm' ? `${openaifmUsedToday} / ${providerSettings.openaifmDailyLimit} kí tự` :
            providerSettings.activeProvider === 'google' ? `${googleUsedToday} / ${providerSettings.googleDailyLimit} kí tự` :
            providerSettings.activeProvider === 'fpt' ? `${fptUsedToday} / ${providerSettings.fptDailyLimit} kí tự` :
            providerSettings.activeProvider === 'viettel' ? `${viettelUsedToday} / ${providerSettings.viettelDailyLimit} kí tự` :
            providerSettings.activeProvider === 'zalo' ? `${zaloUsedToday} / ${providerSettings.zaloDailyLimit} kí tự` : 'Không giới hạn'
          }
          subtext="Số kí tự đã gửi hôm nay"
          hasData={
            providerSettings.activeProvider === 'edge' ? edgeUsedToday > 0 :
            providerSettings.activeProvider === 'capcut' ? capcutUsedToday > 0 :
            providerSettings.activeProvider === 'openaifm' ? openaifmUsedToday > 0 :
            providerSettings.activeProvider === 'google' ? googleUsedToday > 0 :
            providerSettings.activeProvider === 'fpt' ? fptUsedToday > 0 :
            providerSettings.activeProvider === 'viettel' ? viettelUsedToday > 0 :
            providerSettings.activeProvider === 'zalo' ? zaloUsedToday > 0 : false
          } 
        />
        <StatCard 
          icon={<Volume2 size={18} />} 
          label="Tổng phát hôm nay" 
          value={`${fptUsedToday + viettelUsedToday + zaloUsedToday + googleUsedToday + edgeUsedToday + capcutUsedToday + openaifmUsedToday} kí tự`} 
          subtext="Tổng lưu lượng các Cloud & Neural Provider"
          hasData={(fptUsedToday + viettelUsedToday + zaloUsedToday + googleUsedToday + edgeUsedToday + capcutUsedToday + openaifmUsedToday) > 0} 
        />
        <StatCard 
          icon={<BookOpen size={18} />} 
          label="Mẫu câu đã lưu" 
          value={`${templates.length} mẫu`} 
          subtext="Lưu trong cơ sở dữ liệu"
          hasData={templates.length > 0} 
        />
      </div>

      {/* UNIVERSAL SUBTAB BAR */}
      <div className="hub-subtab-bar" style={{ marginBottom: '1.25rem' }}>
        <button 
          type="button" 
          className={`hub-subtab-btn ${mainTab === 'broadcast' ? 'active' : ''}`}
          onClick={() => setMainTab('broadcast')}
        >
          <Volume2 size={15} />
          <span>Phát Thông Báo</span>
        </button>

        <button 
          type="button" 
          className={`hub-subtab-btn ${mainTab === 'settings' ? 'active' : ''}`}
          onClick={() => setMainTab('settings')}
        >
          <SlidersHorizontal size={15} />
          <span>Cấu Hình Giọng & Quota API</span>
        </button>

        <button 
          type="button" 
          className={`hub-subtab-btn ${mainTab === 'history' ? 'active' : ''}`}
          onClick={() => setMainTab('history')}
        >
          <History size={15} />
          <span>Lịch Sử Phát ({history.length})</span>
        </button>
      </div>

      {/* TAB 1: BROADCAST PLAYBACK (2-COLUMN BALANCED WORKFLOW) */}
      {mainTab === 'broadcast' && (
        <>
          {isMobileScreen && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '8px' }}>
              <button 
                type="button" 
                className={`hub-subtab-btn ${mobileBroadcastTab === 'compose' ? 'active' : ''}`}
                onClick={() => setMobileBroadcastTab('compose')}
                style={{ flex: 1, padding: '7px', fontSize: '0.8rem' }}
              >
                ✍️ Soạn câu
              </button>
              <button 
                type="button" 
                className={`hub-subtab-btn ${mobileBroadcastTab === 'templates' ? 'active' : ''}`}
                onClick={() => setMobileBroadcastTab('templates')}
                style={{ flex: 1, padding: '7px', fontSize: '0.8rem' }}
              >
                📂 Thư viện mẫu ({templates.length})
              </button>
            </div>
          )}

          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobileScreen ? '1fr' : '360px 1fr', 
              gap: '1.25rem',
              alignItems: 'start'
            }}
          >
            {/* COLUMN 1: TEMPLATE LIBRARY */}
            {(!isMobileScreen || mobileBroadcastTab === 'templates') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card panel" style={{ background: 'var(--panel-bg)', height: 'auto', display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
              <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.85rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} style={{ color: 'var(--accent-primary)' }} />
                <span>Thư viện mẫu câu</span>
              </h2>

              {/* Search template */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-input)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '6px 10px', marginBottom: '0.75rem' }}>
                <Search size={14} style={{ color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm mẫu câu..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', height: '24px', padding: 0, fontSize: '0.84rem', outline: 'none', boxShadow: 'none' }}
                />
              </div>

              {/* Category tabs */}
              <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '0.75rem' }}>
                {categories.map(cat => (
                  <button 
                    key={cat} 
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    style={{ 
                      height: '28px',
                      whiteSpace: 'nowrap',
                      padding: '0 10px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      background: activeCategory === cat ? 'var(--accent-primary-subtle)' : 'var(--surface-subtle)',
                      border: activeCategory === cat ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--border-default)',
                      color: activeCategory === cat ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {cat === 'Favorite' ? '⭐ Yêu thích' : cat}
                  </button>
                ))}
              </div>

              {/* Saved list */}
              <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: isMobileScreen ? '240px' : '320px' }}>
                {filteredTemplates.map(tpl => (
                  <div 
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    style={{ 
                      padding: '8px 10px', 
                      borderRadius: '8px', 
                      background: selectedTemplateId === tpl.id ? 'var(--accent-primary-subtle)' : 'var(--bg-elevated)', 
                      border: selectedTemplateId === tpl.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ overflow: 'hidden', flexGrow: 1, paddingRight: '8px' }}>
                      <span style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tpl.title}</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tpl.text}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        type="button" 
                        onClick={(e) => toggleFavorite(tpl.id, e)}
                        style={{ background: 'transparent', border: 'none', color: tpl.isFavorite ? '#fbbf24' : 'var(--text-muted)', cursor: 'pointer', padding: '4px', height: 'auto' }}
                      >
                        <Star size={13} fill={tpl.isFavorite ? '#fbbf24' : 'none'} />
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--status-danger)', cursor: 'pointer', padding: '4px', height: 'auto' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredTemplates.length === 0 && (
                  <EmptyState 
                    icon={<Volume2 size={28} />}
                    title="Chưa có mẫu câu nào" 
                    description="Soạn và lưu mẫu câu bên cạnh hoặc thêm từ mục Gợi ý ở dưới." 
                    style={{ padding: '1.5rem 1rem' }}
                  />
                )}
              </div>
            </div>

            {/* Suggestions Library */}
            <div className="card panel" style={{ background: 'var(--panel-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                  <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
                  <span>Gợi ý mẫu câu phát nhanh</span>
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>{filteredSuggestions.length} mẫu</span>
              </div>

              {/* Category Filter Chips */}
              <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '10px' }}>
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'Đặt bàn', label: '🍽️ Đặt bàn' },
                  { id: 'Vận hành', label: '👨‍🍳 Bếp/Sảnh' },
                  { id: 'Thu ngân', label: '💰 Thu ngân' },
                  { id: 'Thông báo', label: '📢 Thông báo' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSuggestionCategory(cat.id)}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      borderRadius: '999px',
                      fontSize: '11.5px',
                      whiteSpace: 'nowrap',
                      border: suggestionCategory === cat.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      cursor: 'pointer',
                      background: suggestionCategory === cat.id ? 'var(--accent-primary)' : 'var(--surface-subtle)',
                      color: suggestionCategory === cat.id ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: suggestionCategory === cat.id ? 600 : 500,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredSuggestions.map((sug, i) => (
                  <div 
                    key={i}
                    style={{ 
                      padding: '8px 10px', 
                      background: 'var(--bg-elevated)', 
                      border: '1px solid var(--border-default)', 
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'block' }}>{sug.title}</strong>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '1px' }}>{sug.text}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleLoadSuggestion(sug)}
                      style={{ height: '28px', background: 'var(--accent-primary-subtle)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--accent-primary)', borderRadius: '6px', padding: '0 10px', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
                    >
                      + Thêm
                    </button>
                  </div>
                ))}
                {filteredSuggestions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '12px', color: 'var(--muted)', fontSize: '11px' }}>
                    Không có gợi ý trong danh mục này.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COLUMN 2: TEXT COMPOSER & INTERPOLATOR */}
        {(!isMobileScreen || mobileBroadcastTab === 'compose') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card panel" style={{ background: 'var(--panel-bg)' }}>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0' }}>✍️ Soạn câu phát âm thanh</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Title and Category */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Tên mẫu câu (Không bắt buộc)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="VD: Thông báo đón khách"
                      value={composeTitle}
                      onChange={e => setComposeTitle(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nhóm</label>
                    <select 
                      className="form-control"
                      value={composeCategory}
                      onChange={e => setComposeCategory(e.target.value)}
                      style={{ background: 'var(--surface-input)', color: 'var(--text-primary)' }}
                    >
                      <option value="Đặt bàn">Đặt bàn</option>
                      <option value="Nhà hàng/Vận hành">Vận hành</option>
                      <option value="Thu ngân">Thu ngân</option>
                      <option value="Lương/Nhân sự">Lương</option>
                      <option value="Chấm công">Chấm công</option>
                      <option value="Thông báo nhanh">Thông báo</option>
                    </select>
                  </div>
                </div>

                {/* Textarea Composer */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Nội dung mẫu nói <span style={{ color: 'var(--primary)', fontWeight: 500, fontSize: '0.72rem' }}>(Nhấn Ctrl + Enter để phát ngay)</span></span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{composeText.length} ký tự</span>
                  </label>
                  <textarea 
                    className="form-control"
                    placeholder="Nhập nội dung mẫu nói ở đây... (Ctrl + Enter để phát loa ngay)"
                    value={composeText}
                    onChange={e => setComposeText(e.target.value)}
                    onKeyDown={e => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleSpeak();
                      }
                    }}
                    style={{ height: '140px', fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: 1.5 }}
                  />
                  
                  {/* Insert variable quick chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', marginRight: '4px' }}>Chèn biến nhanh:</span>
                    {["ten_khach", "so_khach", "gio_nhan_ban", "so_ban", "khu_vuc", "ten_nhan_vien", "so_tien"].map(v => (
                      <button 
                        key={v}
                        type="button"
                        onClick={() => setComposeText(prev => prev + ` {${v}}`)}
                        style={{ 
                          height: '26px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0 8px',
                          background: 'var(--accent-primary-subtle)', 
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          borderRadius: '6px',
                          color: 'var(--accent-primary)',
                          cursor: 'pointer' 
                        }}
                      >
                        +{v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DYNAMIC VARIABLES INPUT FIELDS */}
                {parsedVariables.length > 0 && (
                  <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: '1rem', borderRadius: '10px' }}>
                    <h3 style={{ fontSize: '0.88rem', margin: '0 0 0.75rem 0', color: 'var(--accent-primary)' }}>📝 Nhập giá trị biến động</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {parsedVariables.map(v => (
                        <div key={v} className="form-group">
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>&#123;{v}&#125;</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                            value={variablesInputValues[v] || ''}
                            onChange={e => setVariablesInputValues(prev => ({ ...prev, [v]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TRANSLATED & NORMALIZED PREVIEW CARD */}
                <div className="card" style={{ background: 'var(--status-success-bg)', border: '1px solid var(--status-success-border)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '6px' }}>
                    <h3 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--status-success)' }}>🔊 Xem trước câu nói thật</h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 600, color: 'var(--accent-primary)', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={providerSettings.autoOptimize}
                        onChange={e => setProviderSettings((prev: any) => ({ ...prev, autoOptimize: e.target.checked }))}
                        style={{ accentColor: 'var(--accent-primary)' }}
                      />
                      <span>Tự động tối ưu câu đọc</span>
                    </label>
                  </div>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                    {interpolatedText}
                  </p>
                  
                  {/* Speech normalization display */}
                  {providerSettings.autoOptimize && (
                    <div style={{ borderTop: '1px dashed var(--border-strong)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                      <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Dòng đọc chuẩn hóa phát ra loa:</span>
                      <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: 'var(--accent-primary)', fontStyle: 'italic' }}>
                        "{normalizedTextToSpeak}"
                      </span>
                    </div>
                  )}
                </div>

                {/* PLAYBACK CONTROLS PANEL */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {playbackState === 'playing' ? (
                    <button 
                      className="primary" 
                      onClick={handleStop}
                      style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', flexGrow: 1 }}
                    >
                      <Square size={18} />
                      <span>Dừng phát</span>
                    </button>
                  ) : (
                    <button 
                      className="primary" 
                      onClick={handleSpeak}
                      style={{ flexGrow: 1 }}
                    >
                      <Volume2 size={18} />
                      <span>Nghe thử giọng</span>
                    </button>
                  )}

                  <button className="btn-outline" onClick={handleSaveTemplate} style={{ width: '120px' }}>
                    <Save size={18} />
                    <span>Lưu lại</span>
                  </button>
                  
                  <button 
                    className="btn-outline" 
                    onClick={() => {
                      setComposeText('');
                      setComposeTitle('');
                      setSelectedTemplateId(null);
                    }}
                    style={{ width: '44px', padding: 0 }}
                    title="Xóa trắng"
                  >
                    ×
                  </button>
                </div>

              </div>
            </div>

            {/* Quick action buttons for restaurant operations */}
            <div className="card panel" style={{ background: 'var(--panel-bg)' }}>
              <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem 0' }}>⚡ Phát nhanh thông báo nghiệp vụ</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobileScreen ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                <button 
                  className="btn-outline" 
                  onClick={() => {
                    const text = "Có khách đặt bàn mới, vui lòng kiểm tra thông tin tiệc.";
                    setComposeText(text);
                    setComposeTitle("Đặt bàn mới");
                    setComposeCategory("Đặt bàn");
                    setSelectedTemplateId(null);
                    const normalized = providerSettings.autoOptimize ? normalizeTextForVietnameseTTS(text) : text;
                    dispatchSpeak(normalized);
                  }}
                  style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px' }}
                >
                  <strong style={{ fontSize: '0.85rem' }}>📢 Đặt bàn mới</strong>
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Phát nhanh thông báo đặt bàn chung</span>
                </button>
                
                <button 
                  className="btn-outline" 
                  onClick={() => {
                    const text = "Có giao dịch chuyển khoản mới, đề nghị thu ngân kiểm tra tài khoản.";
                    setComposeText(text);
                    setComposeTitle("Chuyển khoản mới");
                    setComposeCategory("Thu ngân");
                    setSelectedTemplateId(null);
                    const normalized = providerSettings.autoOptimize ? normalizeTextForVietnameseTTS(text) : text;
                    dispatchSpeak(normalized);
                  }}
                  style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px' }}
                >
                  <strong style={{ fontSize: '0.85rem' }}>💰 Chuyển khoản mới</strong>
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Phát loa thông báo biến động số dư</span>
                </button>

                <button 
                  className="btn-outline" 
                  onClick={() => {
                    const text = "Bảng chấm công ngày hôm nay đã được chốt và đồng bộ.";
                    setComposeText(text);
                    setComposeTitle("Chốt chấm công");
                    setComposeCategory("Chấm công");
                    setSelectedTemplateId(null);
                    const normalized = providerSettings.autoOptimize ? normalizeTextForVietnameseTTS(text) : text;
                    dispatchSpeak(normalized);
                  }}
                  style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px' }}
                >
                  <strong style={{ fontSize: '0.85rem' }}>⏰ Chốt chấm công</strong>
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Phát báo cáo chốt công ngày</span>
                </button>

                <button 
                  className="btn-outline" 
                  onClick={() => {
                    const text = "Đã xuất file chuyển tiền lương tháng thành công, kế toán trưởng vui lòng duyệt chuyển tiền.";
                    setComposeText(text);
                    setComposeTitle("Duyệt chuyển lương");
                    setComposeCategory("Lương/Nhân sự");
                    setSelectedTemplateId(null);
                    const normalized = providerSettings.autoOptimize ? normalizeTextForVietnameseTTS(text) : text;
                    dispatchSpeak(normalized);
                  }}
                  style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px' }}
                >
                  <strong style={{ fontSize: '0.85rem' }}>💵 Báo cáo xuất lương</strong>
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Thông báo cho Kế toán trưởng duyệt lương</span>
                </button>

                <button 
                  className="btn-outline" 
                  onClick={() => {
                    const plate = prompt("Nhập biển số xe cần dời:", variablesInputValues.bien_so_xe || "30F-123.45");
                    if (plate === null) return;
                    const cleanPlate = plate.trim() || "chưa rõ";
                    setVariablesInputValues(prev => ({ ...prev, bien_so_xe: cleanPlate }));
                    
                    const textTpl = "Xin thông báo, Quý khách hàng có biển số xe {bien_so_xe}, vui lòng gặp bảo vệ để di chuyển xe đến vị trí khác. Xin cảm ơn quý khách!";
                    setComposeText(textTpl);
                    setComposeTitle("Dời xe");
                    setComposeCategory("Thông báo nhanh");
                    setSelectedTemplateId(null);

                    const text = textTpl.replace("{bien_so_xe}", cleanPlate);
                    const normalized = providerSettings.autoOptimize ? normalizeTextForVietnameseTTS(text) : text;
                    dispatchSpeak(normalized);
                  }}
                  style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px', gridColumn: isMobileScreen ? 'auto' : 'span 2' }}
                >
                  <strong style={{ fontSize: '0.85rem' }}>🚗 Dời xe khẩn cấp</strong>
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Thông báo yêu cầu khách dời xe</span>
                </button>
              </div>
            </div>
          </div>
        )}

          </div>
        </>
      )}

      {/* TAB 2: AUDIO CONFIG & API QUOTA SETTINGS */}
      {mainTab === 'settings' && (
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
              <div className="card panel" style={{ background: 'var(--panel-bg)' }}>
                <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SlidersHorizontal size={18} style={{ color: 'var(--cyan)' }} />
                  <span>Cấu hình giọng đọc</span>
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Select provider */}
                  <div className="form-group">
                    <label className="form-label">Bộ chuyển đổi TTS (Provider)</label>
                    <select 
                      className="form-control"
                      value={providerSettings.activeProvider}
                      onChange={e => setProviderSettings((prev: any) => ({ ...prev, activeProvider: e.target.value }))}
                      style={{ background: 'var(--surface-input)', color: 'var(--text-primary)' }}
                    >
                      <optgroup label="🌟 Nguồn Reverse-Engineered (Miễn phí, Không cần API Key)">
                        <option value="edge">🧠 Microsoft Edge Neural TTS (Hoài My / Nam Minh - Khuyên dùng)</option>
                        <option value="capcut">🎬 CapCut / ByteDance SAMI TTS (18 Giọng Việt TikTok/CapCut)</option>
                        <option value="openaifm">🤖 OpenAI.fm / TTSFM (GPT-4o-mini-tts + Prompt Cảm xúc)</option>
                        <option value="google">🔍 Google Translate TTS (Multi-chunk Nâng cao, Không Key)</option>
                      </optgroup>
                      <optgroup label="☁️ Nguồn Trình duyệt & Cloud API Chính thức">
                        <option value="browser">🌐 Browser Speech API (Nội bộ trình duyệt)</option>
                        <option value="fpt">⚡ FPT.AI Text to Speech (Cloud API Key)</option>
                        <option value="viettel">🎖️ Viettel AI Text to Speech (Cloud Token)</option>
                        <option value="zalo">💬 Zalo AI Text to Speech (Cloud API Key)</option>
                        <option value="custom">🛠️ Custom Endpoint Server (Tự host)</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Fallback & limits configuration */}
                  <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={providerSettings.autoFallback}
                        onChange={e => setProviderSettings((prev: any) => ({ ...prev, autoFallback: e.target.checked }))}
                        style={{ accentColor: 'var(--cyan)' }}
                      />
                      <span>Tự động Fallback sang nguồn dự phòng (Google/Browser) khi lỗi</span>
                    </label>
                  </div>

                  {/* 1. Microsoft Edge Read-Aloud Neural TTS */}
                  {providerSettings.activeProvider === 'edge' && (
                    <>
                      <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.76rem', display: 'flex', gap: '8px', color: '#60a5fa', lineHeight: 1.45 }}>
                        <Sparkles size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>
                          <strong>Microsoft Edge Read-Aloud Neural TTS (DRM Sec-MS-GEC v2):</strong> Sử dụng trực tiếp giọng đọc Neural chất lượng cao nhất của Microsoft Azure (Hoài My & Nam Minh) hoàn toàn miễn phí, không cần tài khoản Azure.
                        </span>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Chọn giọng đọc (Edge Neural Voices)</label>
                        <select 
                          className="form-control"
                          value={providerSettings.edgeVoiceId || 'vi-VN-HoaiMyNeural'}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, edgeVoiceId: e.target.value }))}
                          style={{ background: 'var(--surface-input)', color: 'var(--text-primary)' }}
                        >
                          {EDGE_VOICES.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label">
                            Tốc độ đọc (Rate): {providerSettings.edgeRate >= 0 ? `+${providerSettings.edgeRate}%` : `${providerSettings.edgeRate}%`}
                          </label>
                          <input 
                            type="range" 
                            min="-50" 
                            max="50" 
                            step="5"
                            value={providerSettings.edgeRate || 0} 
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, edgeRate: parseInt(e.target.value, 10) }))}
                            style={{ width: '100%', accentColor: 'var(--cyan)' }}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            Cao độ (Pitch): {providerSettings.edgePitch >= 0 ? `+${providerSettings.edgePitch}Hz` : `${providerSettings.edgePitch}Hz`}
                          </label>
                          <input 
                            type="range" 
                            min="-30" 
                            max="30" 
                            step="2"
                            value={providerSettings.edgePitch || 0} 
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, edgePitch: parseInt(e.target.value, 10) }))}
                            style={{ width: '100%', accentColor: 'var(--cyan)' }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Hạn mức an toàn hàng ngày (Kí tự)</label>
                        <input 
                          type="number" 
                          className="form-control"
                          value={providerSettings.edgeDailyLimit || 100000}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, edgeDailyLimit: parseInt(e.target.value, 10) || 100000 }))}
                        />
                      </div>
                    </>
                  )}

                  {/* 2. CapCut / ByteDance SAMI TTS */}
                  {providerSettings.activeProvider === 'capcut' && (
                    <>
                      <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.76rem', display: 'flex', gap: '8px', color: '#c084fc', lineHeight: 1.45 }}>
                        <Sparkles size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>
                          <strong>CapCut / ByteDance SAMI WebSocket TTS:</strong> Tổng hợp 18 giọng tiếng Việt độc quyền của CapCut & TikTok (Cô gái Hoạt ngôn, Anh Dũng, Cute Girl, Giọng Bắc/Nam/Huế Uranus BigTTS) qua kết nối WebSocket 24kHz WAV, không cần tài khoản.
                        </span>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Chọn giọng đọc (CapCut / TikTok Voices)</label>
                        <select 
                          className="form-control"
                          value={providerSettings.capcutVoiceId || 'BV074_streaming'}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, capcutVoiceId: e.target.value }))}
                          style={{ background: 'var(--surface-input)', color: 'var(--text-primary)' }}
                        >
                          {Array.from(new Set(CAPCUT_VOICES.map(v => v.group))).map(groupName => (
                            <optgroup key={groupName} label={groupName}>
                              {CAPCUT_VOICES.filter(v => v.group === groupName).map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label">
                            Tốc độ đọc (Speech Rate): {((providerSettings.capcutSpeed || 10) / 10).toFixed(1)}x ({providerSettings.capcutSpeed || 10}/20)
                          </label>
                          <input 
                            type="range" 
                            min="5" 
                            max="20" 
                            step="1"
                            value={providerSettings.capcutSpeed || 10} 
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, capcutSpeed: parseInt(e.target.value, 10) }))}
                            style={{ width: '100%', accentColor: 'var(--cyan)' }}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            Cao độ (Pitch Rate): {((providerSettings.capcutPitch || 10) / 10).toFixed(1)}x ({providerSettings.capcutPitch || 10}/20)
                          </label>
                          <input 
                            type="range" 
                            min="5" 
                            max="20" 
                            step="1"
                            value={providerSettings.capcutPitch || 10} 
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, capcutPitch: parseInt(e.target.value, 10) }))}
                            style={{ width: '100%', accentColor: 'var(--cyan)' }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Hạn mức an toàn hàng ngày (Kí tự)</label>
                        <input 
                          type="number" 
                          className="form-control"
                          value={providerSettings.capcutDailyLimit || 50000}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, capcutDailyLimit: parseInt(e.target.value, 10) || 50000 }))}
                        />
                      </div>
                    </>
                  )}

                  {/* 3. OpenAI.fm / TTSFM (gpt-4o-mini-tts) */}
                  {providerSettings.activeProvider === 'openaifm' && (
                    <>
                      <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.76rem', display: 'flex', gap: '8px', color: '#34d399', lineHeight: 1.45 }}>
                        <Sparkles size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>
                          <strong>OpenAI.fm / TTSFM (GPT-4o-mini-tts):</strong> Cho phép điều khiển ngữ điệu và cảm xúc qua Prompt (Vibe). Tự động chuyển mạch liền mạch sang Edge Neural TTS nếu máy chủ công cộng `openai.fm` bật chống bot (HTTP 429 Challenge).
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label">Chọn giọng (OpenAI Voices)</label>
                          <select 
                            className="form-control"
                            value={providerSettings.openaifmVoiceId || 'coral'}
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, openaifmVoiceId: e.target.value }))}
                            style={{ background: 'var(--surface-input)', color: 'var(--text-primary)' }}
                          >
                            {OPENAIFM_VOICES.map(v => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Tốc độ đọc: {providerSettings.openaifmSpeed || 1.0}x</label>
                          <input 
                            type="range" 
                            min="0.7" 
                            max="1.5" 
                            step="0.05"
                            value={providerSettings.openaifmSpeed || 1.0} 
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, openaifmSpeed: parseFloat(e.target.value) }))}
                            style={{ width: '100%', accentColor: 'var(--cyan)', marginTop: '8px' }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Prompt chỉ dẫn cảm xúc & ngữ điệu (Vibe / Instructions)</label>
                        <textarea 
                          className="form-control"
                          rows={2}
                          value={providerSettings.openaifmPrompt || DEFAULT_OPENAIFM_PROMPT}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, openaifmPrompt: e.target.value }))}
                          placeholder="Mô tả phong cách giọng đọc tiếng Việt..."
                          style={{ fontSize: '0.82rem', lineHeight: 1.4 }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label">Endpoint (OpenAI.fm hoặc TTSFM Docker)</label>
                          <input 
                            type="text" 
                            className="form-control"
                            value={providerSettings.openaifmEndpoint || 'https://www.openai.fm/api/generate'}
                            placeholder="https://www.openai.fm/api/generate hoặc http://localhost:8000/v1/audio/speech"
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, openaifmEndpoint: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">API Key (Tùy chọn nếu dùng OpenAI/TTSFM)</label>
                          <input 
                            type="password" 
                            className="form-control"
                            value={providerSettings.openaifmApiKey || ''}
                            placeholder="Không bắt buộc với openai.fm"
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, openaifmApiKey: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Hạn mức an toàn hàng ngày (Kí tự)</label>
                        <input 
                          type="number" 
                          className="form-control"
                          value={providerSettings.openaifmDailyLimit || 30000}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, openaifmDailyLimit: parseInt(e.target.value, 10) || 30000 }))}
                        />
                      </div>
                    </>
                  )}

                  {/* Browser settings */}
                  {providerSettings.activeProvider === 'browser' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Chọn giọng (Voices trình duyệt)</label>
                        <select 
                          className="form-control"
                          value={providerSettings.browserVoiceURI}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, browserVoiceURI: e.target.value }))}
                          style={{ background: 'var(--surface-input)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                        >
                          <option value="">-- Mặc định (Tự chọn vi-VN) --</option>
                          {voices.map(voice => (
                            <option key={voice.voiceURI} value={voice.voiceURI}>
                              {voice.name} ({voice.lang}) {voice.localService ? '[Local]' : ''}
                            </option>
                          ))}
                        </select>
                        {voices.filter(v => v.lang.startsWith('vi')).length === 0 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--red)', display: 'block', marginTop: '4px' }}>
                            ⚠️ Trình duyệt của bạn không hỗ trợ giọng nói tiếng Việt chuẩn.
                          </span>
                        )}
                      </div>

                      {/* Browser Rate speed slider */}
                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label className="form-label" style={{ margin: 0 }}>Tốc độ đọc: {providerSettings.rate}x</label>
                        </div>
                        <input 
                          type="range" 
                          min="0.5" 
                          max="2.0" 
                          step="0.1"
                          value={providerSettings.rate} 
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, rate: parseFloat(e.target.value) }))}
                          style={{ width: '100%', accentColor: 'var(--cyan)' }}
                        />
                      </div>

                      {/* Pitch slider */}
                      <div className="form-group">
                        <label className="form-label">Cao độ giọng (Pitch): {providerSettings.pitch}</label>
                        <input 
                          type="range" 
                          min="0.5" 
                          max="1.5" 
                          step="0.05"
                          value={providerSettings.pitch} 
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, pitch: parseFloat(e.target.value) }))}
                          style={{ width: '100%', accentColor: 'var(--cyan)' }}
                        />
                      </div>
                    </>
                  )}

                  {/* FPT.AI configurations */}
                  {providerSettings.activeProvider === 'fpt' && (
                    <>
                      {/* Safety API Key warning banner */}
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', gap: '8px', color: '#f87171' }}>
                        <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                        <span>⚠️ API key đang lưu trên trình duyệt, chỉ dùng cho thử nghiệm.</span>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Key size={12} />
                          <span>FPT.AI API Key</span>
                        </label>
                        <input 
                          type="password" 
                          className="form-control" 
                          placeholder="Nhập API Key FPT.AI"
                          value={providerSettings.fptApiKey || ''}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, fptApiKey: e.target.value }))}
                        />
                        <div style={{ marginTop: '4px', textAlign: 'right' }}>
                          <a href="https://console.fpt.ai" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'var(--cyan)', textDecoration: 'underline' }}>
                            🔗 Lấy API Key tại FPT.AI Console
                          </a>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Chọn giọng (FPT.AI Voices)</label>
                        <select 
                          className="form-control"
                          value={providerSettings.fptVoiceId}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, fptVoiceId: e.target.value }))}
                          style={{ background: 'var(--surface-input)', color: 'var(--text-primary)' }}
                        >
                          {FPT_VOICES.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Speed FPT.AI Slider (-3 to +3) */}
                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label className="form-label" style={{ margin: 0 }}>Tốc độ đọc: {getFptSpeedDesc(providerSettings.fptSpeed)}</label>
                        </div>
                        <input 
                          type="range" 
                          min="-3" 
                          max="3" 
                          step="1"
                          value={providerSettings.fptSpeed} 
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, fptSpeed: parseInt(e.target.value, 10) }))}
                          style={{ width: '100%', accentColor: 'var(--cyan)' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div className="form-group">
                          <label className="form-label">Định dạng file</label>
                          <select 
                            className="form-control"
                            value={providerSettings.fptFormat}
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, fptFormat: e.target.value }))}
                            style={{ background: 'var(--surface-input)', color: 'var(--text-primary)' }}
                          >
                            <option value="mp3">MP3</option>
                            <option value="wav">WAV</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Hạn mức (Kí tự)</label>
                          <input 
                            type="number" 
                            className="form-control"
                            value={providerSettings.fptDailyLimit}
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, fptDailyLimit: parseInt(e.target.value, 10) || 5000 }))}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">FPT API Endpoint</label>
                        <input 
                          type="text" 
                          className="form-control"
                          value={providerSettings.fptEndpoint}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, fptEndpoint: e.target.value }))}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => {
                          setProviderSettings((prev: any) => ({ ...prev, fptApiKey: '' }));
                          showToast('Đã xóa FPT API Key thành công!', 'info');
                        }}
                        style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.2)', fontSize: '0.8rem' }}
                      >
                        Xóa FPT API Key
                      </button>
                    </>
                  )}

                  {/* Viettel AI configurations */}
                  {providerSettings.activeProvider === 'viettel' && (
                    <>
                      {/* Safety API Key warning banner */}
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', gap: '8px', color: '#f87171' }}>
                        <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                        <span>⚠️ API token đang lưu trên trình duyệt, chỉ dùng cho thử nghiệm.</span>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Key size={12} />
                          <span>Viettel Token</span>
                        </label>
                        <input 
                          type="password" 
                          className="form-control" 
                          placeholder="Nhập Token Viettel AI"
                          value={providerSettings.viettelToken || ''}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, viettelToken: e.target.value }))}
                        />
                        <div style={{ marginTop: '4px', textAlign: 'right' }}>
                          <a href="https://viettelai.vn" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'var(--cyan)', textDecoration: 'underline' }}>
                            🔗 Lấy Token tại Viettel AI Console
                          </a>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Chọn giọng (Viettel Voices)</label>
                        <select 
                          className="form-control"
                          value={providerSettings.viettelVoiceId}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, viettelVoiceId: e.target.value }))}
                          style={{ background: 'var(--surface-input)', color: 'var(--text-primary)' }}
                        >
                          {VIETTEL_VOICES.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Speed Viettel AI Slider (0.8 to 1.2) */}
                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label className="form-label" style={{ margin: 0 }}>Tốc độ đọc: {getViettelSpeedDesc(providerSettings.viettelSpeed)}</label>
                        </div>
                        <input 
                          type="range" 
                          min="0.8" 
                          max="1.2" 
                          step="0.1"
                          value={providerSettings.viettelSpeed} 
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, viettelSpeed: parseFloat(e.target.value) }))}
                          style={{ width: '100%', accentColor: 'var(--cyan)' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div className="form-group">
                          <label className="form-label">Định dạng file</label>
                          <select 
                            className="form-control"
                            value={providerSettings.viettelFormat}
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, viettelFormat: e.target.value }))}
                            style={{ background: 'var(--surface-input)', color: 'var(--text-primary)' }}
                          >
                            <option value="mp3">MP3</option>
                            <option value="wav">WAV</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Hạn mức (Kí tự)</label>
                          <input 
                            type="number" 
                            className="form-control"
                            value={providerSettings.viettelDailyLimit}
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, viettelDailyLimit: parseInt(e.target.value, 10) || 5000 }))}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Viettel API Endpoint</label>
                        <input 
                          type="text" 
                          className="form-control"
                          value={providerSettings.viettelEndpoint}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, viettelEndpoint: e.target.value }))}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => {
                          setProviderSettings((prev: any) => ({ ...prev, viettelToken: '' }));
                          showToast('Đã xóa Viettel Token thành công!', 'info');
                        }}
                        style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.2)', fontSize: '0.8rem' }}
                      >
                        Xóa Viettel Token
                      </button>
                    </>
                  )}

                  {/* Zalo AI configurations */}
                  {providerSettings.activeProvider === 'zalo' && (
                    <>
                      {/* Safety API Key warning banner */}
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', gap: '8px', color: '#f87171' }}>
                        <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                        <span>⚠️ API key đang lưu trên trình duyệt, chỉ dùng cho thử nghiệm.</span>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Key size={12} />
                          <span>Zalo AI API Key</span>
                        </label>
                        <input 
                          type="password" 
                          className="form-control" 
                          placeholder="Nhập API Key Zalo AI"
                          value={providerSettings.zaloApiKey || ''}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, zaloApiKey: e.target.value }))}
                        />
                        <div style={{ marginTop: '4px', textAlign: 'right' }}>
                          <a href="https://zalo.ai" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'var(--cyan)', textDecoration: 'underline' }}>
                            🔗 Lấy API Key tại Zalo AI Console
                          </a>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Chọn giọng (Zalo AI Voices)</label>
                        <select 
                          className="form-control"
                          value={providerSettings.zaloVoiceId}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, zaloVoiceId: e.target.value }))}
                          style={{ background: 'var(--surface-input)', color: 'var(--text-primary)' }}
                        >
                          {ZALO_VOICES.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Speed Zalo AI Slider (0.8 to 1.2) */}
                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label className="form-label" style={{ margin: 0 }}>Tốc độ đọc: {providerSettings.zaloSpeed}x</label>
                        </div>
                        <input 
                          type="range" 
                          min="0.8" 
                          max="1.2" 
                          step="0.05"
                          value={providerSettings.zaloSpeed} 
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, zaloSpeed: parseFloat(e.target.value) }))}
                          style={{ width: '100%', accentColor: 'var(--cyan)' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div className="form-group">
                          <label className="form-label">Hạn mức (Kí tự)</label>
                          <input 
                            type="number" 
                            className="form-control"
                            value={providerSettings.zaloDailyLimit}
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, zaloDailyLimit: parseInt(e.target.value, 10) || 5000 }))}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Zalo API Endpoint</label>
                        <input 
                          type="text" 
                          className="form-control"
                          value={providerSettings.zaloEndpoint}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, zaloEndpoint: e.target.value }))}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => {
                          setProviderSettings((prev: any) => ({ ...prev, zaloApiKey: '' }));
                          showToast('Đã xóa Zalo API Key thành công!', 'info');
                        }}
                        style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.2)', fontSize: '0.8rem' }}
                      >
                        Xóa Zalo API Key
                      </button>
                    </>
                  )}

                  {/* Google TTS configurations */}
                  {providerSettings.activeProvider === 'google' && (
                    <>
                      <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', gap: '8px', color: '#34d399' }}>
                        <Info size={16} style={{ flexShrink: 0 }} />
                        <span>💡 Google Translate TTS (Multi-chunk Nâng cao): Tự động tách câu dài (&gt;180 ký tự) theo dấu câu, hỗ trợ chỉnh tốc độ phát và tự động dự phòng qua Proxy / No-Referer.</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label">Tốc độ đọc (Playback Speed): {providerSettings.googleSpeed || 1.0}x</label>
                          <input 
                            type="range" 
                            min="0.6" 
                            max="1.5" 
                            step="0.05"
                            value={providerSettings.googleSpeed || 1.0} 
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, googleSpeed: parseFloat(e.target.value) }))}
                            style={{ width: '100%', accentColor: 'var(--cyan)', marginTop: '8px' }}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Hạn mức hàng ngày (Kí tự)</label>
                          <input 
                            type="number" 
                            className="form-control"
                            value={providerSettings.googleDailyLimit}
                            onChange={e => setProviderSettings((prev: any) => ({ ...prev, googleDailyLimit: parseInt(e.target.value, 10) || 20000 }))}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Custom settings */}
                  {providerSettings.activeProvider === 'custom' && (
                    <div className="form-group">
                      <label className="form-label">Custom API Endpoint</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={providerSettings.customEndpoint}
                        placeholder="VD: http://localhost:5000/tts"
                        onChange={e => setProviderSettings((prev: any) => ({ ...prev, customEndpoint: e.target.value }))}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginTop: '4px', lineHeight: 1.3 }}>
                        Endpoint nhận tham số `?text=` và trả về luồng âm thanh trực tiếp (WAV/MP3).
                      </span>
                    </div>
                  )}

                  {/* Reverse Proxy URL (for Edge / CapCut / OpenAI.fm / Google when deployed on static hosting) */}
                  {(['edge', 'capcut', 'openaifm', 'google'].includes(providerSettings.activeProvider)) && (
                    <div className="form-group">
                      <label className="form-label">Reverse Proxy URL (Tùy chọn - Mặc định dùng `/api/tts-proxy` hoặc GAS)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={providerSettings.reverseProxyUrl || ''}
                        placeholder="Để trống để dùng Vite Proxy (/api/tts-proxy) hoặc nhập Cloudflare Worker URL"
                        onChange={e => setProviderSettings((prev: any) => ({ ...prev, reverseProxyUrl: e.target.value }))}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginTop: '4px', lineHeight: 1.3 }}>
                        Mặc định hệ thống tự động kết nối qua `/api/tts-proxy` (Vite server) hoặc `CloudflareWorkerHikvision.js` / `gas_backend.gs`.
                      </span>
                    </div>
                  )}

                  {/* Volume slider */}
                  <div className="form-group">
                    <label className="form-label">Âm lượng (Volume): {Math.round(providerSettings.volume * 100)}%</label>
                    <input 
                      type="range" 
                      min="0.0" 
                      max="1.0" 
                      step="0.05"
                      value={providerSettings.volume} 
                      onChange={e => setProviderSettings((prev: any) => ({ ...prev, volume: parseFloat(e.target.value) }))}
                      style={{ width: '100%', accentColor: 'var(--cyan)' }}
                    />
                  </div>

                  {/* Save config button */}
                  <button
                    type="button"
                    className="primary"
                    onClick={handleSaveSettingsToCloud}
                    style={{ height: '40px', fontSize: '0.85rem', width: '100%', marginTop: '0.5rem' }}
                  >
                    <Save size={16} />
                    <span>Lưu & Đồng bộ cấu hình Cloud</span>
                  </button>

                  {/* Clear all credentials */}
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setProviderSettings((prev: any) => ({
                        ...prev,
                        fptApiKey: '',
                        viettelToken: '',
                        zaloApiKey: '',
                        openaifmApiKey: ''
                      }));
                      showToast('Đã xóa toàn bộ API Key khỏi bộ nhớ trình duyệt!', 'info');
                    }}
                    style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--red)', fontSize: '0.8rem', width: '100%', marginTop: '0.5rem' }}
                  >
                    <Trash2 size={14} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                    <span style={{ verticalAlign: 'middle' }}>Xóa toàn bộ API Key</span>
                  </button>

                </div>
              </div>
        </div>
      )}

      {/* TAB 3: HISTORY DETAIL LOG */}
      {mainTab === 'history' && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="card panel" style={{ background: 'var(--panel-bg)', minHeight: '350px', maxHeight: '650px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={16} style={{ color: 'var(--cyan)' }} />
                <span>Nhật ký phát âm thanh gần đây</span>
              </h2>
              {history.length > 0 && (
                <button 
                  type="button" 
                  className="btn-ghost" 
                  onClick={() => {
                    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử phát?')) {
                      setHistory([]);
                      showToast('Đã dọn dẹp toàn bộ lịch sử phát!', 'info');
                    }
                  }}
                  style={{ fontSize: '11px', color: '#f87171', padding: '2px 8px', height: '24px' }}
                >
                  Xóa tất cả
                </button>
              )}
            </div>

            <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {history.map(item => (
                <div 
                  key={item.id} 
                  style={{ 
                    padding: '10px 12px', 
                    background: 'var(--bg-elevated)', 
                    border: '1px solid var(--border-default)', 
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ overflow: 'hidden', flexGrow: 1, paddingRight: '12px' }}>
                    <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {item.text}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px' }}>
                      🕒 {new Date(item.playedAt).toLocaleString('vi-VN')} • <strong style={{ color: 'var(--cyan)' }}>{item.providerId.toUpperCase()}</strong>
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      setComposeText(item.text);
                      setSelectedTemplateId(item.templateId || null);
                      setMainTab('broadcast');
                      dispatchSpeak(item.normalizedText, item.providerId);
                    }}
                    className="primary"
                    style={{ 
                      height: '32px',
                      padding: '0 10px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Phát lại và mở khung soạn thảo"
                  >
                    <Play size={12} fill="white" />
                    <span>Phát lại</span>
                  </button>
                </div>
              ))}
              {history.length === 0 && (
                <EmptyState 
                  icon={<History size={36} />}
                  title="Chưa có lịch sử phát nào"
                  description="Các câu phát qua loa sẽ được tự động ghi lại tại đây."
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Guide Panel Instruction */}
      <div className="card panel" style={{ marginTop: '1.5rem', background: 'var(--panel-bg)' }}>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={18} style={{ color: 'var(--cyan)' }} />
          <span>Hướng dẫn sử dụng Đọc TTS</span>
        </h2>
        <ol style={{ fontSize: '0.85rem', color: 'var(--muted)', paddingLeft: '1.25rem', lineHeight: 1.6, margin: 0 }}>
          <li>Nhập nội dung mẫu câu cần nói ở khung soạn thảo hoặc chọn nhanh từ thư viện bên trái.</li>
          <li>Bạn có thể chèn biến động dạng <code style={{ color: 'var(--cyan)' }}>&#123;ten_khach&#125;</code> để điền nhanh nội dung động cho khách hàng.</li>
          <li>Chọn provider phát âm mong muốn: <strong>Edge Neural TTS</strong> (Hoài My / Nam Minh), <strong>CapCut SAMI TTS</strong> (18 giọng TikTok/CapCut), <strong>OpenAI.fm GPT-4o</strong>, <strong>Google Multi-chunk TTS</strong>, hoặc các Cloud API (FPT.AI / Viettel / Zalo).</li>
          <li>Điều chỉnh tốc độ và cao độ giọng đọc phù hợp với không gian nhà hàng của bạn.</li>
          <li>Bấm <strong>"Nghe thử giọng"</strong> để bắt đầu phát âm thanh. Hệ thống tự động fallback sang nguồn miễn phí nếu Cloud bị lỗi hoặc hết Quota.</li>
          <li>Bấm <strong>"Lưu lại"</strong> để lưu mẫu câu vào cơ sở dữ liệu local và đồng bộ lên Spreadsheet.</li>
        </ol>
      </div>

    </div>
  );
}
