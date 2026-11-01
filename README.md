# eb_inventory_report

Digital version of the "Warenbestände Lebensmittel" stock form for the Earlybird Kommissionierung team.

| Part | Folder | Stack |
|---|---|---|
| Frontend | [`frontend/`](frontend/) | React + TypeScript + Vite, as a PWA (installable, full-screen, works offline). Later packaged as an Android app |
| Backend | [`backend/`](backend/) | Python FastAPI |

## Requirements

- Node.js 22 LTS (includes npm)
- Python 3.13

## First-time setup

```bash
cd frontend
npm install
```

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env
```

## Running in development

Use two terminals.

**Backend** (in `backend/`, with `.venv` activated):

```bash
fastapi dev app/main.py
```

- API: http://localhost:8000/api
- Interactive API docs: http://localhost:8000/docs

**Frontend** (in `frontend/`):

```bash
npm run dev
```

- App: http://localhost:5173. The `Network` address it prints works from a tablet or phone on the same Wi-Fi
- Calls to `/api/...` are forwarded to the backend (see `server.proxy` in `vite.config.ts`)

## Frontend commands (in `frontend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with live reload |
| `npm run build` | Production build into `dist/` (includes manifest, service worker and icons) |
| `npm run preview` | Serve the production build locally, e.g. to install the app on the laptop and test offline mode |
| `npm run lint` | Check the code with oxlint |

## Backend commands (in `backend/`, with `.venv` activated)

| Command | What it does |
|---|---|
| `fastapi dev app/main.py` | Dev server with auto-reload |
| `pytest` | Run the tests |
| `ruff check .` | Lint |
| `ruff format .` | Format the code |

Backend layout:

```
backend/
  app/
    main.py            FastAPI app, CORS, mounts the API under /api
    core/config.py     Settings from environment variables / .env
    api/router.py      Collects all routes
    api/routes/        One file per topic (health.py so far)
  tests/
```

## PWA notes

- PWA settings (name, colours, full-screen mode) are in `frontend/vite.config.ts`.
- App icons are generated at build time from `frontend/public/logo.svg` (placeholder). Replace that file to change the icon.
- Installing to the home screen and offline mode need HTTPS, or `localhost` on the same machine. On a tablet they therefore work from the hosted version, not from the local dev server.
