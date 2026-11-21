import { unwrapExcelCellValue } from './utils/numberUtils';

export interface TimeRecord {
  name: string;
  timestamp: Date;
}

export interface ProcessedRecord {
  employeeName: string;
  logicalDate: string; // YYYY-MM-DD
  checkIn: Date | null;
  checkOut: Date | null;
  overtime: boolean;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function format(date: Date, formatStr: string): string {
  const yyyy = date.getFullYear().toString();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return formatStr
    .replace('yyyy', yyyy)
    .replace('MM', MM)
    .replace('dd', dd)
    .replace('HH', HH)
    .replace('mm', mm)
    .replace('ss', ss);
}

// Helper to determine logical date (shift) based on rules:
// Any punch before 06:00 AM belongs to the previous calendar day's shift.
export function getLogicalDate(timestamp: Date): string {
  const currentHour = timestamp.getHours();
  const baseDate = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
  const logicalDate = currentHour < 6 ? addDays(baseDate, -1) : baseDate;
  return format(logicalDate, 'yyyy-MM-dd');
}

export async function parseFile(file: File): Promise<TimeRecord[]> {
  const isCSV = file.name.toLowerCase().endsWith('.csv');
  const buffer = await file.arrayBuffer();

  if (isCSV) {
    const PapaMod = await import('papaparse');
    const Papa = PapaMod.default ?? PapaMod;
    const csvText = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
    const parsed = Papa.parse<unknown[]>(csvText, { skipEmptyLines: false });
    if (parsed.errors && parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
      throw new Error(parsed.errors[0].message || 'Lỗi đọc tệp CSV');
    }
    return extractData(parsed.data || []);
  }

  const ExcelJSMod = await import('exceljs');
  const ExcelJS = ExcelJSMod.default ?? ExcelJSMod;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Tệp Excel không có trang tính nào.');
  }

  const sheetColCount = Math.max(worksheet.columnCount || 0, 1);
  const cleanedRows: unknown[][] = [];

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const maxCol = Math.max(sheetColCount, row.cellCount);
    const rowValues: unknown[] = [];
    for (let colIdx = 1; colIdx <= maxCol; colIdx++) {
      rowValues.push(unwrapExcelCellValue(row.getCell(colIdx).value));
    }
    cleanedRows.push(rowValues);
  });

  return extractData(cleanedRows);
}

