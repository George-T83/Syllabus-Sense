const http = require('http');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

http.get('http://127.0.0.1:9222/json/list', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', async () => {
    const list = JSON.parse(body);
    const page = list.find(p => p.type === 'page' && p.url.includes('localhost'));
    if (!page) {
      console.error('No localhost page found');
      return;
    }
    console.log('Target page found:', page.url);
    await captureAll(page.webSocketDebuggerUrl);
  });
});

function connectWS(wsUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const socket = net.connect(url.port, url.hostname, () => {
      const headers = [
        `GET ${url.pathname} HTTP/1.1`,
        `Host: ${url.hostname}:${url.port}`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${key}`,
        `Sec-WebSocket-Version: 13`,
        `\r\n`
      ].join('\r\n');
      socket.write(headers);
    });

    let buffer = Buffer.alloc(0);
    let handshakeDone = false;

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!handshakeDone) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          handshakeDone = true;
          buffer = buffer.slice(headerEnd + 4);
          resolve(socket);
        }
      }
    });
    socket.on('error', reject);
  });
}

function sendFrame(socket, data) {
  const payload = Buffer.from(JSON.stringify(data));
  const len = payload.length;
  let header;
  const mask = crypto.randomBytes(4);

  if (len < 126) {
    header = Buffer.from([0x81, 0x80 | len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  const maskedPayload = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    maskedPayload[i] = payload[i] ^ mask[i % 4];
  }

  socket.write(Buffer.concat([header, mask, maskedPayload]));
}

function readFrame(socket) {
  return new Promise((resolve) => {
    let buf = Buffer.alloc(0);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length < 2) return;

      const lenByte = buf[1] & 0x7f;
      let headerLen = 2;
      let dataLen = lenByte;

      if (lenByte === 126) {
        if (buf.length < 4) return;
        dataLen = buf.readUInt16BE(2);
        headerLen = 4;
      } else if (lenByte === 127) {
        if (buf.length < 10) return;
        dataLen = Number(buf.readBigUInt64BE(2));
        headerLen = 10;
      }

      if (buf.length >= headerLen + dataLen) {
        const frameData = buf.slice(headerLen, headerLen + dataLen);
        socket.removeListener('data', onData);
        resolve(JSON.parse(frameData.toString('utf8')));
      }
    };
    socket.on('data', onData);
  });
}

async function captureAll(wsUrl) {
  const socket = await connectWS(wsUrl);

  const targets = [
    { name: 'item-34-command-palette', path: '/dashboard', script: 'window.dispatchEvent(new KeyboardEvent("keydown", {key:"k", metaKey:true, bubbles:true}))' },
    { name: 'item-35-syllabus-chat-copilot', path: '/dashboard' },
    { name: 'item-36-what-if-grade-simulator', path: '/courses' },
    { name: 'item-37-weekly-workload-radar', path: '/dashboard' },
    { name: 'item-43-extracurricular-tracker', path: '/planner' },
    { name: 'item-44-quick-join-class-hero', path: '/dashboard' },
    { name: 'item-45-vcard-qr-generator', path: '/contacts' },
    { name: 'item-46-syllabus-diff-modal', path: '/courses' },
    { name: 'item-47-semester-gpa-goal-radial', path: '/profile' },
    { name: 'item-48-attendance-policy-gauge', path: '/courses' },
    { name: 'item-49-late-penalty-advisor', path: '/tasks' },
  ];

  const docsDir = path.join(__dirname, '../docs/screenshots');
  const artifactDir = 'C:\\Users\\georg\\.gemini\\antigravity\\brain\\dd89f5ff-ff76-48ee-a299-4f4111169b3b\\screenshots';

  let reqId = 1;

  for (const t of targets) {
    // Navigate
    sendFrame(socket, { id: reqId++, method: 'Page.navigate', params: { url: `http://localhost:3000${t.path}` } });
    await new Promise(r => setTimeout(r, 800));

    if (t.script) {
      sendFrame(socket, { id: reqId++, method: 'Runtime.evaluate', params: { expression: t.script } });
      await new Promise(r => setTimeout(r, 400));
    }

    for (const isMobile of [false, true]) {
      const mode = isMobile ? 'mobile-375' : 'desktop-1440';
      const width = isMobile ? 375 : 1440;
      const height = isMobile ? 812 : 900;
      const fileName = `${t.name}-${mode}.png`;

      sendFrame(socket, {
        id: reqId++,
        method: 'Emulation.setDeviceMetricsOverride',
        params: { width, height, deviceScaleFactor: 1, mobile: isMobile }
      });
      await new Promise(r => setTimeout(r, 400));

      const curId = reqId++;
      sendFrame(socket, { id: curId, method: 'Page.captureScreenshot', params: { format: 'png' } });
      const res = await readFrame(socket);

      if (res.result && res.result.data) {
        const imgBuffer = Buffer.from(res.result.data, 'base64');
        const docPath = path.join(docsDir, fileName);
        const artPath = path.join(artifactDir, fileName);

        fs.mkdirSync(docsDir, { recursive: true });
        fs.mkdirSync(artifactDir, { recursive: true });

        fs.writeFileSync(docPath, imgBuffer);
        fs.writeFileSync(artPath, imgBuffer);
        console.log(`Captured live screenshot: ${fileName} (${imgBuffer.length} bytes)`);
      }
    }
  }

  socket.destroy();
  console.log('Finished capturing all fresh live screenshots!');
}
