# External Setup

Steps that happen outside this repo (dashboards, consoles, secrets) to get
the app running.

## Required now

### Postgres
Set a real password before first `docker compose up`:
```
# .env
POSTGRES_PASSWORD=<pick something strong>
```

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

## Not yet needed (planned features)

These aren't required for anything currently in the app but will be once
auth is built:

### Google OAuth
1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth
   client ID** (Web application).
2. Add the deployed domain's callback URL as an authorized redirect URI
   (exact path TBD when auth is implemented, e.g.
   `https://<your-domain>/api/auth/google/callback`).
3. Store the client ID/secret in `.env` (variable names TBD).

### Instagram Login
1. Meta for Developers → create an app → add the **Instagram** product
   (Instagram API with Instagram Login, the successor to the deprecated
   Basic Display API).
2. Configure a redirect URI matching the deployed domain.
3. Store the client ID/secret in `.env` (variable names TBD).

Both OAuth setups are flagged as open work in
[DevelopmentPlan.md](DevelopmentPlan.md) — this file will get concrete env
var names and exact redirect paths once that code exists.