function extractData(data: unknown[][]): TimeRecord[] {
  let headerRowIdx = -1;
  let nameColIdx = -1;
  let lastNameColIdx = -1;
  let dateColIdx = -1;
  let timeColIdx = -1;
  let dateTimeColIdx = -1;

  for (let i = 0; i < Math.min(25, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    let foundName = -1;
    let fallbackName = -1;
    let foundLastName = -1;
    let foundDate = -1;
    let foundTime = -1;
    let foundDateTime = -1;

    for (let j = 0; j < row.length; j++) {
      const cellText = String(unwrapExcelCellValue(row[j]) || '').toLowerCase().trim();
      if (!cellText) continue;

      if (
        cellText === 'tên nhân viên' ||
        cellText === 'họ và tên' ||
        cellText === 'họ tên' ||
        cellText === 'tên riêng' ||
        cellText === 'employee name' ||
        cellText === 'name' ||
        cellText === 'tên'
      ) {
        foundName = j;
      } else if (
        fallbackName === -1 &&
        cellText.includes('tên') &&
        !cellText.includes('phòng') &&
        !cellText.includes('bộ phận') &&
        !cellText.includes('thiết bị')
      ) {
        fallbackName = j;
      }

      if (cellText === 'họ' || cellText === 'last name') {
        foundLastName = j;
      }
      if (cellText === 'ngày' || cellText === 'date' || cellText.includes('ngày chấm')) {
        foundDate = j;
      }
      if (
        cellText === 'giờ' ||
        cellText === 'time' ||
        cellText.includes('giờ chấm') ||
        cellText.includes('giờ kiểm nhập') ||
        cellText === 'hồ sơ vào' ||
        cellText.includes('hồ sơ vào')
      ) {
        foundTime = j;
      }
      if (cellText.includes('thời gian') || cellText.includes('ngày giờ') || cellText === 'datetime') {
        foundDateTime = j;
      }
    }

    const resolvedNameCol = foundName !== -1 ? foundName : fallbackName;
    if (resolvedNameCol !== -1 && ((foundDate !== -1 && foundTime !== -1) || foundDateTime !== -1)) {
      headerRowIdx = i;
      nameColIdx = resolvedNameCol;
      lastNameColIdx = foundLastName;
      dateColIdx = foundDate;
      timeColIdx = foundTime;
      dateTimeColIdx = foundDateTime;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('Không thể tìm thấy dòng tiêu đề chuẩn. Vui lòng đảm bảo tệp có các cột: Tên nhân viên, Ngày, Giờ');
  }

  const records: TimeRecord[] = [];

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    let nameStr = String(unwrapExcelCellValue(row[nameColIdx]) || '').trim();
    if (!nameStr) continue;

    if (lastNameColIdx !== -1) {
      const lastNameStr = String(unwrapExcelCellValue(row[lastNameColIdx]) || '').trim();
      if (lastNameStr && lastNameStr !== '-') {
        nameStr = `${lastNameStr} ${nameStr}`.trim();
      }
    }

    if (dateColIdx !== -1 && timeColIdx !== -1) {
      const dateVal = unwrapExcelCellValue(row[dateColIdx]);
      const timeVal = unwrapExcelCellValue(row[timeColIdx]);

      if (typeof timeVal === 'string' && timeVal.includes(';')) {
        const timeParts = timeVal
          .split(';')
          .map((t) => t.trim())
          .filter(Boolean);
        timeParts.forEach((t) => {
          const timestamp = parseValToDate(dateVal, t);
          if (timestamp && !isNaN(timestamp.getTime())) {
            records.push({ name: nameStr, timestamp });
          }
        });
      } else {
        const timestamp = parseValToDate(dateVal, timeVal);
        if (timestamp && !isNaN(timestamp.getTime())) {
          records.push({ name: nameStr, timestamp });
        }
      }
    } else if (dateTimeColIdx !== -1) {
      const timestamp = parseValToDate(unwrapExcelCellValue(row[dateTimeColIdx]));
      if (timestamp && !isNaN(timestamp.getTime())) {
        records.push({ name: nameStr, timestamp });
      }
    }
  }

  return records;
}

function extractHMSFromTimeValue(timeVal: unknown): { h: number; min: number; sec: number } | null {
  if (timeVal === null || timeVal === undefined || timeVal === '') return null;

  if (timeVal instanceof Date) {
    // ExcelJS stores wall-clock time-only cells on UTC epoch (1899-12-30T08:30:00.000Z).
    // Reading local .getHours() on 1899 dates applies historical LMT (+07:06:40 in Saigon)!
    return {
      h: timeVal.getUTCHours(),
      min: timeVal.getUTCMinutes(),
      sec: timeVal.getUTCSeconds(),
    };
  }

  if (typeof timeVal === 'number' && Number.isFinite(timeVal) && timeVal >= 0 && timeVal < 1) {
    const totalSeconds = Math.round(timeVal * 86400);
    const h = Math.floor(totalSeconds / 3600) % 24;
    const min = Math.floor((totalSeconds % 3600) / 60);
    const sec = totalSeconds % 60;
    return { h, min, sec };
  }

  const rawStr = String(timeVal).trim();
  if (!rawStr) return null;

  const match = rawStr.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM|SA|CH)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const sec = match[3] ? parseInt(match[3], 10) : 0;
    const meridiem = match[4]?.toUpperCase();
    if (meridiem === 'PM' || meridiem === 'CH') {
      if (h < 12) h += 12;
    } else if (meridiem === 'AM' || meridiem === 'SA') {
      if (h === 12) h = 0;
    }
    if (h >= 0 && h < 24 && min >= 0 && min < 60 && sec >= 0 && sec < 60) {
      return { h, min, sec };
    }
  }

  return null;
}

