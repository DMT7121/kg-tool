/**
 * Google Apps Script Backend cho Dự án KG_TOOL
 * Tích hợp:
 * 1. Xử lý chấm công (Lưu Bang_Cham_Cong_Log)
 * 2. Lưu trữ thông tin tài khoản VietQR (Lưu DATA2)
 * 3. Quản lý Phiếu lương nhân viên (Lưu PayrollData & ActionLogs)
 */

// Initialize or open spreadsheets
function getOrCreateSheets(ssId) {
  var ss;
  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (err) {
      throw new Error("Không thể mở Spreadsheet với ID đã cung cấp. Chi tiết: " + err.message);
    }
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("Không tìm thấy Spreadsheet hoạt động. Hãy cấu hình Spreadsheet ID.");
    }
  }

  var dataSheet = ss.getSheetByName("PayrollData");
  if (!dataSheet) {
    dataSheet = ss.insertSheet("PayrollData");
    dataSheet.appendRow(["Month", "UpdatedTime", "Operator", "PayrollJson"]);
    dataSheet.getRange("A1:D1").setFontWeight("bold").setBackground("#eef4ff");
  }

  var logSheet = ss.getSheetByName("ActionLogs");
  if (!logSheet) {
    logSheet = ss.insertSheet("ActionLogs");
    logSheet.appendRow(["Timestamp", "Operator", "Action", "Month", "Details"]);
    logSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#feeef0");
  }

  return { ss: ss, dataSheet: dataSheet, logSheet: logSheet };
}

/**
 * GET Handler
 * Dùng để đọc danh sách tháng lương, thông tin lương chi tiết và log chỉnh sửa.
 */
