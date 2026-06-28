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
    historySheet.appendRow(['id', 'templateId', 'text', 'providerId', 'voiceId', 'gender', 'rate', 'pitch', 'volume', 'playedAt', 'status', 'errorMessage', 'user']);
    historySheet.getRange("A1:L1").setFontWeight("bold").setBackground("#feeef0");
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
  getOrCreateSheets("1jL7m6dZuuxOdpMPSOO1KfMviUmbI1VJXAq3Hmwz9DGk");
}
