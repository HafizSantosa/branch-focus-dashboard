#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$HOME/lop-dashboard"
REPO="https://github.com/HafizSantosa/branch-focus-dashboard.git"
BRANCH="feature/rbac"

echo ""
echo "=== LOP Dashboard Deployment ==="
echo ""

# ── 1. Clone ─────────────────────────────────────────────
if [ -d "$APP_DIR" ]; then
  echo "[1/6] Updating existing repo..."
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  echo "[1/6] Cloning repository..."
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 2. Create .env ──────────────────────────────────────
if [ ! -f .env ]; then
  echo "[2/6] Creating .env..."
  SECRET=$(openssl rand -hex 32)

  read -rp "Gmail address for SMTP (e.g. myhafizas@gmail.com): " SMTP_USER
  read -rsp "Gmail App Password: " SMTP_PASS && echo

  cat > .env << ENVEOF
NEXTAUTH_URL=https://tdsc.online
NEXTAUTH_SECRET=${SECRET}
BIND_ADDRESS=127.0.0.1
PORT=3001
TRUST_PROXY=true
ALLOW_PUBLIC_REGISTRATION=false
DATA_SYNC_INTERVAL_SECONDS=300

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM="Dashboard LOP <${SMTP_USER}>"
ENVEOF

  echo "  .env created."
else
  echo "[2/6] .env already exists, skipping."
fi

# ── 3. Build and start ──────────────────────────────────
echo "[3/6] Building and starting container..."
docker compose up -d --build

echo "[3/6] Waiting for healthy container..."
for i in $(seq 1 20); do
  STATUS=$(docker inspect --format '{{.State.Health.Status}}' lop-priority-app 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    echo "  Container is healthy!"
    break
  fi
  sleep 3
done

curl -sf http://127.0.0.1:3001/api/health && echo ""

# ── 4. Create admin ────────────────────────────────────
echo "[4/6] Creating admin user..."
read -rp "Admin username: " ADMIN_USER
read -rp "Admin email: " ADMIN_EMAIL
read -rsp "Admin password (min 12 chars): " ADMIN_PASS && echo

docker compose exec \
  -e ADMIN_USERNAME="$ADMIN_USER" \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASS" \
  app npm run admin:create

unset ADMIN_PASS

# ── 5. Nginx ───────────────────────────────────────────
echo "[5/6] Configuring Nginx..."
sudo apt-get install -y -qq nginx certbot python3-certbot-nginx > /dev/null 2>&1

sudo tee /etc/nginx/sites-available/tdsc.online > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name tdsc.online www.tdsc.online;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXEOF

sudo ln -sf /etc/nginx/sites-available/tdsc.online /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
echo "  Nginx configured."

# ── 6. HTTPS ──────────────────────────────────────────
echo "[6/6] Setting up HTTPS..."
sudo certbot --nginx -d tdsc.online -d www.tdsc.online

echo ""
echo "=== Deployment complete ==="
echo "  Dashboard: https://tdsc.online"
echo "  Health:    https://tdsc.online/api/health"
echo ""
free -h
docker stats --no-stream
