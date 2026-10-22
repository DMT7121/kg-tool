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
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyCetIZ7cBHfLOF5eu1PXyeHfg7Gmqo9m-V8j6fJc_-7rjT2_YL4IKvzz6nbOHbsulrCw/exec";

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
            if (data.action === "tts_proxy") {
              return await handleTtsProxy(data);
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
        spreadsheetId: env.SPREADSHEET_ID || "1jd3ANq8kFEaheluau15Akk_qIHO-qojN7XI0256hZPU",
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
      spreadsheetId: env.SPREADSHEET_ID || "1jd3ANq8kFEaheluau15Akk_qIHO-qojN7XI0256hZPU",
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

/**
 * ==============================================================================
 * REVERSE-ENGINEERED TTS PROXY (EDGE NEURAL, CAPCUT SAMI, OPENAI.FM, GOOGLE TTS)
 * ==============================================================================
 */
const EDGE_TRUSTED_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_GEC_VERSION = "2-143.0.3650.75";
const WIN_EPOCH_SEC = 11644473600;
const SHA256_INIT_STATE = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const SHA256_CUSTOM_STATE = [0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a, 0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2];
const SHA256_SCHED_SEED = [0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba, 0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6, 0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33, 0xd258b060, 0x72766564];
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
const SHA256_ADJ = 0xc9dc06a7;
const SHA256_BLK_K = [...SHA256_K.slice(0, 14), SHA256_ADJ, ...SHA256_K.slice(15)];
const CS64_COEFFS = [
  [0xe82e91b1, 0xb32700d0], [0x44de24c6, 0x88dff51d], [0x3beb65bc, 0x29514038], [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5], [0x314ef5d5, 0x26e55f3c], [0xe92491b1, 0x607801c6], [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da], [0xda79fa60, 0x207cc464], [0xbed20560, 0x3c3c74f3], [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1], [0xcb49e3c6, 0xc5626167]
];

function _mul32(a, b) { return Math.imul(a, b) >>> 0; }
function _rol16(v) { v = v >>> 0; return ((v << 16) | (v >>> 16)) >>> 0; }
function _rotr(v, n) { v = v >>> 0; return ((v >>> n) | (v << (32 - n))) >>> 0; }
function _s0(v) { v = v >>> 0; return (_rotr(v, 7) ^ _rotr(v, 18) ^ (v >>> 3)) >>> 0; }
function _s1(v) { v = v >>> 0; return (_rotr(v, 17) ^ _rotr(v, 19) ^ (v >>> 10)) >>> 0; }

function generateEdgeSecMsGecV2(unixSec) {
  let ticks = unixSec + WIN_EPOCH_SEC;
  ticks -= ticks % 300;
  ticks *= 1e7;
  const dataBytes = new TextEncoder().encode(`${ticks.toFixed(0)}${EDGE_TRUSTED_TOKEN}`);
  const wordsInit = new Array(14).fill(0);
  wordsInit.push(((dataBytes[0] << 16) | (dataBytes[1] << 8) | dataBytes[2]) >>> 0);
  wordsInit.push(((dataBytes[3] << 24) | (dataBytes[4] << 16) | (dataBytes[5] << 8) | dataBytes[6]) >>> 0);
  for (let i = 16; i < 30; i++) {
    let val = SHA256_SCHED_SEED[i - 16];
    if (i - 2 >= 14) val = (val + (i === 16 ? (_s1(wordsInit[i - 2]) ^ 0x000b92c0) : _s1(wordsInit[i - 2]))) >>> 0;
    if (i - 7 >= 14) val = (val + wordsInit[i - 7]) >>> 0;
    if (i - 15 >= 14) val = (val + (i === 29 ? (_s0(wordsInit[i - 15]) ^ 0x059c0b80) : _s0(wordsInit[i - 15]))) >>> 0;
    wordsInit.push(val >>> 0);
  }
  wordsInit.push((_s1(wordsInit[28]) + wordsInit[23] + _s0(wordsInit[15]) + wordsInit[14] + SHA256_ADJ - SHA256_K[14]) >>> 0);
  for (let i = 31; i < 64; i++) wordsInit.push((_s1(wordsInit[i - 2]) + wordsInit[i - 7] + _s0(wordsInit[i - 15]) + wordsInit[i - 16]) >>> 0);

  const runRounds = (st, w, start) => {
    let [a, b, c, d, e, f, g, h] = st.map(x => x >>> 0);
    const kArr = start === 14 ? SHA256_BLK_K : SHA256_K;
    for (let i = start; i < 64; i++) {
      const S1 = (_rotr(e, 6) ^ _rotr(e, 11) ^ _rotr(e, 25)) >>> 0;
      const ch = (g ^ (e & (f ^ g))) >>> 0;
      const t1 = (h + S1 + ch + kArr[i] + w[i]) >>> 0;
      const S0 = (_rotr(a, 2) ^ _rotr(a, 13) ^ _rotr(a, 22)) >>> 0;
      const maj = ((a & b) | (c & (a | b))) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    return [a, b, c, d, e, f, g, h];
  };

  let wState = runRounds(SHA256_CUSTOM_STATE, wordsInit, 14);
  let state = SHA256_INIT_STATE.map((x, idx) => (x + wState[idx]) >>> 0);

  const length = 57 + dataBytes.length;
  const tail = dataBytes.subarray(7);
  const padZeros = (55 - (length % 64) + 64) % 64;
  const padded = new Uint8Array(tail.length + 1 + padZeros + 8);
  padded.set(tail, 0);
  padded[tail.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setBigUint64(padded.length - 8, BigInt(length) * 8n, false);

  for (let off = 0; off < padded.length; off += 64) {
    const w = [];
    for (let j = 0; j < 16; j++) w.push(dv.getUint32(off + j * 4, false));
    for (let i = 16; i < 64; i++) w.push((_s1(w[i - 2]) + w[i - 7] + _s0(w[i - 15]) + w[i - 16]) >>> 0);
    const wrk = runRounds(state, w, 0);
    state = state.map((x, idx) => (x + wrk[idx]) >>> 0);
  }

  const digest = new Uint8Array(32);
  const digDv = new DataView(digest.buffer);
  state.forEach((w, idx) => digDv.setUint32(idx * 4, w, false));

  const keyA = (digDv.getUint32(0, true) | 1) >>> 0;
  const keyB = (digDv.getUint32(4, true) | 1) >>> 0;
  const factors = [_mul32(keyA, 0x82893933), _mul32(keyB, 0x82893933)];
  const terms = CS64_COEFFS.map(([c], idx) => _mul32(c, factors[idx % 2]));
  const offsets = CS64_COEFFS.map(([, o]) => o >>> 0);
  const pref = new Uint8Array(1 + dataBytes.length);
  pref.set(dataBytes, 1);
  const pad4 = (4 - (pref.length % 4)) % 4;
  const pBuf = new Uint8Array(pref.length + pad4);
  pBuf.set(pref, 0);
  const pDv = new DataView(pBuf.buffer);
  const leWords = [];
  for (let i = 0; i < pBuf.length; i += 4) leWords.push(pDv.getUint32(i, true));
  if (leWords.length % 2 !== 0) leWords.push(0);
  for (let idx = 0; idx < leWords.length; idx++) {
    const word = leWords[idx];
    let term = _mul32(word, idx % 2 === 0 ? keyA : keyB);
    let offset = _mul32(_rol16(word), idx % 2 === 0 ? 0xef0569fb : 0xc31713db);
    if (idx === 0) {
      term = (term + _mul32(0xf2f90b1a, factors[0])) >>> 0;
      offset = (offset + 0x0b1a0000) >>> 0;
    }
    terms.push(term);
    offsets.push(offset);
  }
  let swapAcc = 0, swapLast = 0, csState = 0, acc = 0;
  for (let idx = 0; idx < terms.length; idx += 2) {
    const x = terms[idx], y = terms[idx + 1];
    let t = _rol16((offsets[idx] + x) >>> 0);
    let q = _mul32(t, 0x76f50f34);
    swapAcc = (swapAcc + ((_mul32(_rol16(q), 0xc3efea97) + q) >>> 0)) >>> 0;
    t = _rol16((offsets[idx + 1] + y) >>> 0);
    q = _mul32(t, 0x1881ce3c);
    swapLast = (_mul32(_rol16(q), 0x35bd1ec9) + q) >>> 0;
    swapAcc = (swapAcc + swapLast) >>> 0;
    csState = (_mul32(csState, keyA) + x) >>> 0;
    csState = _mul32(_rol16(csState), 0xcf98b111);
    csState = _mul32(_rol16(csState), 0x87085b9f);
    csState = _mul32(_rol16(csState), 0x12ceb96d);
    csState = _mul32(_rol16(csState), 0x257e1d83);
    acc = (acc + csState) >>> 0;
    t = (_mul32(csState, keyB) + y) >>> 0;
    t = _mul32(_rol16(t), 0xa27416f5);
    t = _mul32(_rol16(t), 0xd38396ff);
    csState = _mul32(_rol16(_mul32(_rol16(t), 0x7c932b89)), 0xbfa49f69);
    acc = (acc + csState) >>> 0;
  }
  const csBuf = new Uint8Array(8);
  const csDv = new DataView(csBuf.buffer);
  csDv.setUint32(0, (swapLast ^ csState) >>> 0, true);
  csDv.setUint32(4, (swapAcc ^ acc) >>> 0, true);
  const csHex = Array.from(csBuf).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const shaHex = Array.from(digest).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `${csHex}-${shaHex}`;
}

async function handleTtsProxy(data) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    const provider = String(data.provider || "edge").toLowerCase();
    const text = String(data.text || "").trim();
    if (!text) {
      return new Response(JSON.stringify({ success: false, error: "Thiếu văn bản cần đọc (text)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (provider === "google") {
      const rate = Number(data.rate ?? 1.0);
      const speedParam = rate < 0.85 ? "0.3" : "1";
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&ttsspeed=${speedParam}&q=${encodeURIComponent(text.slice(0, 195))}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      const buf = await res.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "audio/mpeg" }
      });
    }

    if (provider === "capcut") {
      const tokenUrl = "https://edit-api-sg.capcut.com/lv/v1/common/tts/token";
      const deviceTime = Math.floor(Date.now() / 1000).toString();
      const sign = await md5(`9e2c|s/token|7|5.8.0|${deviceTime}||11ac`);
      const tokenRes = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Appvr": "5.8.0",
          "Content-Type": "application/json",
          "Device-Time": deviceTime,
          "Origin": "https://www.capcut.com",
          "Pf": "7",
          "Sign": sign,
          "Sign-Ver": "1",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: JSON.stringify({ scenes: ["normal"] })
      });
      const tokenJson = await tokenRes.json();
      const token = tokenJson?.data?.token;
      const appKey = tokenJson?.data?.app_key;
      if (!token || !appKey) throw new Error("Không lấy được token CapCut");

      const wsResp = await fetch("https://sami-sg1.byteintlapi.com/internal/api/v1/ws", {
        headers: {
          Upgrade: "websocket",
          Origin: "https://www.capcut.com",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      const ws = wsResp.webSocket;
      if (!ws) throw new Error("Không mở được WebSocket tới CapCut SAMI");
      ws.accept();

      const audioBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        const timer = setTimeout(() => {
          try { ws.close(); } catch {}
          chunks.length > 0 ? resolve(chunks) : reject(new Error("CapCut WS timeout"));
        }, 15000);

        ws.addEventListener("message", (ev) => {
          if (typeof ev.data === "string") {
            try {
              const p = JSON.parse(ev.data);
              if (p.event === "TaskFinished") {
                clearTimeout(timer);
                ws.close();
                resolve(chunks);
              } else if (p.event === "TaskFailed" || (p.status_code && p.status_code >= 400)) {
                clearTimeout(timer);
                ws.close();
                reject(new Error(p.status_text || "CapCut TaskFailed"));
              }
            } catch {}
          } else if (ev.data) {
            const u8 = ev.data instanceof Uint8Array ? ev.data : new Uint8Array(ev.data);
            if (u8.byteLength > 0 && u8[0] === 0x7b && u8[u8.byteLength - 1] === 0x7d) {
              try {
                const txt = new TextDecoder().decode(u8);
                const p = JSON.parse(txt);
                if (p.event === "TaskFinished") {
                  clearTimeout(timer);
                  ws.close();
                  resolve(chunks);
                  return;
                } else if (p.event === "TaskFailed" || (p.status_code && p.status_code >= 400)) {
                  clearTimeout(timer);
                  ws.close();
                  reject(new Error(p.status_text || "CapCut TaskFailed"));
                  return;
                }
              } catch {}
            }
            chunks.push(u8);
          }
        });
        ws.addEventListener("close", () => {
          clearTimeout(timer);
          if (chunks.length > 0) resolve(chunks);
        });
        ws.addEventListener("error", (e) => {
          clearTimeout(timer);
          reject(new Error(e.message || "WS Error"));
        });
        ws.send(JSON.stringify({
          token,
          appkey: appKey,
          namespace: "TTS",
          event: "StartTask",
          payload: JSON.stringify({
            text,
            speaker: data.voice || "BV074_streaming",
            pitch: Math.round(Number(data.pitch ?? 10)),
            speed: Math.round(Number(data.rate ?? 10)),
            volume: Math.round(Number(data.volume ?? 1) * 10),
            rate: 24000,
            appid: "348188"
          })
        }));
      });

      const totalLen = audioBuffer.reduce((s, c) => s + c.byteLength, 0);
      const merged = new Uint8Array(totalLen);
      let off = 0;
      for (const c of audioBuffer) {
        merged.set(c, off);
        off += c.byteLength;
      }
      return new Response(merged.buffer, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "audio/wav" }
      });
    }

    // Default / Edge TTS (or OpenAI.fm fallback)
    const voice = provider === "openaifm"
      ? (["echo", "onyx", "ash", "verse"].includes(data.voice) ? "vi-VN-NamMinhNeural" : "vi-VN-HoaiMyNeural")
      : (data.voice || "vi-VN-HoaiMyNeural");
    const secMsGec = generateEdgeSecMsGecV2(Math.floor(Date.now() / 1000));
    const connectId = crypto.randomUUID().replace(/-/g, "");
    const muid = crypto.randomUUID().replace(/-/g, "").toUpperCase();
    const edgeUrl = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_TRUSTED_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${EDGE_GEC_VERSION}&ConnectionId=${connectId}`;

    const wsResp = await fetch(edgeUrl, {
      headers: {
        Upgrade: "websocket",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        Cookie: `muid=${muid};`
      }
    });
    const ws = wsResp.webSocket;
    if (!ws) throw new Error(`Edge TTS WebSocket upgrade failed (HTTP ${wsResp.status})`);
    ws.accept();

    const rateVal = Number(data.rate ?? 0);
    const ratePct = Math.abs(rateVal) <= 3 && rateVal !== 0 ? Math.round((rateVal - 1.0) * 100) : Math.round(rateVal);
    const rateStr = `${ratePct >= 0 ? "+" : ""}${ratePct}%`;
    const pitchVal = Number(data.pitch ?? 0);
    const pitchHz = Math.abs(pitchVal) <= 2 && pitchVal !== 0 ? Math.round((pitchVal - 1.0) * 50) : Math.round(pitchVal);
    const pitchStr = `${pitchHz >= 0 ? "+" : ""}${pitchHz}Hz`;

    const mp3Chunks = await new Promise((resolve, reject) => {
      const chunks = [];
      const timer = setTimeout(() => {
        try { ws.close(); } catch {}
        chunks.length > 0 ? resolve(chunks) : reject(new Error("Edge TTS WS timeout"));
      }, 15000);

      ws.addEventListener("message", (ev) => {
        if (typeof ev.data === "string") {
          if (ev.data.includes("Path:turn.end")) {
            clearTimeout(timer);
            ws.close();
            resolve(chunks);
          }
        } else if (ev.data) {
          const buf = ev.data instanceof ArrayBuffer ? ev.data : ev.data.buffer;
          const u8 = ev.data instanceof Uint8Array ? ev.data : new Uint8Array(buf);
          if (u8.byteLength > 2) {
            const hLen = (u8[0] << 8) | u8[1];
            if (u8.byteLength > 2 + hLen) {
              chunks.push(u8.subarray(2 + hLen));
            }
          }
        }
      });
      ws.addEventListener("close", () => {
        clearTimeout(timer);
        if (chunks.length > 0) resolve(chunks);
      });
      ws.addEventListener("error", (e) => {
        clearTimeout(timer);
        reject(new Error(e.message || "Edge WS Error"));
      });

      const ts = new Date().toUTCString();
      ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
      const reqId = crypto.randomUUID().replace(/-/g, "");
      const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'><voice name='${voice}'><prosody pitch='${pitchStr}' rate='${rateStr}' volume='+0%'>${safeText}</prosody></voice></speak>`;
      ws.send(`X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    const totalLen = mp3Chunks.reduce((s, c) => s + c.byteLength, 0);
    const merged = new Uint8Array(totalLen);
    let off = 0;
    for (const c of mp3Chunks) {
      merged.set(c, off);
      off += c.byteLength;
    }
    return new Response(merged.buffer, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
