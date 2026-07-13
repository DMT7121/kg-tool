/**
 * Google Apps Script Backend cho Dự án KG_TOOL
 * Tích hợp:
 * 1. Xử lý chấm công (Lưu Bang_Cham_Cong_Log)
 * 2. Lưu trữ thông tin tài khoản VietQR (Lưu DATA2)
 * 3. Quản lý Phiếu lương nhân viên (Lưu PayrollData & ActionLogs)
 * 4. Tích hợp Quản lý và Lưu trữ mẫu câu / lịch sử Đọc TTS (Lưu TTS_Templates, TTS_History, TTS_Settings)
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

// Auto-create TTS tables if missing
function getOrCreateTtsSheets(ss) {
  var templatesSheet = ss.getSheetByName("TTS_Templates");
  if (!templatesSheet) {
    templatesSheet = ss.insertSheet("TTS_Templates");
    templatesSheet.appendRow(['id', 'title', 'category', 'text', 'variables', 'providerId', 'voiceId', 'gender', 'lang', 'rate', 'pitch', 'volume', 'isFavorite', 'createdAt', 'updatedAt', 'createdBy', 'note']);
    templatesSheet.getRange("A1:Q1").setFontWeight("bold").setBackground("#eef4ff");
  }

  var historySheet = ss.getSheetByName("TTS_History");
  if (!historySheet) {
    historySheet = ss.insertSheet("TTS_History");
    historySheet.appendRow(['id', 'templateId', 'text', 'normalizedText', 'providerId', 'voiceId', 'gender', 'rate', 'pitch', 'volume', 'playedAt', 'status', 'errorMessage', 'user']);
    historySheet.getRange("A1:N1").setFontWeight("bold").setBackground("#feeef0");
  }

  var settingsSheet = ss.getSheetByName("TTS_Settings");
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet("TTS_Settings");
    settingsSheet.appendRow(['key', 'value', 'updatedAt']);
    settingsSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#eef4ff");
  }

  return { templatesSheet: templatesSheet, historySheet: historySheet, settingsSheet: settingsSheet };
}

/**
 * GET Handler
 * Dùng để đọc danh sách tháng lương, thông tin lương chi tiết và log chỉnh sửa, mẫu câu/lịch sử TTS.
 */
