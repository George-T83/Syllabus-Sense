import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getPages() {
  const res = await fetch('http://127.0.0.1:9222/json/list');
  return await res.json();
}

async function captureScreen(wsUrl, viewport, outputPath) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 1;

    ws.on('open', () => {
      // Set viewport
      ws.send(JSON.stringify({
        id: id++,
        method: 'Emulation.setDeviceMetricsOverride',
        params: {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: viewport.isMobile,
        }
      }));

      // Take screenshot
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: id++,
          method: 'Page.captureScreenshot',
          params: { format: 'png' }
        }));
      }, 800);
    });

    ws.on('message', (message) => {
      const data = JSON.parse(message);
      if (data.result && data.result.data) {
        const buffer = Buffer.from(data.result.data, 'base64');
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, buffer);
        console.log(`Captured real screenshot: ${outputPath} (${buffer.length} bytes)`);
        ws.close();
        resolve();
      }
    });

    ws.on('error', reject);
  });
}

async function run() {
  const pages = await getPages();
  const page = pages.find(p => p.type === 'page' && p.url.includes('localhost'));
  if (!page) {
    console.error('No localhost page found in Chrome');
    return;
  }

  const wsUrl = page.webSocketDebuggerUrl;
  console.log('Connecting to Chrome CDP:', wsUrl);

  const targets = [
    { name: 'item-34-command-palette', path: '/dashboard' },
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

  for (const t of targets) {
    // Desktop 1440
    const desktopFile = path.join(docsDir, `${t.name}-desktop-1440.png`);
    await captureScreen(wsUrl, { width: 1440, height: 900, isMobile: false }, desktopFile);
    fs.copyFileSync(desktopFile, path.join(artifactDir, `${t.name}-desktop-1440.png`));

    // Mobile 375
    const mobileFile = path.join(docsDir, `${t.name}-mobile-375.png`);
    await captureScreen(wsUrl, { width: 375, height: 812, isMobile: true }, mobileFile);
    fs.copyFileSync(mobileFile, path.join(artifactDir, `${t.name}-mobile-375.png`));
  }

  console.log('All real live app screenshots captured successfully!');
}

run().catch(console.error);
