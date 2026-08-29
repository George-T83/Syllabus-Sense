const http = require('http');
const net = require('net');
const crypto = require('crypto');

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
    console.log('Target Chrome page found:', page.url);
    await debugPage(page.webSocketDebuggerUrl);
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

let reqId = 1;
function sendCommand(socket, method, params = {}) {
  const id = reqId++;
  const payload = Buffer.from(JSON.stringify({ id, method, params }));
  const len = payload.length;
  const mask = crypto.randomBytes(4);
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, 0x80 | len]);
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  }
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    masked[i] = payload[i] ^ mask[i % 4];
  }
  socket.write(Buffer.concat([header, mask, masked]));
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
      }
      if (buf.length >= headerLen + dataLen) {
        const frameData = buf.slice(headerLen, headerLen + dataLen);
        try {
          const parsed = JSON.parse(frameData.toString('utf8'));
          if (parsed.id === id) {
            socket.removeListener('data', onData);
            resolve(parsed);
          }
        } catch {}
      }
    };
    socket.on('data', onData);
  });
}

async function debugPage(wsUrl) {
  const socket = await connectWS(wsUrl);

  // Enable Console
  await sendCommand(socket, 'Console.enable');
  await sendCommand(socket, 'Runtime.enable');

  socket.on('data', (chunk) => {
    // Look for console messages
    try {
      // frames can have multiple websocket data messages, ignore parsing failures
      const str = chunk.toString('utf8');
      if (str.includes('Console.messageAdded')) {
        console.log('BROWSER LOG:', str);
      }
    } catch {}
  });

  console.log('Navigating to http://localhost:3000/dashboard?mock=true');
  await sendCommand(socket, 'Page.navigate', { url: 'http://localhost:3000/dashboard?mock=true' });
  await new Promise(r => setTimeout(r, 4000));

  const url = await sendCommand(socket, 'Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
  console.log('Current Browser URL:', url.result.result.value);

  const html = await sendCommand(socket, 'Runtime.evaluate', { expression: 'document.body.innerHTML', returnByValue: true });
  console.log('Length of body HTML:', html.result.result.value.length);
  console.log('Body HTML preview (first 1000 chars):', html.result.result.value.substring(0, 1000));

  socket.destroy();
}
