# External Setup

Steps that happen outside this repo (dashboards, consoles, secrets) to get
the app running. See `.env.example` for the full list of variables `.env`
needs.

## Required now

### Postgres
Set a real password before first `docker compose up`:
```
# .env
POSTGRES_PASSWORD=<pick something strong>
```

### Sessions and the first admin account
```
# .env
JWT_SECRET=<a long random string>
ADMIN_EMAIL=<your email>
ADMIN_PASSWORD=<pick something strong>
ADMIN_NAME=<your name>            # optional, defaults to "Admin"
```
`JWT_SECRET` signs session cookies and OAuth state — treat it like a
password. On first startup against an empty database, the server creates one
admin account from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (invites — and therefore
every other account — can only be created by an admin, so this is how the
very first one gets in). Once at least one user exists these vars are no
longer read; log in as that admin and use **Einladungen** in the app to
invite everyone else, then optionally remove `ADMIN_PASSWORD` from `.env`.

### Cloudflare Tunnel
The app is exposed publicly via a Cloudflare Tunnel rather than open inbound
ports.
1. In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a
   tunnel** (choose the token-based/"Cloudflared" connector type).
2. Copy the tunnel token and set it in `.env`:
   ```
   CLOUD_FLARE_TUNNEL_TOKEN=<token>
   ```
3. In the tunnel's **Public Hostname** settings, add a route pointing your
   chosen hostname to `teamxtreme-server:8000` (the service name/port from
   `docker-compose.yml`, reachable over the tunnel's internal Docker network).

Without a valid token, the `cloudflared` container will fail to authenticate
and keep restarting — this is expected until step 2 is done.

### App base URL
```
# .env
APP_BASE_URL=https://teamxtreme.bendun.io
```
Used to build invite links and OAuth redirect URIs. Defaults to that same
value in `docker-compose.yml`, so this only needs to be set explicitly if the
domain ever changes, or for backend-only local dev (defaults to
`http://localhost:8000` there instead).

## Needed for social login

Password login and invites work without these — they're only needed for the
"Mit Google/Instagram anmelden" buttons to function. Skip either one and
users can still register/log in with a password.

### Google OAuth
1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth
   client ID** (Web application).
2. Add this exact redirect URI: `https://teamxtreme.bendun.io/api/auth/google/callback`
   (or `http://localhost:8000/api/auth/google/callback` for local testing).
3. Store the client ID/secret in `.env`:
   ```
   GOOGLE_CLIENT_ID=<client id>
   GOOGLE_CLIENT_SECRET=<client secret>
   ```

### Instagram Login
1. Meta for Developers → create an app → add the **Instagram** product
   (Instagram API with Instagram Login, the successor to the deprecated
   Basic Display API).
2. This requires the account(s) that will log in to be Instagram
   **professional** (business/creator) accounts — a personal Instagram
   account cannot use this login flow.
3. Add this exact redirect URI: `https://teamxtreme.bendun.io/api/auth/instagram/callback`
   (or the `localhost:8000` equivalent for local testing), and request the
   `instagram_business_basic` scope.
4. Store the client ID/secret in `.env`:
   ```
   INSTAGRAM_CLIENT_ID=<client id>
   INSTAGRAM_CLIENT_SECRET=<client secret>
   ```
5. Instagram's API doesn't return an email address, so accounts created via
   Instagram login have no email on file and can't fall back to password
   login — only "Mit Instagram anmelden" will work for them.