function doGet(e) {
  var res = { success: false, data: null, error: "" };
  try {
    var action = e.parameter.action;
    var ssId = e.parameter.ssId;
    
    var sheets = getOrCreateSheets(ssId);
    
    if (action === "getMonths") {
      res.data = fetchMonthsList(sheets.dataSheet, ssId);
      res.success = true;
    } else if (action === "getPayroll") {
      var month = e.parameter.month;
      if (!month) throw new Error("Thiếu tham số 'month'");
      res.data = fetchPayrollByMonth(sheets.dataSheet, month, ssId);
      res.success = true;
    } else if (action === "getLogs") {
      res.data = fetchActionLogs(sheets.logSheet, ssId);
      res.success = true;
    } else {
      throw new Error("Hành động GET không hợp lệ: " + action);
    }
  } catch (err) {
    res.success = false;
    res.error = err.message;
  }
  
  return ContentService.createTextOutput(JSON.stringify(res))
                       .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST Handler
 * Hỗ trợ lưu chấm công, lưu VietQR, lưu/xóa phiếu lương
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "save_attendance";
    var ssId = data.spreadsheetId || data.ssId;
    
    var ss;
    try {
      if (ssId) {
        ss = SpreadsheetApp.openById(ssId);
      } else {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      }
    } catch (err) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", success: false, message: "Không thể mở Google Sheet" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // 1. LƯU THÔNG TIN TÀI KHOẢN VIETQR
    if (action === "save_bank_account") {
      var sheet = ss.getSheetByName("DATA2");
      if (!sheet) {
        sheet = ss.insertSheet("DATA2");
      }
      
      var account = data.account;
      if (!account) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", success: false, message: "Không có dữ liệu tài khoản" }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
      
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Thời gian tạo', 'Ngân hàng', 'Mã ngân hàng', 'Số tài khoản', 'Tên chủ tài khoản', 'Số tiền', 'Nội dung chuyển khoản', 'Link mã QR']);
        sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#f1f5f9');
      }
      
      var row = [
        account.createdAt || new Date().toISOString(),
        account.bankName || "",
        account.bankId || "",
        String(account.accountNo || ""),
        account.accountHolder || "",
        account.amount || 0,
        account.memo || "",
        account.qrUrl || ""
      ];
      
      sheet.appendRow(row);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        message: "Lưu thông tin tài khoản và mã QR thành công!"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. LƯU CHẤM CÔNG (ATTENDANCE)
    if (action === "save_attendance") {
      var sheet = ss.getSheetByName("Bang_Cham_Cong_Log");
      if (!sheet) {
        sheet = ss.insertSheet("Bang_Cham_Cong_Log");
      }
      
      var records = data.records;
      if (!records || !records.length) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", success: false, message: "Không có dữ liệu chấm công" }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
      
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Tên nhân viên', 'Ngày', 'Giờ vào', 'Giờ ra', 'Ghi chú']);
        sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f1f5f9');
      }
      
      var rows = records.map(function(r) {
        var notes = [];
        if (r.overtime) notes.push('Tăng ca');
        if (r.checkIn && !r.checkOut) {
          notes.push('Quên chấm công ra ca');
        } else if (!r.checkIn && r.checkOut) {
          notes.push('Quên chấm công vào ca');
        }
        return [
          r.employeeName,
          r.logicalDate,
          r.checkIn ? new Date(r.checkIn).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : '',
          r.checkOut ? new Date(r.checkOut).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : '',
          notes.join(', ')
        ];
      });
      
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", success: true, inserted: rows.length }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. LƯU PHIẾU LƯƠNG NHÂN VIÊN (PAYROLL)
    if (action === "savePayroll") {
      var sheets = getOrCreateSheets(ssId);
      var month = data.month;
      var dataStr = data.data; // JSON string of payroll
      var operator = data.operator || "Hệ thống";
      
      if (!month || !dataStr) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", success: false, message: "Thiếu dữ liệu tháng hoặc cấu trúc phiếu lương." }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
      
      savePayrollData(sheets.dataSheet, month, dataStr, operator, ssId);
      writeLog(sheets.logSheet, operator, "Lưu phiếu lương", month, "Đã cập nhật/tạo mới phiếu lương cho tháng " + month, ssId);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", success: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. XÓA PHIẾU LƯƠNG NHÂN VIÊN
    if (action === "deletePayroll") {
      var sheets = getOrCreateSheets(ssId);
      var month = data.month;
      var operator = data.operator || "Hệ thống";
      if (!month) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", success: false, message: "Thiếu tham số tháng cần xóa." }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
      
      deletePayrollData(sheets.dataSheet, month, ssId);
      writeLog(sheets.logSheet, operator, "Xóa phiếu lương", month, "Đã xóa toàn bộ phiếu lương của tháng " + month, ssId);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", success: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    throw new Error("Hành động POST không hợp lệ: " + action);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", success: false, message: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// HIGH SPEED SHEETS API V4 & FALLBACK IMPLEMENTATION
// ==========================================

function isSheetsApiEnabled() {
  return (typeof Sheets !== 'undefined' && Sheets.Spreadsheets && Sheets.Spreadsheets.Values);
}

function getSheetValues(sheet, ssId, rangeName) {
  var ss = sheet.getParent();
  var sheetName = sheet.getName();
  
  if (isSheetsApiEnabled()) {
    try {
      var spreadId = ssId || ss.getId();
      var response = Sheets.Spreadsheets.Values.get(spreadId, sheetName + "!" + rangeName);
      return response.values || [];
    } catch (err) {
      console.warn("Sheets API v4 error: " + err.message + ". Falling back.");
    }
  }
  return sheet.getDataRange().getValues();
}

function updateSheetValues(sheet, ssId, rangeName, values) {
  var ss = sheet.getParent();
  var sheetName = sheet.getName();
  
  if (isSheetsApiEnabled()) {
    try {
      var spreadId = ssId || ss.getId();
      var valueRange = Sheets.newValueRange();
      valueRange.values = values;
      Sheets.Spreadsheets.Values.update(valueRange, spreadId, sheetName + "!" + rangeName, {
        valueInputOption: "RAW"
      });
      return;
    } catch (err) {
      console.warn("Sheets API v4 update error: " + err.message + ". Falling back.");
    }
  }
  var parts = rangeName.split(":");
  var startCell = parts[0];
  var range = sheet.getRange(startCell);
  var row = range.getRow();
  var col = range.getColumn();
  sheet.getRange(row, col, values.length, values[0].length).setValues(values);
}

// ==========================================
// BUSINESS LOGIC METHODS FOR PAYROLL
// ==========================================

function fetchMonthsList(dataSheet, ssId) {
  var rows = getSheetValues(dataSheet, ssId, "A2:C");
  var months = [];
  
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0]) {
      months.push({
        month: rows[i][0],
        updatedTime: rows[i][1],
        operator: rows[i][2]
      });
    }
  }
  months.sort(function(a, b) {
    return b.month.localeCompare(a.month);
  });
  return months;
}