function doGet(e) {
  var res = { success: false, data: null, error: "" };
  try {
    var action = e.parameter.action;
    var ssId = e.parameter.ssId;
    
    var sheets = getOrCreateSheets(ssId);
    var ss = sheets.ss;
    
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
    } else if (action === "get_tts_templates") {
      res.data = fetchTtsTemplates(ss, ssId);
      res.success = true;
    } else if (action === "get_tts_history") {
      res.data = fetchTtsHistory(ss, ssId);
      res.success = true;
    } else if (action === "get_tts_settings") {
      res.data = fetchTtsSettings(ss, ssId);
      res.success = true;
    } else if (action === "getAttendanceLogs") {
      res.data = fetchAttendanceLogs(ss, ssId);
      res.success = true;
    } else if (action === "init_sheets") {
      var brevoKey = e.parameter.brevo_key || "";
      var brevoSender = e.parameter.brevo_sender || "";
      res.data = initSystemSheets(ss, brevoKey, brevoSender);
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
 * Hỗ trợ lưu chấm công, lưu VietQR, lưu/xóa phiếu lương, lưu/đồng bộ TTS
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
    if (action === "hikvision_sync") {
      return ContentService.createTextOutput(JSON.stringify(externalHikvisionSync(data, ss)))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "hikvision_bulk_sync") {
      return ContentService.createTextOutput(JSON.stringify(externalHikvisionBulkSync(data, ss)))
                           .setMimeType(ContentService.MimeType.JSON);
    }

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
      var dataStr = data.data; 
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

    // 5. LƯU / ĐỒNG BỘ MẪU CÂU TTS
    if (action === "save_tts_template") {
      var templatesSheet = getOrCreateTtsSheets(ss).templatesSheet;
      var template = data.template;
      if (!template || !template.id) {
        throw new Error("Thiếu dữ liệu template hoặc ID.");
      }
      saveTtsTemplateRow(templatesSheet, template, ssId);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // 6. XÓA MẪU CÂU TTS
    if (action === "delete_tts_template") {
      var templatesSheet = getOrCreateTtsSheets(ss).templatesSheet;
      var id = data.id;
      if (!id) throw new Error("Thiếu ID template cần xóa.");
      deleteTtsTemplateRow(templatesSheet, id, ssId);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // 7. LƯU LỊCH SỬ PHÁT TTS
    if (action === "save_tts_history") {
      var historySheet = getOrCreateTtsSheets(ss).historySheet;
      var log = data.log;
      if (!log) throw new Error("Thiếu thông tin lịch sử.");
      saveTtsHistoryRow(historySheet, log, ssId);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // 8. LƯU CẤU HÌNH TTS
    if (action === "save_tts_settings") {
      var settingsSheet = getOrCreateTtsSheets(ss).settingsSheet;
      var settingsList = data.settings; 
      if (!settingsList || !settingsList.length) throw new Error("Thiếu cấu hình lưu trữ.");
      saveTtsSettingsRows(settingsSheet, settingsList, ssId);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", success: true })).setMimeType(ContentService.MimeType.JSON);
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

// ==========================================
// BUSINESS LOGIC METHODS FOR TTS
// ==========================================

function fetchTtsTemplates(ss, ssId) {
  var sheet = ss.getSheetByName("TTS_Templates");
  if (!sheet) return [];
  var rows = getSheetValues(sheet, ssId, "A2:Q");
  var list = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0]) {
      list.push({
        id: rows[i][0],
        title: rows[i][1],
        category: rows[i][2],
        text: rows[i][3],
        variables: rows[i][4] ? JSON.parse(rows[i][4]) : [],
        providerId: rows[i][5],
        voiceId: rows[i][6],
        gender: rows[i][7],
        lang: rows[i][8],
        rate: Number(rows[i][9]) || 1.0,
        pitch: Number(rows[i][10]) || 1.0,
        volume: Number(rows[i][11]) || 1.0,
        isFavorite: rows[i][12] === "TRUE" || rows[i][12] === true,
        createdAt: rows[i][13],
        updatedAt: rows[i][14],
        createdBy: rows[i][15],
        note: rows[i][16]
      });
    }
  }
  return list;
}

function saveTtsTemplateRow(sheet, template, ssId) {
  var rows = getSheetValues(sheet, ssId, "A2:A");
  var targetRowIndex = -1;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === template.id) {
      targetRowIndex = i + 2;
      break;
    }
  }

  var rowData = [
    template.id,
    template.title || "",
    template.category || "",
    template.text || "",
    template.variables ? JSON.stringify(template.variables) : "[]",
    template.providerId || "",
    template.voiceId || "",
    template.gender || "",
    template.lang || "vi-VN",
    template.rate || 1.0,
    template.pitch || 1.0,
    template.volume || 1.0,
    template.isFavorite ? "TRUE" : "FALSE",
    template.createdAt || new Date().toISOString(),
    new Date().toISOString(),
    template.createdBy || "",
    template.note || ""
  ];

  if (targetRowIndex !== -1) {
    updateSheetValues(sheet, ssId, "A" + targetRowIndex + ":Q" + targetRowIndex, [rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function deleteTtsTemplateRow(sheet, id, ssId) {
  var rows = getSheetValues(sheet, ssId, "A2:A");
  var targetRowIndex = -1;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === id) {
      targetRowIndex = i + 2;
      break;
    }
  }
  if (targetRowIndex !== -1) {
    sheet.deleteRow(targetRowIndex);
  }
}

function fetchTtsHistory(ss, ssId) {
  var sheet = ss.getSheetByName("TTS_History");
  if (!sheet) return [];
  var rows = getSheetValues(sheet, ssId, "A2:L");
  var list = [];
  var start = Math.max(0, rows.length - 100);
  for (var i = rows.length - 1; i >= start; i--) {
    if (rows[i][0]) {
      list.push({
        id: rows[i][0],
        templateId: rows[i][1],
        text: rows[i][2],
        providerId: rows[i][3],
        voiceId: rows[i][4],
        gender: rows[i][5],
        rate: Number(rows[i][6]) || 1.0,
        pitch: Number(rows[i][7]) || 1.0,
        volume: Number(rows[i][8]) || 1.0,
        playedAt: rows[i][9],
        status: rows[i][10],
        errorMessage: rows[i][11]
      });
    }
  }
  return list;
}

function saveTtsHistoryRow(sheet, log, ssId) {
  var rowData = [
    log.id || "hist-" + Date.now(),
    log.templateId || "",
    log.text || "",
    log.normalizedText || "",
    log.providerId || "",
    log.voiceId || "",
    log.gender || "",
    log.rate || 1.0,
    log.pitch || 1.0,
    log.volume || 1.0,
    log.playedAt || new Date().toISOString(),
    log.status || "success",
    log.errorMessage || "",
    log.user || ""
  ];
  sheet.appendRow(rowData);
}

function fetchTtsSettings(ss, ssId) {
  var sheet = ss.getSheetByName("TTS_Settings");
  if (!sheet) return {};
  var rows = getSheetValues(sheet, ssId, "A2:B");
  var settings = {};
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0]) {
      settings[rows[i][0]] = rows[i][1];
    }
  }
  return settings;
}

