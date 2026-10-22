/**
 * Reverse-Engineered Vietnamese TTS Engines & Catalogs
 * Tích hợp 4 nguồn TTS:
 * 1. Microsoft Edge Read-Aloud Neural TTS (hasscc/hass-edge-tts / rany2/edge-tts v7.3+)
 * 2. CapCut / ByteDance SAMI TTS (kuwacom/CapCut-TTS v1 WS & K07VN/capcut-tts-api v3)
 * 3. OpenAI.fm / TTSFM (dbccccccc/ttsfm - GPT-4o mini TTS)
 * 4. Google Translate Unofficial TTS (pndurette/gTTS / thiennq/node-gtts)
 */

export interface VoiceOption {
  id: string;
  name: string;
  group?: string;
  gender?: 'female' | 'male' | 'neutral';
  resourceId?: string;
}

// 1. Microsoft Edge Neural TTS Voices (vi-VN)
export const EDGE_VOICES: VoiceOption[] = [
  {
    id: 'vi-VN-HoaiMyNeural',
    name: 'Hoài My Neural (Nữ miền Bắc - Chuẩn lễ tân/phát thanh)',
    gender: 'female',
  },
  {
    id: 'vi-VN-NamMinhNeural',
    name: 'Nam Minh Neural (Nam miền Bắc - Trầm ấm, rõ chữ)',
    gender: 'male',
  },
];