function fetchPayrollByMonth(dataSheet, month, ssId) {
  var rows = getSheetValues(dataSheet, ssId, "A2:D");
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === month) {
      return JSON.parse(rows[i][3]);
    }
  }
  return null;
}

function savePayrollData(dataSheet, month, dataStr, operator, ssId) {
  var rows = getSheetValues(dataSheet, ssId, "A2:D");
  var targetRowIndex = -1;
  var timestamp = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");
  
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === month) {
      targetRowIndex = i + 2;
      break;
    }
  }
  
  var newRowData = [month, timestamp, operator, dataStr];
  
  if (targetRowIndex !== -1) {
    updateSheetValues(dataSheet, ssId, "A" + targetRowIndex + ":D" + targetRowIndex, [newRowData]);
  } else {
    if (isSheetsApiEnabled()) {
      try {
        var spreadId = ssId || dataSheet.getParent().getId();
        var valueRange = Sheets.newValueRange();
        valueRange.values = [newRowData];
        Sheets.Spreadsheets.Values.append(valueRange, spreadId, "PayrollData!A:D", {
          valueInputOption: "RAW"
        });
        return;
      } catch (err) {
        console.warn("Sheets API append error: " + err.message + ". Falling back.");
      }
    }
    dataSheet.appendRow(newRowData);
  }
}

function deletePayrollData(dataSheet, month, ssId) {
  var rows = getSheetValues(dataSheet, ssId, "A2:A");
  var targetRowIndex = -1;
  
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === month) {
      targetRowIndex = i + 2;
      break;
    }
  }
  
  if (targetRowIndex !== -1) {
    dataSheet.deleteRow(targetRowIndex);
  } else {
    throw new Error("Không tìm thấy dữ liệu tháng " + month + " để xóa.");
  }
}

function writeLog(logSheet, operator, action, month, details, ssId) {
  var timestamp = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");
  var newLog = [timestamp, operator, action, month, details];
  
  if (isSheetsApiEnabled()) {
    try {
      var spreadId = ssId || logSheet.getParent().getId();
      var valueRange = Sheets.newValueRange();
      valueRange.values = [newLog];
      Sheets.Spreadsheets.Values.append(valueRange, spreadId, "ActionLogs!A:E", {
        valueInputOption: "RAW"
      });
      return;
    } catch (err) {
      console.warn("Sheets API log append error: " + err.message + ". Falling back.");
    }
  }
  logSheet.appendRow(newLog);
}

function fetchActionLogs(logSheet, ssId) {
  var rows = getSheetValues(logSheet, ssId, "A2:E");
  var logs = [];
  var start = Math.max(0, rows.length - 100);
  for (var i = rows.length - 1; i >= start; i--) {
    if (rows[i][0]) {
      logs.push({
        timestamp: rows[i][0],
        operator: rows[i][1],
        action: rows[i][2],
        month: rows[i][3],
        details: rows[i][4]
      });
    }
  }
  return logs;
}

function test() {
  getOrCreateSheets("1jL7m6dZuuxOdpMPSOO1KfMviUmbI1VJXAq3Hmwz9DGk");
}
