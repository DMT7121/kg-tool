/**
 * Google Apps Script Backend cho Hệ Thống Xử Lý Chấm Công 
 * Hướng dẫn triển khai:
 * 1. Mở Google Drive, tạo một Google Sheet mới (hoặc dùng cái cũ).
 * 2. Chọn Extensions (Tiện ích mở rộng) -> Apps Script.
 * 3. Dán toàn bộ đoạn code này vào file Code.gs.
 * 4. Nhấn nút Deploy (Triển khai) -> New deployment (Triển khai mới).
 * 5. Chọn loại là Web app. Settings:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy URL Web app cung cấp.
 * (Bạn có thể thêm lệnh gọi POST từ phía frontend webapp để lưu dữ liệu thẳng vào file này sau khi xử lý thành công)
 */

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Parse data from JSON payload
    const data = JSON.parse(e.postData.contents);
    const records = data.records; // Array of { employeeName, logicalDate, checkIn, checkOut, overtime }
    
    if (!records || !records.length) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No data" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Check headers
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Tên nhân viên', 'Ngày', 'Giờ vào', 'Giờ ra', 'Ghi chú']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }
    
    // Append rows
    const rows = records.map(r => [
      r.employeeName,
      r.logicalDate,
      r.checkIn ? new Date(r.checkIn).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : '',
      r.checkOut ? new Date(r.checkOut).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : '',
      r.overtime ? 'Tăng ca' : ''
    ]);
    
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", inserted: rows.length }))
                         .setMimeType(ContentService.MimeType.JSON);
                         
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
