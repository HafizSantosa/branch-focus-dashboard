# Dashboard LOP Priority 20 Branch

Executive dashboard for monitoring infrastructure rollout, construction stages, go-live tracking, material readiness, and port capacity across Telkom Indonesia priority branches.

## Architecture

- **Application:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, and Recharts.
- **Authentication:** NextAuth.js v4 credentials with signed JWT sessions. Every server authorization decision resolves the current user from SQLite, so role and account-status changes take effect without waiting for a new login.
- **Roles:** `admin` manages users, the global spreadsheet source, and CSV exports; `viewer` has read-only analytical access.
- **Database:** SQLite through `better-sqlite3`, using WAL mode under `data/users.db`.
- **Dashboard data:** one server-owned SQLite snapshot is shared by every user, refreshed from a validated `docs.google.com` source on a configurable schedule. Open dashboards check for the latest snapshot every 30 seconds.
- **Email:** Nodemailer SMTP for account verification. Ethereal is used only in development when SMTP is absent.
- **Deployment:** standalone Node.js container, non-root UID 1001, read-only root filesystem, dropped Linux capabilities, health checks, and bounded JSON logs.
- **Daily CSV backup:** optional unfiltered Detail Data exports to Google Drive with restart catch-up, one-file-per-day protection, and administrator-visible status.

## Local development

Use Node.js 22. Native `better-sqlite3` builds may require platform C/C++ build tools when a prebuilt binary is unavailable.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The development server defaults to `http://localhost:3000`. Docker development publishes it on port 3001:

```bash
npm run docker:dev
```

## Production environment

Create `.env` from `.env.example`. `.env` is intentionally ignored by Git and excluded from the Docker build context.

Required values:

| Variable | Purpose |
| --- | --- |
| `NEXTAUTH_URL` | Public HTTPS origin, for example `https://lop.example.com` |
| `NEXTAUTH_SECRET` | Random 64-character signing secret; generate with `openssl rand -hex 32` |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Production verification-email transport |
| `SMTP_FROM` | Sender identity shown in verification emails |

Optional values:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BIND_ADDRESS` | `127.0.0.1` | Host interface exposed by Docker |
| `PORT` | `3001` | Host port used by the reverse proxy |
| `TRUST_PROXY` | `true` | Trust `X-Forwarded-For` from the local reverse proxy for registration throttling |
| `ALLOW_PUBLIC_REGISTRATION` | `false` | Allow self-service viewer registration via `/register`; keep `false` for private deployments |
| `DATA_SYNC_INTERVAL_SECONDS` | `300` | Server-side Google Sheet refresh interval, clamped between 30 seconds and 24 hours |
| `GOOGLE_DRIVE_BACKUP_ENABLED` | `false` | Enable the daily unfiltered Detail Data CSV backup |
| `GOOGLE_DRIVE_BACKUP_FOLDER_ID` | none | Destination Google Drive folder ID |
| `GOOGLE_DRIVE_BACKUP_DAILY_AT` | `02:00` | Daily backup time in 24-hour `HH:mm` format |
| `GOOGLE_DRIVE_BACKUP_TIMEZONE` | `Asia/Jakarta` | IANA time zone used for the daily schedule and filename date |

Production Compose refuses to start without `NEXTAUTH_URL` and `NEXTAUTH_SECRET`. Never reuse the example secret or commit `.env`.

## VPS deployment

### 1. Build and start

```bash
cp .env.example .env
# Edit .env with the real HTTPS origin, random secret, and SMTP credentials.
docker compose up -d --build
docker compose ps
```

The application binds to `127.0.0.1:3001` by default. Expose only the reverse proxy on public ports 80/443.

### 2. Create the first administrator

The health check initializes the SQLite schema. Create the first account after the container is healthy:

```bash
read -rsp "Admin password: " ADMIN_PASSWORD && echo
docker compose exec \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  app npm run admin:create
unset ADMIN_PASSWORD
```

The password must contain at least 12 characters and at most 72 UTF-8 bytes. The command refuses duplicate usernames or email addresses and creates a verified, active administrator. Subsequent users can be managed from `/admin/users`.

### 3. Reverse proxy

Example Nginx location for the HTTPS virtual host:

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Terminate TLS at Nginx or another trusted reverse proxy. Keep `TRUST_PROXY=false` if clients can reach the application port directly.

## Operations

```bash
# Health and status
docker compose ps
curl --fail http://127.0.0.1:3001/api/health