function saveTtsSettingsRows(sheet, settingsList, ssId) {
  var rows = getSheetValues(sheet, ssId, "A2:B");
  var timestamp = new Date().toISOString();
  
  settingsList.forEach(function(item) {
    var targetRowIndex = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === item.key) {
        targetRowIndex = i + 2;
        break;
      }
    }
    
    var rowData = [item.key, String(item.value), timestamp];
    if (targetRowIndex !== -1) {
      updateSheetValues(sheet, ssId, "A" + targetRowIndex + ":C" + targetRowIndex, [rowData]);
    } else {
      sheet.appendRow(rowData);
    }
  });
}

function test() {
  getOrCreateSheets("1jd3ANq8kFEaheluau15Akk_qIHO-qojN7XI0256hZPU");
}
/**
 * Lấy lịch sử chấm công từ sheet Bang_Cham_Cong_Log
 */
function fetchAttendanceLogs(ss, ssId) {
  var sheet = ss.getSheetByName("Bang_Cham_Cong_Log");
  if (!sheet) return [];
  var rows = getSheetValues(sheet, ssId, "A2:E");
  var list = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i][0]) {
      list.push({
        name: rows[i][0],
        date: rows[i][1],
        checkIn: rows[i][2] || "",
        checkOut: rows[i][3] || "",
        notes: rows[i][4] || ""
      });
    }
  }
  return list;
}

/**
 * Chuyển đổi định dạng giờ "HH:mm:ss" hoặc "HH:mm" thành số giây trong ngày để so sánh chính xác
 */
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  var parts = timeStr.toString().split(":");
  var hrs = parseInt(parts[0], 10) || 0;
  var mins = parseInt(parts[1], 10) || 0;
  var secs = parseInt(parts[2], 10) || 0;
  return hrs * 3600 + mins * 60 + secs;
}

/**
 * Ghi nhận tất cả các lượt chấm công vào sheet Logs dạng thô (semicolon-separated)
 */
