# UX acceptance & performance report — 25 Nov 2026

All tests were run on this exact build (static demo export) in headless Chromium.
Phone tests use a 390 × 844 viewport (iPhone-sized) unless noted.

## Acceptance tests (UX brief §14)

| # | Requirement | Result | How it was checked |
|---|---|---|---|
| 1 | First-time customer finds the ship booking button within 5 s | PASS | Visible ~0.5 s after load; two ≥44 px booking buttons in the first screen (hero + bottom bar) |
| 2 | Basic booking within 2 minutes | PASS | 10 taps + 3 typed fields (cargo, name, phone). Automated run 5 s; estimated ~1 min for a person — not timed with real users |
| 3 | Book without an account | PASS | Submitted as guest, no session created |
| 4 | Readable for older users | PASS | No visible text under 13 px on 15 pages; body 16–18 px; labels 16 px; axe-core WCAG 2 A/AA: 0 violations on 15 pages |
| 5 | Works on mobile | PASS | No horizontal scrolling on all 15 public pages at 360 px and 390 px, and on the admin dashboard at 360 px |
| 6 | Upload cargo photos from the phone | PASS | `accept="image/*"` → iOS/Android offer camera or gallery; photo attached in test |
| 7 | New bookings appear in admin automatically | PASS | Admin open in one tab, customer books in another → list updated 2→3 without reload (demo: storage events; production: Supabase Realtime + 20 s fallback poll) |
| 8 | Simple admin approval | PASS | Booking with unknown weight: “กรอกข้อมูลแล้วอนุมัติ” → enter weight + sailing → “อนุมัติการจอง” |
| 9 | Secure tracking | PASS | Wrong phone → “ไม่พบข้อมูล”; correct reference + phone → timeline |
| 10 | Buttons and links work | PASS | 16 internal links on 15 pages all return 200 |
| 11 | Clear error messages | PASS | Empty step → Thai message next to the field, page scrolls to it |
| 12 | Backend/security unchanged | PASS | PostgreSQL 16 tests: RLS hides bookings from guests; guests cannot confirm/edit; capacity enforced on submit, confirm and reschedule; machinery overlap rejected; unknown weight blocks confirmation until staff fill it in |

Not covered by automation: real user timing with older customers, real iPhone/Android camera
hardware, Supabase Realtime against a live project (code path implemented, not run here).

## Red banner theme update (25 Nov 2026, 19:50)
Header, hero, page headers, “how it works” band and footer now use the banner's red/yellow look.
All 13 acceptance checks re-run: PASS (axe: 0 WCAG violations on 15 pages after fixing one faint label).
Lighthouse after the change (3 runs, scores vary run to run on this test machine):
Home performance 81 / 95 / 86, LCP 2.9 / 2.6 / 3.0 s — LCP is slightly above the 2.5 s target.
Booking 85 / 95 / 92, LCP 2.1 / 2.5 / 2.4 s. Track 95, LCP 2.1 s. Accessibility 98–100, SEO 100, Best practices 96.

## Lighthouse 12 before the red theme (mobile, simulated slow 4G, gzip on — as Vercel serves it)

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| Home | 92–98 (2 runs) | 100 | 96 | 100 | 2.3–2.7 s | 0 |
| Booking | 96 | 100 | 96 | 100 | 2.1 s | 0 |
| Schedule | 94 | 100 | 96 | 100 | 1.9 s | 0 |
| Track | 92 | 98 | 96 | 100 | 2.5 s | 0 |
| Contact | 93 | 100 | 96 | 100 | 2.0 s | 0 |
| Materials | 94 | 98 | 96 | 100 | 1.9 s | 0 |
| Services | 91 | 100 | 96 | 100 | 2.6 s | 0 |

Conditions: local static server with compression, test sandbox without access to Google Fonts.
Best Practices 96 is only the failed Google-Fonts request in this sandbox; Accessibility 98 on
Track/Materials is one minor audit. Home LCP is borderline (2.3–2.7 s) — re-measure on the real
Vercel domain after deployment (PageSpeed Insights).
