# FSW Booking System — Documentation

Comprehensive, review-oriented documentation. Every build phase ships a document here in **both Markdown
(`.md`) and Word (`.docx`)** form. The `.md` is the source; the `.docx` is generated from it.

## Index

| Phase | Document | Status |
|---|---|---|
| 0 | [Phase 0 — Foundation](Phase-0-Foundation.md) · `Phase-0-Foundation.docx` | Complete |
| 1 | [Phase 1 — Auth & app shell](Phase-1-Auth-and-Shell.md) · `Phase-1-Auth-and-Shell.docx` | Complete |
| 2 | [Phase 2 — Employee availability](Phase-2-Employee-Availability.md) · `Phase-2-Employee-Availability.docx` | Complete |
| 3 | [Phase 3 — Time off & closures](Phase-3-Time-Off-and-Closures.md) · `Phase-3-Time-Off-and-Closures.docx` | Complete |
| 4 | [Phase 4 — Manager booking](Phase-4-Manager-Booking.md) · `Phase-4-Manager-Booking.docx` | Complete |
| 5 | Reschedule & cancel | Pending |
| 6 | Notifications & reminders | Pending |
| 7 | Reporting dashboard | Pending |
| 8 | Deployment & Google Sites embedding | Pending |

## Regenerating the Word versions

The `.docx` files are produced from the `.md` sources with a small converter (`tools/md2docx.py`, which uses
`python-docx`). To rebuild:

```bash
tools/build-docs.sh                       # rebuild every doc
tools/build-docs.sh docs/Phase-0-Foundation.md   # rebuild one
```

These tools live outside `src/`, so they are never pushed to Apps Script.
