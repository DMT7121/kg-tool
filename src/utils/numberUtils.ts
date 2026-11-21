/**
 * Core numeric, currency, Excel cell, date, and Vietnamese text normalization utilities.
 * Designed for Vietnamese POS/Payroll/Banking formats ("6.500.000", "500.000 đ", "26,5", ExcelJS formula/richText cells).
 */

export function unwrapExcelCellValue(val: unknown): unknown {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val;
  if (typeof val !== 'object') return val;

  const obj = val as Record<string, unknown>;

  if ('result' in obj && obj.result !== undefined && obj.result !== null) {
    if (typeof obj.result === 'object' && obj.result !== null && 'error' in (obj.result as Record<string, unknown>)) {
      return '';
    }
    return unwrapExcelCellValue(obj.result);
  }

  if ('richText' in obj && Array.isArray(obj.richText)) {
    return obj.richText
      .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text?: unknown }).text ?? '') : ''))
      .join('');
  }

  if ('text' in obj && typeof obj.text === 'string') {
    return obj.text;
  }

  if ('formula' in obj || 'sharedFormula' in obj) {
    return '';
  }

  return String(val);
}

/**
 * Parses Vietnamese / international currency strings or numbers into integer VND amounts.
 * Safely handles:
 * - "6.500.000", "500.000", "500.000 đ", "1.250.000 VNĐ" -> 6500000, 500000, 1250000
 * - "6,500,000", "6,500,000.00" -> 6500000
 * - "6.500.000,00" -> 6500000
 * - "6500000.00" -> 6500000
 * - "(500.000)" or "-500.000" -> -500000
 */
export function parseSmartCurrency(val: unknown): number {
  const raw = unwrapExcelCellValue(val);
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.round(raw) : 0;
  }

  let str = String(raw).trim();
  if (!str) return 0;

  let isNegative = false;
  if (/^\(.*\)$/.test(str)) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  // Strip currency symbols/words and whitespace
  str = str.replace(/vn[dđ]|đồng|[đ₫$\s]/gi, '');
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1);
  } else if (str.startsWith('+')) {
    str = str.slice(1);
  }

  // Keep only digits, dots, and commas
  str = str.replace(/[^0-9.,]/g, '');
  if (!str) return 0;

  let numeric = 0;

  if (/^\d+$/.test(str)) {
    numeric = Number(str);
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    // Vietnamese/EU thousands dots + optional decimal comma: "6.500.000" or "500.000" or "6.500.000,50"
    const normalized = str.replace(/\./g, '').replace(',', '.');
    numeric = Number(normalized);
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(str)) {
    // US/UK thousands commas + optional decimal dot: "6,500,000" or "500,000" or "6,500,000.00"
    const normalized = str.replace(/,/g, '');
    numeric = Number(normalized);
  } else if (str.includes('.') && str.includes(',')) {
    // Mixed separators fallback: last separator is decimal
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      numeric = Number(str.replace(/\./g, '').replace(',', '.'));
    } else {
      numeric = Number(str.replace(/,/g, ''));
    }
  } else if (/^\d+[.,]\d{1,2}$/.test(str)) {
    // Plain number with 1-2 decimal digits: "6500000.00" or "6500000,50"
    numeric = Number(str.replace(',', '.'));
  } else {
    // Multiple dots/commas or 3-digit group fallback -> strip all separators
    numeric = Number(str.replace(/[.,]/g, ''));
  }

  if (!Number.isFinite(numeric)) return 0;
  const rounded = Math.round(numeric);
  return isNegative && rounded !== 0 ? -rounded : rounded;
}

/**
 * Parses decimal quantities such as workedDays ("26,5", "26.5"), hours ("208,5"), or rates.
 */
export function parseSmartDecimal(val: unknown): number {
  const raw = unwrapExcelCellValue(val);
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }

  let str = String(raw).trim();
  if (!str) return 0;

  let isNegative = false;
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1);
  } else if (str.startsWith('+')) {
    str = str.slice(1);
  }

  str = str.replace(/[^0-9.,]/g, '');
  if (!str) return 0;

  let numeric = 0;
  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      numeric = Number(str.replace(/\./g, '').replace(',', '.'));
    } else {
      numeric = Number(str.replace(/,/g, ''));
    }
  } else if ((str.match(/\./g) || []).length > 1) {
    numeric = Number(str.replace(/\./g, ''));
  } else if ((str.match(/,/g) || []).length > 1) {
    numeric = Number(str.replace(/,/g, ''));
  } else if (str.includes(',')) {
    numeric = Number(str.replace(',', '.'));
  } else {
    numeric = Number(str);
  }

  if (!Number.isFinite(numeric)) return 0;
  return isNegative && numeric !== 0 ? -numeric : numeric;
}

/**
 * Allocates an integer VND total across `count` items using Largest Remainder Allocation
 * so the sum of parts ALWAYS equals `Math.round(totalAmount)` with zero disparity.
 */
