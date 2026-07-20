# Deployment Guide

Step-by-step instructions for shipping this platform to a public URL. Two deployment targets are covered:

- **Render.com** (recommended; free tier works)
- **Self-hosted VPS** (DigitalOcean / AWS Lightsail / your own server)

---

## Build → static bundle

The frontend is a Vite SPA. Build once and deploy anywhere.

```bash
cd frontend
npm install --include=dev
npm run build
```

This produces `dist/` containing `index.html`, `assets/index-*.css`, `assets/index-*.js`. Total bundle ≈ 1.5 MB JS / 50 KB CSS.

The backend ships as a single Python process — no separate worker, no Redis, no broker. All in-process caches (RSS news, OSM coords, alerts, scheduler) live in Python memory and survive across HTTP requests but **not** across deploys.

---

## Option 1: Render.com

### Backend service

1. Push your fork to GitHub (already done).
2. Render dashboard → **New +** → **Web Service**.
3. Connect your repo.
4. Configure:
   - **Root directory:** `backend`
   - **Runtime:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance type:** Free / Starter
5. Environment variables:
   - `OPENAI_API_KEY` = your Groq key (Groq exposes an OpenAI-compatible endpoint; set this with any `OPENAI_API_KEY=gsk_...`)
   - `FRONTEND_URL` = your frontend's Render URL (set after deploying frontend)
6. **Health check path:** `/`

### Frontend service

1. **New +** → **Static Site**.
2. Connect same repo.
3. Configure:
   - **Root directory:** `frontend`
   - **Build command:** `npm install --include=dev && npm run build`
   - **Publish directory:** `dist`
   - **Environment:** Add `VITE_API_URL=https://your-backend.onrender.com` (no trailing slash)
4. After it's deployed: **Redirects/Rewrites** → add:
   - Source: `/*`  Destination: `/index.html`  Action: **Rewrite**
   - (so the SPA router works for `/quality`, `/carbon`, etc.)

### Critical: Cold start

The Render free tier spins down after 15 min idle. On first hit after idle:
- Backend spins up, OSM geocoding runs (~3-9 s cold)
- App's startup hook warms caches
- Frontend has `fetchFleetReadiness` retry loop (5 attempts with exponential backoff)

If you see "Loading Platform..." freeze, that's the **cold-start window**. The frontend has its own resilience:
```typescript
// frontend/src/api.ts
export const fetchFleetReadiness = async (retries = 5) => {
  for (let i = 0; i < retries; i++) { ... 1s, 2s, 3s, 4s delays ... }
}
```

For demo / judging: open the URL 30 s ahead of time so the server is warm.

---

## Option 2: Self-hosted VPS

### Provision

Any Debian / Ubuntu 22.04 VPS with ≥ 1 GB RAM.

```bash
# Install Node 20 + Python 3.10
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y python3.10 python3.10-venv nginx certbot python3-certbot-nginx

# Clone the repo
git clone https://github.com/KumarSrinidhi/ET-Project
cd ET-Project
```

### Backend

```bash
cd backend
python3.10 -m venv .venv310
.venv310/bin/pip install -r requirements.txt

# Systemd unit
cat > /etc/systemd/system/ev-backend.service <<'EOF'
[Unit]
Description=EV Intelligence Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/ET-Project/backend
ExecStart=/opt/ET-Project/backend/.venv310/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=always
Environment=OPENAI_API_KEY=sk-...

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now ev-backend
```

### Frontend build + nginx

```bash
cd /opt/ET-Project/frontend
npm ci
npm run build
cp -r dist/* /var/www/ev-frontend/

# Nginx with TLS
cat > /etc/nginx/sites-available/ev <<'EOF'
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/ev-frontend;
    index index.html;

    location /api/ { proxy_pass http://127.0.0.1:8000; }
    location /api/alerts/stream {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    location / { try_files $uri /index.html; }
}
EOF
ln -s /etc/nginx/sites-available/ev /etc/nginx/sites-enabled/ev
certbot --nginx -d yourdomain.com
systemctl reload nginx
```

---

## Performance tuning

### SQLite
For multi-instance production, replace `database.py: get_db_connection` with a Postgres DSN. Rest of the codebase stays the same.

### Background scheduler
In-process APScheduler is fine for single-instance. For multi-instance, wrap jobs in a Redis lock:
```python
from redis_lock import Lock
with Lock("anomaly_scan", expire=120):
    ...
```

### Cold start
- First OSM lookup is cached forever (`@lru_cache`)
- First RSS pull is cached for 5 minutes
- News cache is warmed on the lifespan startup hook
- Quality scores computed once per fleet snapshot

---

## Smoke test after deploy

```bash
# Public API root
curl https://yourdomain.com/

# Login (default admin/admin)
TOKEN=$(curl -s -X POST https://yourdomain.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Fleet readiness
curl -s -H "Authorization: Bearer $TOKEN" https://yourdomain.com/api/fleet-readiness | jq '. | length'

# WebSocket (use websocat or wscat)
wscat -c wss://yourdomain.com/api/alerts/stream
```

If all four return data, the deployment is healthy.

---

*For local development, see [DEV.md](./DEV.md).*
