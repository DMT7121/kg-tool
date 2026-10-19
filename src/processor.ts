import ExcelJS from 'exceljs';
import * as Papa from 'papaparse';

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

function subDays(date: Date, amount: number): Date {
  return new Date(date.getTime() - amount * 86400000);
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 86400000);
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

// Helper to determine logical date (shift) based on rules
// Any time before 06:00 AM belongs to the previous day
export function getLogicalDate(timestamp: Date): string {
  const currentHour = timestamp.getHours();
  // If hour < 6 (ie 0:xx, 1:xx... 5:xx), it's previous day's shift
  let logicalDate = new Date(timestamp);
  if (currentHour < 6) {
    logicalDate = subDays(logicalDate, 1);
  }
  return format(logicalDate, 'yyyy-MM-dd');
}

export async function parseFile(file: File): Promise<TimeRecord[]> {
  const isCSV = file.name.toLowerCase().endsWith('.csv');
  const buffer = await file.arrayBuffer();
  
  if (isCSV) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (results: any) => {
          resolve(extractData(results.data as any[][]));
        },
        error: (err: any) => reject(err)
      });
    });
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0]; // Assume first sheet
    
    const rows: any[][] = [];
    worksheet.eachRow((row: any) => {
      // exceljs rows are 1-based, values is an array where index 0 is empty
      rows.push(row.values as any[]);
    });
    
    // Clean empty values out of row structure
    const cleanedRows = rows.map(r => r.filter((_, idx) => idx > 0));
    return extractData(cleanedRows);
  }
}

function extractData(data: any[][]): TimeRecord[] {
  let headerRowIdx = -1;
  let nameColIdx = -1;
  let lastNameColIdx = -1;
  let dateColIdx = -1;
  let timeColIdx = -1;
  let dateTimeColIdx = -1;

  // Find header row
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    let foundName = -1, foundLastName = -1, foundDate = -1, foundTime = -1, foundDateTime = -1;
    
    for (let j = 0; j < row.length; j++) {
      const cellText = String(row[j] || '').toLowerCase().trim();
      if (cellText === 'tên nhân viên' || cellText === 'tên riêng' || cellText === 'name' || cellText.includes('tên')) {
        foundName = j;
      }
      if (cellText === 'họ' || cellText === 'last name') {
        foundLastName = j;
      }
      if (cellText === 'ngày' || cellText === 'date' || cellText.includes('ngày chấm')) {
        foundDate = j;
      }
      if (cellText === 'giờ' || cellText === 'time' || cellText.includes('giờ chấm') || cellText.includes('giờ kiểm nhập') || cellText === 'hồ sơ vào' || cellText.includes('hồ sơ vào')) {
        foundTime = j;
      }
      if (cellText.includes('thời gian') || cellText.includes('ngày giờ')) {
        foundDateTime = j;
      }
    }

    if (foundName !== -1 && ((foundDate !== -1 && foundTime !== -1) || foundDateTime !== -1)) {
      headerRowIdx = i;
      nameColIdx = foundName;
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
    
    let nameStr = String(row[nameColIdx] || '').trim();
    if (!nameStr) continue;

    // Prepend Họ if it is a valid last name
    if (lastNameColIdx !== -1) {
      const lastNameStr = String(row[lastNameColIdx] || '').trim();
      if (lastNameStr && lastNameStr !== '-') {
        nameStr = `${lastNameStr} ${nameStr}`.trim();
      }
    }

    if (dateTimeColIdx !== -1) {
      const timestamp = parseValToDate(row[dateTimeColIdx]);
      if (timestamp && !isNaN(timestamp.getTime())) {
        records.push({
          name: nameStr,
          timestamp
        });
      }
    } else if (dateColIdx !== -1 && timeColIdx !== -1) {
      const dateVal = row[dateColIdx];
      const timeVal = row[timeColIdx];
      
      const timeStr = String(timeVal || '').trim();
      if (timeStr.includes(';')) {
        const timeParts = timeStr.split(';').map(t => t.trim()).filter(Boolean);
        timeParts.forEach(t => {
          const timestamp = parseValToDate(dateVal, t);
          if (timestamp && !isNaN(timestamp.getTime())) {
            records.push({
              name: nameStr,
              timestamp
            });
          }
        });
      } else {
        const timestamp = parseValToDate(dateVal, timeVal);
        if (timestamp && !isNaN(timestamp.getTime())) {
          records.push({
            name: nameStr,
            timestamp
          });
        }
      }
    }
  }

  return records;
}