function writeToRawLogs(ss, employeeName, dateString, timeString) {
  var sheet = ss.getSheetByName("Logs");
  if (!sheet) {
    sheet = ss.insertSheet("Logs");
    sheet.appendRow(['Tên nhân viên', 'Ngày', 'Lịch sử chấm công']);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#eef4ff');
  }

  var lastRow = sheet.getLastRow();
/**
 * Xử lý sự kiện chấm công thông minh trong Bang_Cham_Cong_Log (In-Memory)
 */
function processCheckInEvent(ss, sheet, existingRecords, employeeName, dateStringObj, gioString, isBulk) {
  var tSeconds = parseTimeToSeconds(gioString);
  var lastShift = null;

  // Tìm ca cuối cùng của nhân viên trong ngày từ existingRecords
  for (var i = existingRecords.length - 1; i >= 0; i--) {
    var rowName = existingRecords[i][0];
    var rowDate = existingRecords[i][1];
    if (rowName === employeeName && rowDate === dateStringObj) {
      lastShift = {
        arrayIndex: i,
        checkIn: existingRecords[i][2],
        checkOut: existingRecords[i][3],
        notes: existingRecords[i][4]
      };
      break;
    }
  }

  if (lastShift) {
    if (!lastShift.checkOut || lastShift.checkOut === "") {
      // Đã có giờ vào, chưa có giờ ra
      var inSeconds = parseTimeToSeconds(lastShift.checkIn);
      var diff = tSeconds - inSeconds;
      if (diff <= 600) {
        // Chấm công liên tiếp trong vòng 10 phút kể từ giờ vào -> bỏ qua
        return { status: "ignored", message: "Bỏ qua chấm công liên tiếp dưới 10 phút cho " + employeeName + " lúc " + gioString };
      } else {
        // Cập nhật giờ ra cho ca hiện tại
        var canSend = shouldSendEmail(employeeName, dateStringObj, gioString, "Ra", existingRecords);
        
        // Cập nhật local array cho caller
        existingRecords[lastShift.arrayIndex][3] = gioString;
        existingRecords[lastShift.arrayIndex][4] = "Chấm công vào ca / Chấm công ra ca";

        if (!isBulk) {
          sendTelegram("🔴 <b>[KING'S GRILL - HIKVISION RA CA]</b>\n" +
                       "Nhân viên: <b>" + employeeName + "</b>\n" +
                       "Giờ ra: <b>" + gioString + " (" + dateStringObj + ")</b>", ss);
          sendGoogleChat("🔴 *[KING'S GRILL - HIKVISION RA CA]*\n" +
                         "Nhân viên: *" + employeeName + "*\n" +
                         "Giờ ra: *" + gioString + " (" + dateStringObj + ")*", ss);
        }

        if (canSend && !isBulk) {
          sendAttendanceEmail(employeeName, dateStringObj, gioString, "Ra", ss);
        }

        return { 
          status: "success", 
          type: "out", 
          message: "Ghi nhận Ra Ca thành công lúc " + gioString,
          modifiedArrayIndex: lastShift.arrayIndex,
          canSendEmail: canSend
        };
      }
    } else {
      // Đã có cả giờ vào và giờ ra của ca gần nhất
      var outSeconds = parseTimeToSeconds(lastShift.checkOut);
      var diff = tSeconds - outSeconds;
      if (diff < 900) {
        // Bắt buộc ca mới sau ca cũ ít nhất 15 phút -> bỏ qua
        return { status: "ignored", message: "Bỏ qua chấm công mới dưới 15 phút sau giờ ra cũ cho " + employeeName + " lúc " + gioString };
      } else {
        // Tạo ca mới
        var canSend = shouldSendEmail(employeeName, dateStringObj, gioString, "Vào", existingRecords);
        
        var newRow = [employeeName, dateStringObj, gioString, "", "Chấm công vào ca"];
        existingRecords.push(newRow);

        if (!isBulk) {
          sendTelegram("🟢 <b>[KING'S GRILL - HIKVISION VÀO CA]</b>\n" +
                       "Nhân viên: <b>" + employeeName + "</b>\n" +
                       "Giờ vào: <b>" + gioString + " (" + dateStringObj + ")</b>", ss);
          sendGoogleChat("🟢 *[KING'S GRILL - HIKVISION VÀO CA]*\n" +
                         "Nhân viên: *" + employeeName + "*\n" +
                         "Giờ vào: *" + gioString + " (" + dateStringObj + ")*", ss);
        }

        if (canSend && !isBulk) {
          sendAttendanceEmail(employeeName, dateStringObj, gioString, "Vào", ss);
        }

        return { 
          status: "success", 
          type: "in", 
          message: "Ghi nhận Vào Ca mới thành công lúc " + gioString,
          newRow: newRow,
          canSendEmail: canSend
        };
      }
    }
  } else {
    // Chưa có ca nào trong ngày
    var canSend = shouldSendEmail(employeeName, dateStringObj, gioString, "Vào", existingRecords);
    
    var newRow = [employeeName, dateStringObj, gioString, "", "Chấm công vào ca"];
    existingRecords.push(newRow);

    if (!isBulk) {
      sendTelegram("🟢 <b>[KING'S GRILL - HIKVISION VÀO CA]</b>\n" +
                   "Nhân viên: <b>" + employeeName + "</b>\n" +
                   "Giờ vào: <b>" + gioString + " (" + dateStringObj + ")</b>", ss);
      sendGoogleChat("🟢 *[KING'S GRILL - HIKVISION VÀO CA]*\n" +
                   "Nhân viên: *" + employeeName + "*\n" +
                   "Giờ vào: *" + gioString + " (" + dateStringObj + ")*", ss);
    }

    if (canSend && !isBulk) {
      sendAttendanceEmail(employeeName, dateStringObj, gioString, "Vào", ss);
    }

    return { 
      status: "success", 
      type: "in", 
      message: "Ghi nhận Vào Ca thành công lúc " + gioString,
      newRow: newRow,
      canSendEmail: canSend
    };
  }
}

/**
 * Ghi nhận thô vào cache Logs trong bộ nhớ
 */
function processRawLogInMemory(existingLogs, employeeName, dateString, timeString, modifiedLogIndices) {
  var matchIndex = -1;
  for (var i = existingLogs.length - 1; i >= 0; i--) {
    if (existingLogs[i][0].toString() === employeeName && existingLogs[i][1].toString() === dateString) {
      matchIndex = i;
      break;
    }
  }
  
  if (matchIndex !== -1) {
    var existingTimes = existingLogs[matchIndex][2] ? existingLogs[matchIndex][2].toString() : "";
    var newTimes = existingTimes ? existingTimes + "; " + timeString : timeString;
    existingLogs[matchIndex][2] = newTimes;
    modifiedLogIndices[matchIndex] = true;
  } else {
    var newRow = [employeeName, dateString, timeString];
    existingLogs.push(newRow);
  }
}

/**
 * Xử lý đồng bộ chấm công từ máy chấm công Hikvision (qua Cloudflare Worker)
 */
function externalHikvisionSync(data, ss) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { success: false, status: "error", message: "Hệ thống đang bận xử lý yêu cầu khác, vui lòng thử lại sau." };
  }

  try {
    var payload = data.payload || {};
    if (payload.secret_key !== "KINGS_GRILL_HIKVISION_SECRET_2026") {
      return { success: false, status: "error", message: "Sai khóa bảo mật Webhook." };
    }

    var employeeName = payload.name || payload.ma_nv;
    if (!employeeName) {
      return { success: false, status: "error", message: "Thiếu tên hoặc mã nhân viên." };
    }

    var timeString = payload.thoi_gian;
    var now = new Date();
    if (timeString) {
      var parsedDate = new Date(timeString);
      if (!isNaN(parsedDate.getTime())) {
        now = parsedDate;
      }
    }

    var dateStringObj = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy");
    var gioString = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");

    // 1. Ghi nhận thô vào sheet Logs
    writeToRawLogs(ss, employeeName, dateStringObj, gioString);

    // 2. Ghi nhận thông minh vào Bang_Cham_Cong_Log
    var sheet = ss.getSheetByName("Bang_Cham_Cong_Log");
    if (!sheet) {
      sheet = ss.insertSheet("Bang_Cham_Cong_Log");
      sheet.appendRow(['Tên nhân viên', 'Ngày', 'Giờ vào', 'Giờ ra', 'Ghi chú']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f1f5f9');
    }

    var lastRow = sheet.getLastRow();
    var existingRecords = [];
    if (lastRow > 1) {
      existingRecords = sheet.getRange(2, 1, lastRow - 1, 5).getDisplayValues();
    }

    var result = processCheckInEvent(ss, sheet, existingRecords, employeeName, dateStringObj, gioString, false);

    // Write back changes to Bang_Cham_Cong_Log
    if (result.status === "success") {
      if (result.newRow) {
        sheet.appendRow(result.newRow);
      } else if (result.modifiedArrayIndex !== undefined) {
        var rowIndex = result.modifiedArrayIndex + 2;
        sheet.getRange(rowIndex, 4).setValue(gioString);
        sheet.getRange(rowIndex, 5).setValue("Chấm công vào ca / Chấm công ra ca");
      }
    }

    return { success: true, status: result.status, message: result.message };
  } catch (err) {
    return { success: false, status: "error", message: "Lỗi đồng bộ: " + err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xử lý đồng bộ hàng loạt (bulk sync) từ máy chấm công khi khôi phục kết nối
 */
function externalHikvisionBulkSync(data, ss) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { success: false, status: "error", message: "Hệ thống đang bận xử lý yêu cầu khác, vui lòng thử lại sau." };
  }

  try {
    var payload = data.payload || {};
    if (payload.secret_key !== "KINGS_GRILL_HIKVISION_SECRET_2026") {
      return { success: false, status: "error", message: "Sai khóa bảo mật Webhook." };
    }

    var events = payload.events || [];
    if (!events.length) {
      return { success: true, status: "success", message: "Không có sự kiện nào cần đồng bộ.", importedCount: 0 };
    }

    // 1. Đọc dữ liệu Bang_Cham_Cong_Log
    var sheet = ss.getSheetByName("Bang_Cham_Cong_Log");
    if (!sheet) {
      sheet = ss.insertSheet("Bang_Cham_Cong_Log");
      sheet.appendRow(['Tên nhân viên', 'Ngày', 'Giờ vào', 'Giờ ra', 'Ghi chú']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f1f5f9');
    }

    var lastRow = sheet.getLastRow();
    var existingRecords = [];
    if (lastRow > 1) {
      existingRecords = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    }

    // 2. Đọc dữ liệu Logs
    var logsSheet = ss.getSheetByName("Logs");
    if (!logsSheet) {
      logsSheet = ss.insertSheet("Logs");
      logsSheet.appendRow(['Tên nhân viên', 'Ngày', 'Lịch sử chấm công']);
      logsSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#eef4ff');
    }
    
    var logsLastRow = logsSheet.getLastRow();
    var existingLogs = [];
    if (logsLastRow > 1) {
      existingLogs = logsSheet.getRange(2, 1, logsLastRow - 1, 3).getValues();
    }

    // Tiền xử lý sự kiện: sắp xếp theo thời gian tăng dần
    events.sort(function(a, b) {
      return new Date(a.time).getTime() - new Date(b.time).getTime();
    });

    var modifiedLogIndices = {};
    var importedCount = 0;
    var bulkDetails = [];

    for (var idx = 0; idx < events.length; idx++) {
      var event = events[idx];
      var employeeName = event.name || event.empId;
      if (!employeeName) continue;

      var eventTime = new Date(event.time);
      if (isNaN(eventTime.getTime())) continue;

      var dateStringObj = Utilities.formatDate(eventTime, "GMT+7", "dd/MM/yyyy");
      var gioString = Utilities.formatDate(eventTime, "GMT+7", "HH:mm:ss");

      // A. Ghi nhận thô vào cache Logs
      processRawLogInMemory(existingLogs, employeeName, dateStringObj, gioString, modifiedLogIndices);

      // B. Ghi nhận thông minh vào cache Bang_Cham_Cong_Log
      var result = processCheckInEvent(ss, sheet, existingRecords, employeeName, dateStringObj, gioString, true);
      if (result.status === "success") {
        importedCount++;
      }
    }

    return { success: true, status: "success", message: "Đã đồng bộ bổ sung thành công " + importedCount + " lượt chấm công.", importedCount: importedCount };
  } catch (err) {
    return { success: false, status: "error", message: "Lỗi đồng bộ hàng loạt: " + err.message };
  }
}

/**
 * Gửi thông báo Telegram tự động qua cấu hình trong sheet CauHinh_HT
 */
function sendTelegram(message, ss) {
  try {
    var sheet = ss.getSheetByName("Cấu Hình Hệ Thống") 
             || ss.getSheetByName("CauHinh_HT") 
             || ss.getSheetByName("Cấu hình hệ thống");
    if (!sheet) return;
    var headers = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
    var tokenCol = -1, chatIdCol = -1;
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] === "telegram_bot_token") tokenCol = i + 1;
      if (headers[i] === "telegram_chat_id_bgd") chatIdCol = i + 1;
    }
    if (tokenCol !== -1 && chatIdCol !== -1) {
      var botToken = sheet.getRange(3, tokenCol).getValue();
      var chatId = sheet.getRange(3, chatIdCol).getValue();
      if (botToken && chatId) {
        var url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
        var payload = JSON.stringify({
          chat_id: chatId,
          parse_mode: "HTML",
          text: message
        });
        UrlFetchApp.fetch(url, {
          method: "post",
          contentType: "application/json",
          payload: payload,
          muteHttpExceptions: true
        });
      }
    }
  } catch (err) {
    console.warn("Lỗi gửi Telegram: " + err.message);
  }
}

