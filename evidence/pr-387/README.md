# PR #387 — Month calendar day cells

Month view of a busy month: 12 items across assignments, quizzes, exams, a reading and a project, long titles, a day with more than two items, and class sessions. Real app on the Firebase emulator in Chromium, 1280 and 390, light and dark. `before-*` is `main`, `after-*` is this branch. Only the month grid's day cells changed.

For the captures only, the dev-only emulator banner and the floating Focus Timer / AI Advisor buttons are hidden with injected CSS; they are not touched in the code (a separate PR covers them).

## What changed in the cells

Phone (390px, a cell is 42px wide):
- Event chips read as whole words — `Assign`, `Exam`, `Quiz`, `Read`, `Proj` — instead of being cut to `AS…` / `EX…` / `QU…`. The browser measurement flags the old label as cut (`ASSIGN (cut)`); the new one is not.
- Day numbers are centered over the cell, the class-session marker and the chips are centered too, and the number is a little larger (14px, in a 24px circle).
- More room: cells are taller (80px minimum instead of 64px), rows are 4px apart instead of 2px.
- "+N more" stays on one line.

Desktop (1280px, a cell is 116px wide):
- Event titles wrap to two lines instead of being cut after a few words (`Midterm Exa…`), and chips have more padding and softer corners; a title longer than two lines still ends in an ellipsis, and the full title stays in the chip's tooltip and the day panel below.
- Padding is 8px instead of 6px; columns and rows are 6px apart instead of 4px; cells are taller (120px minimum instead of 104px).
- The day number lines up with the chip text, and the weekday header uses the same column gap as the cells so they stay aligned.

| Measured (day with two chips) | before | after |
|---|---|---|
| Phone chip label | `ASSIGN` cut | `Assign` whole |
| Phone chip width | 34px | 38px |
| Desktop cell height | 104px | 122px |
| Desktop chip height | 19px | 24px (two lines when the title needs it) |
