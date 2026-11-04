# SRJ Order App

Ordering app for SRJ's restaurant, hotel and shop customers. The full plan is in [docs/CONCEPT.md](docs/CONCEPT.md).

**Status:** Phase 1 (Foundation) is done. That covers login, roles, customers, branches, users and the team.

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
  pages/            screens (Login, Profile, admin/…)
  components/       shared pieces (forms, PIN dialog, layout)
  i18n/             texts: de.js, en.js, hi.js
server/src/
  routes/auth.js    setup, login, logout, own profile
  routes/admin.js   customers, branches, users, team
  db.js             database + migrations
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
2. Ordering: products (Excel import), orders with quantity, note and voice, repeat order
3. Warehouse and routes: missing items, finished items list, route calendar
4. Bills: Rechnung upload, payments, open and paid totals
5. Notifications and go-live: push notifications, reminders, hosting