function parseValToDate(dateVal: any, timeVal?: any): Date | null {
  if (!dateVal) return null;
  // If it's already a JS Date Object (from exceljs)
  if (dateVal instanceof Date) {
      if (timeVal) {
          if (timeVal instanceof Date) {
              return new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate(), timeVal.getHours(), timeVal.getMinutes(), timeVal.getSeconds());
          }
          const timeStr = String(timeVal).trim();
          const parts = timeStr.split(':').map(Number);
          const hours = parts[0];
          const minutes = parts[1];
          const seconds = parts[2] || 0;
          if (!isNaN(hours) && !isNaN(minutes)) {
             const result = new Date(dateVal);
             result.setHours(hours, minutes, seconds, 0);
             return result;
          }
      }
      return dateVal;
  }
  
  // If it's a string
  const dateStr = String(dateVal).trim();
  let result: Date | null = null;
  
  // Custom parsing to ensure local timezone for YYYY-MM-DD or DD/MM/YYYY
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        result = new Date(p1, p2 - 1, p3);
      } else {
        // DD-MM-YYYY
        let y = p3;
        if (y < 100) y += 2000;
        result = new Date(y, p2 - 1, p1);
      }
    }
  }

  if (!result || isNaN(result.getTime())) {
    result = new Date(dateStr);
  }
  
  if (isNaN(result.getTime())) {
    return null;
  }

  if (timeVal) {
      let tStr = '';
      if (timeVal instanceof Date) {
          tStr = format(timeVal, 'HH:mm:ss');
      } else {
          tStr = String(timeVal).trim();
      }
      
      const parts = tStr.split(':').map(Number);
      const h = parts[0];
      const min = parts[1];
      const sec = parts[2] || 0;
      if (!isNaN(h) && !isNaN(min)) {
          result.setHours(h, min, sec, 0);
      }
  }

  return result;
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
  let sampleMonth = '';

  records.forEach(r => {
    if (!sampleMonth && r.logicalDate && r.logicalDate.length >= 7) {
      sampleMonth = r.logicalDate.slice(0, 7);
    }
    if (!byEmp.has(r.employeeName)) {
      byEmp.set(r.employeeName, []);
    }
    byEmp.get(r.employeeName)!.push(r);
  });

  const summaries: AttendancePayrollSummary[] = [];
  byEmp.forEach((empRecords, name) => {
    let workedDays = 0;
    let totalMs = 0;
    let minLogical = '';
    let maxLogical = '';

    empRecords.forEach(r => {
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

    const formatShort = (dStr: string) => {
      const parts = dStr.split('-');
      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dStr;
    };

    const totalHours = Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
    const range = minLogical && maxLogical ? `${formatShort(minLogical)} - ${formatShort(maxLogical)}` : '';

    summaries.push({
      name,
      workedDays,
      totalHours,
      range,
      month: sampleMonth
    });
  });

  return summaries;
}

export function processRecords(records: TimeRecord[]): ProcessedRecord[] {
  const grouped = new Map<string, TimeRecord[]>();

  records.forEach(r => {
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
      // If check-out is within 10 minutes (600,000 ms) of check-in, treat it as a duplicate check-in (not a valid check-out)
      if (potentialCheckOut.getTime() - checkIn.getTime() > 10 * 60 * 1000) {
        checkOut = potentialCheckOut;
      } else {
        checkOut = null;
      }
    }

    let overtime = false;
    if (checkIn && checkOut) {
      if (checkIn.getDate() !== checkOut.getDate()) {
        overtime = true;
      }
    }

    results.push({
      employeeName: name,
      logicalDate,
      checkIn,
      checkOut,
      overtime
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
  const lookup = new Map<string, ProcessedRecord>();

  processed.forEach(p => {
    const d = parseLocalYMD(p.logicalDate);
    if (d < minDate) minDate = d;
    lookup.set(`${p.employeeName}\0${p.logicalDate}`, p);
  });
  
  const start = startOfMonth(minDate);
  const end = endOfMonth(minDate);
  
  const employees = Array.from(new Set(processed.map(p => p.employeeName))).sort((a, b) => a.localeCompare(b, 'vi'));
  
  const finalResults: ProcessedRecord[] = [];
  
  employees.forEach(emp => {
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const lDateStr = format(d, 'yyyy-MM-dd');
      const existing = lookup.get(`${emp}\0${lDateStr}`);
      
      if (existing) {
        finalResults.push(existing);
      } else {
        finalResults.push({
          employeeName: emp,
          logicalDate: lDateStr,
          checkIn: null,
          checkOut: null,
          overtime: false
        });
      }
    }
  });

  return finalResults;
}

export async function exportToExcel(records: ProcessedRecord[]): Promise<Blob> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bang_Cham_Cong');

    // Add Header
    worksheet.columns = [
        { header: 'Tên nhân viên', key: 'name', width: 25 },
        { header: 'Ngày', key: 'date', width: 15 },
        { header: 'Giờ vào', key: 'checkin', width: 15 },
        { header: 'Giờ ra', key: 'checkout', width: 15 },
        { header: 'Ghi chú', key: 'note', width: 15 }
    ];

    // Style Header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Freeze top row
    worksheet.views = [
        { state: 'frozen', ySplit: 1 }
    ];

    let currentEmp = '';

    records.forEach((r) => {
        // Insert empty separator row if employee changes
        if (currentEmp !== '' && currentEmp !== r.employeeName) {
            const emptyRow = worksheet.addRow([]);
            emptyRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF5F5F5' } // light gray/blue
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
            date: format(new Date(r.logicalDate), 'dd/MM/yyyy'),
            checkin: r.checkIn ? format(r.checkIn, 'HH:mm:ss') : '',
            checkout: r.checkOut ? format(r.checkOut, 'HH:mm:ss') : '',
            note: noteStr
        });

        row.alignment = { vertical: 'middle', horizontal: 'center' };
        // except name, align left
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function exportAttendanceTemplate(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Mau_Cham_Cong_Tho');

  // Add Header
  worksheet.columns = [
    { header: 'Tên nhân viên', key: 'name', width: 25 },
    { header: 'Ngày', key: 'date', width: 15 },
    { header: 'Giờ', key: 'time', width: 15 }
  ];

  // Style Header
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' } // Dark blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Sample data
  const sampleData = [
    { name: 'Nguyễn Văn A', date: '01/07/2026', time: '08:00' },
    { name: 'Nguyễn Văn A', date: '01/07/2026', time: '17:30' },
    { name: 'Trần Thị B', date: '01/07/2026', time: '14:00' },
    { name: 'Trần Thị B', date: '02/07/2026', time: '02:30' }, // night shift out example
    { name: 'Lê Văn C', date: '02/07/2026', time: '08:15' }
  ];

  sampleData.forEach(item => {
    const row = worksheet.addRow(item);
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

