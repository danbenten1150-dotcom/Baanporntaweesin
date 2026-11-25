# บ้านพรทวีสิน · Baan PornTaweesin — Website & Booking Platform

A bilingual (TH/EN) website and operations platform for marine cargo (Chumphon ⇄ Koh Tao / Koh Phangan), construction materials, contracting and machinery rental.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · shadcn/ui-style components · Lucide icons · Supabase (Postgres, Auth, Storage, Edge Functions) · Zod.

---

## 1. What's included

| Area | Route | Notes |
|---|---|---|
| Homepage | `/` | Hero, quick-booking widget, 6 service cards, interactive route map, why-us, gallery, CTA |
| About / Services / Contact | `/about` `/services` `/contact` | Contact details come from admin settings only |
| Shipping schedule | `/schedule` | Filters: port, destination, date, vessel, availability |
| Ship booking (7 steps) | `/booking` | Route → date & sailing → cargo → transport option → customer → summary → confirmation |
| Construction quotation | `/construction` | Project form, uploads, site-inspection date |
| Machinery rental | `/machinery` | Dump truck, crane, excavator, heavy, transport |
| Materials store + cart | `/materials` `/cart` | Price **or** "request quotation"; subtotal only when every line has a verified price |
| General quote request | `/quote` | |
| Tracking | `/track` | Reference **and** phone must match; vertical timeline; no fake GPS |
| Customer portal | `/account` | Bookings, construction, machinery, orders, quotations (accept/reject), payments (slip upload), documents, profile, addresses, notifications |
| Admin dashboard | `/admin` | Overview KPIs + Bookings, Schedules & routes, Vessels, Construction, Machinery, Material orders, Products, Customers, Finance (slip verification, quotations, balances, CSV export), Website settings |
| Legal | `/privacy` `/terms` | PDPA-aware **templates** — have them reviewed by counsel |

### UX (Nov 2026 redesign)
- 6-item menu (services grouped under “บริการของเรา”), mobile bottom bar (หน้าแรก · บริการ · **จองเรือ** · ติดตาม · ติดต่อ).
- Homepage: hero → 6 quick-service tiles → quick booking → routes (availability shown only when sailings exist) → 4 steps → gallery → contact.
- Booking in **3 steps**, no account, auto-saved draft, “ไม่ทราบน้ำหนัก / ไม่ทราบขนาด” and “let staff choose a sailing” (flagged for staff review).
- Construction quote form asks only essentials; extra fields are optional and folded away.
- Admin: 10-item sidebar, large summary cards, notification center, search + filters, edit / reschedule, confirmation dialogs, Excel + CSV, print, live updates.
- One status colour system with icons: yellow pending · blue confirmed · purple in transit · green done · red cancelled · grey draft.
- Measured results: see `TEST-REPORT.md`.

Business rules enforced:
- A booking is never "confirmed" until staff approve it. Payments are never auto-confirmed.
- No prices, schedules, contacts or bank details are invented. Missing prices show **"รอเจ้าหน้าที่ยืนยันราคา"**.
- Overbooking is impossible (row lock + `CHECK (booked_tons <= capacity_tons)`).
- A vessel can't have overlapping sailings; a machine can't have overlapping confirmed bookings (Postgres exclusion constraints).
- Customers only see their own rows (row-level security). Internal notes never leave staff.

## 2. Two run modes

| | Demo mode | Production mode |
|---|---|---|
| When | `NEXT_PUBLIC_SUPABASE_URL` empty | Supabase env vars set |
| Data | `lib/data/demo.ts` — sample data in the visitor's browser, flagged **DEMO** everywhere | `lib/data/supabase.ts` — Postgres via RLS + RPC functions |
| Login | Phone number (no password) or "Demo admin" button | Supabase Auth email + password; roles in `profiles.role` |
| Files | Names only (nothing stored) | Private Storage bucket `documents`; public `site-media` for website photos |

Both adapters implement the same `DataApi` interface (`lib/data/api.ts`), so pages never talk to a database directly.

