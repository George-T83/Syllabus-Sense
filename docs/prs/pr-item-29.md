# Pull Request: Item 29 — Offline Network Status Banner & Background Sync Notice

**Branch**: `item-29-offline-network-status-banner` → `overnight/2026-08-24`
**Category**: Reliability & Resilience

## 5-Role Perspective Write-up

- **Student**: Stays confident and focused when studying in offline lecture halls, underground transit, or intermittent campus connections. The application clearly informs them that offline changes are safely stored on-device and will automatically synchronize upon reconnection.
- **UX**: Presents non-intrusive, sticky awareness banners: an accessible amber offline warning with a manual "Check Connection" button when offline, and a momentary emerald success banner with live sync indicators when network connectivity returns.
- **PM**: Eliminates student anxiety regarding data loss during network dropouts, boosting trust, daily active usage, and completion of offline task management.
- **PO**: Implements enterprise-grade offline UX conforming to WCAG 2.2 Live Region standards (`role="status"`, `aria-live="polite"`), integrating cleanly into the root `LayoutWrapper`.
- **Dev**: Authored `src/hooks/useOnlineStatus.ts` providing event-driven browser online/offline subscriptions and active endpoint health checks, built `src/components/layout/OfflineBanner.tsx`, and validated behavior across 6 tests in `src/hooks/__tests__/useOnlineStatus.test.ts` and `src/components/layout/__tests__/OfflineBanner.test.tsx`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 type errors
- `npm test src/hooks/__tests__/useOnlineStatus.test.ts src/components/layout/__tests__/OfflineBanner.test.tsx`: 6/6 tests passed
- `npm test`: All tests passed
