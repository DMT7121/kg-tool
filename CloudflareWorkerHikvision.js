/**
 * ==============================================================================
 * CLOUDFLARE WORKER WEBHOOK PROXY - HIKVISION DS-K1T320MX SYNC (KG_TOOL)
 * ==============================================================================
 * 
 * Hướng dẫn deploy trên Cloudflare:
 * 1. Đăng nhập vào trang quản trị Cloudflare dashboard (https://dash.cloudflare.com/)
 * 2. Vào mục Workers & Pages -> Chọn "Create Application" -> "Create Worker".
 * 3. Đặt tên cho Worker (ví dụ: kingsgrill-hikvision-sync).
 * 4. Bấm "Deploy" để tạo.
 * 5. Bấm "Edit Code", copy toàn bộ nội dung file này dán đè vào mục `worker.js`.
 * 6. Sửa cấu hình bên dưới (GAS_WEBAPP_URL) bằng link Web App Apps Script của bạn.
 * 7. Bấm "Save and Deploy".
 * 8. Lấy đường dẫn URL của Worker (ví dụ: https://kingsgrill-hikvision-sync.username.workers.dev)
 *    và dán vào mục cấu hình "HTTP Host" trên máy chấm công Hikvision.
 */

// Cấu hình URL Google Apps Script Web App của bạn
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyWhtyEggy1Kx13LXLzllnbBhofIES6K12wlsegUPagoc6a1M-PKqpwvq--iPukEvnlmg/exec"; 

// Khóa bí mật trùng khớp với cài đặt trong Apps Script
const WEBHOOK_SECRET = "KINGS_GRILL_HIKVISION_SECRET_2026"; 

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Chỉ hỗ trợ phương thức POST.", { status: 405 });
    }

    try {
      const contentType = request.headers.get("content-type") || "";
      let empId = null;
      let name = null;
      let time = null;
      let macAddress = "";
      let rawText = "";

      // 1. PHÂN TÍCH DỮ LIỆU ĐẦU VÀO
      if (contentType.includes("multipart/form-data")) {
        // Trường hợp máy gửi kèm ảnh chụp khuôn mặt (multipart/form-data)
        const formData = await request.formData();
        let eventLogText = "";

        for (const [key, value] of formData.entries()) {
          if (typeof value === "string") {
            eventLogText = value;
          }
        }

        rawText = eventLogText;

        // Parse metadata trong phần text
        if (eventLogText) {
          const parsed = parsePayloadText(eventLogText);
          empId = parsed.empId;
          name = parsed.name;
          time = parsed.time;
          macAddress = parsed.macAddress;
        }

      } else {
        // Trường hợp chỉ gửi log dạng JSON hoặc XML thuần
        rawText = await request.text();
        const parsed = parsePayloadText(rawText);
        empId = parsed.empId;
        name = parsed.name;
        time = parsed.time;
        macAddress = parsed.macAddress;
      }

      // 2. KIỂM TRA DỮ LIỆU CƠ BẢN
      if (!empId && !name) {
        return new Response(JSON.stringify({
          success: false,
          message: "Không tìm thấy Mã nhân viên (employeeNoString) hoặc Tên trong dữ liệu gửi từ máy chấm công.",
          debug_raw: rawText.substring(0, 500)
        }), { 
          status: 400, 
          headers: { "Content-Type": "application/json" } 
        });
      }

      // Chuẩn hóa thời gian nếu thiếu
      if (!time) {
        time = new Date().toISOString();
      }

      // 3. CHUYỂN TIẾP LÊN GOOGLE APPS SCRIPT
      const gasPayload = {
        action: "hikvision_sync",
        spreadsheetId: "1jd3ANq8kFEaheluau15Akk_qIHO-qojN7XI0256hZPU",
        payload: {
          secret_key: WEBHOOK_SECRET,
          ma_nv: empId,
          name: name,
          thoi_gian: time,
          mac_address: macAddress
        }
      };

      const gasResponse = await fetch(env.GAS_WEBAPP_URL || GAS_WEBAPP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(gasPayload),
        redirect: "follow" // Cho phép tự động chuyển hướng 302 của Apps Script
      });

      const responseText = await gasResponse.text();

      return new Response(responseText, {
        status: gasResponse.status,
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: "Lỗi xử lý Proxy Worker: " + error.message
      }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      });
    }
  }
};

/**
 * Hàm phân tích nội dung text từ máy chấm công (JSON hoặc XML)
 */
function parsePayloadText(text) {
  let empId = null;
  let name = null;
  let time = null;
  let macAddress = "";

  text = text.trim();

  // Thử parse dạng JSON
  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text);
      const eventDetail = data.eventDetail || data.AcsEvent || {};
      empId = eventDetail.employeeNoString || data.employeeNoString;
      name = eventDetail.name || data.name;
      time = data.dateTime || eventDetail.time || data.time;
      macAddress = data.macAddress || "";
      
      return { empId, name, time, macAddress };
    } catch (e) {}
  }

  // Parse bằng Regex để hỗ trợ cả XML lẫn JSON lỗi
  // 1. Tìm Employee ID
  const empMatch = text.match(/<employeeNoString>([^<]+)<\/employeeNoString>/) 
                || text.match(/"employeeNoString"\s*:\s*"([^"]+)"/);
  if (empMatch) {
    empId = empMatch[1];
  }

  // 2. Tìm Name
  const nameMatch = text.match(/<name>([^<]+)<\/name>/) 
                 || text.match(/"name"\s*:\s*"([^"]+)"/);
  if (nameMatch) {
    name = nameMatch[1];
  }

  // 3. Tìm thời gian
  const timeMatch = text.match(/<dateTime>([^<]+)<\/dateTime>/)
                 || text.match(/"dateTime"\s*:\s*"([^"]+)"/)
                 || text.match(/<time>([^<]+)<\/time>/)
                 || text.match(/"time"\s*:\s*"([^"]+)"/);
  if (timeMatch) {
    time = timeMatch[1];
  }

  // 4. Tìm Mac Address
  const macMatch = text.match(/<macAddress>([^<]+)<\/macAddress>/)
                || text.match(/"macAddress"\s*:\s*"([^"]+)"/);
  if (macMatch) {
    macAddress = macMatch[1];
  }

  return { empId, name, time, macAddress };
}
