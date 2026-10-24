# Independent batch registration numbers

## Applied October 24, 2026

All 39 students in the configured academy database were reassigned in one MongoDB transaction, preserving student IDs and original creation order within each batch/session.

| Batch | Students | Sequence | Next registration suffix |
| --- | ---: | --- | --- |
| Boys Batch (B01) | 25 | 00–24 | B01-25 |
| Girls Batch (B02) | 14 | 00–13 | B02-14 |
| Test Batch (B03) | 0 | — | B03-00 |

Format: `MA` + two-digit session year + two-digit class + `B` + batch code + `-` + sequence. For example, class 09 students can have `MA2609B01-00` and `MA2609B02-00` without a login collision. Sequences run across classes within each teacher's batch and reset independently each session year. They start at 00. The batch code is stable when a teacher or batch is renamed.

Students must use their **new full registration number** to sign in; passwords are unchanged. Existing JWT sessions use student IDs, so renumbering does not invalidate them. Attendance, fee payments, enrollment dates, private billing settings, and other student fields are not rewritten. Matching password-recovery request identifiers are updated with the new registration numbers.

The reassignment closes current gaps. Normal future deletions do not silently renumber other students. Failed registrations can reserve a counter value; the allocator prioritizes unique numbers under concurrent requests. Existing student registrations remain stable during ordinary profile edits.

## Local backup and distribution list

- Old/new mapping backup: `server/backups/roll-numbers/roll-numbers-1792835338604-6f2a1837-8f34-4f28-829d-19e91e7778aa.json`
- Readable CSV: `server/backups/roll-numbers/registration-number-changes.csv`

These files contain student names and are excluded from Git. Keep a private copy before cleaning the workspace. The JSON is a mapping backup, not a full database dump.

## Deployment and testing

Restart or redeploy the updated backend **before adding more students**. The existing database has already been migrated; an older deployed backend still contains the academy-wide counter logic. The frontend build includes the updated login example. This task has not pushed code or deployed the app.

1. Refresh the admin student list and compare registrations against the CSV.
2. Check the teacher rosters: Boys suffixes should be B01-00 through B01-24, Girls B02-00 through B02-13. Class digits vary by student.
3. Have a student use their new registration number and unchanged password. Confirm their attendance and fee history are present.
4. After the updated backend is running, the next Boys student should receive B01-25 and the next Girls student B02-14. Test this with an intended real enrollment or a staging database; creating/deleting a disposable live student consumes a number.

Automated checks: `npm test --prefix server` covers separate counters, year reset, concurrent allocation, registration login, read-only migration preview, old/new backups, repeat-run stability, preserved student fields and linked attendance/fees, recovery identifiers, invalid assignments, and full rollback after a simulated write failure. Production frontend build passes.

Post-apply verification read back all 39 IDs/registrations/assignments, confirmed uniqueness, and compared the database with a fresh contiguous plan: zero mismatches, duplicates, or remaining gaps.

## Maintenance tool

`node server/scripts/reassign-roll-numbers.js` previews the configured database without writes. `--apply` performs another backed-up transactional reassignment. Do not run apply as a startup step or routine job: a fresh reassignment can change existing login IDs after deletions or transfers. Schedule any future reassignment when student creation/assignment edits are paused. It requires a MongoDB replica set/Atlas deployment for transactions; it does not fall back to partial writes on standalone MongoDB.

Changed files: `.gitignore`, `server/utils/rollNumbers.js`, `server/routes/students.js`, `server/scripts/reassign-roll-numbers.js`, `server/tests/rollNumbers.test.js`, `server/tests/security.test.js`, `server/seed.js`, `client/src/pages/LoginPage.jsx`, and this document.