export function allocateEqualSplit(totalAmount: number, count: number): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  const cleanTotal = Math.max(0, Math.round(Number.isFinite(totalAmount) ? totalAmount : 0));
  const base = Math.floor(cleanTotal / safeCount);
  const remainder = cleanTotal - base * safeCount;

  return Array.from({ length: safeCount }, (_, idx) => (idx < remainder ? base + 1 : base));
}

/**
 * Returns local calendar date in YYYY-MM-DD format (never UTC-shifted).
 */
export function getLocalYMD(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Escapes untrusted strings before interpolation into HTML templates (e.g. receipt print windows).
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function normalizeVietnameseName(name: string): string {
  if (!name) return '';
  return removeVietnameseAccents(name)
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9\s]/g, '');
}

/**
 * Converts an integer into natural Vietnamese words (supports 0, negative numbers, billions/trillions, "không trăm lẻ").
 */
export function numberToVietnameseWords(rawNum: number): string {
  let num = Math.round(Number(rawNum) || 0);
  if (num === 0) return 'không';

  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  const readTriple = (n: number, full: boolean): string => {
    const tr = Math.floor(n / 100);
    const ch = Math.floor((n % 100) / 10);
    const dv = n % 10;
    const out: string[] = [];

    if (tr > 0 || full) {
      out.push(digits[tr], 'trăm');
    }
    if (ch > 1) {
      out.push(digits[ch], 'mươi');
      if (dv === 1) out.push('mốt');
      else if (dv === 5) out.push('lăm');
      else if (dv > 0) out.push(digits[dv]);
    } else if (ch === 1) {
      out.push('mười');
      if (dv === 5) out.push('lăm');
      else if (dv > 0) out.push(digits[dv]);
    } else if (dv > 0) {
      if (tr > 0 || full) out.push('lẻ');
      out.push(digits[dv]);
    }
    return out.join(' ');
  };

  const isNegative = num < 0;
  num = Math.abs(num);

  const groups: number[] = [];
  while (num > 0) {
    groups.push(num % 1000);
    num = Math.floor(num / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const full = i < groups.length - 1 && groups[i] < 100;
    const text = readTriple(groups[i], full);
    const unitLabel = units[i] || '';
    parts.push(unitLabel ? `${text} ${unitLabel}` : text);
  }

  const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  return isNegative ? `âm ${joined}` : joined;
}

/**
 * Normalizes numbers, currencies, times, dates, and common Vietnamese abbreviations for TTS engines.
 */
export function normalizeTextForVietnameseTTS(text: string): string {
  if (!text) return '';
  let str = text.trim().replace(/\s+/g, ' ');

  // 1. Convert currencies, e.g. "12000000đ", "10.000 đ", "1.005.000 VNĐ"
  str = str.replace(/(\d+[\d.,]*)\s*(đ|₫|vnd|vnđ|đồng)\b/gi, (_match, amount: string) => {
    const parsed = parseSmartCurrency(amount);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return `${numberToVietnameseWords(parsed)} đồng`;
    }
    return _match;
  });

  // Also handle attached 'đ'/'₫' where \b doesn't match after non-ASCII 'đ'
  str = str.replace(/(\d+[\d.,]*)\s*(đ|₫|đồng)(?=\s|[.,!?;:)]|$)/gi, (_match, amount: string) => {
    const parsed = parseSmartCurrency(amount);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return `${numberToVietnameseWords(parsed)} đồng`;
    }
    return _match;
  });

  // 2. Convert times, e.g. "18h30" or "18:30"
  str = str.replace(/\b(\d{1,2})[h:](\d{2})\b/gi, (_match, hour: string, minute: string) => {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (!isNaN(h) && !isNaN(m) && h <= 24 && m < 60) {
      return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
    }
    return _match;
  });
  str = str.replace(/\b(\d{1,2})h\b/gi, (_match, hour: string) => {
    const h = parseInt(hour, 10);
    if (!isNaN(h) && h <= 24) return `${h} giờ`;
    return _match;
  });

  // 3. Convert dates, e.g. "28/06/2026"
  str = str.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_match, d: string, m: string, y: string) => {
    return `ngày ${parseInt(d, 10)} tháng ${parseInt(m, 10)} năm ${y}`;
  });

  // 4. Common abbreviations
  const abbrevs: Record<string, string> = {
    QR: 'kiu rờ',
    TTS: 'ti ti ét',
    STT: 'số thứ tự',
    CMND: 'chứng minh nhân dân',
    CCCD: 'căn cước công dân',
    VIB: 'vi ai bi',
    VCB: 'vi ét xi bi',
    VIP: 'víp',
    NV: 'nhân viên',
    KH: 'khách hàng',
    GP: 'giờ phát',
    VD: 'ví dụ',
  };

  Object.keys(abbrevs).forEach((key) => {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    str = str.replace(regex, abbrevs[key]);
  });

  return str;
}
