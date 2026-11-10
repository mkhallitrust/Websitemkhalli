# Deploying mkhallipranadevaru.com to Firebase (project `mkhalli`)

Website of **Mavinakayinahalli Sri Mukhyaprana Seva Trust (R)**, Reg. No. GBD-4-00153-2013-14.

```
public/            the website (separate pages; shared CSS/JS in public/assets)
public/seva-booking/  seva booking portal (sevas + dates load live from Firestore)
public/admin/      Trust admin portal: bookings, priest list, sevas & prices, dates, admins
functions/         payment server: Cashfree orders, webhook, receipts, receipt emails (Node 22)
firestore.rules    who can read/write the database
tools/             scripts that built public/ (split_pages.py → patch_site.py → build_booking.py)
```

Nothing uses Google Sheets or UPI QR codes any more. Bookings live in Firestore and are paid through Cashfree.

## 1. Firebase console, once (about 15 minutes)

In https://console.firebase.google.com/project/mkhalli:

1. **Upgrade the plan.** ⚙ Project settings → Usage and billing → **Blaze (pay as you go)**. Cloud Functions need it. At this site's traffic it stays inside the free allowance. Add a budget alert of ₹100.
2. **Firestore.** Build → Firestore Database → *Create database* → location **asia-south1 (Mumbai)** → *production mode*.
3. **Google sign-in for admins.** Build → Authentication → *Get started* → Sign-in method → **Google** → Enable → support email `mkhallitrust@gmail.com` → Save.
   Then Authentication → Settings → **Authorized domains** → add `www.mkhallipranadevaru.com` and `mkhallipranadevaru.com`.
4. **First admin.** Firestore → *Start collection* → collection ID `admins` → document ID **your Gmail address in lowercase** (e.g. `mkhallitrust@gmail.com`) → add any field, e.g. `role` = `owner` → Save.
   Other admins can then be added from the portal (Admins tab).

## 2. On your computer (Node.js 22 or newer)

```
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..
firebase functions:secrets:set CASHFREE_APP_ID        (paste the Cashfree TEST App ID)
firebase functions:secrets:set CASHFREE_SECRET_KEY    (paste the Cashfree TEST Secret Key)
firebase deploy
```

The site is now live at **https://mkhalli.web.app**.

## 3. Receipt emails (Firebase "Trigger Email" extension)

After each payment the server writes the receipt to the Firestore collection `mail`. This extension sends it:

```
firebase ext:install firebase/firestore-send-email
```

- Collection: `mail`
- SMTP: a Gmail account with an *App password* (Google Account → Security → 2-Step Verification → App passwords), entered as `smtps://mkhallitrust@gmail.com@smtp.gmail.com:465` with the app password when asked
- Default FROM: `Mavinakayinahalli Sri Mukhyaprana Seva Trust <mkhallitrust@gmail.com>`

The Trust gets a copy (BCC) of every receipt.

## 4. Cashfree

1. Dashboard → Developers → Webhooks → add `https://mkhalli.web.app/api/webhook` (later `https://www.mkhallipranadevaru.com/api/webhook`). Events: payment success, failed, user dropped.
2. **Test.** Open `/seva-booking/`, pick a date and a seva, and pay with test UPI `testsuccess@gocash`. You should get a receipt like `MSMPST/2026-27/00001` and an email, and the booking appears in `/admin/`.
3. **Go live** after Cashfree approves the account. Set the Production keys with the two `secrets:set` commands, change `CASHFREE_ENV=production` in `functions/.env`, run `firebase deploy --only functions`, and whitelist the domain in Cashfree.

## 5. Your domain

Hosting → *Add custom domain* → `www.mkhallipranadevaru.com` (and the bare domain, redirected to www). Firebase shows the DNS records. Change them at your domain registrar, replacing the GitHub Pages records. SSL is automatic.

## 6. GitHub auto-deploy (optional)

`firebase init hosting:github` → pick this repository. Every push to `main` then publishes the website. Deploy functions by hand when `functions/` changes: `firebase deploy --only functions`.

## Running the Trust's sevas day to day (all in /admin/)

| Task | Where |
|---|---|
| Open dates for an utsava, name them, close them | **Dates** tab. Past dates hide themselves. |
| Change a price, add a seva, switch one off | **Sevas & prices**. The server charges exactly these prices. |
| See bookings and donations, search, export to Excel (CSV) | **Bookings** |
| Print the names for the priests for a seva day | **Priest list** → choose the date → Print |
| Tick a seva as performed, add a note | Bookings → tick box / click a row |
| Add or remove admins | **Admins** |

## Firestore collections

| Collection | Written by | Contents |
|---|---|---|
| `sevas/{id}` | admin portal (first copy from `functions/catalog.js`) | name, Kannada name, price, icon, order, active |
| `settings/booking` | admin portal | open/closed, message, list of seva dates |
| `orders/{orderId}` | payment server only | each seva booking or donation, status, receipt no., payment ref |
| `counters/receipts-YYYY-YY` | payment server | receipt number counter per financial year |
| `mail/{orderId}` | payment server | receipt email (sent by the extension) |
| `admins/{email}` | you / admin portal | who can open /admin/ |

Devotees' browsers never touch Firestore. They only talk to `/api/...` on the server, so prices can't be changed from the browser.
