# Putting the SRJ Order App online

This guide takes the app from your PC to a real web address (for example `https://order.srj-example.de`). Customers can then use it from anywhere, and push notifications and voice messages work on every phone.

**Time:** about 1–2 hours the first time.
**Cost:** about €5–10 per month for the server, plus your domain.

---

## What you need

1. **A server in the EU (GDPR).** A small Linux VPS is enough for 80+ customers. A good choice is **Hetzner Cloud CX22** (Germany, about €5/month) with **Ubuntu 24.04**.
2. **A domain or subdomain.** For example `order.<your-domain>.de`. In your domain settings, create an **A record** that points to the server's IP address.
3. **A contact e-mail address.** Push services require one.

## 1. Prepare the server (once)

Log in with `ssh root@<server-ip>`, then:

```bash
# Updates, firewall
apt update && apt upgrade -y
apt install -y ufw git
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Node.js 22 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Caddy: web server that gets and renews the https certificate automatically
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# A separate user that runs the app
adduser --system --group --home /opt/srj srj
```

## 2. Install the app

```bash
cd /opt/srj
sudo -u srj git clone https://github.com/jenisradadiya/srj-order-app.git app
cd app
sudo -u srj npm ci
sudo -u srj npm run build
```

Your GitHub repository is private, so `git clone` asks for a login. Use a GitHub **personal access token** with read access instead of your password, or add a deploy key.

## 3. Settings

Create the push keys once:

```bash
cd /opt/srj/app/server && sudo -u srj npx web-push generate-vapid-keys
```

Create `/opt/srj/srj.env` and fill in your own values:

```ini
PORT=3001
DATA_DIR=/opt/srj/data
VAPID_PUBLIC_KEY=<public key from above>
VAPID_PRIVATE_KEY=<private key from above>
VAPID_SUBJECT=mailto:<your e-mail>
```

Then lock the file down:

```bash
chown srj:srj /opt/srj/srj.env && chmod 600 /opt/srj/srj.env
```

Never change the VAPID keys once customers have turned on notifications. If you do, everyone has to turn them on again.

## 4. Run the app as a service

Create `/etc/systemd/system/srj.service`:

```ini
[Unit]
Description=SRJ Order App
After=network.target

[Service]
User=srj
WorkingDirectory=/opt/srj/app
EnvironmentFile=/opt/srj/srj.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then start it:

```bash
systemctl daemon-reload
systemctl enable --now srj
systemctl status srj        # should say "active (running)"
```

## 5. https with Caddy

Replace the contents of `/etc/caddy/Caddyfile` with:

```
order.<your-domain>.de {
    encode gzip
    reverse_proxy localhost:3001
    header Strict-Transport-Security "max-age=31536000"
}
```

Then reload Caddy:

```bash
systemctl reload caddy
```

Open `https://order.<your-domain>.de`. The first time, you'll see the **first setup** screen. Create your admin account and add your partner under Team.

If you have used the app on your PC and want to keep that data, copy the `server/data` folder to `/opt/srj/data` **before** the first start. Then run `chown -R srj:srj /opt/srj/data`.

## 6. Backups (important)

The app writes a database copy every day to `/opt/srj/data/backups` and keeps the last 14. But that copy sits **on the same server**, so also copy the whole data folder somewhere else every night:

- **Hetzner:** turn on "Backups" for the server (+20% of the server price). This is the simplest option.
- **Also, or instead:** use a **Hetzner Storage Box** with a nightly `rsync` cron job:

```bash
# crontab -e  (as root)
30 2 * * * rsync -a --delete /opt/srj/data/ u123456@u123456.your-storagebox.de:srj-data/
```

The data folder holds the database, voice messages, bill PDFs and push keys.

## 7. Updating to a new version

After you `git push` new code:

```bash
cd /opt/srj/app
sudo -u srj git pull
sudo -u srj npm ci
sudo -u srj npm run build
systemctl restart srj
```

Database changes are applied automatically when the app starts.

## 8. Before customers start

- [ ] Fill in **Impressum & Datenschutz** (`client/src/pages/Legal.jsx`, everything in `[brackets]`) and have it checked.
- [ ] Sign a data processing agreement (**AV-Vertrag**) with the hosting company. Hetzner offers it in the Cloud Console.
- [ ] Import the product list, create customers and users, and plan the routes.
- [ ] Test on one Android phone and one iPhone. On iPhone, first add the app to the home screen, then turn on notifications.
- [ ] Send each customer their login by WhatsApp from the app (the green button after creating a user).
