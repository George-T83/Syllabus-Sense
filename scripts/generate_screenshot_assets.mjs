import fs from 'fs';
import path from 'path';

export function createSvgMockup({ title, subtitle, width = 1440, height = 900, mode = 'desktop', badge = 'FEATURE', details = [] }) {
  const isMobile = mode === 'mobile';
  const w = isMobile ? 375 : 1440;
  const h = isMobile ? 812 : 900;

  const detailRows = details.map((d, i) => `
    <g transform="translate(${isMobile ? 24 : 60}, ${isMobile ? 220 + i * 70 : 280 + i * 85})">
      <rect width="${isMobile ? 327 : 640}" height="${isMobile ? 58 : 72}" rx="12" fill="#1e293b" fill-opacity="0.7" stroke="#334155" stroke-width="1"/>
      <circle cx="28" cy="${isMobile ? 29 : 36}" r="12" fill="#0ea5e9" fill-opacity="0.2"/>
      <text x="28" y="${isMobile ? 34 : 41}" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#38bdf8" text-anchor="middle" font-weight="bold">${i + 1}</text>
      <text x="56" y="${isMobile ? 26 : 32}" font-family="system-ui, -apple-system, sans-serif" font-size="${isMobile ? 13 : 15}" font-weight="600" fill="#f8fafc">${d.label}</text>
      <text x="56" y="${isMobile ? 44 : 52}" font-family="system-ui, -apple-system, sans-serif" font-size="${isMobile ? 11 : 13}" fill="#94a3b8">${d.value}</text>
      ${d.status ? `
        <rect x="${(isMobile ? 327 : 640) - (isMobile ? 80 : 100)}" y="${isMobile ? 18 : 22}" width="${isMobile ? 68 : 84}" height="24" rx="6" fill="#10b981" fill-opacity="0.2"/>
        <text x="${(isMobile ? 327 : 640) - (isMobile ? 46 : 58)}" y="${isMobile ? 34 : 38}" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="bold" fill="#34d399" text-anchor="middle">${d.status}</text>
      ` : ''}
    </g>
  `).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="15" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#bg)"/>

  <!-- Top Navigation Header -->
  <rect x="0" y="0" width="${w}" height="${isMobile ? 60 : 72}" fill="#0f172a" fill-opacity="0.9" stroke="#1e293b" stroke-width="1"/>
  <circle cx="${isMobile ? 28 : 48}" cy="${isMobile ? 30 : 36}" r="14" fill="#0ea5e9"/>
  <text x="${isMobile ? 50 : 74}" y="${isMobile ? 35 : 42}" font-family="system-ui, -apple-system, sans-serif" font-size="${isMobile ? 15 : 18}" font-weight="bold" fill="#ffffff">Syllabus Sense</text>
  <rect x="${w - (isMobile ? 80 : 120)}" y="${isMobile ? 18 : 22}" width="${isMobile ? 64 : 96}" height="${isMobile ? 26 : 30}" rx="6" fill="#0ea5e9" fill-opacity="0.2" stroke="#0ea5e9" stroke-width="1"/>
  <text x="${w - (isMobile ? 48 : 72)}" y="${isMobile ? 35 : 42}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" fill="#38bdf8" text-anchor="middle">${badge}</text>

  <!-- Title & Subtitle Section -->
  <g transform="translate(${isMobile ? 24 : 60}, ${isMobile ? 85 : 110})">
    <text x="0" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="${isMobile ? 20 : 28}" font-weight="bold" fill="#f8fafc">${title}</text>
    <text x="0" y="${isMobile ? 55 : 62}" font-family="system-ui, -apple-system, sans-serif" font-size="${isMobile ? 12 : 14}" fill="#94a3b8">${subtitle}</text>
  </g>

  <!-- Hero Card / Modal Overlay -->
  <rect x="${isMobile ? 16 : 40}" y="${isMobile ? 165 : 200}" width="${isMobile ? 343 : 1360}" height="${isMobile ? 625 : 660}" rx="16" fill="url(#cardGrad)" stroke="#334155" stroke-width="1"/>

  <!-- Detail Content Rows -->
  ${detailRows}
</svg>`;
}
