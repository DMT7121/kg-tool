import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Volume2, 
  Square, 
  Save, 
  Trash2, 
  RefreshCw, 
  Play, 
  Sliders, 
  Sparkles, 
  BookOpen, 
  History, 
  Search, 
  Star, 
  Database
} from 'lucide-react';
import { StatCard, EmptyState } from './Shared';

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
  type: 'browser' | 'local' | 'cloud' | 'custom';
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
  }
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
    return saved ? JSON.parse(saved) : {
      activeProvider: 'browser',
      browserVoiceURI: '',
      browserGender: 'auto',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      customEndpoint: 'http://localhost:5000/tts',
      cloudApiKey: '',
      cloudVoiceId: ''
    };
  });

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
    ngay: "28/06/2026"
  });

  // System voices list
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused'>('idle');

  // Sidebar search & category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Layout Mobile view tabs
  const [mobileActiveTab, setMobileActiveTab] = useState<'compose' | 'templates' | 'settings' | 'history'>('compose');

  // Mobile layout state listener
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
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
    return normalizeTextForVietnameseTTS(interpolatedText);
  }, [interpolatedText]);

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

  // Play using custom API endpoint (Piper / Kokoro / Cloud Proxy)
  const speakCustom = async (textToSpeak: string) => {
    setPlaybackState('playing');
    showToast('Đang tải dữ liệu từ TTS server...', 'info');

    try {
      // Build query string or body depending on settings
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
      // Fallback
      speakBrowser(textToSpeak);
    }
  };

  const handleSpeak = () => {
    if (!interpolatedText.trim()) {
      showToast('Vui lòng soạn câu nói trước khi nghe thử.', 'error');
      return;
    }

    if (providerSettings.activeProvider === 'browser') {
      speakBrowser(normalizedTextToSpeak);
    } else {
      speakCustom(normalizedTextToSpeak);
    }
  };

  const handleStop = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaybackState('idle');
  };

  // Helper to add history record
  const addHistoryLog = (text: string, status: 'success' | 'failed', errMsg?: string) => {
    const newItem: TTSHistoryItem = {
      id: 'hist-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      templateId: selectedTemplateId || undefined,
      text: text,
      providerId: providerSettings.activeProvider,
      voiceId: providerSettings.browserVoiceURI || 'Default vi-VN',
      gender: providerSettings.browserGender,
      rate: providerSettings.rate,
      pitch: providerSettings.pitch,
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

    const newTpl: TTSTemplate = {
      id,
      title,
      category: composeCategory,
      text: composeText,
      variables: parsedVariables,
      providerId: providerSettings.activeProvider,
      voiceId: providerSettings.browserVoiceURI,
      gender: providerSettings.browserGender,
      lang: 'vi-VN',
      rate: providerSettings.rate,
      pitch: providerSettings.pitch,
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
    setProviderSettings((prev: any) => ({
      ...prev,
      rate: tpl.rate,
      pitch: tpl.pitch,
      volume: tpl.volume,
      browserVoiceURI: tpl.voiceId || prev.browserVoiceURI,
      browserGender: tpl.gender || prev.browserGender
    }));

    setMobileActiveTab('compose');
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
      // Local templates not in remote will be pushed to sheet
      const mergedList = [...templates];
      
      // Remote templates missing or newer replace local
      remoteTemplates.forEach(rt => {
        const localIdx = mergedList.findIndex(t => t.id === rt.id);
        if (localIdx === -1) {
          mergedList.push(rt);
        } else {
          // If remote is newer
          const localTime = new Date(mergedList[localIdx].updatedAt).getTime();
          const remoteTime = new Date(rt.updatedAt).getTime();
          if (remoteTime > localTime) {
            mergedList[localIdx] = rt;
          }
        }
      });

      // 3. Upload missing/local changes to sheet
      for (const t of templates) {
        const remoteMatch = remoteTemplates.find(rt => rt.id === t.id);
        if (!remoteMatch || new Date(t.updatedAt).getTime() > new Date(remoteMatch.updatedAt).getTime()) {
          await saveTemplateToSpreadsheet(t);
        }
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

  return (
    <div className="tts-page">
      
      {/* PAGE HEADER */}
      <div className="head" style={{ marginBottom: '1.5rem' }}>
        <div className="title">
          <h1>Đọc Văn Bản TTS <span className="blue-dot"></span></h1>
          <p>Tạo và phát giọng đọc tự động từ mẫu câu nghiệp vụ nhà hàng hoặc văn bản tùy chỉnh.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn-outline" 
            onClick={handleSpreadsheetSync}
            disabled={syncStatus === 'syncing'}
          >
            {syncStatus === 'syncing' ? <RefreshCw className="spinner" size={18} /> : <Database size={18} />}
            <span>Đồng bộ Spreadsheet</span>
          </button>
        </div>
      </div>

      {/* OVERVIEW KPIS */}
      <div className="kpis" style={{ marginBottom: '1.5rem' }}>
        <StatCard 
          icon="🔊" 
          label="Provider đang dùng" 
          value={providerSettings.activeProvider === 'browser' ? 'Browser Native' : 'Custom Server'} 
          subtext={providerSettings.activeProvider === 'browser' ? 'Giọng đọc trình duyệt' : providerSettings.customEndpoint}
          hasData={true} 
        />
        <StatCard 
          icon="📚" 
          label="Mẫu câu đã lưu" 
          value={`${templates.length} mẫu`} 
          subtext="Lưu trong cơ sở dữ liệu"
          hasData={templates.length > 0} 
        />
        <StatCard 
          icon="⏱️" 
          label="Lịch sử phát" 
          value={`${history.length} lượt`} 
          subtext="Tổng số lượt phát gần đây"
          hasData={history.length > 0} 
        />
      </div>

      {/* MOBILE TAB BAR */}
      {isMobileScreen && (
        <div className="card panel" style={{ marginBottom: '1rem', padding: '6px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              type="button" 
              onClick={() => setMobileActiveTab('compose')}
              style={{ 
                flex: 1, padding: '8px', borderRadius: '6px', fontSize: '0.8rem',
                background: mobileActiveTab === 'compose' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent',
                border: 'none', color: 'white', fontWeight: 600
              }}
            >
              ✍️ Soạn câu
            </button>
            <button 
              type="button" 
              onClick={() => setMobileActiveTab('templates')}
              style={{ 
                flex: 1, padding: '8px', borderRadius: '6px', fontSize: '0.8rem',
                background: mobileActiveTab === 'templates' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent',
                border: 'none', color: 'white', fontWeight: 600
              }}
            >
              📂 Mẫu câu
            </button>
            <button 
              type="button" 
              onClick={() => setMobileActiveTab('settings')}
              style={{ 
                flex: 1, padding: '8px', borderRadius: '6px', fontSize: '0.8rem',
                background: mobileActiveTab === 'settings' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent',
                border: 'none', color: 'white', fontWeight: 600
              }}
            >
              ⚙️ Giọng đọc
            </button>
            <button 
              type="button" 
              onClick={() => setMobileActiveTab('history')}
              style={{ 
                flex: 1, padding: '8px', borderRadius: '6px', fontSize: '0.8rem',
                background: mobileActiveTab === 'history' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent',
                border: 'none', color: 'white', fontWeight: 600
              }}
            >
              ⏱️ Lịch sử
            </button>
          </div>
        </div>
      )}

      {/* DASHBOARD LAYOUT GRID */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobileScreen ? '1fr' : '300px 1fr 340px', 
          gap: '1.25rem',
          alignItems: 'start'
        }}
      >
        
        {/* COLUMN 1: TEMPLATE LIBRARY (Left in Desktop, Tab in Mobile) */}
        {(!isMobileScreen || mobileActiveTab === 'templates') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card panel" style={{ background: 'var(--panel-bg)', height: isMobileScreen ? 'auto' : '650px', display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} style={{ color: 'var(--cyan)' }} />
                <span>Thư viện mẫu câu</span>
              </h2>

              {/* Search template */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '6px 10px', marginBottom: '0.75rem' }}>
                <Search size={14} style={{ opacity: 0.5 }} />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm mẫu câu..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              {/* Category tabs */}
              <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '0.75rem' }}>
                {categories.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setActiveCategory(cat)}
                    style={{ 
                      whiteSpace: 'nowrap',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      background: activeCategory === cat ? 'var(--cyan-glow)' : 'rgba(255,255,255,0.05)',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    {cat === 'Favorite' ? '⭐ Yêu thích' : cat}
                  </button>
                ))}
              </div>

              {/* Saved list */}
              <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: isMobileScreen ? '250px' : '380px' }}>
                {filteredTemplates.map(tpl => (
                  <div 
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    style={{ 
                      padding: '8px 10px', 
                      borderRadius: '6px', 
                      background: selectedTemplateId === tpl.id ? 'rgba(2, 132, 199, 0.15)' : 'rgba(255,255,255,0.02)', 
                      border: selectedTemplateId === tpl.id ? '1px solid var(--cyan)' : '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ overflow: 'hidden', flexGrow: 1, paddingRight: '8px' }}>
                      <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tpl.title}</span>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tpl.text}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        type="button" 
                        onClick={(e) => toggleFavorite(tpl.id, e)}
                        style={{ background: 'transparent', border: 'none', color: tpl.isFavorite ? '#fbbf24' : 'var(--muted)', cursor: 'pointer', padding: '4px' }}
                      >
                        <Star size={12} fill={tpl.isFavorite ? '#fbbf24' : 'none'} />
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredTemplates.length === 0 && (
                  <EmptyState 
                    icon={<Volume2 size={32} />}
                    title="Chưa có mẫu câu nào" 
                    description="Soạn và lưu mẫu câu bên cạnh hoặc thêm từ mục Gợi ý ở dưới." 
                  />
                )}
              </div>
            </div>

            {/* Suggestions Library */}
            <div className="card panel" style={{ background: 'var(--panel-bg)' }}>
              <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} style={{ color: 'var(--cyan)' }} />
                <span>Gợi ý mẫu câu phát nhanh</span>
              </h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {DEFAULT_SUGGESTIONS.map((sug, i) => (
                  <div 
                    key={i}
                    style={{ 
                      padding: '6px 8px', 
                      background: 'rgba(255,255,255,0.01)', 
                      border: '1px solid rgba(255,255,255,0.03)', 
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                      <strong>{sug.title}</strong>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{sug.text}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleLoadSuggestion(sug)}
                      style={{ background: 'var(--cyan-glow)', border: 'none', color: 'white', borderRadius: '4px', padding: '3px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                      + Thêm
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* COLUMN 2: TEXT COMPOSER & INTERPOLATOR (Middle in Desktop, Tab in Mobile) */}
        {(!isMobileScreen || mobileActiveTab === 'compose') && (
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
                      style={{ background: '#0a101e', color: 'white' }}
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
                    <span>Nội dung mẫu nói</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{composeText.length} ký tự</span>
                  </label>
                  <textarea 
                    className="form-control"
                    placeholder="Nhập nội dung mẫu nói ở đây..."
                    value={composeText}
                    onChange={e => setComposeText(e.target.value)}
                    style={{ height: '140px', fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: 1.5 }}
                  />
                  
                  {/* Insert variable quick chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}>Chèn biến nhanh:</span>
                    {["ten_khach", "so_khach", "gio_nhan_ban", "so_ban", "khu_vuc", "ten_nhan_vien", "so_tien"].map(v => (
                      <button 
                        key={v}
                        type="button"
                        onClick={() => setComposeText(prev => prev + ` {${v}}`)}
                        style={{ 
                          fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', 
                          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: 'var(--cyan)', cursor: 'pointer' 
                        }}
                      >
                        +{v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DYNAMIC VARIABLES INPUT FIELDS */}
                {parsedVariables.length > 0 && (
                  <div className="card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '8px' }}>
                    <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.75rem 0', color: 'var(--cyan)' }}>📝 Nhập giá trị biến động</h3>
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
                <div className="card" style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem 0', color: 'var(--green)' }}>🔊 Xem trước câu nói thật</h3>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'white', lineHeight: 1.4 }}>
                    {interpolatedText}
                  </p>
                  
                  {/* Speech normalization display */}
                  <div style={{ borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '2px' }}>Dòng đọc chuẩn hóa phát ra loa:</span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--cyan)', fontStyle: 'italic' }}>
                      "{normalizedTextToSpeak}"
                    </span>
                  </div>
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
                    if (providerSettings.activeProvider === 'browser') speakBrowser(normalizeTextForVietnameseTTS(text));
                    else speakCustom(normalizeTextForVietnameseTTS(text));
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
                    if (providerSettings.activeProvider === 'browser') speakBrowser(normalizeTextForVietnameseTTS(text));
                    else speakCustom(normalizeTextForVietnameseTTS(text));
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
                    if (providerSettings.activeProvider === 'browser') speakBrowser(normalizeTextForVietnameseTTS(text));
                    else speakCustom(normalizeTextForVietnameseTTS(text));
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
                    if (providerSettings.activeProvider === 'browser') speakBrowser(normalizeTextForVietnameseTTS(text));
                    else speakCustom(normalizeTextForVietnameseTTS(text));
                  }}
                  style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px' }}
                >
                  <strong style={{ fontSize: '0.85rem' }}>💵 Báo cáo xuất lương</strong>
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Thông báo cho Kế toán trưởng duyệt lương</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* COLUMN 3: AUDIO CONFIG & HISTORY (Right in Desktop, Tab in Mobile) */}
        {(!isMobileScreen || mobileActiveTab === 'settings' || mobileActiveTab === 'history') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* AUDIO CONFIG SECTION */}
            {(!isMobileScreen || mobileActiveTab === 'settings') && (
              <div className="card panel" style={{ background: 'var(--panel-bg)' }}>
                <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={18} style={{ color: 'var(--cyan)' }} />
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
                      style={{ background: '#0a101e', color: 'white' }}
                    >
                      <option value="browser">🌐 Browser Speech API (Miễn phí)</option>
                      <option value="custom">🛠️ Custom Endpoint Server (Tự host)</option>
                    </select>
                  </div>

                  {/* Browser settings */}
                  {providerSettings.activeProvider === 'browser' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Chọn giọng (Voices trình duyệt)</label>
                        <select 
                          className="form-control"
                          value={providerSettings.browserVoiceURI}
                          onChange={e => setProviderSettings((prev: any) => ({ ...prev, browserVoiceURI: e.target.value }))}
                          style={{ background: '#0a101e', color: 'white', fontSize: '0.85rem' }}
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

                  {/* Rate speed slider */}
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Tốc độ đọc: {providerSettings.rate}x</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                          className="btn-outline" 
                          style={{ padding: '1px 4px', fontSize: '10px' }}
                          onClick={() => setProviderSettings((prev: any) => ({ ...prev, rate: 0.75 }))}
                        >Chậm</button>
                        <button 
                          className="btn-outline" 
                          style={{ padding: '1px 4px', fontSize: '10px' }}
                          onClick={() => setProviderSettings((prev: any) => ({ ...prev, rate: 1.0 }))}
                        >Chuẩn</button>
                        <button 
                          className="btn-outline" 
                          style={{ padding: '1px 4px', fontSize: '10px' }}
                          onClick={() => setProviderSettings((prev: any) => ({ ...prev, rate: 1.25 }))}
                        >Nhanh</button>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="2.0" 
                      step="0.05"
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

                </div>
              </div>
            )}

            {/* HISTORY SECTION */}
            {(!isMobileScreen || mobileActiveTab === 'history') && (
              <div className="card panel" style={{ background: 'var(--panel-bg)', height: isMobileScreen ? 'auto' : '260px', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: '1rem', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={16} style={{ color: 'var(--cyan)' }} />
                  <span>Lịch sử phát gần đây</span>
                </h2>

                <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {history.map(item => (
                    <div 
                      key={item.id} 
                      style={{ 
                        padding: '6px 8px', 
                        background: 'rgba(255,255,255,0.01)', 
                        border: '1px solid rgba(255,255,255,0.03)', 
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ overflow: 'hidden', flexGrow: 1, paddingRight: '8px' }}>
                        <span style={{ display: 'block', fontSize: '0.75rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {item.text}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--muted)' }}>
                          {new Date(item.playedAt).toLocaleTimeString('vi-VN')} - {item.providerId}
                        </span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          setComposeText(item.text);
                          setSelectedTemplateId(item.templateId || null);
                          if (item.providerId === 'browser') speakBrowser(normalizeTextForVietnameseTTS(item.text));
                          else speakCustom(normalizeTextForVietnameseTTS(item.text));
                        }}
                        style={{ 
                          background: 'transparent', border: 'none', color: 'var(--cyan)', 
                          cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' 
                        }}
                        title="Phát lại"
                      >
                        <Play size={10} fill="var(--cyan)" />
                      </button>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <span style={{ fontSize: '0.75rem', opacity: 0.5, textAlign: 'center', display: 'block', padding: '12px' }}>Chưa phát câu nào hôm nay.</span>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