/**
 * Gửi thông báo tự động tới Google Chat Space qua Incoming Webhook
 */
function sendGoogleChat(message, ss) {
  try {
    var sheet = ss.getSheetByName("Cấu Hình Hệ Thống") 
             || ss.getSheetByName("CauHinh_HT") 
             || ss.getSheetByName("Cấu hình hệ thống");
             
    if (!sheet) return;
    
    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();
    
    if (lastRow >= 3) {
      var headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
      var gchatCol = -1;
      for (var i = 0; i < headers.length; i++) {
        if (headers[i] === "google_chat_webhook_url") {
          gchatCol = i + 1;
          break;
        }
      }
      
      if (gchatCol === -1) return;
      var webhookUrl = sheet.getRange(3, gchatCol).getValue().toString().trim();
      if (!webhookUrl) return; // Không cấu hình webhook, bỏ qua
      
      var payload = { "text": message };
      var options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      
      var response = UrlFetchApp.fetch(webhookUrl, options);
      Logger.log("Google Chat response status: " + response.getResponseCode());
    }
  } catch (err) {
    Logger.log("Lỗi gửi Google Chat: " + err.message);
  }
}

/**
 * Lấy email của nhân viên từ sheet Danh_Sach_Nhan_Vien
 */
function getEmployeeEmail(employeeName, ss) {
  var sheetName = "Danh_Sach_Nhan_Vien";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(["Tên nhân viên", "Email", "Ghi chú"]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f1f5f9");
    // Add instruction row
    sheet.appendRow(["Nguyễn Văn A", "nva@gmail.com", "Nhập tên khớp với tên trên máy chấm công"]);
    return null;
  }
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  
  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    var name = data[i][0].toString().trim().toLowerCase();
    if (name === employeeName.trim().toLowerCase()) {
      return data[i][1].toString().trim();
    }
  }
  return null;
}

