# PR #386 — More vertical space on the contact card

Professor card with a name, title, address line, email, one course, five action pills and office hours and location. Real app on the Firebase emulator in Chromium, 1280 and 390, light and dark. `before-*` is `main`, `after-*` is this branch.

Only spacing changed: gaps between the card's sections and between the two rows of action pills. Layout, pills and content are the same.

| Measured in the browser | before | after |
|---|---|---|
| Gap between the two rows of action pills | 8px | 12px |
| Card height, desktop | 365px | 403px |
| Card height, phone | 389px | 431px |

Section spacing, before to after: role badge → name `8` → `12`; name block → address and email `8` → `12`; above the COURSE rule `12` → `20`, below it `12` → `16`; course title → pills `8` → `12`; pills → office lines `2` → `12`; between courses on a multi-course card `8` → `16`.

The floating Focus Timer / AI Advisor buttons and the emulator banner that overlap the phone shots are fixed in a separate PR.
