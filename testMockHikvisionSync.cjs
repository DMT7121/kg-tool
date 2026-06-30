/**
 * ==============================================================================
 * SCRIPT MOCK TEST - HIKVISION ONLINE WEBHOOK SYNC (KG_TOOL)
 * ==============================================================================
 * 
 * Hướng dẫn sử dụng:
 * 1. Mở terminal tại thư mục dự án và chạy: node testMockHikvisionSync.js
 * 2. Mặc định script sẽ hướng dẫn cách điền URL Web App của bạn để chạy test thực tế.
 */

const https = require('https');

// Sửa đường dẫn này bằng Link Web App Apps Script đã deploy của bạn để test thực tế
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyCetIZ7cBHfLOF5eu1PXyeHfg7Gmqo9m-V8j6fJc_-7rjT2_YL4IKvzz6nbOHbsulrCw/exec";
const WEBHOOK_SECRET = "KINGS_GRILL_HIKVISION_SECRET_2026";

// Thay tên nhân viên hợp lệ có sẵn trong sheet của bạn để test
const TEST_EMPLOYEE_NAME = "Nguyễn Văn A"; 
const TEST_EMPLOYEE_ID = "NV01";

function runMockTest() {
  if (GAS_WEBAPP_URL.includes("YOUR_WEB_APP_ID")) {
    console.log("======================================================================");
    console.log("⚠️ CHƯA ĐIỀN LINK WEB APP THỰC TẾ!");
    console.log("Vui lòng mở file này và thay thế giá trị GAS_WEBAPP_URL bằng URL deploy");
    console.log("của Apps Script dự án để chạy kiểm thử thực tế.");
    console.log("======================================================================");
    return;
  }

  // 1. Giả lập tín hiệu gửi từ Cloudflare Worker sang Google Apps Script
  const mockPayload = {
    action: "hikvision_sync",
    spreadsheetId: "1jd3ANq8kFEaheluau15Akk_qIHO-qojN7XI0256hZPU", 
    payload: {
      secret_key: WEBHOOK_SECRET,
      ma_nv: TEST_EMPLOYEE_ID,
      name: TEST_EMPLOYEE_NAME,
      thoi_gian: new Date().toISOString(),
      mac_address: "8c:e7:48:fa:f5:33"
    }
  };

  const dataString = JSON.stringify(mockPayload);

  console.log(`🚀 Đang gửi yêu cầu giả lập chấm công cho Nhân viên: ${TEST_EMPLOYEE_NAME} (${TEST_EMPLOYEE_ID})...`);
  console.log(`URL: ${GAS_WEBAPP_URL}`);

  sendRequestWithRedirect(GAS_WEBAPP_URL, dataString, (err, responseText) => {
    if (err) {
      console.error("❌ Lỗi gửi request:", err.message);
      return;
    }
    console.log("\n✅ [PHẢN HỒI TỪ SERVER]:");
    try {
      const resObj = JSON.parse(responseText);
      console.log(JSON.stringify(resObj, null, 2));
      if (resObj.success) {
        console.log("\n🎉 TEST THÀNH CÔNG! Dữ liệu đã được ghi nhận trên Google Sheet.");
      } else {
        console.log("\n❌ Server trả về lỗi. Kiểm tra lại secret_key hoặc mã nhân viên.");
      }
    } catch (e) {
      console.log(responseText);
      console.log("\n⚠️ Phản hồi không phải dạng JSON. Hãy kiểm tra lại đường dẫn Web App.");
    }
  });
}

function sendRequestWithRedirect(url, data, callback) {
  const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
    let body = '';
    
    // Nếu có redirect (302)
    if (res.statusCode === 302 || res.statusCode === 301) {
      const redirectUrl = res.headers.location;
      https.get(redirectUrl, (redirectRes) => {
        let redirectBody = '';
        redirectRes.on('data', chunk => redirectBody += chunk);
        redirectRes.on('end', () => callback(null, redirectBody));
      }).on('error', callback);
      return;
    }

    res.on('data', chunk => body += chunk);
    res.on('end', () => callback(null, body));
  });

  req.on('error', callback);
  req.write(data);
  req.end();
}

runMockTest();