/**
 * Gửi email thông báo chấm công cho nhân viên
 */
function sendAttendanceEmail(employeeName, dateString, gioString, type, ss) {
  try {
    var email = getEmployeeEmail(employeeName, ss);
    if (!email) {
      Logger.log("Không tìm thấy email cho nhân viên: " + employeeName);
      return;
    }
    
    var isCheckIn = type.toLowerCase().includes("vào");
    var typeText = isCheckIn ? "🟢 VÀO CA" : "🔴 RA CA";
    var color = isCheckIn ? "#10b981" : "#ef4444";
    
    var subject = "[King's Grill] Thông báo chấm công " + (isCheckIn ? "Vào ca" : "Ra ca") + " - " + employeeName;
    
    var htmlContent = '<div style="font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">' +
      '<div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">' +
        '<h2 style="color: #1e3a8a; margin: 0;">KING\'S GRILL</h2>' +
        '<p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">Hệ Thống Chấm Công Tự Động</p>' +
      '</div>' +
      '<div style="margin-bottom: 25px;">' +
        '<p style="color: #334155; font-size: 16px;">Xin chào <strong>' + employeeName + '</strong>,</p>' +
        '<p style="color: #334155; font-size: 15px; line-height: 1.5;">Hệ thống ghi nhận bạn đã chấm công thành công trên thiết bị:</p>' +
        '<div style="background-color: #f8fafc; border-left: 4px solid ' + color + '; padding: 15px; border-radius: 4px; margin: 20px 0;">' +
          '<table style="width: 100%; border-collapse: collapse;">' +
            '<tr>' +
              '<td style="color: #64748b; padding: 5px 0; font-size: 14px; width: 35%;">Trạng thái:</td>' +
              '<td style="color: ' + color + '; padding: 5px 0; font-weight: bold; font-size: 15px;">' + typeText + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="color: #64748b; padding: 5px 0; font-size: 14px;">Thời gian:</td>' +
              '<td style="color: #1e293b; padding: 5px 0; font-weight: bold; font-size: 15px;">' + gioString + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="color: #64748b; padding: 5px 0; font-size: 14px;">Ngày:</td>' +
              '<td style="color: #1e293b; padding: 5px 0; font-weight: bold; font-size: 15px;">' + dateString + '</td>' +
            '</tr>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #94a3b8;">' +
        '<p style="margin: 0 0 5px 0;">Email này được gửi tự động từ hệ thống nhân sự King\'s Grill.</p>' +
        '<p style="margin: 0;">Chúc bạn có một ngày làm việc vui vẻ và hiệu quả!</p>' +
      '</div>' +
    '</div>';
    
    var configSheet = ss.getSheetByName("Cấu Hình Hệ Thống") 
                   || ss.getSheetByName("CauHinh_HT") 
                   || ss.getSheetByName("Cấu hình hệ thống");
    var brevoApiKey = "";
    var senderEmail = "";
    
    if (configSheet) {
      var headers = configSheet.getRange(2, 1, 1, configSheet.getLastColumn()).getValues()[0];
      var apiKeyCol = -1, senderCol = -1;
      for (var i = 0; i < headers.length; i++) {
        if (headers[i] === "brevo_api_key") apiKeyCol = i + 1;
        if (headers[i] === "brevo_sender_email") senderCol = i + 1;
      }
      
      if (apiKeyCol !== -1 && senderCol !== -1) {
        brevoApiKey = configSheet.getRange(3, apiKeyCol).getValue().toString().trim();
        senderEmail = configSheet.getRange(3, senderCol).getValue().toString().trim();
      }
    }
    
    if (brevoApiKey && senderEmail) {
      Logger.log("Đang gửi email qua Brevo API đến: " + email);
      sendViaBrevo(brevoApiKey, senderEmail, email, subject, htmlContent);
    } else {
      Logger.log("Đang gửi email qua GmailApp đến: " + email);
      sendViaGmail(email, subject, htmlContent);
    }
  } catch (err) {
    Logger.log("Lỗi gửi email thông báo: " + err.message);
  }
}

