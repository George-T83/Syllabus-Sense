// Quick script: navigate to dashboard, then dump the error toast HTML to identify it
const net = require('net');
const path = require('path');

async function getWsUrl() {
  const res = await fetch('http://localhost:9222/json');
  const targets = await res.json();
  const page = targets.find((t) => t.url && t.url.includes('localhost:3000')) || targets[0];
  if (!page) throw new Error('No Chrome page found');
  console.log('Found page:', page.url);
  return page.webSocketDebuggerUrl;
}

function connectWS(wsUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const socket = net.connect(parseInt(u.port), u.hostname);
    const key = Buffer.from(Math.random().toString()).toString('base64');
    const reqHeaders = [
      `GET ${u.pathname} HTTP/1.1`,
      `Host: ${u.host}`,
      `Upgrade: websocket`,
      `Connection: Upgrade`,
      `Sec-WebSocket-Key: ${key}`,
      `Sec-WebSocket-Version: 13`,
      '',
      '',
    ].join('\r\n');
    let resolved = false;
    let msgId = 1;
    const pending = new Map();
    const listeners = [];
    let buf = Buffer.alloc(0);
    let handshakeDone = false;

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!handshakeDone) {
        const end = buf.indexOf('\r\n\r\n');
        if (end !== -1) {
          handshakeDone = true;
          buf = buf.slice(end + 4);
          if (!resolved) { resolved = true; resolve({ send, on: addListener }); }
        }
        return;
      }
      while (buf.length > 2) {
        const b0 = buf[0], b1 = buf[1];
        const masked = (b1 & 0x80) !== 0;
        let payloadLen = b1 & 0x7f;
        let offset = 2;
        if (payloadLen === 126) { if (buf.length < 4) return; payloadLen = buf.readUInt16BE(2); offset = 4; }
        else if (payloadLen === 127) { if (buf.length < 10) return; payloadLen = Number(buf.readBigUInt64BE(2)); offset = 10; }
        const maskLen = masked ? 4 : 0;
        if (buf.length < offset + maskLen + payloadLen) return;
        const mask = masked ? buf.slice(offset, offset + 4) : null;
        offset += maskLen;
        let payload = buf.slice(offset, offset + payloadLen);
        if (masked) { for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]; }
        buf = buf.slice(offset + payloadLen);
        const opcode = b0 & 0xf;
        if (opcode === 1) {
          const msg = JSON.parse(payload.toString());
          if (msg.id && pending.has(msg.id)) { const cb = pending.get(msg.id); pending.delete(msg.id); cb(msg); }
          listeners.forEach(fn => fn(msg));
        }
      }
    });

    socket.on('error', reject);

    function send(method, params = {}) {
      return new Promise((res) => {
        const id = msgId++;
        pending.set(id, res);
        const data = JSON.stringify({ id, method, params });
        const frame = encodeFrame(data);
        socket.write(frame);
      });
    }

    function encodeFrame(data) {
      const payload = Buffer.from(data, 'utf8');
      const len = payload.length;
      const header = len < 126 ? Buffer.from([0x81, len]) :
        len < 65536 ? Buffer.from([0x81, 126, len >> 8, len & 0xff]) :
        (() => { const b = Buffer.alloc(10); b[0]=0x81; b[1]=127; b.writeBigUInt64BE(BigInt(len),2); return b; })();
      return Buffer.concat([header, payload]);
    }

    function addListener(fn) { listeners.push(fn); }
  });
}

async function main() {
  const wsUrl = await getWsUrl();
  const { send } = await connectWS(wsUrl);

  await send('Runtime.enable', {});
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard?mock=true' });
  await new Promise(r => setTimeout(r, 3000));

  // Inspect what the error toast looks like in the DOM
  const result = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      fixedEls: Array.from(document.querySelectorAll('[class*="fixed"]')).map(el => ({
        tag: el.tagName,
        cls: el.className.slice(0,80),
        text: el.innerText.slice(0,100)
      })),
      nextjsPortal: document.querySelector('nextjs-portal') ? 'FOUND' : 'not found',
      shadowHTML: (() => {
        const p = document.querySelector('nextjs-portal');
        return p && p.shadowRoot ? p.shadowRoot.innerHTML.slice(0, 800) : 'none';
      })()
    })`,
    returnByValue: true
  });

  const info = JSON.parse(result.result.result.value);
  console.log('\n=== Fixed elements ===');
  info.fixedEls.forEach(el => console.log(el));
  console.log('\n=== nextjs-portal ===', info.nextjsPortal);
  console.log('\n=== Shadow HTML ===\n', info.shadowHTML);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
