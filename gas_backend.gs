/**
 * Google Apps Script Backend cho Hệ Thống Xử Lý Chấm Công & Quản Lý VietQR
 * Hướng dẫn triển khai:
 * 1. Mở Google Sheet: https://docs.google.com/spreadsheets/d/1jL7m6dZuuxOdpMPSOO1KfMviUmbI1VJXAq3Hmwz9DGk/edit
 * 2. Chọn Extensions (Tiện ích mở rộng) -> Apps Script.
 * 3. Dán toàn bộ đoạn code này vào file Code.gs.
 * 4. Nhấn nút Deploy (Triển khai) -> New deployment (Triển khai mới).
 * 5. Chọn loại là Web app. Cấu hình:
 *    - Execute as: Me (Tôi)
 *    - Who has access: Anyone (Bất kỳ ai)
 * 6. Copy URL Web app cung cấp để dán vào cấu hình trên Web App.
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "save_attendance";
    
    // Mở Spreadsheet chỉ định hoặc spreadsheet đang chứa script
    let ss;
    try {
      ss = SpreadsheetApp.openById("1jL7m6dZuuxOdpMPSOO1KfMviUmbI1VJXAq3Hmwz9DGk");
    } catch (err) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Không thể mở Google Sheet" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "save_bank_account") {
      let sheet = ss.getSheetByName("DATA2");
      if (!sheet) {
        sheet = ss.insertSheet("DATA2");
      }
      
      const account = data.account; // { bankName, bankId, accountNo, accountHolder, amount, memo, qrUrl, createdAt }
      if (!account) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Không có dữ liệu tài khoản" }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Tạo tiêu đề nếu sheet mới
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Thời gian tạo', 'Ngân hàng', 'Mã ngân hàng', 'Số tài khoản', 'Tên chủ tài khoản', 'Số tiền', 'Nội dung chuyển khoản', 'Link mã QR']);
        sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#f1f5f9');
      }
      
      const row = [
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
        message: "Lưu thông tin tài khoản và mã QR thành công vào sheet DATA2!"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Default action: save_attendance
    let sheet = ss.getSheetByName("Bang_Cham_Cong_Log") || ss.getActiveSheet();
    const records = data.records; // Array of { employeeName, logicalDate, checkIn, checkOut, overtime }
    
    if (!records || !records.length) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Không có dữ liệu chấm công" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Tạo tiêu đề nếu sheet mới
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Tên nhân viên', 'Ngày', 'Giờ vào', 'Giờ ra', 'Ghi chú']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f1f5f9');
    }
    
    // Append rows
    const rows = records.map(r => {
      const notes = [];
      if (r.overtime) {
        notes.push('Tăng ca');
      }
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
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", inserted: rows.length }))
                         .setMimeType(ContentService.MimeType.JSON);
                         
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