// 2. CapCut / ByteDance SAMI Vietnamese Voices (vi-VN)
export const CAPCUT_VOICES: VoiceOption[] = [
  // Nhóm Thông báo & Giao tiếp tự nhiên
  {
    id: 'BV074_streaming',
    name: 'Cô Gái Hoạt Ngôn (Nữ - Phổ biến nhất, rõ ràng)',
    group: 'Giọng tự nhiên & Thông báo',
    gender: 'female',
    resourceId: '7102355709945188865',
  },
  {
    id: 'BV421_vivn_streaming',
    name: 'Nhỏ Ngọt Ngào (Nữ miền Nam - Dịu dàng, thân thiện)',
    group: 'Giọng tự nhiên & Thông báo',
    gender: 'female',
    resourceId: '7252594014782755330',
  },
  {
    id: 'BV075_streaming',
    name: 'Thanh Niên Tự Tin (Nam - Trẻ trung, dứt khoát)',
    group: 'Giọng tự nhiên & Thông báo',
    gender: 'male',
    resourceId: '7102355803792740865',
  },
  {
    id: 'multi_female_yangguangnv_uranus_bigtts',
    name: 'Ban Mai BigTTS (Nữ - Tươi sáng, hiện đại)',
    group: 'Giọng tự nhiên & Thông báo',
    gender: 'female',
    resourceId: '7637456432522218773',
  },
  {
    id: 'multi_male_felipe_uranus_bigtts',
    name: 'Giọng Nam Trầm BigTTS (Nam - Lịch lãm, ấm áp)',
    group: 'Giọng tự nhiên & Thông báo',
    gender: 'male',
    resourceId: '7637456729696996628',
  },
  {
    id: 'BV560_streaming',
    name: 'Alex Đại Đế (Nam - Mạnh mẽ, cá tính)',
    group: 'Giọng tự nhiên & Thông báo',
    gender: 'male',
    resourceId: '7483736167565758992',
  },
  // Nhóm Phát thanh & Bản tin (BigTTS)
  {
    id: 'multi_female_quanweinv_uranus_bigtts',
    name: 'Bản Tin 1 (Nữ BigTTS - Phát thanh viên chuẩn)',
    group: 'Giọng Phát thanh & Bản tin',
    gender: 'female',
    resourceId: '7637458743197732117',
  },
  {
    id: 'multi_female_sisi_uranus_bigtts',
    name: 'Bản Tin Nữ (Nữ BigTTS - Trang trọng, sắc nét)',
    group: 'Giọng Phát thanh & Bản tin',
    gender: 'female',
    resourceId: '7637455857285860629',
  },
  {
    id: 'multi_female_xinwenjieshuo_uranus_bigtts',
    name: 'Nam Bản Tin (Nam BigTTS - Phát thanh chuyên nghiệp)',
    group: 'Giọng Phát thanh & Bản tin',
    gender: 'male',
    resourceId: '7637455039719640327',
  },
  // Nhóm Kể chuyện & Review
  {
    id: 'multi_female_richgirl_uranus_bigtts',
    name: 'Review Phim Mới (Nữ BigTTS - Truyền cảm)',
    group: 'Giọng Review & Sáng tạo',
    gender: 'female',
    resourceId: '7637460351541447956',
  },
  {
    id: 'multi_female_peiqi_uranus_bigtts',
    name: 'Giọng Gái Mới Lớn (Nữ BigTTS - Trẻ trung)',
    group: 'Giọng Review & Sáng tạo',
    gender: 'female',
    resourceId: '7637458789033151751',
  },
  {
    id: 'multi_female_kiwi_uranus_bigtts',
    name: 'Sunny Idol (Nữ BigTTS - Năng động)',
    group: 'Giọng Review & Sáng tạo',
    gender: 'female',
    resourceId: '7637457995882089749',
  },
  {
    id: 'multi_female_xyf04auto_uranus_bigtts',
    name: 'Review Phim 2 (Nữ BigTTS)',
    group: 'Giọng Review & Sáng tạo',
    gender: 'female',
    resourceId: '7637458743197732117',
  },
  {
    id: 'multi_female_daqi_uranus_bigtts',
    name: 'Review Phim 3 (Nữ BigTTS)',
    group: 'Giọng Review & Sáng tạo',
    gender: 'female',
    resourceId: '7637451983389019409',
  },
  {
    id: 'multi_female_stokie_uranus_bigtts',
    name: 'Review Phim 4 (Nữ BigTTS)',
    group: 'Giọng Review & Sáng tạo',
    gender: 'female',
    resourceId: '7637456729696996628',
  },
  // Nhóm Hiệu ứng đặc biệt (DSP)
  {
    id: 'BV074_streaming_dsp',
    name: 'Giọng Bé (Hiệu ứng em bé dễ thương)',
    group: 'Giọng Hiệu ứng DSP',
    gender: 'female',
    resourceId: '7550087831092251920',
  },
  {
    id: 'BV075_streaming_vibrato_dsp',
    name: 'Việt Méo (Hiệu ứng hài hước)',
    group: 'Giọng Hiệu ứng DSP',
    gender: 'male',
    resourceId: '7569450639810465040',
  },
  {
    id: 'BV075_streaming_robot_dsp',
    name: 'Robot VN (Hiệu ứng người máy)',
    group: 'Giọng Hiệu ứng DSP',
    gender: 'neutral',
    resourceId: '7538698409633516816',
  },
];

// 3. OpenAI.fm / TTSFM Voices (GPT-4o mini TTS)
export const OPENAIFM_VOICES: VoiceOption[] = [
  { id: 'nova', name: 'Nova (Nữ - Ấm áp, phát âm tiếng Việt tự nhiên)', gender: 'female' },
  { id: 'coral', name: 'Coral (Nữ - Thân thiện, tươi sáng)', gender: 'female' },
  { id: 'shimmer', name: 'Shimmer (Nữ - Nhẹ nhàng, lịch sự)', gender: 'female' },
  { id: 'sage', name: 'Sage (Nữ - Điềm tĩnh, chuẩn mực)', gender: 'female' },
  { id: 'alloy', name: 'Alloy (Trung tính - Cân bằng, rõ chữ)', gender: 'neutral' },
  { id: 'echo', name: 'Echo (Nam - Trầm ấm, rõ ràng)', gender: 'male' },
  { id: 'onyx', name: 'Onyx (Nam - Trầm sâu, uy lực)', gender: 'male' },
  { id: 'ash', name: 'Ash (Nam - Trẻ trung, tự nhiên)', gender: 'male' },
  { id: 'ballad', name: 'Ballad (Trung tính - Truyền cảm)', gender: 'neutral' },
  { id: 'fable', name: 'Fable (Biểu cảm, kể chuyện)', gender: 'neutral' },
  { id: 'verse', name: 'Verse (Linh hoạt, giàu ngữ điệu)', gender: 'male' },
];