# Logs
docker compose logs -f app

# Upgrade (including browser-managed Drive credentials)
docker compose up -d --build

# Only for externally mounted Drive credentials
docker compose -f docker-compose.yml -f docker-compose.backup.yml up -d --build

# Stop
docker compose down
```

### Backup

The persistent state is stored in the Docker volume `app-data`. SQLite runs in WAL mode, so do not copy only `users.db` while the application is writing. Use SQLite's online backup API:

```bash
docker compose exec app node -e "const D=require('better-sqlite3');const d=new D('/app/data/users.db');d.backup('/app/data/backup.db').then(()=>d.close())"
```

Then copy the backup off the container and verify it can be opened:

```bash
docker compose cp app:/app/data/backup.db ./backup.db
```

### Daily unfiltered CSV backup to Google Drive

The daily export uses the same 14-column contract as the Detail Data table, but always reads the complete shared snapshot without dashboard filters, table search, sorting, or pagination.

1. Enable the Google Drive API in a Google Cloud project.
2. Create a service account and download its JSON key.
3. Add the service-account email as an editor of the destination folder. A Shared Drive is recommended because service accounts do not have personal Drive storage quota.

4. Configure `.env`:

```dotenv
GOOGLE_DRIVE_BACKUP_ENABLED=true
GOOGLE_DRIVE_BACKUP_FOLDER_ID=your-google-drive-folder-id
GOOGLE_DRIVE_BACKUP_DAILY_AT=02:00
GOOGLE_DRIVE_BACKUP_TIMEZONE=Asia/Jakarta
```

5. Deploy normally for browser upload:

```bash
docker compose up -d --build
```

6. Sign in as an administrator over HTTPS. In dashboard settings under
   **Backup CSV Harian**, select the downloaded service-account JSON and click
   **Unggah Kunci**. The upload endpoint accepts at most 32 KB, validates the
   service-account key, and stores it mode `0600` in the persistent `app-data`
   volume; it never appears in Git, container images, or API responses.

Alternatively, an operator with SSH/SFTP can mount a read-only credential with
`docker-compose.backup.yml` and set `GOOGLE_APPLICATION_CREDENTIALS` to that
mounted path; dashboard upload is unavailable in that mode.

The application synchronizes the sheet before each backup and writes `LOP_Detail_Unfiltered_YYYY-MM-DD.csv`. It records the Drive file ID, row count, SHA-256 checksum, last success, and last error in SQLite. Browser upload starts the first backup immediately when enabled; afterward the scheduled backup runs once per Jakarta calendar day. A restart after the scheduled time catches up a missing backup; failed attempts retry after one hour. Administrators can see the latest status and open the Drive folder from the settings dialog.

## Security behavior

- All dashboard and data routes require authentication.
- Admin APIs resolve the current database role instead of trusting a stale client role.
- Disabled or unverified accounts are rejected on the next session check.
- Verification tokens are single-use, expire after 24 hours, and are removed after success or expiry.
- Registration is throttled in SQLite by account identity and, behind a trusted proxy, client IP.
- Spreadsheet synchronization is server-side and restricted to HTTPS `docs.google.com` URLs. The last successful SQLite snapshot remains available if Google Sheets is temporarily unreachable.
- Security headers include clickjacking protection, MIME sniffing protection, HSTS, a restrictive permissions policy, and same-origin opener isolation.
