# 🌌 Stellar Lens
**Fan Dashboard · Stellar Dominion**

> A self-hosted performance dashboard for the iOS game [Stellar Dominion](https://apps.apple.com/app/stellar-dominion) — an OGame-inspired PvE space strategy game.
> Track your empire across all colonies, monitor resource production, analyze research progress, and climb the highscore ranks — all from a clean, dark web UI.

---

## ✨ Features

- **Overview** — Empire-wide totals: production, buildings, defenses and fleet across all planets
- **Per Planet** — Drill into any colony: production share, building levels grouped by category, defense & fleet breakdown
- **Research** — Progress bars for all 18 research fields with max-level indicators
- **Performance** — Fleet & defense composition charts, resource production over time
- **Highscore** — Points, ranks, account stats, and historical rank trend charts
- **Auto-polling** — Fetches a new snapshot every 15 minutes (configurable via Admin UI)
- **Multi-user** — Register with an invite code, each user links their own game API token
- **Admin panel** — Manage users, invite codes, email confirmation, pull interval and system settings
- **Email confirmation** — Registration requires email verification via SMTP
- **Light / Dark theme** — Toggleable from the cogwheel menu
- **Fully responsive** — Works on desktop, tablet and mobile

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3` |
| Auth | JWT + bcryptjs |
| Email | Nodemailer (SMTP) |
| Polling | node-cron (1 min tick, DB-configurable interval) |
| Charts | Chart.js 4.4.1 via CDN |
| Container | Rootless Podman (single container) |
| Frontend | Vanilla HTML + CSS + JS (no framework, no build step) |
| Font | DM Mono via Google Fonts |

---

## 📋 Requirements

- A Linux VPS (tested on AlmaLinux 9)
- [Podman](https://podman.io/) + [podman-compose](https://github.com/containers/podman-compose)
- Python 3 (for setup scripts)
- A Stellar Dominion account with an API token
- An SMTP server for email delivery (optional but recommended)

---

## 🚀 Setup

### 1. Clone the repository

```bash
git clone https://github.com/youruser/stellar-lens.git ~/claude-stellar
cd ~/claude-stellar
```

### 2. Create your `.env` file

```bash
cp .env.example .env
nano .env
```

Fill in all required values (see section below).

### 3. Build and start the container

```bash
podman-compose build --no-cache
podman-compose up -d
```

### 4. Check it's running

```bash
podman logs stellar-dashboard | tail -20
```

The app will be available at `http://localhost:8000` (or your configured domain).

### 5. Log in as admin

Use the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`. The admin account is created automatically on startup.

### 6. Create an invite code

Go to **Admin Panel → Invite Codes → Generate** and share the code with users who should be able to register.

---

## ⚙️ Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# ── Server ─────────────────────────────────────────────────
PORT=8000

# ── Security ────────────────────────────────────────────────
JWT_SECRET=your_long_random_secret_here
JWT_EXPIRES_IN=7d

# ── Admin account ───────────────────────────────────────────
# These are synced to the database on every container start.
# Changing them here and restarting updates the admin credentials.
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_admin_password

# ── Database ─────────────────────────────────────────────────
DB_PATH=/app/data/stellar.db

# ── SMTP — leave blank to disable email ─────────────────────
# If disabled, the admin panel will show confirmation links
# directly instead of sending emails.
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=mail@example.com
SMTP_PASS=your_smtp_password
SMTP_FROM=mail@example.com

# ── App URL (used in email links) ───────────────────────────
APP_URL=https://yourdomain.com

# ── Invite codes ────────────────────────────────────────────
# How many days before an invite code expires
INVITE_CODE_EXPIRY_DAYS=30
```

### Variable reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | ✅ | Port the app listens on inside the container |
| `JWT_SECRET` | ✅ | Secret key for signing JWT tokens — make this long and random |
| `JWT_EXPIRES_IN` | ✅ | How long login sessions last (e.g. `7d`, `24h`) |
| `ADMIN_EMAIL` | ✅ | Admin account email — synced from `.env` on every restart |
| `ADMIN_PASSWORD` | ✅ | Admin account password — synced from `.env` on every restart |
| `DB_PATH` | ✅ | Path to SQLite database file inside the container |
| `SMTP_HOST` | ⬜ | SMTP server hostname — leave blank to disable email |
| `SMTP_PORT` | ⬜ | SMTP port (usually `465` for SSL or `587` for STARTTLS) |
| `SMTP_USER` | ⬜ | SMTP login username |
| `SMTP_PASS` | ⬜ | SMTP password |
| `SMTP_FROM` | ⬜ | From address shown in outgoing emails |
| `APP_URL` | ✅ | Public URL of your deployment — used in email confirmation links |
| `INVITE_CODE_EXPIRY_DAYS` | ⬜ | Days until invite codes expire (default: `30`) |

---

## 🔄 Useful Commands

```bash
# Rebuild after code changes
podman-compose build --no-cache && \
  podman stop stellar-dashboard && \
  podman rm stellar-dashboard && \
  podman-compose up -d

# Hot-patch a frontend file (no rebuild needed)
podman cp ~/claude-stellar/frontend/js/dashboard/overview.js \
  stellar-dashboard:/app/frontend/js/dashboard/overview.js

# View live logs
podman logs stellar-dashboard -f

# Open a shell inside the container
podman exec -it stellar-dashboard sh
```

---

## 📁 Project Structure

```
~/claude-stellar/
├── backend/
│   ├── app.js                  # Express app + route mounting
│   ├── server.js               # Entry point, starts poller
│   ├── config.js
│   ├── db/                     # index.js, migrations.js, schema.js
│   ├── middleware/             # auth.js, adminOnly.js
│   ├── routes/                 # auth, admin, accounts, snapshots, users, highscore, history
│   └── services/               # poller.js, mailer.js, adminSync.js, inviteCodes.js
├── frontend/
│   ├── css/                    # base.css, dashboard.css, settings.css, admin.css, responsive.css
│   ├── js/
│   │   ├── api.js              # API client + legacy shim
│   │   ├── auth.js, toast.js, theme.js
│   │   ├── admin/              # invites.js, modal.js, panel.js, stats.js, users.js
│   │   └── dashboard/          # loader.js, overview.js, performance.js, planet.js, research.js, highscore.js
│   ├── dashboard.html
│   ├── admin.html
│   ├── settings.html
│   ├── index.html
│   ├── register.html
│   └── confirm.html
├── data/                       # SQLite DB volume (persists restarts)
├── Containerfile
├── podman-compose.yml
└── .env
```

---

## 🎮 About Stellar Dominion

Stellar Dominion is a PvE-only space strategy game for iOS inspired by the classic browser game OGame. Players build colonies, mine resources, research technologies and participate in PvE events including:

- **Daily Raids** — random attacks on one of your planets
- **Expeditions** — explore the unknown for ships, resources or gems
- **Stellar Anomalies** — 3 raids per day against AI factions (Imperium, Consortium, Collectif, Pirates)
- **Missions** — recycling runs for rewards

This dashboard is an **unofficial fan project** and is not affiliated with or endorsed by the developers of Stellar Dominion.

---

## 🤖 Built with Claude

This entire project — every line of backend code, frontend, CSS, database schema, Docker configuration, and setup script — was **designed and written by [Claude](https://claude.ai)** (Anthropic), through an iterative conversation-driven development process.

No prior coding knowledge was required from the project owner. Tasks were broken into numbered scripts, delivered one at a time, and hot-patched or rebuilt as needed.

> *"I have no clue about coding."* — the person who built this anyway.

---

## 📄 License

This is a personal fan project. Use it freely for your own self-hosted setup.
Not for commercial use. Not affiliated with Stellar Dominion or its developers.