export const DEFAULT_OPENAIFM_PROMPT =
  'Affect/personality: Lễ tân nhà hàng Việt Nam chuyên nghiệp, thân thiện.\n' +
  'Tone: Lịch sự, ấm áp, rõ ràng từng chữ.\n' +
  'Pronunciation: Phát âm chuẩn tiếng Việt, đọc số và giờ giấc mạch lạc, ngắt nghỉ tự nhiên.';

/**
 * Chia văn bản dài thành các đoạn nhỏ theo dấu câu (chuẩn gTTS <= 180 ký tự)
 */
export function splitTextIntoChunks(text: string, maxLength = 180): string[] {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return [];
  if (clean.length <= maxLength) return [clean];

  const chunks: string[] = [];
  const rawSentences = clean.split(/(?<=[.!?;,\n])\s+/);
  let current = '';

  for (const seg of rawSentences) {
    if (!seg) continue;
    if ((current ? current.length + 1 + seg.length : seg.length) <= maxLength) {
      current = current ? `${current} ${seg}` : seg;
    } else {
      if (current) chunks.push(current);
      if (seg.length <= maxLength) {
        current = seg;
      } else {
        // Cắt theo từ nếu 1 vế câu dài quá maxLength
        const words = seg.split(' ');
        current = '';
        for (const w of words) {
          if ((current ? current.length + 1 + w.length : w.length) <= maxLength) {
            current = current ? `${current} ${w}` : w;
          } else {
            if (current) chunks.push(current);
            current = w;
          }
        }
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Cache CapCut v1 token ở phía client để tái sử dụng (hiệu lực 5 giờ)
let cachedCapCutToken: { token: string; appKey: string; expiresAt: number } | null = null;

/**
 * Kết nối trực tiếp WebSocket từ trình duyệt tới ByteDance SAMI (CapCut v1)
 * Dùng khi đã có { token, appKey } từ Proxy / Worker / Google Apps Script
 */
export function synthesizeCapCutBrowserWS(params: {
  text: string;
  speaker: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  token: string;
  appKey: string;
}): Promise<Blob> {
  const {
    text,
    speaker = 'BV074_streaming',
    speed = 10,
    pitch = 10,
    volume = 10,
    token,
    appKey,
  } = params;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://sami-sg1.byteintlapi.com/internal/api/v1/ws');
    ws.binaryType = 'arraybuffer';
    const chunks: ArrayBuffer[] = [];
    let settled = false;

    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        try { ws.close(); } catch {}
        reject(new Error('Quá thời gian kết nối WebSocket CapCut (12s)'));
      }
    }, 12000);

    ws.onopen = () => {
      const payload = {
        text,
        speaker,
        pitch: Math.round(pitch),
        speed: Math.round(speed),
        volume: Math.round(volume),
        rate: 24000,
        appid: '348188',
      };
      ws.send(
        JSON.stringify({
          token,
          appkey: appKey,
          namespace: 'TTS',
          event: 'StartTask',
          payload: JSON.stringify(payload),
        })
      );
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed.event === 'TaskFinished') {
            window.clearTimeout(timer);
            settled = true;
            ws.close();
            if (chunks.length === 0) {
              reject(new Error('CapCut WebSocket không trả về dữ liệu âm thanh'));
            } else {
              resolve(new Blob(chunks, { type: 'audio/wav' }));
            }
          } else if (parsed.event === 'TaskFailed' || (parsed.status_code && parsed.status_code >= 400)) {
            window.clearTimeout(timer);
            settled = true;
            ws.close();
            reject(new Error(`CapCut từ chối giọng đọc (${parsed.status_text || parsed.status_code})`));
          }
        } catch {
          // Ignore non-JSON text frame
        }
      } else if (ev.data instanceof ArrayBuffer) {
        // Kiểm tra xem frame binary có phải JSON status không
        try {
          const view = new Uint8Array(ev.data);
          if (view.length > 0 && view[0] === 0x7b /* '{' */ && view[view.length - 1] === 0x7d /* '}' */) {
            const textStr = new TextDecoder().decode(view);
            const parsed = JSON.parse(textStr);
            if (parsed.event === 'TaskFinished') {
              window.clearTimeout(timer);
              settled = true;
              ws.close();
              resolve(new Blob(chunks, { type: 'audio/wav' }));
              return;
            } else if (parsed.event === 'TaskFailed' || (parsed.status_code && parsed.status_code >= 400)) {
              window.clearTimeout(timer);
              settled = true;
              ws.close();
              reject(new Error(`CapCut lỗi: ${parsed.status_text || parsed.status_code}`));
              return;
            }
          }
        } catch {
          // Binary WAV data
        }
        chunks.push(ev.data);
      }
    };

    ws.onerror = () => {
      if (!settled) {
        window.clearTimeout(timer);
        settled = true;
        reject(new Error('Lỗi kết nối WebSocket tới máy chủ CapCut SAMI'));
      }
    };

    ws.onclose = () => {
      if (!settled) {
        window.clearTimeout(timer);
        settled = true;
        if (chunks.length > 0) {
          resolve(new Blob(chunks, { type: 'audio/wav' }));
        } else {
          reject(new Error('Kết nối CapCut đóng trước khi hoàn tất'));
        }
      }
    };
  });
}

