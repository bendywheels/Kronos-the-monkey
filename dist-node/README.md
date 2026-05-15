# KRONOS ARENA — Hostinger deployment guide

This is a **production-ready Node.js bundle** of the game. It contains:

```
kronos-arena/
├── server.js          ← Express server (API + static)
├── package.json       ← Node dependencies
├── .env.example       ← Copy to .env and fill in
├── public/            ← Pre-built React frontend (HTML + JS + CSS)
└── README.md          ← This file
```

You only need **Node.js 18+** and a **MongoDB** database.

---

## 1) Get a MongoDB database (free)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a free **M0 cluster**.
3. Under **Database Access**, create a user with password.
4. Under **Network Access**, add IP `0.0.0.0/0` (allow from anywhere).
5. Click **Connect → Drivers → Node.js** and copy the connection string. It looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

## 2) Upload to Hostinger

### Option A — via hPanel (recommended, no SSH)

1. Log into Hostinger → **Hosting** → your domain → **Node.js**.
2. Click **Create application**:
   - Node.js version: **18 or higher**
   - Application root: e.g. `/home/yourusername/kronos-arena`
   - Application URL: your domain (e.g. `kronos.tudominio.com`)
   - Application startup file: `server.js`
3. After it's created, click **Edit** and add **Environment variables**:
   - `MONGO_URL` → your Atlas connection string from step 1
   - `DB_NAME` → `kronos_arena`
   - `CORS_ORIGINS` → `*`
   - (Hostinger sets `PORT` automatically — don't override it.)
4. Go to **File Manager** (or use FTP) and upload **all the contents** of this folder into the **Application root** you set above. Make sure `server.js`, `package.json` and the `public/` folder are at the root of that directory.
5. Back in **Node.js**, click **Run NPM Install**.
6. Click **Restart**.
7. Open your domain — KRONOS ARENA should be live.

### Option B — via SSH

```bash
# upload the folder, then:
cd ~/kronos-arena
cp .env.example .env
nano .env            # paste MONGO_URL, save
npm install --omit=dev
npm start
```

---

## 3) Verify it works

- Open `https://your-domain/` → you should see the **KRONOS // ARENA** lobby.
- Open `https://your-domain/api/` → should return `{"message":"KRONOS ARENA online"}`.
- Click **▶ ENTER ARENA**, play a round → leaderboard at the bottom should populate.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank page | Make sure `public/index.html` is inside the application root, not nested in `public/public/`. |
| `Cannot connect` errors in logs | Check `MONGO_URL` env var. Whitelist `0.0.0.0/0` in MongoDB Atlas Network Access. |
| Audio doesn't play | Click **ENABLE AUDIO** in the lobby. Browsers require a user gesture before any sound. |
| Leaderboard always empty | Make sure the round finishes (90 s) — submissions only happen at round end. |

---

## Running locally (optional)

```bash
cp .env.example .env
# edit .env with a local mongo URL like mongodb://localhost:27017
npm install
npm start
# open http://localhost:3000
```

Enjoy. ☣
