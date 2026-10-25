# PR 354 evidence: deleting a course can be undone

On a course page: Delete, then Confirm, at 1280x800 and 390x844, light and dark. The test then presses Undo if the toast offers it, waits 11 seconds (longer than the 8 second window) and checks the database and the Courses list. `*-toast.png` is the toast right after deleting; `*-courses-after.png` is the Courses page at the end.

- `before.log`: no Undo on the toast, and the course is already gone from the database right after Confirm. There is no way back.
- `after.log`: the toast has an Undo button, the course is still in the database right after Confirm (the real delete waits out the window), and after pressing Undo it is still there 11 seconds later and listed on /courses.

The unit tests also cover the other path: with no Undo, the real delete runs when the window closes and reports its outcome.
