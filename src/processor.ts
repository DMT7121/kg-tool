import ExcelJS from 'exceljs';
import * as Papa from 'papaparse';
import { subDays, format, addDays, endOfMonth, startOfMonth } from 'date-fns';

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
        complete: (results) => {
          resolve(extractData(results.data as any[][]));
        },
        error: (err) => reject(err)
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
  let dateColIdx = -1;
  let timeColIdx = -1;
  let dateTimeColIdx = -1;

  // Find header row
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    let foundName = -1, foundDate = -1, foundTime = -1, foundDateTime = -1;
    
    for (let j = 0; j < row.length; j++) {
      const cellText = String(row[j] || '').toLowerCase().trim();
      if (cellText === 'tên nhân viên' || cellText === 'tên riêng' || cellText === 'name' || cellText.includes('tên')) {
        foundName = j;
      }
      if (cellText === 'ngày' || cellText === 'date' || cellText.includes('ngày chấm')) {
        foundDate = j;
      }
      if (cellText === 'giờ' || cellText === 'time' || cellText.includes('giờ chấm')) {
        foundTime = j;
      }
      if (cellText.includes('thời gian') || cellText.includes('ngày giờ')) {
        foundDateTime = j;
      }
    }

    if (foundName !== -1 && ((foundDate !== -1 && foundTime !== -1) || foundDateTime !== -1)) {
      headerRowIdx = i;
      nameColIdx = foundName;
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
    
    const nameStr = String(row[nameColIdx] || '').trim();
    if (!nameStr) continue;

    let timestamp: Date | null = null;

    if (dateTimeColIdx !== -1) {
      timestamp = parseValToDate(row[dateTimeColIdx]);
    } else if (dateColIdx !== -1 && timeColIdx !== -1) {
      // Need to parse Date + Time
      const dateVal = row[dateColIdx];
      const timeVal = row[timeColIdx];
      timestamp = parseValToDate(dateVal, timeVal);
    }

    if (timestamp && !isNaN(timestamp.getTime())) {
      records.push({
        name: nameStr,
        timestamp
      });
    }
  }

  return records;
}

function parseValToDate(dateVal: any, timeVal?: any): Date | null {
  if (!dateVal) return null;
  // If it's already a JS Date Object (from exceljs)
  if (dateVal instanceof Date) {
      // if timeVal is also provided and it's a string, we might need to stitch them
      if (timeVal) {
          if (timeVal instanceof Date) {
              const result = new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate(), timeVal.getHours(), timeVal.getMinutes(), timeVal.getSeconds());
              return result;
          }
          // if timeVal is a string like "08:00"
          const timeStr = String(timeVal).trim();
          const [hours, minutes] = timeStr.split(':').map(Number);
          if (!isNaN(hours) && !isNaN(minutes)) {
             const result = new Date(dateVal);
             result.setHours(hours, minutes, 0, 0);
             return result;
          }
      }
      return dateVal;
  }
  
  // If it's a string
  const dateStr = String(dateVal).trim();
  let result = new Date(dateStr);
  
  // Try custom parsing for DD/MM/YYYY if standard fails or yields invalid date
  if (isNaN(result.getTime()) || result.getFullYear() < 2000) {
    // common format DD/MM/YYYY
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      const [p1, p2, p3] = parts;
      // assuming DD/MM/YYYY
      let d = parseInt(p1, 10);
      let m = parseInt(p2, 10) - 1;
      let y = parseInt(p3, 10);
      
      // Handle YYYY/MM/DD just in case
      if (p1.length === 4) {
          y = parseInt(p1, 10);
          m = parseInt(p2, 10) - 1;
          d = parseInt(p3, 10);
      }
      
      if (y < 100) y += 2000;
      
      result = new Date(y, m, d);
    }
  }

  if (timeVal) {
      let tStr = '';
      if (timeVal instanceof Date) {
          tStr = format(timeVal, 'HH:mm:ss');
      } else {
          tStr = String(timeVal).trim();
      }
      
      const [h, min] = tStr.split(':').map(Number);
      if (!isNaN(h) && !isNaN(min)) {
          result.setHours(h, min, 0, 0);
      }
  }

  return result;
}

export function processRecords(records: TimeRecord[]): ProcessedRecord[] {
  const grouped = new Map<string, TimeRecord[]>();

  records.forEach(r => {
    const logicalDate = getLogicalDate(r.timestamp);
    const key = `${r.name}_${logicalDate}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(r);
  });

  const results: ProcessedRecord[] = [];

  grouped.forEach((groupRecords, key) => {
    const [name, logicalDate] = key.split('_');
    
    groupRecords.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    let checkIn: Date | null = null;
    let checkOut: Date | null = null;
    
    if (groupRecords.length === 1) {
      const t = groupRecords[0].timestamp;
      // If only 1 record: before 06:00 is Out (actually logic date takes care of this, 
      // wait! If it's before 06:00, its logical date shifted to yesterday, so it SHOULD be an Out for yesterday!)
      if (t.getHours() < 6) {
        checkOut = t;
      } else {
        checkIn = t;
      }
    } else {
      checkIn = groupRecords[0].timestamp;
      checkOut = groupRecords[groupRecords.length - 1].timestamp;
    }

    let overtime = false;
    if (checkIn && checkOut) {
      if (checkIn.getDate() !== checkOut.getDate()) {
        overtime = true;
      }
    } else if (checkOut && groupRecords.length === 1 && checkOut.getHours() < 6) {
        // If it's just check out at 1am, it technically belongs to yesterday's night shift. Overtime might be true.
        // Actually, if checkIn is missing, we don't know, but let's say overtime=false unless we have both.
    }

    results.push({
      employeeName: name,
      logicalDate,
      checkIn,
      checkOut,
      overtime
    });
  });

  // Now, calendar merging!
  return calendarMerge(results);
}

function calendarMerge(processed: ProcessedRecord[]): ProcessedRecord[] {
  if (processed.length === 0) return [];
  
  // find min and max date across all records to know the month
  let minDate = new Date(8640000000000000);
  processed.forEach(p => {
      const d = new Date(p.logicalDate);
      if (d < minDate) minDate = d;
  });
  
  // We use the month of the first logical date we find
  const baseDate = new Date(processed[0].logicalDate);
  const start = startOfMonth(baseDate);
  const end = endOfMonth(baseDate);
  
  const employees = Array.from(new Set(processed.map(p => p.employeeName))).sort();
  
  const finalResults: ProcessedRecord[] = [];
  
  employees.forEach(emp => {
      // For each day in month
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
          const lDateStr = format(d, 'yyyy-MM-dd');
          
          const existing = processed.find(p => p.employeeName === emp && p.logicalDate === lDateStr);
          
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

        const row = worksheet.addRow({
            name: r.employeeName,
            date: format(new Date(r.logicalDate), 'dd/MM/yyyy'),
            checkin: r.checkIn ? format(r.checkIn, 'HH:mm') : '',
            checkout: r.checkOut ? format(r.checkOut, 'HH:mm') : '',
            note: r.overtime ? 'Tăng ca' : ''
        });

        row.alignment = { vertical: 'middle', horizontal: 'center' };
        // except name, align left
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