/**
 * Gửi email qua Brevo API
 */
function sendViaBrevo(apiKey, senderEmail, recipientEmail, subject, htmlContent) {
  var url = "https://api.brevo.com/v3/smtp/email";
  var payload = JSON.stringify({
    sender: { email: senderEmail, name: "King's Grill HR" },
    to: [{ email: recipientEmail }],
    subject: subject,
    htmlContent: htmlContent
  });
  
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "api-key": apiKey
    },
    payload: payload,
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var resText = response.getContentText();
  Logger.log("Brevo response: " + resText);
  return response.getResponseCode() === 201 || response.getResponseCode() === 200;
}

/**
 * Gửi email qua GmailApp mặc định (miễn phí)
 */
function sendViaGmail(recipientEmail, subject, htmlContent) {
  GmailApp.sendEmail(recipientEmail, subject, "", {
    htmlBody: htmlContent,
    name: "King's Grill HR"
  });
}

/**
 * Tự động khởi tạo các sheet Danh_Sach_Nhan_Vien và Cấu Hình Hệ Thống nếu chưa tồn tại
 */
function initSystemSheets(ss, brevoKey, brevoSender) {
  // 1. Khởi tạo sheet Cấu Hình Hệ Thống
  var configSheetName = "Cấu Hình Hệ Thống";
  var configSheet = ss.getSheetByName(configSheetName)
                 || ss.getSheetByName("CauHinh_HT")
                 || ss.getSheetByName("Cấu hình hệ thống");
                 
  if (!configSheet) {
    configSheet = ss.insertSheet(configSheetName);
  }
  
  var lastRow = configSheet.getLastRow();
  if (lastRow < 3) {
    configSheet.getRange(1, 1).setValue("BẢNG CẤU HÌNH HỆ THỐNG - KHÔNG ĐƯỢC XÓA DÒNG 2 VÀ DÒNG 3");
    configSheet.getRange(1, 1, 1, 5).merge().setFontWeight("bold").setFontColor("#1e3a8a").setBackground("#eff6ff");
    
    configSheet.getRange(2, 1, 1, 5).setValues([[
      "telegram_bot_token", 
      "telegram_chat_id_bgd", 
      "brevo_api_key", 
      "brevo_sender_email",
      "google_chat_webhook_url"
    ]]).setFontWeight("bold").setBackground("#f1f5f9");
    
    configSheet.getRange(3, 1, 1, 5).setValues([[
      "", 
      "", 
      brevoKey || "", 
      brevoSender || "",
      ""
    ]]);
  } else {
    var headers = configSheet.getRange(2, 1, 1, configSheet.getLastColumn()).getValues()[0];
    var apiKeyCol = -1, senderCol = -1, gchatCol = -1;
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] === "brevo_api_key") apiKeyCol = i + 1;
      if (headers[i] === "brevo_sender_email") senderCol = i + 1;
      if (headers[i] === "google_chat_webhook_url") gchatCol = i + 1;
    }
    
    var lastCol = configSheet.getLastColumn();
    
    if (apiKeyCol === -1) {
      configSheet.getRange(2, lastCol + 1).setValue("brevo_api_key").setFontWeight("bold").setBackground("#f1f5f9");
      configSheet.getRange(3, lastCol + 1).setValue(brevoKey || "");
      lastCol++;
    } else if (brevoKey) {
      configSheet.getRange(3, apiKeyCol).setValue(brevoKey);
    }
    
    if (senderCol === -1) {
      configSheet.getRange(2, lastCol + 1).setValue("brevo_sender_email").setFontWeight("bold").setBackground("#f1f5f9");
      configSheet.getRange(3, lastCol + 1).setValue(brevoSender || "");
      lastCol++;
    } else if (brevoSender) {
      configSheet.getRange(3, senderCol).setValue(brevoSender);
    }

    if (gchatCol === -1) {
      configSheet.getRange(2, lastCol + 1).setValue("google_chat_webhook_url").setFontWeight("bold").setBackground("#f1f5f9");
      configSheet.getRange(3, lastCol + 1).setValue("");
    }
  }

  // 2. Khởi tạo sheet Danh_Sach_Nhan_Vien
  var employeeSheetName = "Danh_Sach_Nhan_Vien";
  var employeeSheet = ss.getSheetByName(employeeSheetName);
  if (!employeeSheet) {
    employeeSheet = ss.insertSheet(employeeSheetName);
    employeeSheet.appendRow(["Tên nhân viên", "Email", "Ghi chú"]);
    employeeSheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f1f5f9");
    employeeSheet.appendRow(["Nguyễn Văn A", "nva@gmail.com", "Nhập tên khớp với tên trên máy chấm công"]);
  }
  
  return "Khởi tạo các bảng cấu hình thành công!";
}