export interface ReverseTtsRequest {
  provider: 'edge' | 'capcut' | 'openaifm' | 'google';
  text: string;
  voice?: string;
  rate?: number;     // 0.5 -> 2.0 (or CapCut 5 -> 20)
  pitch?: number;    // 0.5 -> 1.5 (or CapCut 5 -> 20)
  volume?: number;   // 0.0 -> 1.0
  prompt?: string;   // OpenAI.fm instructions
  apiKey?: string;   // Optional OpenAI API key
  endpoint?: string; // Optional custom endpoint
  proxyUrl?: string; // Optional Cloudflare Worker / Custom proxy URL
  gasUrl?: string;   // Optional Google Apps Script URL
}

export interface ReverseTtsResult {
  blob?: Blob;
  audioUrl?: string;
  fallbackUsed?: string;
}

/**
 * Điều phối tổng hợp âm thanh cho cả 4 nguồn Reverse-Engineered TTS:
 * Ưu tiên:
 * 1. Vite Local Proxy (/api/tts-proxy) hoặc Cloudflare Worker Proxy (nếu cấu hình proxyUrl)
 * 2. Google Apps Script Proxy (gasUrl) + Browser Direct WebSocket (với CapCut)
 * 3. Direct Browser Fetch / Audio Element (với Google TTS)
 */
