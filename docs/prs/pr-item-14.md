# PR Item 14: Semantic Description List (`<dl>`) Structure in TaskDetailView

**Branch:** `item-14-task-detail-dl-semantics`  
**Integration Target:** `overnight/2026-08-24`  
**Category:** A11y (WCAG AA)  
**Status:** Ready to Merge

---

## Overview

Fixes invalid HTML and accessibility tree violations in `src/components/tasks/TaskDetailView.tsx` where `<dt>` (description term) and `<dd>` (description details) tags were rendered inside plain `<div>` tags without an enclosing `<dl>` container. Wraps metadata and notes in semantic `<dl>` description lists.

---

## 5-Role Perspectives

### 1. Student Perspective

Assistive technology users (such as screen reader users) can accurately hear term-definition associations (e.g., "Due Date: Tuesday, September 15, 2026", "Estimated effort: 3.5 hours", "Notes: Review chapter 2 before starting") instead of disconnected elements.

### 2. User Experience (UX) Perspective

Preserves the exact existing visual grid layout and responsive styling while elevating underlying DOM semantic structure to modern standards.

### 3. Product Manager (PM) Perspective

Satisfies WCAG 2.1 Success Criteria 1.3.1 (Info and Relationships) and 4.1.2 (Name, Role, Value), ensuring zero semantic HTML validation errors during automated campus accessibility compliance audits.

### 4. Product Owner (PO) Perspective

Increases product quality and institutional compliance for universities with strict accessibility mandates for student portal software.

### 5. Developer (Dev) Perspective

Complies with W3C HTML5 specification where `<dt>` and `<dd>` elements must be children of `<dl>` (or `div` inside `dl`). Adds dedicated unit tests in `src/components/tasks/__tests__/TaskDetailView.test.tsx`.

---

## Changes

- `src/components/tasks/TaskDetailView.tsx`: Wrapped task metadata ("Due", "Estimated effort") and "Notes" sections in valid `<dl>` description lists with appropriate `<dt>` and `<dd>` pairings.
- `src/lib/workload/constants.ts`: Imported `WorkloadLevel` type.
- `src/lib/__tests__/workload.test.ts`: Cleaned up unused imports.
- `src/components/tasks/__tests__/TaskDetailView.test.tsx`: Comprehensive unit test verifying `<dl>`, `<dt>`, and `<dd>` semantic structure.

---

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 type errors
- `npx vitest run src/components/tasks/__tests__/TaskDetailView.test.tsx`: 3/3 passing
- `npm run build`: Success
