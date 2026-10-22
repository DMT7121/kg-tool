import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'node:https';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ============================================================================
// 1. MICROSOFT EDGE NEURAL TTS (Sec-MS-GEC v2 DRM + WebSocket)
// ============================================================================
const EDGE_TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_CHROMIUM_FULL_VERSION = '143.0.3650.75';
const EDGE_SEC_MS_GEC_VERSION = `2-${EDGE_CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600;

const SHA256_INITIAL = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const SHA256_STATE = [0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a, 0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2];
const SHA256_SCHEDULE = [0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba, 0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6, 0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33, 0xd258b060, 0x72766564];
const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const SHA256_ADJUSTMENT = 0xc9dc06a7;
const SHA256_BLOCK_CONSTANTS = [...SHA256_ROUND_CONSTANTS.slice(0, 14), SHA256_ADJUSTMENT, ...SHA256_ROUND_CONSTANTS.slice(15)];
const SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80;
const SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0;
const CS64_COEFFICIENTS: [number, number][] = [
  [0xe82e91b1, 0xb32700d0], [0x44de24c6, 0x88dff51d], [0x3beb65bc, 0x29514038], [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5], [0x314ef5d5, 0x26e55f3c], [0xe92491b1, 0x607801c6], [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da], [0xda79fa60, 0x207cc464], [0xbed20560, 0x3c3c74f3], [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1], [0xcb49e3c6, 0xc5626167],
];
const CS64_FACTOR = 0x82893933;
const CS64_ADJUSTMENT0 = 0xf2f90b1a;
const CS64_ADJUSTMENT1 = 0x0b1a0000;

function u32(v: number): number { return v >>> 0; }
function mul32(a: number, b: number): number { return Math.imul(a, b) >>> 0; }
function rol16(v: number): number { v = v >>> 0; return ((v << 16) | (v >>> 16)) >>> 0; }
function rotr(v: number, n: number): number { v = v >>> 0; return ((v >>> n) | (v << (32 - n))) >>> 0; }
function sigma0(v: number): number { v = v >>> 0; return (rotr(v, 7) ^ rotr(v, 18) ^ (v >>> 3)) >>> 0; }
function sigma1(v: number): number { v = v >>> 0; return (rotr(v, 17) ^ rotr(v, 19) ^ (v >>> 10)) >>> 0; }

function expandSha256Schedule(words: number[], firstWord = 16): void {
  for (let i = firstWord; i < 64; i++) {
    words.push((sigma1(words[i - 2]) + words[i - 7] + sigma0(words[i - 15]) + words[i - 16]) >>> 0);
  }
}

function sha256Rounds(state: number[], words: number[], firstRound = 0): number[] {
  let [a, b, c, d, e, f, g, h] = state.map(u32);
  const constants = firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS;
  for (let i = firstRound; i < 64; i++) {
    const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
    const ch = (g ^ (e & (f ^ g))) >>> 0;
    const t1 = (h + S1 + ch + constants[i] + words[i]) >>> 0;
    const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
    const maj = ((a & b) | (c & (a | b))) >>> 0;
    const t2 = (S0 + maj) >>> 0;
    h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
  }
  return [a, b, c, d, e, f, g, h];
}

function sha256Init(data7: Uint8Array): number[] {
  const words = new Array<number>(14).fill(0);
  words.push(((data7[0] << 16) | (data7[1] << 8) | data7[2]) >>> 0);
  words.push(((data7[3] << 24) | (data7[4] << 16) | (data7[5] << 8) | data7[6]) >>> 0);
  for (let i = 16; i < 30; i++) {
    let value = SHA256_SCHEDULE[i - 16];
    if (i - 2 >= 14) value = (value + (i === 16 ? (sigma1(words[i - 2]) ^ SHA256_SIGMA1_ADJUSTMENT) : sigma1(words[i - 2]))) >>> 0;
    if (i - 7 >= 14) value = (value + words[i - 7]) >>> 0;
    if (i - 15 >= 14) value = (value + (i === 29 ? (sigma0(words[i - 15]) ^ SHA256_SIGMA0_ADJUSTMENT) : sigma0(words[i - 15]))) >>> 0;
    words.push(value >>> 0);
  }
  words.push((sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + SHA256_ADJUSTMENT - SHA256_ROUND_CONSTANTS[14]) >>> 0);
  expandSha256Schedule(words, 31);
  const working = sha256Rounds(SHA256_STATE, words, 14);
  return SHA256_INITIAL.map((x, idx) => (x + working[idx]) >>> 0);
}

function sha256Digest(dataBytes: Uint8Array): Uint8Array {
  const length = 57 + dataBytes.length;
  const tail = dataBytes.subarray(7);
  const padZeroCount = (55 - (length % 64) + 64) % 64;
  const padded = new Uint8Array(tail.length + 1 + padZeroCount + 8);
  padded.set(tail, 0);
  padded[tail.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setBigUint64(padded.length - 8, BigInt(length) * 8n, false);
  let state = sha256Init(dataBytes.subarray(0, 7));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words: number[] = [];
    for (let j = 0; j < 16; j++) words.push(dv.getUint32(offset + j * 4, false));
    expandSha256Schedule(words, 16);
    const working = sha256Rounds(state, words, 0);
    state = state.map((x, idx) => (x + working[idx]) >>> 0);
  }
  const out = new Uint8Array(32);
  const outDv = new DataView(out.buffer);
  state.forEach((w, idx) => outDv.setUint32(idx * 4, w, false));
  return out;
}

function cs64Digest(dataBytes: Uint8Array, digestBytes: Uint8Array): [number, number] {
  const digestDv = new DataView(digestBytes.buffer, digestBytes.byteOffset, digestBytes.byteLength);
  const keyA = (digestDv.getUint32(0, true) | 1) >>> 0;
  const keyB = (digestDv.getUint32(4, true) | 1) >>> 0;
  const factors = [mul32(keyA, CS64_FACTOR), mul32(keyB, CS64_FACTOR)];
  const terms = CS64_COEFFICIENTS.map(([coeff], idx) => mul32(coeff, factors[idx % 2]));
  const offsets = CS64_COEFFICIENTS.map(([, off]) => off >>> 0);
  const prefixed = new Uint8Array(1 + dataBytes.length);
  prefixed.set(dataBytes, 1);
  const padLen = (4 - (prefixed.length % 4)) % 4;
  const padded = new Uint8Array(prefixed.length + padLen);
  padded.set(prefixed, 0);
  const dv = new DataView(padded.buffer);
  const leWords: number[] = [];
  for (let i = 0; i < padded.length; i += 4) leWords.push(dv.getUint32(i, true));
  if (leWords.length % 2 !== 0) leWords.push(0);
  for (let idx = 0; idx < leWords.length; idx++) {
    const word = leWords[idx];
    let term = mul32(word, idx % 2 === 0 ? keyA : keyB);
    let offset = mul32(rol16(word), idx % 2 === 0 ? 0xef0569fb : 0xc31713db);
    if (idx === 0) {
      term = (term + mul32(CS64_ADJUSTMENT0, factors[0])) >>> 0;
      offset = (offset + CS64_ADJUSTMENT1) >>> 0;
    }
    terms.push(term);
    offsets.push(offset);
  }
  let swapAcc = 0, swapLast = 0, state = 0, acc = 0;
  for (let idx = 0; idx < terms.length; idx += 2) {
    const x = terms[idx], y = terms[idx + 1];
    let t = rol16((offsets[idx] + x) >>> 0);
    let q = mul32(t, 0x76f50f34);
    swapAcc = (swapAcc + ((mul32(rol16(q), 0xc3efea97) + q) >>> 0)) >>> 0;
    t = rol16((offsets[idx + 1] + y) >>> 0);
    q = mul32(t, 0x1881ce3c);
    swapLast = (mul32(rol16(q), 0x35bd1ec9) + q) >>> 0;
    swapAcc = (swapAcc + swapLast) >>> 0;
    state = (mul32(state, keyA) + x) >>> 0;
    state = mul32(rol16(state), 0xcf98b111);
    state = mul32(rol16(state), 0x87085b9f);
    state = mul32(rol16(state), 0x12ceb96d);
    state = mul32(rol16(state), 0x257e1d83);
    acc = (acc + state) >>> 0;
    t = (mul32(state, keyB) + y) >>> 0;
    t = mul32(rol16(t), 0xa27416f5);
    t = mul32(rol16(t), 0xd38396ff);
    state = mul32(rol16(mul32(rol16(t), 0x7c932b89)), 0xbfa49f69);
    acc = (acc + state) >>> 0;
  }
  return [(swapLast ^ state) >>> 0, (swapAcc ^ acc) >>> 0];
}

function generateSecMsGecV2(unixTimestampSec: number): string {
  let ticks = unixTimestampSec + WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= 1e7;
  const strToHash = `${ticks.toFixed(0)}${EDGE_TRUSTED_CLIENT_TOKEN}`;
  const dataBytes = new TextEncoder().encode(strToHash);
  const digest = sha256Digest(dataBytes);
  const [cs0, cs1] = cs64Digest(dataBytes, digest);
  const csBuf = new Uint8Array(8);
  const csDv = new DataView(csBuf.buffer);
  csDv.setUint32(0, cs0, true);
  csDv.setUint32(4, cs1, true);
  const csHex = Array.from(csBuf).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const shaHex = Array.from(digest).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${csHex}-${shaHex}`;
}

function encodeWsTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  const maskKey = crypto.randomBytes(4);
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(6);
    header[0] = 0x81;
    header[1] = 0x80 | len;
    maskKey.copy(header, 2);
  } else if (len < 65536) {
    header = Buffer.alloc(8);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
    maskKey.copy(header, 4);
  } else {
    header = Buffer.alloc(14);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
    maskKey.copy(header, 10);
  }
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ maskKey[i % 4];
  return Buffer.concat([header, masked]);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function synthesizeEdgeMp3(
  text: string,
  voice = 'vi-VN-HoaiMyNeural',
  rateMultiplier = 1.0,
  pitchMultiplier = 1.0,
  volumeMultiplier = 1.0
): Promise<Buffer> {
  let serverEpochSec = Math.floor(Date.now() / 1000);
  try {
    const bingRes = await fetch('https://www.bing.com', { method: 'HEAD' });
    const dateHeader = bingRes.headers.get('date');
    if (dateHeader) serverEpochSec = Math.floor(new Date(dateHeader).getTime() / 1000);
  } catch {
    // Use local clock
  }

  const secMsGec = generateSecMsGecV2(serverEpochSec);
  const connectId = crypto.randomUUID().replace(/-/g, '');
  const muid = crypto.randomBytes(16).toString('hex').toUpperCase();
  const path = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${EDGE_SEC_MS_GEC_VERSION}&ConnectionId=${connectId}`;

  const ratePct = Math.round((rateMultiplier - 1.0) * 100);
  const rateStr = `${ratePct >= 0 ? '+' : ''}${ratePct}%`;
  const pitchHz = Math.round((pitchMultiplier - 1.0) * 50);
  const pitchStr = `${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz`;
  const volPct = Math.round((volumeMultiplier - 1.0) * 100);
  const volStr = `${volPct >= 0 ? '+' : ''}${volPct}%`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'speech.platform.bing.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13',
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        Cookie: `muid=${muid};`,
      },
    });

    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Edge TTS timeout (15s)'));
    }, 15000);

    req.on('upgrade', (_res, socket, head) => {
      const audioChunks: Buffer[] = [];
      let recvBuf = head && head.length ? Buffer.from(head) : Buffer.alloc(0);

      const configMsg = `X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
      socket.write(encodeWsTextFrame(configMsg));

      const reqId = crypto.randomUUID().replace(/-/g, '');
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'><voice name='${escapeXml(voice)}'><prosody pitch='${pitchStr}' rate='${rateStr}' volume='${volStr}'>${escapeXml(text)}</prosody></voice></speak>`;
      const ssmlMsg = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toString()}Z\r\nPath:ssml\r\n\r\n${ssml}`;
      socket.write(encodeWsTextFrame(ssmlMsg));

      socket.on('data', (chunk: Buffer) => {
        recvBuf = Buffer.concat([recvBuf, chunk]);
        while (recvBuf.length >= 2) {
          const byte0 = recvBuf[0];
          const byte1 = recvBuf[1];
          const opcode = byte0 & 0x0f;
          const isMasked = (byte1 & 0x80) !== 0;
          let payloadLen = byte1 & 0x7f;
          let offset = 2;
          if (payloadLen === 126) {
            if (recvBuf.length < 4) return;
            payloadLen = recvBuf.readUInt16BE(2);
            offset = 4;
          } else if (payloadLen === 127) {
            if (recvBuf.length < 10) return;
            payloadLen = Number(recvBuf.readBigUInt64BE(2));
            offset = 10;
          }
          if (isMasked) offset += 4;
          if (recvBuf.length < offset + payloadLen) return;
          const frameData = recvBuf.subarray(offset, offset + payloadLen);
          recvBuf = recvBuf.subarray(offset + payloadLen);

          if (opcode === 0x01) {
            const str = frameData.toString('utf8');
            if (str.includes('Path:turn.end')) {
              clearTimeout(timeout);
              socket.destroy();
              resolve(Buffer.concat(audioChunks));
              return;
            }
          } else if (opcode === 0x02) {
            if (frameData.length >= 2) {
              const headerLen = frameData.readUInt16BE(0);
              const headerStr = frameData.subarray(2, 2 + headerLen).toString('utf8');
              if (headerStr.includes('Path:audio')) {
                audioChunks.push(Buffer.from(frameData.subarray(2 + headerLen)));
              }
            }
          } else if (opcode === 0x08) {
            clearTimeout(timeout);
            socket.destroy();
            resolve(Buffer.concat(audioChunks));
            return;
          }
        }
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    req.on('response', (res) => {
      clearTimeout(timeout);
      reject(new Error(`Edge TTS HTTP ${res.statusCode}`));
    });
    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    req.end();
  });
}

// ============================================================================
// 2. CAPCUT / BYTEDANCE SAMI TTS (v1 Token + WebSocket WAV)
// ============================================================================
let cachedCapCutServerToken: { token: string; appKey: string; expiresAt: number } | null = null;

async function getCapCutServerToken(): Promise<{ token: string; appKey: string }> {
  if (cachedCapCutServerToken && Date.now() < cachedCapCutServerToken.expiresAt) {
    return cachedCapCutServerToken;
  }
  const url = 'https://edit-api-sg.capcut.com/lv/v1/common/tts/token';
  const deviceTime = Math.floor(Date.now() / 1000).toString();
  const raw = `9e2c|s/token|7|5.8.0|${deviceTime}||11ac`;
  const sign = crypto.createHash('md5').update(raw).digest('hex').toLowerCase();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Appvr: '5.8.0',
      'Device-Time': deviceTime,
      Origin: 'https://www.capcut.com',
      Pf: '7',
      Sign: sign,
      'Sign-Ver': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  const json = (await res.json()) as { data?: { token?: string; app_key?: string } };
  if (!json?.data?.token || !json?.data?.app_key) {
    throw new Error('Không lấy được token từ máy chủ CapCut');
  }
  cachedCapCutServerToken = {
    token: json.data.token,
    appKey: json.data.app_key,
    expiresAt: Date.now() + 5 * 3600 * 1000,
  };
  return cachedCapCutServerToken;
}

async function synthesizeCapCutWav(
  text: string,
  speaker = 'BV074_streaming',
  speed = 10,
  pitch = 10,
  volume = 10
): Promise<Buffer> {
  const { token, appKey } = await getCapCutServerToken();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'sami-sg1.byteintlapi.com',
      port: 443,
      path: '/internal/api/v1/ws',
      method: 'GET',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('CapCut TTS timeout (15s)'));
    }, 15000);

    req.on('upgrade', (_res, socket, head) => {
      const audioChunks: Buffer[] = [];
      let recvBuf = head && head.length ? Buffer.from(head) : Buffer.alloc(0);

      const startMsg = JSON.stringify({
        token,
        appkey: appKey,
        namespace: 'TTS',
        event: 'StartTask',
        payload: JSON.stringify({
          text,
          speaker,
          pitch: Math.round(pitch),
          speed: Math.round(speed),
          volume: Math.round(volume),
          rate: 24000,
          appid: '348188',
        }),
      });
      socket.write(encodeWsTextFrame(startMsg));

      socket.on('data', (chunk: Buffer) => {
        recvBuf = Buffer.concat([recvBuf, chunk]);
        while (recvBuf.length >= 2) {
          const byte0 = recvBuf[0];
          const byte1 = recvBuf[1];
          const opcode = byte0 & 0x0f;
          const isMasked = (byte1 & 0x80) !== 0;
          let payloadLen = byte1 & 0x7f;
          let offset = 2;
          if (payloadLen === 126) {
            if (recvBuf.length < 4) return;
            payloadLen = recvBuf.readUInt16BE(2);
            offset = 4;
          } else if (payloadLen === 127) {
            if (recvBuf.length < 10) return;
            payloadLen = Number(recvBuf.readBigUInt64BE(2));
            offset = 10;
          }
          if (isMasked) offset += 4;
          if (recvBuf.length < offset + payloadLen) return;
          const frameData = recvBuf.subarray(offset, offset + payloadLen);
          recvBuf = recvBuf.subarray(offset + payloadLen);

          if (opcode === 0x01 || opcode === 0x02) {
            const isJsonLike = frameData.length > 0 && frameData[0] === 0x7b;
            if (opcode === 0x01 || isJsonLike) {
              try {
                const parsed = JSON.parse(frameData.toString('utf8')) as {
                  event?: string;
                  status_code?: number;
                  status_text?: string;
                };
                if (parsed.event === 'TaskFinished') {
                  clearTimeout(timeout);
                  socket.destroy();
                  resolve(Buffer.concat(audioChunks));
                  return;
                } else if (parsed.event === 'TaskFailed' || (parsed.status_code && parsed.status_code !== 20000000)) {
                  clearTimeout(timeout);
                  socket.destroy();
                  reject(new Error(`CapCut lỗi: ${parsed.status_text || parsed.status_code}`));
                  return;
                }
                continue;
              } catch {
                // Binary audio chunk
              }
            }
            audioChunks.push(Buffer.from(frameData));
          } else if (opcode === 0x08) {
            clearTimeout(timeout);
            socket.destroy();
            resolve(Buffer.concat(audioChunks));
            return;
          }
        }
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    req.on('response', (res) => {
      clearTimeout(timeout);
      reject(new Error(`CapCut WS HTTP ${res.statusCode}`));
    });
    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    req.end();
  });
}

// ============================================================================
// 3. GOOGLE TRANSLATE UNOFFICIAL TTS (gTTS chunking + multi-part MP3 join)
// ============================================================================
function splitTextForGoogle(text: string, maxLength = 180): string[] {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return [];
  if (clean.length <= maxLength) return [clean];
  const chunks: string[] = [];
  const sentences = clean.split(/(?<=[.!?;,\n])\s+/);
  let current = '';
  for (const seg of sentences) {
    if ((current ? current.length + 1 + seg.length : seg.length) <= maxLength) {
      current = current ? `${current} ${seg}` : seg;
    } else {
      if (current) chunks.push(current);
      current = seg.slice(0, maxLength);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function synthesizeGoogleMp3(text: string, rate = 1.0): Promise<Buffer> {
  const chunks = splitTextForGoogle(text, 180);
  const buffers: Buffer[] = [];
  const speedParam = rate < 0.85 ? '0.3' : '1';
  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&ttsspeed=${speedParam}&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!res.ok) throw new Error(`Google TTS trả về HTTP ${res.status}`);
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  return Buffer.concat(buffers);
}

// ============================================================================
// 4. OPENAI.FM / TTSFM (with seamless Edge Neural fallback on bot challenge)
// ============================================================================
async function synthesizeOpenAIFm(params: {
  text: string;
  voice?: string;
  prompt?: string;
  apiKey?: string;
  endpoint?: string;
  rate?: number;
}): Promise<{ buffer: Buffer; fallbackUsed?: string }> {
  const targetEndpoint = (params.endpoint || 'https://www.openai.fm/api/generate').trim();
  const voice = params.voice || 'nova';

  // Trường hợp người dùng cấu hình OpenAI-compatible /v1/audio/speech (Docker ttsfm hoặc OpenAI chính thức)
  if (targetEndpoint.includes('/v1/audio/speech')) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (params.apiKey) headers['Authorization'] = `Bearer ${params.apiKey}`;
    const res = await fetch(targetEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: params.text,
        voice,
        instructions: params.prompt,
        response_format: 'mp3',
        speed: params.rate || 1.0,
      }),
    });
    if (res.ok) {
      return { buffer: Buffer.from(await res.arrayBuffer()) };
    }
  } else {
    // Gọi trực tiếp https://www.openai.fm/api/generate (chuẩn dbccccccc/ttsfm)
    const form = new URLSearchParams();
    form.append('input', params.text);
    form.append('voice', voice);
    form.append('generation', crypto.randomUUID());
    form.append('response_format', 'mp3');
    if (params.prompt) form.append('prompt', params.prompt);

    const res = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    if (res.ok) {
      return { buffer: Buffer.from(await res.arrayBuffer()) };
    }
  }

  // Khi www.openai.fm bật Vercel Bot Challenge (429), tự động chuyển sang Edge Neural TTS tương đương
  const maleVoices = new Set(['echo', 'onyx', 'ash', 'verse']);
  const mappedEdgeVoice = maleVoices.has(voice) ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural';
  const fallbackBuffer = await synthesizeEdgeMp3(params.text, mappedEdgeVoice, params.rate ?? 1.0, 1.0, 1.0);
  return { buffer: fallbackBuffer, fallbackUsed: mappedEdgeVoice };
}

// ============================================================================
// VITE SERVER MIDDLEWARE FOR /api/tts-proxy
// ============================================================================
function createTtsReverseProxyPlugin(): Plugin {
  const handleMiddleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url || !req.url.startsWith('/api/tts-proxy')) {
      next();
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const bodyRaw = Buffer.concat(chunks).toString('utf8');
        const body = bodyRaw ? JSON.parse(bodyRaw) : {};
        const provider = String(body.provider || 'edge').toLowerCase();
        const text = String(body.text || '').trim();
        if (!text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Thiếu văn bản cần đọc (text)' }));
          return;
        }

        if (provider === 'edge') {
          const mp3 = await synthesizeEdgeMp3(
            text,
            body.voice || 'vi-VN-HoaiMyNeural',
            Number(body.rate ?? 1.0),
            Number(body.pitch ?? 1.0),
            Number(body.volume ?? 1.0)
          );
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': String(mp3.length),
            'Access-Control-Allow-Origin': '*',
          });
          res.end(mp3);
          return;
        }

        if (provider === 'capcut') {
          const wav = await synthesizeCapCutWav(
            text,
            body.voice || 'BV074_streaming',
            Number(body.rate ?? 10),
            Number(body.pitch ?? 10),
            Math.round(Number(body.volume ?? 1.0) * 10)
          );
          res.writeHead(200, {
            'Content-Type': 'audio/wav',
            'Content-Length': String(wav.length),
            'Access-Control-Allow-Origin': '*',
          });
          res.end(wav);
          return;
        }

        if (provider === 'openaifm') {
          const { buffer, fallbackUsed } = await synthesizeOpenAIFm({
            text,
            voice: body.voice,
            prompt: body.prompt,
            apiKey: body.apiKey,
            endpoint: body.endpoint,
            rate: Number(body.rate ?? 1.0),
          });
          const headers: Record<string, string> = {
            'Content-Type': 'audio/mpeg',
            'Content-Length': String(buffer.length),
            'Access-Control-Allow-Origin': '*',
          };
          if (fallbackUsed) headers['X-TTS-Fallback'] = fallbackUsed;
          res.writeHead(200, headers);
          res.end(buffer);
          return;
        }

        if (provider === 'google') {
          const mp3 = await synthesizeGoogleMp3(text, Number(body.rate ?? 1.0));
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': String(mp3.length),
            'Access-Control-Allow-Origin': '*',
          });
          res.end(mp3);
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Provider không hợp lệ: ${provider}` }));
      } catch (err: any) {
        res.writeHead(502, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ success: false, error: err?.message || 'Lỗi xử lý TTS Proxy' }));
      }
    });
  };

  return {
    name: 'kg-tool-tts-reverse-proxy',
    configureServer(server) {
      server.middlewares.use(handleMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleMiddleware);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), createTtsReverseProxyPlugin()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('exceljs')) return 'vendor-excel';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
            if (id.includes('jszip') || id.includes('papaparse')) return 'vendor-data';
            if (id.includes('lucide-react')) return 'vendor-icons';
          }
        },
      },
    },
  },
});