function parseValToDate(dateVal: unknown, timeVal?: unknown): Date | null {
  if (dateVal === null || dateVal === undefined || dateVal === '') return null;

  let baseDate: Date | null = null;

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    // ExcelJS encodes naive spreadsheet dates in UTC components.
    baseDate = new Date(
      dateVal.getUTCFullYear(),
      dateVal.getUTCMonth(),
      dateVal.getUTCDate(),
      dateVal.getUTCHours(),
      dateVal.getUTCMinutes(),
      dateVal.getUTCSeconds()
    );
  } else if (typeof dateVal === 'number' && Number.isFinite(dateVal) && dateVal > 20000) {
    // Excel serial date fallback
    const utcMs = Math.round((dateVal - 25569) * 86400 * 1000);
    const utcDate = new Date(utcMs);
    baseDate = new Date(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate(),
      utcDate.getUTCHours(),
      utcDate.getUTCMinutes(),
      utcDate.getUTCSeconds()
    );
  } else {
    const dateStr = String(dateVal).trim();
    if (!dateStr) return null;

    // Match YYYY-MM-DD or DD/MM/YYYY with optional inline time "HH:mm[:ss]"
    const dtMatch = dateStr.match(
      /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?:[T\s]+(\d{1,2}:\d{1,2}(?::\d{1,2})?\s*(?:AM|PM|SA|CH)?))?$/i
    );
    if (dtMatch) {
      const p1 = parseInt(dtMatch[1], 10);
      const p2 = parseInt(dtMatch[2], 10);
      const p3 = parseInt(dtMatch[3], 10);
      if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
        if (dtMatch[1].length === 4) {
          baseDate = new Date(p1, p2 - 1, p3);
        } else {
          const year = p3 < 100 ? p3 + 2000 : p3;
          baseDate = new Date(year, p2 - 1, p1);
        }
        if (dtMatch[4]) {
          const inlineTime = extractHMSFromTimeValue(dtMatch[4]);
          if (inlineTime) {
            baseDate.setHours(inlineTime.h, inlineTime.min, inlineTime.sec, 0);
          }
        }
      }
    }

    if (!baseDate || isNaN(baseDate.getTime())) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }
  }

  if (!baseDate || isNaN(baseDate.getTime())) {
    return null;
  }

  if (timeVal !== undefined && timeVal !== null && timeVal !== '') {
    const hms = extractHMSFromTimeValue(timeVal);
    if (!hms) return null;
    const combined = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hms.h, hms.min, hms.sec, 0);
    return combined;
  }

  return baseDate;
}

export interface AttendancePayrollSummary {
  name: string;
  workedDays: number;
  totalHours: number;
  range: string;
  month: string;
}

export function summarizeAttendanceForPayroll(records: ProcessedRecord[]): AttendancePayrollSummary[] {
  if (!records || records.length === 0) return [];
  const byEmp = new Map<string, ProcessedRecord[]>();
  const monthCounts = new Map<string, number>();

  records.forEach((r) => {
    if (r.logicalDate && r.logicalDate.length >= 7) {
      const ym = r.logicalDate.slice(0, 7);
      const weight = r.checkIn || r.checkOut ? 10 : 1;
      monthCounts.set(ym, (monthCounts.get(ym) || 0) + weight);
    }
    if (!byEmp.has(r.employeeName)) {
      byEmp.set(r.employeeName, []);
    }
    byEmp.get(r.employeeName)!.push(r);
  });

  let dominantMonth = '';
  let maxMonthWeight = -1;
  monthCounts.forEach((weight, ym) => {
    if (weight > maxMonthWeight) {
      maxMonthWeight = weight;
      dominantMonth = ym;
    }
  });

  const formatShort = (dStr: string) => {
    const parts = dStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dStr;
  };

  const summaries: AttendancePayrollSummary[] = [];
  byEmp.forEach((empRecords, name) => {
    let workedDays = 0;
    let totalMs = 0;
    let minLogical = '';
    let maxLogical = '';

    empRecords.forEach((r) => {
      if (!minLogical || r.logicalDate < minLogical) minLogical = r.logicalDate;
      if (!maxLogical || r.logicalDate > maxLogical) maxLogical = r.logicalDate;

      if (r.checkIn || r.checkOut) {
        workedDays += 1;
      }
      if (r.checkIn && r.checkOut) {
        const diff = r.checkOut.getTime() - r.checkIn.getTime();
        if (diff > 0) totalMs += diff;
      }
    });

    const totalHours = Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
    const range = minLogical && maxLogical ? `${formatShort(minLogical)} - ${formatShort(maxLogical)}` : '';

    summaries.push({
      name,
      workedDays,
      totalHours,
      range,
      month: dominantMonth,
    });
  });

  return summaries;
}