/**
 * Xác định xem có nên gửi email cho lượt chấm công này hay không (giãn cách tối thiểu 30 phút giữa các lần gửi cùng loại trong ngày)
 */
function shouldSendEmail(employeeName, dateString, timeString, type, existingRecords) {
  try {
    if (!existingRecords || existingRecords.length === 0) return true; // Bảng rỗng, cho phép gửi
    
    var isCheckIn = type === "Vào";
    var colIndex = isCheckIn ? 2 : 3; // Cột Giờ vào (chỉ số 2) hoặc Giờ ra (chỉ số 3)
    
    var newTimeMinutes = parseTimeToMinutes(timeString);
    var lastEventMinutes = -1;
    
    for (var i = 0; i < existingRecords.length; i++) {
      var rowName = existingRecords[i][0];
      var rowDate = existingRecords[i][1];
      var rowTime = existingRecords[i][colIndex];
      
      if (rowName === employeeName && rowDate === dateString && rowTime && rowTime.trim() !== "") {
        var minutes = parseTimeToMinutes(rowTime);
        if (minutes > lastEventMinutes) {
          lastEventMinutes = minutes;
        }
      }
    }
    
    if (lastEventMinutes === -1) {
      return true; // Chưa có lượt chấm công nào cùng loại trong ngày, cho phép gửi
    }
    
    // Tính khoảng cách phút giữa lần mới và lần gần nhất cùng loại
    var diff = Math.abs(newTimeMinutes - lastEventMinutes);
    return diff >= 30; // Trả về true nếu cách nhau >= 30 phút
  } catch (err) {
    Logger.log("Lỗi trong shouldSendEmail: " + err.message);
    return true; // Nếu có lỗi thì vẫn cho phép gửi email để tránh mất thông tin
  }
}

/**
 * Chuyển đổi định dạng giờ "HH:mm" thành số phút trong ngày
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  var parts = timeStr.toString().split(":");
  if (parts.length < 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Hàm khởi chạy một lần từ Editor để ủy quyền (Authorize) và tạo tự động các sheet
 */
function runInitialize() {
  var ss = SpreadsheetApp.openById("1jd3ANq8kFEaheluau15Akk_qIHO-qojN7XI0256hZPU");
  var brevoKey = "";
  var brevoSender = "";
  
  var result = initSystemSheets(ss, brevoKey, brevoSender);
  Logger.log(result);
}
