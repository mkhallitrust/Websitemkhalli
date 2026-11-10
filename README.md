# Mavinakayinahalli Sri Pranadevaru — website

Website and seva booking portal of **Mavinakayinahalli Sri Mukhyaprana Seva Trust (R)**
(Reg. No. GBD-4-00153-2013-14), hosted on **Firebase** (project `mkhalli`) at
https://www.mkhallipranadevaru.com.

| Folder | What it is |
|---|---|
| `public/` | the website: every page, plus `/seva-booking/` and `/admin/` |
| `functions/` | payment server (Cashfree) — orders, webhook, receipts |
| `firestore.rules` | database permissions |
| `media/` | original photos kept for the record (not published) |
| `tools/` | scripts used to build `public/` from the old single-page site |

Pushing to `main` publishes the website automatically (`.github/workflows/firebase-hosting.yml`).
See **[DEPLOY.md](DEPLOY.md)** for setup, payments, admins and the domain.
