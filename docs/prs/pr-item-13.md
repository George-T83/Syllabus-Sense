# PR Item 13: Hardened Modal Focus Trapping, Shift+Tab Boundary Cycling & Scroll Locking

**Branch:** `item-13-modal-focus-trap-shifttab-boundary`  
**Integration Target:** `overnight/2026-08-24`  
**Category:** A11y (WCAG AA)  
**Status:** Ready to Merge

---

## Overview

Harden `useModalA11y` hook with robust focus trapping, Shift+Tab boundary cycling, container `tabIndex={-1}` initialization, background body scroll locking (`overflow: hidden`), and clean Escape dismissal.

---

## 5-Role Perspectives

### 1. Student Perspective

When navigating course or task modals with the keyboard, tabbing forwards or backwards stays strictly inside the active dialog. The background page is locked from accidental scrolling or out-of-modal clicks, eliminating confusion and lost focus states.

### 2. User Experience (UX) Perspective

Modal dialogs provide a focused, distraction-free overlay experience. The underlying body scroll is seamlessly locked while the modal is open and restored immediately upon exit, and focus returns smoothly to the triggering element.

### 3. Product Manager (PM) Perspective

Satisfies critical accessibility compliance under WCAG 2.1 Success Criteria 2.1.1 (Keyboard Navigation), 2.1.2 (No Keyboard Trap), and 2.4.3 (Focus Order), establishing university-grade a11y standards.

### 4. Product Owner (PO) Perspective

Removes a common source of user error and confusion during modal workflows on desktop and tablet, elevating overall product maturity and audit-readiness.

### 5. Developer (Dev) Perspective

Centralized focus trap logic in `useModalA11y.ts` with comprehensive unit tests (`src/hooks/__tests__/useModalA11y.test.tsx`). Handles dynamic edge cases: empty focusable lists, Shift+Tab from modal container, and focus restoration to trigger elements.

---

## Changes

- `src/hooks/useModalA11y.ts`: Added background body scroll lock/unlock, container `tabIndex={-1}` assignment, boundary Shift+Tab cycling, and stopPropagation on Escape.
- `src/hooks/__tests__/useModalA11y.test.tsx`: 8 comprehensive unit tests covering all edge cases.

---

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 type errors
- `npx vitest run src/hooks/__tests__/useModalA11y.test.tsx`: 8/8 passing
- `npm run build`: Success