export async function synthesizeReverseEngineeredTTS(req: ReverseTtsRequest): Promise<ReverseTtsResult> {
  const candidates: string[] = [];
  if (req.proxyUrl && req.proxyUrl.trim()) {
    candidates.push(req.proxyUrl.trim());
  }
  // 1. Thử endpoint nội bộ /api/tts-proxy (hoạt động trong Vite dev/preview)
  candidates.push('/api/tts-proxy');
  // 2. Tự động thử Cloudflare Worker đã deploy của hệ thống KG Studio (dùng khi chạy bản tĩnh GitHub Pages / Extension)
  try {
    const savedWorkerUrl =
      (typeof window !== 'undefined' && window.localStorage.getItem('kg_tool_worker_url')) ||
      'https://kingsgrill-hikvision-sync.dmt-kgwork.workers.dev';
    if (savedWorkerUrl && !candidates.includes(savedWorkerUrl)) {
      candidates.push(savedWorkerUrl);
    }
  } catch {
    candidates.push('https://kingsgrill-hikvision-sync.dmt-kgwork.workers.dev');
  }

  let lastError: Error | null = null;

  // BƯỚC 1: Thử gọi qua Proxy (Vite Middleware hoặc Cloudflare Worker)
  for (const proxyEndpoint of candidates) {
    try {
      const response = await fetch(proxyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tts_proxy',
          provider: req.provider,
          text: req.text,
          voice: req.voice,
          rate: req.rate,
          pitch: req.pitch,
          volume: req.volume,
          prompt: req.prompt,
          apiKey: req.apiKey,
          endpoint: req.endpoint,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && (contentType.includes('audio/') || contentType.includes('application/octet-stream'))) {
        const blob = await response.blob();
        if (blob.size > 100) {
          const fallbackUsed = response.headers.get('x-tts-fallback') || undefined;
          return { blob, fallbackUsed };
        }
      } else if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.success && data.audioBase64) {
          const binary = atob(data.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return {
            blob: new Blob([bytes], { type: data.mimeType || 'audio/mpeg' }),
            fallbackUsed: data.fallbackUsed,
          };
        }
        if (data.error || data.message) {
          lastError = new Error(data.error || data.message);
        }
      } else if (response.status !== 404 && response.status !== 405) {
        const errText = await response.text().catch(() => '');
        try {
          const errJson = JSON.parse(errText);
          lastError = new Error(errJson.error || errJson.message || `HTTP ${response.status}`);
        } catch {
          lastError = new Error(`Proxy trả về HTTP ${response.status}`);
        }
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  // BƯỚC 2: Xử lý dự phòng qua Google Apps Script (gasUrl) hoặc Trình duyệt trực tiếp
  if (req.provider === 'capcut') {
    // Nếu có cached token hoặc lấy được token từ GAS, kết nối thẳng WebSocket từ trình duyệt!
    if ((!cachedCapCutToken || Date.now() > cachedCapCutToken.expiresAt) && req.gasUrl) {
      try {
        const tokenRes = await fetch(`${req.gasUrl}?action=tts_proxy&provider=capcut_token`);
        const tokenData = await tokenRes.json();
        const appKeyVal = tokenData.appKey || tokenData.app_key;
        if (tokenData.success && tokenData.token && appKeyVal) {
          cachedCapCutToken = {
            token: tokenData.token,
            appKey: appKeyVal,
            expiresAt: Date.now() + 5 * 3600 * 1000,
          };
        }
      } catch {
        // Ignore GAS token error
      }
    }

    if (cachedCapCutToken) {
      const blob = await synthesizeCapCutBrowserWS({
        text: req.text,
        speaker: req.voice || 'BV074_streaming',
        speed: req.rate ?? 10,
        pitch: req.pitch ?? 10,
        volume: Math.round((req.volume ?? 1) * 10),
        token: cachedCapCutToken.token,
        appKey: cachedCapCutToken.appKey,
      });
      return { blob };
    }
  }

  if (req.gasUrl && (req.provider === 'google' || req.provider === 'openaifm')) {
    try {
      const gasRes = await fetch(
        `${req.gasUrl}?action=tts_proxy&provider=${encodeURIComponent(req.provider)}&text=${encodeURIComponent(
          req.text
        )}&voice=${encodeURIComponent(req.voice || '')}&rate=${encodeURIComponent(String(req.rate ?? 1))}`
      );
      const gasData = await gasRes.json();
      if (gasData.success && gasData.audioBase64) {
        const binary = atob(gasData.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return {
          blob: new Blob([bytes], { type: gasData.mimeType || 'audio/mpeg' }),
        };
      }
    } catch {
      // Fallback below
    }
  }

  if (req.provider === 'google') {
    // Fallback trực tiếp tới Google Translate TTS endpoint (chuẩn gTTS client=tw-ob)
    const speedParam = (req.rate ?? 1.0) < 0.85 ? '0.3' : '1';
    const chunks = splitTextIntoChunks(req.text, 180);
    const firstChunk = chunks[0] || req.text;
    const directUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&ttsspeed=${speedParam}&q=${encodeURIComponent(
      firstChunk
    )}`;
    return { audioUrl: directUrl };
  }

  throw lastError || new Error(`Không thể kết nối tới dịch vụ ${req.provider.toUpperCase()} TTS`);
}
