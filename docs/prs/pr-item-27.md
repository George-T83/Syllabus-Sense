# Pull Request: Item 27 — Root Layout PWA Viewport, Dynamic Theme-Color & iOS Touch-Icon Metadata

**Branch**: `item-27-pwa-root-layout-meta-theme-color` → `overnight/2026-08-24`
**Category**: PWA & Mobile Shell Integration

## 5-Role Perspective Write-up

- **Student**: Experiences a true mobile application feel on iOS Safari and Android Chrome, with full-bleed status bars (`black-translucent`), dynamic dark/light status bar theming that automatically responds to OS daylight and dark mode preferences, and high-resolution apple-touch-icons on the home screen.
- **UX**: Eliminates white flash during dark theme startup, aligns viewport scaling limits (`userScalable: true`, `maximumScale: 5`) for accessibility while guaranteeing zero horizontal page drift, and connects the browser theme-color meta tag dynamically across both color schemes (`#FFFFFF` light / `#090D16` dark).
- **PM**: Fortifies the progressive web application shell to match native app store quality benchmarks, improving student engagement, mobile retention, and cross-platform installation rates.
- **PO**: Satisfies Next.js 14 App Router standards by separating `viewport` and `metadata` exports in `src/app/layout.tsx`, ensuring 100% compliance with modern W3C PWA and Apple Web Clip specifications.
- **Dev**: Upgraded `src/app/layout.tsx` to export typed `Viewport` and `Metadata` configurations with `appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Syllabus Sense' }`, linked `/manifest.webmanifest`, disabled unwanted telephone auto-detection, and authored automated contract tests in `src/lib/__tests__/layoutMetadata.test.ts`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 type errors
- `npm test src/lib/__tests__/layoutMetadata.test.ts`: 3/3 tests passed
- `npm test`: All tests passed
