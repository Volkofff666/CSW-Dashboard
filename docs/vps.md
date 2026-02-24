# VPS Test Deployment (Caddy, Ubuntu 22.04+)

Server IP: `213.165.57.233`
Domain: `nocto.online`
Recommended project dir: `/opt/csw` (do not run from `/root/...` in production)

## 1) DNS records (required)
Set A records to `213.165.57.233`:
- `nocto.online`
- `api.nocto.online`
- `dashboard.nocto.online`
- `widget.nocto.online`

Check before deploy:
```bash
dig +short api.nocto.online
dig +short dashboard.nocto.online
dig +short widget.nocto.online
```

Each must resolve to `213.165.57.233`.

## 2) System packages
```bash
sudo apt update
sudo apt install -y curl git postgresql postgresql-contrib redis-server caddy
```

## 3) Node.js 24 + Corepack
```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable || true
```

If `corepack: command not found`, install pnpm globally:
```bash
sudo npm install -g pnpm
pnpm -v
```

## 4) Clone and install
```bash
git clone <YOUR_REPO_URL> /opt/csw
cd /opt/csw
if command -v corepack >/dev/null 2>&1; then corepack pnpm install; else pnpm install; fi
cp .env.example .env
```

If you already cloned to `/root/CSW-Dashboard`, move it:
```bash
sudo mkdir -p /opt
sudo mv /root/CSW-Dashboard /opt/csw
cd /opt/csw
```

Update `/opt/csw/.env`:
```dotenv
DATABASE_URL="postgresql://csw:strong_password@localhost:5432/csw?schema=public"
REDIS_URL="redis://localhost:6379"
API_PORT=4000
API_PUBLIC_URL="https://api.nocto.online"
WIDGET_CORS_ORIGINS="https://widget.nocto.online,https://nocto.online,https://dashboard.nocto.online"
NEXT_PUBLIC_API_URL="https://api.nocto.online"
```

## 5) Database
```bash
sudo -u postgres psql -c "CREATE USER csw WITH PASSWORD 'strong_password';"
sudo -u postgres psql -c "CREATE DATABASE csw OWNER csw;"
cd /opt/csw
if command -v corepack >/dev/null 2>&1; then
  corepack pnpm db:generate
  corepack pnpm db:migrate -- --name init_m1
  corepack pnpm db:seed
else
  pnpm db:generate
  pnpm db:migrate -- --name init_m1
  pnpm db:seed
fi
```

## 6) Build apps
```bash
cd /opt/csw
if command -v corepack >/dev/null 2>&1; then corepack pnpm build; else pnpm build; fi
```

## 7) Run API with systemd
Create `/etc/systemd/system/csw-api.service`:
```ini
[Unit]
Description=CSW API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/csw/apps/api
EnvironmentFile=/opt/csw/.env
ExecStart=/usr/bin/node /opt/csw/apps/api/dist/main.js
Restart=always
RestartSec=5
User=www-data

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now csw-api
sudo systemctl status csw-api
```

## 8) Run dashboard with systemd
Create `/etc/systemd/system/csw-dashboard.service`:
```ini
[Unit]
Description=CSW Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/csw/apps/dashboard
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/csw/apps/dashboard/node_modules/next/dist/bin/next start -p 3000
Restart=always
RestartSec=5
User=www-data

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now csw-dashboard
sudo systemctl status csw-dashboard
```

## 9) Configure Caddy
Project Caddyfile already prepared:
- `/opt/csw/infra/Caddyfile`

Install it:
```bash
sudo cp /opt/csw/infra/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy
```

## 10) Widget integration on site
```html
<script
  src="https://widget.nocto.online/widget.js"
  data-csw-widget
  data-site-key="demo_site_key"
  data-api-url="https://api.nocto.online"
></script>
```

## 11) Smoke checks
```bash
curl -s https://api.nocto.online/health
curl -s "https://api.nocto.online/v1/widget/config?site_key=demo_site_key"
```
