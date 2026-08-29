# Pull Request: Item 26 — Web App Manifest & PWA Icons Suite

**Branch**: `item-26-pwa-web-manifest-and-icons` → `overnight/2026-08-24`
**Category**: PWA & Offline Readiness

## 5-Role Perspective Write-up

- **Student**: Can install Syllabus Sense directly to mobile home screens (iOS/Android) or desktop OS dock/taskbar (macOS/Windows/ChromeOS) as a standalone progressive web app with custom app shortcuts (Dashboard, Tasks, Calendar, Courses) for instant one-tap access.
- **UX**: Standalone window mode (`display: 'standalone'`) eliminates browser address bar clutter, provides seamless immersion matching native application ergonomics, and applies brand-themed background (`#090D16`) and theme color (`#5B3DF5`) during app launch splash sequences.
- **PM**: Expands app adoption and retention by enabling zero-friction PWA installation without needing third-party app store gatekeepers, while providing instant app shortcut jump points to core daily workflows.
- **PO**: Satisfies Milestone 2 PWA criteria, providing both dynamic App Router `src/app/manifest.ts` MetadataRoute standard and static fallback `public/manifest.webmanifest`, paired with a complete suite of standard and maskable icons (16x16, 32x32, 180x180, 192x192, 512x512).
- **Dev**: Implemented Next.js 14 `MetadataRoute.Manifest` in `src/app/manifest.ts` alongside standard static `public/manifest.webmanifest`, created binary PNG generator `scripts/generate-pwa-icons.mjs` using pure Node.js buffer rasterization, and established automated asset existence verification tests in `src/lib/__tests__/manifest.test.ts`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 type errors
- `npm test src/lib/__tests__/manifest.test.ts`: 5/5 tests passed
- `npm test`: 36 test files passed, 301/301 tests passed
- `npm run build`: Production build verified