export function processRecords(records: TimeRecord[]): ProcessedRecord[] {
  const grouped = new Map<string, TimeRecord[]>();

  records.forEach((r) => {
    const logicalDate = getLogicalDate(r.timestamp);
    const key = `${r.name}\0${logicalDate}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(r);
  });

  const results: ProcessedRecord[] = [];

  grouped.forEach((groupRecords, key) => {
    const sepIdx = key.lastIndexOf('\0');
    const name = sepIdx >= 0 ? key.slice(0, sepIdx) : key;
    const logicalDate = sepIdx >= 0 ? key.slice(sepIdx + 1) : '';

    groupRecords.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let checkIn: Date | null = null;
    let checkOut: Date | null = null;

    if (groupRecords.length === 1) {
      const t = groupRecords[0].timestamp;
      if (t.getHours() < 6) {
        checkOut = t;
      } else {
        checkIn = t;
      }
    } else {
      checkIn = groupRecords[0].timestamp;
      const potentialCheckOut = groupRecords[groupRecords.length - 1].timestamp;
      // If check-out is within 10 minutes (600,000 ms) of check-in, treat it as a duplicate punch
      if (potentialCheckOut.getTime() - checkIn.getTime() > 10 * 60 * 1000) {
        checkOut = potentialCheckOut;
      } else {
        checkOut = null;
      }
    }

    let overtime = false;
    if (checkIn && checkOut && checkIn.getDate() !== checkOut.getDate()) {
      overtime = true;
    }

    results.push({
      employeeName: name,
      logicalDate,
      checkIn,
      checkOut,
      overtime,
    });
  });

  return calendarMerge(results);
}

function parseLocalYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
    return new Date(y, m - 1, d);
  }
  return new Date(ymd);
}

function calendarMerge(processed: ProcessedRecord[]): ProcessedRecord[] {
  if (processed.length === 0) return [];

  let minDate = parseLocalYMD(processed[0].logicalDate);
  let maxDate = parseLocalYMD(processed[0].logicalDate);
  const lookup = new Map<string, ProcessedRecord>();
  const monthDates = new Map<string, Set<string>>();
  const monthRecordCount = new Map<string, number>();

  processed.forEach((p) => {
    const d = parseLocalYMD(p.logicalDate);
    if (d < minDate) minDate = d;
    if (d > maxDate) maxDate = d;
    lookup.set(`${p.employeeName}\0${p.logicalDate}`, p);

    const ym = p.logicalDate.slice(0, 7);
    if (!monthDates.has(ym)) monthDates.set(ym, new Set());
    monthDates.get(ym)!.add(p.logicalDate);
    monthRecordCount.set(ym, (monthRecordCount.get(ym) || 0) + 1);
  });

  // Determine dominant month by record count (break ties by more distinct dates, then chronologically latest)
  let dominantYM = '';
  let bestCount = -1;
  let bestDistinct = -1;
  monthRecordCount.forEach((count, ym) => {
    const distinct = monthDates.get(ym)?.size || 0;
    if (
      count > bestCount ||
      (count === bestCount && distinct > bestDistinct) ||
      (count === bestCount && distinct === bestDistinct && ym > dominantYM)
    ) {
      bestCount = count;
      bestDistinct = distinct;
      dominantYM = ym;
    }
  });

  // Detect genuine cross-month payroll cycles (e.g. 26/06 -> 25/07 where secondary month has >= 3 distinct dates)
  let isCrossMonthCycle = false;
  monthDates.forEach((datesSet, ym) => {
    if (ym !== dominantYM && datesSet.size >= 3) {
      isCrossMonthCycle = true;
    }
  });

  let start: Date;
  let end: Date;
  if (isCrossMonthCycle) {
    start = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    end = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59, 999);
  } else {
    const domDate = parseLocalYMD(`${dominantYM}-01`);
    start = startOfMonth(domDate);
    end = endOfMonth(domDate);
  }

  const startYMD = format(start, 'yyyy-MM-dd');
  const endYMD = format(end, 'yyyy-MM-dd');

  const employees = Array.from(new Set(processed.map((p) => p.employeeName))).sort((a, b) =>
    a.localeCompare(b, 'vi')
  );

  const finalResults: ProcessedRecord[] = [];

  employees.forEach((emp) => {
    const empRows: ProcessedRecord[] = [];

    // Preserve any real spillover records before `start` (e.g. night-shift punch at 01/07 01:30 -> logicalDate 30/06)
    processed
      .filter((p) => p.employeeName === emp && p.logicalDate < startYMD)
      .sort((a, b) => a.logicalDate.localeCompare(b.logicalDate))
      .forEach((p) => empRows.push(p));

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const lDateStr = format(d, 'yyyy-MM-dd');
      const existing = lookup.get(`${emp}\0${lDateStr}`);

      if (existing) {
        empRows.push(existing);
      } else {
        empRows.push({
          employeeName: emp,
          logicalDate: lDateStr,
          checkIn: null,
          checkOut: null,
          overtime: false,
        });
      }
    }

    // Preserve any real spillover records after `end`
    processed
      .filter((p) => p.employeeName === emp && p.logicalDate > endYMD)
      .sort((a, b) => a.logicalDate.localeCompare(b.logicalDate))
      .forEach((p) => empRows.push(p));

    empRows.forEach((r) => finalResults.push(r));
  });

  return finalResults;
}

export async function exportToExcel(records: ProcessedRecord[]): Promise<Blob> {
  const ExcelJSMod = await import('exceljs');
  const ExcelJS = ExcelJSMod.default ?? ExcelJSMod;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Bang_Cham_Cong');

  worksheet.columns = [
    { header: 'Tên nhân viên', key: 'name', width: 25 },
    { header: 'Ngày', key: 'date', width: 15 },
    { header: 'Giờ vào', key: 'checkin', width: 15 },
    { header: 'Giờ ra', key: 'checkout', width: 15 },
    { header: 'Ghi chú', key: 'note', width: 15 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  let currentEmp = '';

  records.forEach((r) => {
    if (currentEmp !== '' && currentEmp !== r.employeeName) {
      const emptyRow = worksheet.addRow([]);
      emptyRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' },
      };
    }
    currentEmp = r.employeeName;

    const notes: string[] = [];
    if (r.overtime) {
      notes.push('Tăng ca');
    }
    if (r.checkIn && !r.checkOut) {
      notes.push('Quên chấm công ra ca');
    } else if (!r.checkIn && r.checkOut) {
      notes.push('Quên chấm công vào ca');
    }
    const noteStr = notes.join(', ');

    const row = worksheet.addRow({
      name: r.employeeName,
      date: format(parseLocalYMD(r.logicalDate), 'dd/MM/yyyy'),
      checkin: r.checkIn ? format(r.checkIn, 'HH:mm:ss') : '',
      checkout: r.checkOut ? format(r.checkOut, 'HH:mm:ss') : '',
      note: noteStr,
    });

    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function exportAttendanceTemplate(): Promise<Blob> {
  const ExcelJSMod = await import('exceljs');
  const ExcelJS = ExcelJSMod.default ?? ExcelJSMod;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Mau_Cham_Cong_Tho');

  worksheet.columns = [
    { header: 'Tên nhân viên', key: 'name', width: 25 },
    { header: 'Ngày', key: 'date', width: 15 },
    { header: 'Giờ', key: 'time', width: 15 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  const sampleData = [
    { name: 'Nguyễn Văn A', date: '01/07/2026', time: '08:00' },
    { name: 'Nguyễn Văn A', date: '01/07/2026', time: '17:30' },
    { name: 'Trần Thị B', date: '01/07/2026', time: '14:00' },
    { name: 'Trần Thị B', date: '02/07/2026', time: '02:30' },
    { name: 'Lê Văn C', date: '02/07/2026', time: '08:15' },
  ];

  sampleData.forEach((item) => {
    const row = worksheet.addRow(item);
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
