# SRJ Order App

Ordering app for SRJ's restaurant, hotel and shop customers. The full plan is in [docs/CONCEPT.md](docs/CONCEPT.md).

**Status:** Phases 1–4 are done.
- **Phase 1:** login, roles, customers, branches, users, team.
- **Phase 2:** products with Excel import, ordering with notes and voice messages, order history, repeat order, and the admin order inbox.
- **Phase 3:**
  - warehouse day view (routes, then stops, then open orders);
  - missing items per order and an out-of-stock list;
  - the route calendar with a drag-and-drop planner.
- **Phase 4:** bills (Rechnung PDF, number, date, amount), payments (bank, cash or other; partial allowed), and the owner's view of open and paid bills.

**About bills:** the Rechnung itself is still made in weclapp; the app only stores the PDF and tracks what is paid. A bill closes automatically when it is fully paid. Staff (cooks, helpers) never see bills.

Screens added from Phase 3 on are in English only for now; German and Hindi users see English there until the texts are translated.

## Run it on your computer

Install once:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Open **http://localhost:5173**.

On the very first start the app asks you to create the first admin account. Add the second admin afterwards under **Team**.

### Open it on a phone (same Wi-Fi)

1. Find your PC's IP address. Vite prints it as `Network: http://192.168.x.x:5173` when it starts.
2. Open that address in the phone's browser.
3. If it doesn't load, allow Node.js through the Windows Firewall (private networks).

**Voice messages on a phone:** browsers only allow the microphone over **https**. To test recording on a phone, start the app with:

```bash
npm run dev:phone
```

Then open `https://192.168.x.x:5173`. The phone warns about the certificate once; tap "Advanced", then "Continue". On your PC (`localhost`), recording works with the normal `npm run dev`.

Once the app is online with a real domain (Phase 5), https comes with it and this step goes away.

## Importing the product list

Go to **Artikel → Excel-Import** and pick an `.xlsx` or `.csv` file. The first row must hold the column names.

- **Required:** only the product name column.
- **Optional:** category (Warengruppe), article number and unit.
- **Columns are matched automatically.** Check the match, look at the preview, then import.
- **Importing again is safe.** Existing products are updated, matched by article number, or by name when there is none. Nothing is deleted.
- **Hiding a product:** uncheck "Für Kunden sichtbar" in the product. Old orders still show it.

## How it is built

| Part | Folder | Tech |
|---|---|---|
| App (what users see) | `client/` | React + Vite |
| Server (API) | `server/` | Node.js + Express |
| Database | `server/data/srj.db` | SQLite (built into Node, no setup) |

- `npm run dev` starts both the server (port 3001) and the app (port 5173).
- `npm run build` followed by `npm start` runs it the way it will run online: everything on port 3001.
- The database file is created automatically. It is **not** in git, so each computer has its own data. Delete `server/data/` to start fresh.

### Folders

```
client/src/
  pages/customer/          ordering, cart, order history
  pages/admin/             dashboard, orders, customers, products, import, team
  components/              shared pieces (layout, item sheet, voice, order view)
  lib/                     catalog search, cart draft (saved on the phone)
  i18n/                    texts: de.js, en.js, hi.js
server/src/
  routes/auth.js           setup, login, logout, own profile
  routes/customer.js       catalog, place order, own orders
  routes/voice.js          voice upload / playback
  routes/admin.js          customers, branches, users, team, dashboard
  routes/adminCatalog.js   products, categories, import
  routes/adminOrders.js    order inbox, accept / delivered
  routes/adminRoutes.js    route plans (weekly template + single days)
  routes/team.js           warehouse + admin: orders, day view, missing / out-of-stock notes
  routes/invoices.js       bills, payments, PDFs (admin + owner)
  plans.js                 which routes apply on a date
  db.js                    database + migrations
server/data/               database file, voice recordings, bill PDFs (not in git)
```

### Adding or changing text

All words on screen live in `client/src/i18n/de.js`, `en.js` and `hi.js`. Change a text in all three files.

## Login and security

- Users log in with **mobile number + 4-digit PIN** and stay logged in for 180 days.
- Only admins create accounts. A new PIN is shown **once** and can be sent straight by WhatsApp.
- PINs are stored hashed, never in plain text.
- After 5 wrong PINs, that number is locked for 15 minutes.
- When a PIN is reset or a user is blocked, they are logged out on all their phones.

## Phases

1. ✅ Foundation: login, roles, customers / branches / users, team, 3 languages
2. ✅ Ordering: products (Excel import), orders with quantity, note and voice, repeat order
3. ✅ Warehouse and routes: missing items, finished items list, route calendar
4. ✅ Bills: Rechnung upload, payments, open and paid totals
5. Notifications and go-live: push notifications, reminders, hosting
