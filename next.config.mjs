// Firebase Auth/Firestore/Storage need their real hosts reachable from the
// browser (popup sign-in, realtime Firestore listeners over websockets,
// direct-to-Storage uploads) - the app has no external fonts, analytics, or
// third-party scripts (confirmed: everything is self-hosted via next/font),
// so the allowlist below is deliberately narrow to just those.
//
// Dev-only relaxations (never shipped to production, gated on NODE_ENV):
// - 'unsafe-eval' - `next dev`'s webpack build evaluates chunks via eval()
//   for its default eval-source-map devtool; without this every page fails
//   to run any JS at all under this CSP in dev.
// - localhost/127.0.0.1 in connect-src - the Firebase Local Emulator Suite
//   (NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true) talks to the Auth/Firestore
//   emulators over plain http/ws on localhost, which the production
//   connect-src list has no reason to allow.
const isDev = process.env.NODE_ENV !== 'production';

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self' https://*.googleapis.com https://*.google.com https://*.firebaseio.com wss://*.firebaseio.com https://*.gstatic.com${
    isDev ? ' http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*' : ''
  }`,
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;

