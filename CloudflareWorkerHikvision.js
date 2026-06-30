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
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxiav9YYV21xfqdiZ7ZtiN6wkApoiaBOZRtHa6SIjgwp1KpvhnD_KYEXgPJ7MnEfkQ/exec"; 

// Khóa bí mật trùng khớp với cài đặt trong Apps Script
const WEBHOOK_SECRET = "KINGS_GRILL_HIKVISION_SECRET_2026"; 

export default {
  async fetch(request, env, ctx) {
    // 0. XỬ LÝ CORS PREFLIGHT
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (request.method !== "POST") {
      return new Response("Chỉ hỗ trợ phương thức POST.", { status: 405 });
    }

    try {
      const contentType = request.headers.get("content-type") || "";
      console.log("--- BẮT ĐẦU NHẬN REQUEST ---");
      console.log("Content-Type:", contentType);
      
      let empId = null;
      let name = null;
      let time = null;
      let macAddress = "";
      let rawText = "";

      // 1. PHÂN TÍCH DỮ LIỆU ĐẦU VÀO
      if (contentType.includes("multipart/form-data")) {
        // Trường hợp máy gửi kèm ảnh chụp khuôn mặt (multipart/form-data)
        const formData = await request.formData();
        console.log("FormData Keys:", Array.from(formData.keys()));
        let eventLogText = "";

        for (const [key, value] of formData.entries()) {
          const isFile = value && typeof value === 'object' && typeof value.text === 'function';
          console.log(`Field: "${key}", Type: ${typeof value}, isFile: ${isFile}`);
          
          if (typeof value === "string") {
            eventLogText = value;
          } else if (isFile) {
            const textContent = await value.text();
            console.log(`Content of "${key}" (first 200 chars):`, textContent.substring(0, 200));
            if (textContent.includes("employeeNoString") || textContent.includes("eventDetail") || textContent.includes("AcsEvent") || key.toLowerCase().includes("log") || key.toLowerCase().includes("event")) {
              eventLogText = textContent;
            }
          }
        }

        rawText = eventLogText;
        console.log("RawText Content:", rawText);

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

        // Kiểm tra lệnh điều khiển đồng bộ bổ sung từ Web App
        try {
          if (rawText.trim().startsWith("{")) {
            const data = JSON.parse(rawText);
            if (data.action === "sync_offline_logs") {
              const syncResult = await handleOfflineSync(data, env);
              return new Response(JSON.stringify(syncResult), {
                status: 200,
                headers: { 
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*"
                }
              });
            }
          }
        } catch (e) {
          console.log("JSON parse error, treating as standard Hikvision payload:", e.message);
        }

        const parsed = parsePayloadText(rawText);
        empId = parsed.empId;
        name = parsed.name;
        time = parsed.time;
        macAddress = parsed.macAddress;
      }

      // 2. KIỂM TRA DỮ LIỆU CƠ BẢN
      if (!empId && !name) {
        // Trả về 200 OK để máy chấm công không gửi lại (retry) các sự kiện rác/sự kiện lỗi
        return new Response(JSON.stringify({
          success: true,
          status: "ignored",
          message: "Bỏ qua sự kiện không phải chấm công (Heartbeat / Invalid Verification / Rác).",
          debug_raw: rawText.substring(0, 500)
        }), { 
          status: 200, 
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
      console.log("GAS Response:", responseText);
 
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
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduledSync(env));
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
      const eventDetail = data.AccessControllerEvent || data.eventDetail || data.AcsEvent || {};
      empId = eventDetail.employeeNoString || data.employeeNoString;
      name = eventDetail.name || data.name;
      time = data.dateTime || eventDetail.time || data.time;
      macAddress = data.macAddress || "";
      
      if (empId && name) {
        return { empId, name, time, macAddress };
      }
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

/**
 * Hàm gọi API máy chấm công lấy danh sách sự kiện offline
 */
async function handleOfflineSync(data, env) {
  const { tunnelUrl, username, password, fromDate, toDate, secret_key } = data;

  if (secret_key !== WEBHOOK_SECRET) {
    return { success: false, message: "Sai khóa bảo mật Webhook." };
  }

  if (!tunnelUrl) {
    return { success: false, message: "Thiếu địa chỉ kết nối máy chấm công (tunnelUrl)." };
  }

  // Format date range: YYYY-MM-DDT00:00:00+07:00
  const startTime = `${fromDate}T00:00:00+07:00`;
  const endTime = `${toDate}T23:59:59+07:00`;

  let formattedUrl = tunnelUrl.trim();
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = "http://" + formattedUrl;
  }
  const targetUrl = `${formattedUrl.replace(/\/$/, "")}/ISAPI/AccessControl/AcsEvent?format=json`;
  
  const requestBody = {
    AcsEventCond: {
      searchID: "1",
      searchResultPosition: 0,
      maxResults: 1000,
      startTime: startTime,
      endTime: endTime
    }
  };

  try {
    const response = await fetchWithDigest(
      targetUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      },
      username || "admin",
      password
    );

    if (response.status !== 200) {
      let diagnostic = "Kiểm tra lại địa chỉ kết nối, tài khoản và mật khẩu.";
      if (response.status === 403) {
        diagnostic = "Lỗi 403 Forbidden: Thường do chưa kích hoạt giao thức ISAPI/CGI trên máy chấm công, tài khoản bị khóa tạm thời (30 phút) do nhập sai pass nhiều lần, hoặc tài khoản không có quyền Admin.";
      } else if (response.status === 401) {
        diagnostic = "Lỗi 401 Unauthorized: Sai tài khoản hoặc mật khẩu máy chấm công.";
      }
      return { 
        success: false, 
        message: `Kết nối máy chấm công thất bại. HTTP Status: ${response.status}. ${diagnostic}` 
      };
    }

    const resJson = await response.json();
    const acsEvent = resJson.AcsEvent || {};
    const infoList = acsEvent.InfoList || [];

    // Lọc các sự kiện có mã nhân viên
    const eventsToSync = infoList
      .filter(item => item.employeeNoString)
      .map(item => ({
        empId: item.employeeNoString,
        name: item.name || "",
        time: item.time,
        macAddress: item.macAddress || ""
      }));

    if (!eventsToSync.length) {
      return { 
        success: true, 
        message: "Không tìm thấy lượt chấm công nào trong khoảng thời gian này.", 
        importedCount: 0 
      };
    }

    // Chuyển tiếp lên Google Apps Script Web App
    const gasPayload = {
      action: "hikvision_bulk_sync",
      spreadsheetId: "1jd3ANq8kFEaheluau15Akk_qIHO-qojN7XI0256hZPU",
      payload: {
        secret_key: WEBHOOK_SECRET,
        events: eventsToSync
      }
    };

    const gasResponse = await fetch(env.GAS_WEBAPP_URL || GAS_WEBAPP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(gasPayload),
      redirect: "follow"
    });

    return await gasResponse.json();

  } catch (error) {
    return { 
      success: false, 
      message: "Lỗi thực hiện đồng bộ bổ sung: " + error.message 
    };
  }
}

/**
 * Hàm hỗ trợ Digest Authentication cho fetch
 */
async function fetchWithDigest(url, options = {}, username, password) {
  // Gửi request lần đầu để lấy challenge (401)
  let response = await fetch(url, options);
  if (response.status !== 401) {
    return response;
  }

  const authHeader = response.headers.get("www-authenticate");
  if (!authHeader || !authHeader.startsWith("Digest")) {
    return response;
  }

  const params = parseDigestHeader(authHeader);
  const realm = params.realm;
  const nonce = params.nonce;
  const qop = params.qop;
  const opaque = params.opaque;

  const parsedUrl = new URL(url);
  const uri = parsedUrl.pathname + parsedUrl.search;
  const method = options.method || "GET";

  const cn = "0a4f113b"; // Client nonce ngẫu nhiên
  const nc = "00000001"; // Nonce count

  const HA1 = await md5(`${username}:${realm}:${password}`);
  const HA2 = await md5(`${method}:${uri}`);

  let responseHash;
  if (qop === "auth" || qop === "auth-int") {
    responseHash = await md5(`${HA1}:${nonce}:${nc}:${cn}:${qop}:${HA2}`);
  } else {
    responseHash = await md5(`${HA1}:${nonce}:${HA2}`);
  }

  let authStr = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${responseHash}"`;
  if (qop) {
    authStr += `, qop=${qop}, nc=${nc}, cnonce="${cn}"`;
  }
  if (opaque) {
    authStr += `, opaque="${opaque}"`;
  }

  const authOptions = {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": authStr
    }
  };

  return await fetch(url, authOptions);
}

/**
 * Hàm parse header WWW-Authenticate Digest
 */
function parseDigestHeader(header) {
  const matches = header.matchAll(/(\w+)=["']?([^"',]+)["']?/g);
  const params = {};
  for (const match of matches) {
    params[match[1]] = match[2];
  }
  return params;
}

/**
 * Hàm tính MD5 hash
 */
async function md5(string) {
  const msgUint8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest("MD5", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Tự động chạy hằng ngày để đồng bộ bù log chấm công của ngày hôm trước
 */
async function handleScheduledSync(env) {
  console.log("--- BẮT ĐẦU CHẠY TRIGGER ĐỒNG BỘ TỰ ĐỘNG ---");
  const tunnelUrl = env.HIKVISION_TUNNEL_URL;
  const username = env.HIKVISION_USERNAME || "admin";
  const password = env.HIKVISION_PASSWORD;

  if (!tunnelUrl || !password) {
    console.error("Thiếu cấu hình biến môi trường HIKVISION_TUNNEL_URL hoặc HIKVISION_PASSWORD. Bỏ qua đồng bộ tự động.");
    return;
  }

  // Tính ngày hôm trước (theo múi giờ Việt Nam GMT+7)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const vntime = new Date(utc + (3600000 * 7));
  
  vntime.setDate(vntime.getDate() - 1);

  const yyyy = vntime.getFullYear();
  const mm = String(vntime.getMonth() + 1).padStart(2, '0');
  const dd = String(vntime.getDate()).padStart(2, '0');
  const prevDayStr = `${yyyy}-${mm}-${dd}`;

  console.log(`Đang đồng bộ tự động dữ liệu chấm công cho ngày: ${prevDayStr}`);

  try {
    const result = await handleOfflineSync({
      action: "sync_offline_logs",
      tunnelUrl,
      username,
      password,
      fromDate: prevDayStr,
      toDate: prevDayStr,
      secret_key: WEBHOOK_SECRET
    }, env);
    
    console.log("Kết quả đồng bộ tự động:", JSON.stringify(result));
  } catch (error) {
    console.error("Lỗi khi chạy đồng bộ tự động:", error.message);
  }
}