Demo walkthrough: book a sailing at `/booking` → note the reference → `/login` → **Demo admin** → *Bookings* → open it → **Approve & confirm** → *Create quotation* → log in as the customer (same phone) → *Quotations* → **Accept** → **Submit payment** → back in admin *Finance* → **Verify**. Try tracking `BPT-C-DEMO-0001` with `0800000000`.

## 3. Local setup

```bash
npm install
cp .env.example .env.local     # leave Supabase blank for demo mode
npm run dev                    # http://localhost:3000
npm run typecheck && npm run build
```

Static demo export (no server needed): `STATIC_EXPORT=1 npm run build` → `out/`.

## 4. Supabase setup

1. Create a project at supabase.com (region: Singapore is closest to Thailand).
2. Install the CLI and link: `npx supabase login && npx supabase link --project-ref <ref>`
3. Apply schema, security and functions: `npx supabase db push` (runs all 4 files in `supabase/migrations/`; `…0004_ux_update.sql` adds unknown weight/size, optional sailing, edit/reschedule and the realtime feed).
4. Seed: run `supabase/seed.sql` in the SQL editor. Part 1 (ports, routes, categories) is real structure; part 2 is **demo** — delete it before launch (statement at the bottom of the file).
5. Auth → Providers: enable Email. Auth → URL configuration: set your site URL.
6. Create the first admin: sign up on `/login`, then in the SQL editor:
   ```sql
   update profiles set role = 'admin' where email = 'you@company.com';
   ```
   Staff accounts use `role = 'staff'`.
7. Put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` / Vercel.
8. Admin → *Website settings*: enter real phone, LINE, email, address, bank / PromptPay, deposit %, and switch off any services you don't offer. Add real vessels, sailings, products and machinery.

### Notifications (optional)
`supabase/functions/notify` sends new `notifications` rows to LINE OA, email (Resend) and SMS. Each channel is skipped until its secrets exist.
```bash
npx supabase functions deploy notify
npx supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=... LINE_ADMIN_TARGET_ID=... RESEND_API_KEY=... NOTIFY_EMAIL_FROM=... NOTIFY_ADMIN_EMAIL=...
```
Then Dashboard → Database → Webhooks → table `notifications`, event INSERT → the `notify` function.

## 5. Deploy to Vercel

1. Push this folder to GitHub, then *Import Project* in Vercel (framework auto-detected: Next.js).
2. Add the environment variables from `.env.example` (never add `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_` variable).
3. Deploy. Set `NEXT_PUBLIC_SITE_URL` to your domain so the sitemap and canonical URLs are correct.
4. Add the domain in Supabase Auth → URL configuration.

## 6. Project structure

```
app/                 routes (page.tsx = SEO metadata, view.tsx = client UI)
components/ui        shadcn-style primitives (Button, Field, Modal, Tabs, Toast…)
components/layout    header, footer, floating LINE/phone buttons
components/home      hero, quick booking, services, route map, gallery
components/admin     admin modules + quotation builder
components/shared    contact fields, timeline, downloadable summaries
lib/data             DataApi interface, demo adapter, Supabase adapter, seed
lib/                 types, labels (TH/EN), validation (zod), i18n, auth, cart, utils
supabase/migrations  schema · RLS & storage · business functions
supabase/functions   notify edge function
public/brand         original logo (cut from the supplied banner, unaltered) and banners
```

## 7. Before go-live checklist

- [ ] Replace photo placeholders with real company photos (admin → Products / Vessels / Website).
- [ ] Delete demo rows (`is_demo = true`).
- [ ] Complete bracketed text in Privacy Policy and Terms; have them reviewed.
- [ ] Add rate limiting on `track_booking` and public submit RPCs (e.g. Supabase rate limits / Vercel WAF).
- [ ] Confirm VAT / deposit / cancellation rules with your accountant.
- [ ] Note: in production, admin pages are protected by RLS + `require_staff()` in every function; the client-side guard is only a convenience.

## 8. Verified

All 4 migrations were applied to PostgreSQL 16 with Supabase auth/storage shims and tested: guest booking submission, guests unable to read bookings or confirm, phone validation, tracking requires matching phone, capacity enforced on submit and confirm, cancellation releases capacity, machinery overlap rejected. The UI was tested end-to-end in demo mode (book → track → admin confirm → track shows confirmed).
