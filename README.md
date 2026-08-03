# Puffage

A free birthday gift site for two players (`pandhi` & `kothi`): unlock → password gate → hub with Timeline, **Our Story** map game, Messages/Drawings, and Games (20 Questions + Wavelength).

**Stack:** static HTML/CSS/JS on GitHub Pages · Node/Express on Render · Turso (hosted SQLite)

---

## Local development

### Backend

```bash
cd server
cp .env.example .env
npm install
npm start
```

API runs at `http://localhost:3000`. With no Turso env vars set, it uses `server/local.db`.

### Frontend

```bash
# from repo root
npx --yes serve .
```

Open the printed URL. On localhost, `js/config.js` talks to `http://localhost:3000`.

**Login:** username `pandhi` or `kothi123` (displays as “kothi”) · password `puffage` (case-insensitive)

---

## Deploy (100% free)

Do **backend first**, then Pages — the frontend needs the Render URL.

### 1. Turso database

1. Sign up at [turso.tech](https://turso.tech) (free tier, no card).
2. Create a database → copy URL + create an auth token.

### 2. Backend on Render

1. [Render](https://render.com) → New → Web Service → connect this GitHub repo.
2. Settings:
   - **Name:** `pandhi-api` (matches [`js/config.js`](js/config.js) default)
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Instance:** Free
3. Environment variables:

   | Key | Value |
   |-----|--------|
   | `TURSO_DATABASE_URL` | from Turso |
   | `TURSO_AUTH_TOKEN` | from Turso |
   | `SITE_PASSWORD` | `puffage` |
   | `CORS_ORIGIN` | `https://aditya-iyer1.github.io` |

4. Deploy. Confirm the URL is `https://pandhi-api.onrender.com` (or update `PROD_API_BASE_URL` in `js/config.js` to match, then push again).

> Free-tier services sleep when idle; the first request after a pause may take ~30–60s.

### 3. Frontend on GitHub Pages

1. Repo → **Settings** → **Pages** → Source: **Deploy from a branch** → `main` / **`/ (root)`**.
2. Site: `https://aditya-iyer1.github.io/pandhi/`
3. `js/config.js` auto-uses `PROD_API_BASE_URL` on `github.io`.

You can also enable Pages from the CLI after pushing:

```bash
gh api repos/aditya-iyer1/pandhi/pages -X POST -f build_type=legacy -f source[branch]=main -f source[path]=/
```

---

## Content prep checklist

- [x] Generate a photomosaic and save as **`puffage_photos/mosaic.jpg`** (wired into the login screen).
- [ ] Edit [`data/timeline.json`](data/timeline.json) with dates, titles, captions; drop photos under `puffage_photos/timeline/`.
- [ ] Edit [`data/albums.json`](data/albums.json) with album names, covers, and photo paths under `images/albums/`.
- [ ] Swap clip-art under `images/panels/` and `images/lock-heart.svg` if you want custom art.
- [ ] Font is **Comic Neue** with Comic Sans MS fallback (already wired).

### Mosaic

```
puffage_photos/mosaic.jpg
```

Referenced from `index.html` as the login-screen mosaic.

---

## API overview

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/login` | `{ username, password }` |
| `GET` / `POST` | `/messages` | History / new note + optional drawing data URL |
| `GET` / `POST` | `/games` | List / create |
| `GET` | `/games/:id` | Full game + `data_json` |
| `POST` | `/games/:id/turn` | Game-specific actions |
| `GET` | `/health` | Liveness |

Timeline and albums are **static JSON** on the frontend (not API).

---

## Project layout

```
├── index.html          # SPA shell (screens + panels)
├── css/styles.css
├── js/                 # frontend modules
├── data/               # timeline.json, albums.json
├── images/             # art + media placeholders
└── server/             # Express + Turso API
```
