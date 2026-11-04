# SRJ Order App: Concept

**Status:** concept agreed, not built yet
**Last updated:** 4 November 2026

---

## 1. Purpose

SRJ sells Indian groceries wholesale to restaurants, hotels and retail shops across North Germany (80+ customers). Today orders come in by **phone and WhatsApp**.

The SRJ Order App lets customers send orders themselves from their phone. SRJ manages orders, delivery routes, the warehouse and bills in one place.

## 2. Platform and branding

- **One web app** that customers install on their phone like a normal app (a PWA). It works on Android, iPhone and computer, with no App Store needed.
- The app includes a short **"Install app" guide**. On iPhone, notifications only work after the app is added to the home screen.
- **Languages:** German, English and Hindi. Each user picks their own. Product names stay as SRJ enters them.
- **Branding:** SRJ logo (wordmark, stacked logo, icon), red `#D22035` and white `#FFFFFF`.
- **No prices** are shown anywhere in the ordering part of the app.

## 3. Roles

| Role | Who | Can do |
|---|---|---|
| **Admin** | The two partners (admins can add more admins) | Everything |
| **Warehouse** | Each worker has their own login | See orders, write missing items for an order, write the "Finished items" list |
| **Owner** | Restaurant owner | Order, see all orders and bills for **all their branches**, see open and paid totals |
| **Staff** | Cook, helper, others | Order and see past orders. **No bills, no money.** |

- One **customer** (company) can have several **branches** (restaurants). Each branch can have several users.
- Only the admin creates accounts. There is no public sign-up.

**Login:** phone number plus a **4-digit PIN**. The app stays logged in on the phone. If a user forgets their PIN, the admin resets it and sends the new one by WhatsApp.

## 4. Customer app (Owner and Staff)

### Ordering
- **Search** for products or **browse by category**. There are 3,500+ articles.
- Pick an item, enter a **quantity**, and write a **note** such as "India Gate Basmati, 10 kg". The note is how customers say which brand or weight they want.
- **Other item:** a free-text item for anything not in the list.
- **Voice message:** for a single item or for the whole order. Customers can speak any language (Punjabi, Urdu, Gujarati, Hindi…). This helps SRJ understand unknown items and add them to the list later.
- **Repeat order:** opens the last order as a **draft**. The customer removes or adds items, then sends it.
- The order goes **directly to SRJ**. It **can't be changed or cancelled** after sending.

### After ordering
- **Order history:** all past orders, showing **who placed each one** (for example "by Raju – Staff").
- **Notification** when SRJ **accepts** the order. There is no other tracking.
- **Reminder notification** before the customer's route day ("Tomorrow is your delivery. Please send your order.").

### Bills (Owner only)
- See every **Rechnung (PDF)** for their branches.
- See the **total open** and **total paid** amounts, and which bills are open or closed.

Customers **don't see** stock or availability.

## 5. Warehouse

- Sees the **order list** and **order details**, and can play **voice messages**.
- Can't change orders, customers or bills, and can't tick items off.
- **Missing items for this order:** a section under each order where the worker writes which items are missing. This means the item is missing **for this customer only**.
- **Finished items list:** one shared list where the worker writes items the **whole warehouse** has run out of, for example until the next big shipment.
- **Only the admin** sees both notes. Customers are not told.

## 6. Admin

### Dashboard
- New orders, accepted orders, number of customers, total open bills, the latest warehouse notes.

### Orders
- See all orders, **accept** them (the customer gets a notification), listen to voice messages, and see the warehouse's missing-items notes.

### Customers
- Add, edit and remove customers, branches and users (Owner or Staff).
- Reset PINs.

### Products
- Add, edit and remove articles and categories.
- **Import from Excel.** SRJ will provide the article list.
- Photos are **optional** and can be added over time. Items without a photo show a placeholder.

### Route calendar
- Create **routes per day** (normally 2, sometimes 3 to 5).
- **Drag restaurants into a route**, then add the next route, and so on.
- A **fixed weekly plan** acts as the template, and the admin can change any single day by dragging.
- Routes drive the automatic **order reminders** to customers.

### Bills
- **Upload a Rechnung PDF** with its number, date and amount, linked to a customer or branch (and the order).
- **Record payments by hand**: amount, date, bank transfer or cash. **Partial payments** are allowed.
- A bill **closes automatically** when it is fully paid.
- Bills can be removed.

### Warehouse notes
- See missing items per order and the **finished items** list.

### Admins and warehouse users
- Add or remove admins and warehouse workers.

## 7. Notifications (in-app push)

| When | Who is notified |
|---|---|
| New order sent | Admin |
| Order accepted | Customer (the user who ordered, and owners) |
| Before route day | Customers on that route |
| New Rechnung added | Owner |

## 8. Not included for now

- Prices.
- An order tracker.
- Online payment.
- Due dates and payment reminders.
- An order deadline.
- Editing or cancelling an order after it is sent.
- Customers seeing stock.
- A connection to weclapp. It can be added later.
- Automatic voice-to-text.

## 9. Build phases

| Phase | Content |
|---|---|
| **1. Foundation** | Project setup, SRJ branding, 3 languages, login (phone + PIN), roles, customers / branches / users |
| **2. Ordering** | Products and categories (Excel import), order with quantity, note, other item and voice; repeat order; order history; admin order list and accept |
| **3. Warehouse and routes** | Warehouse view, missing items per order, finished items list, route calendar with drag and drop |
| **4. Bills** | Rechnung upload, payments (partial), open and closed totals, owner bill view |
| **5. Notifications and go-live** | Push notifications, route reminders, install guide, hosting, domain, backups |

## 10. Technical plan (short)

- **Frontend:** React web app (PWA), mobile-first.
- **Backend:** Node.js API with a database.
- **Database:** SQLite while running locally, PostgreSQL when it goes online.
- **Files:** voice messages and Rechnung PDFs are stored on the server.
- **Running locally for now:** the app runs on one computer. Phones on the **same Wi-Fi** can test it.

### Before real customers can use it

- The app must be **online (hosted)**, because customers' phones can't reach a laptop.
- It needs **HTTPS and a domain** (for example `order.<your-domain>.de`). **Push notifications only work over HTTPS.**
- Hosting must be **in the EU (GDPR / DSGVO)**. The estimated cost is about €10–30 per month.
- A **privacy policy** (Datenschutzerklärung) and **Impressum** page are required.

## 11. Open items

- [ ] SRJ sends the **article list (Excel)** with names and categories.
- [ ] Choose a **domain and hosting** before go-live.
- [ ] Add more languages later if needed (Punjabi, Gujarati, Urdu…).
