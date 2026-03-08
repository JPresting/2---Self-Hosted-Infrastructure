# OpenClaw + Cloudflare Tunnel Fix

## The Problem

`coollabsio/openclaw` generates an nginx config on every container start that forwards Cloudflare proxy headers (`X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Proto`) directly to the OpenClaw Gateway.

OpenClaw sees these headers and classifies the connection as **remote/external** — not as a local loopback connection. This causes the gateway to reject the bearer token with:

```
disconnected (1008): unauthorized: gateway token missing
```

---

## Fix — Two Steps

### Step 1: Create init script on the server

SSH into your server and run:

```bash
docker exec -it <openclaw-container-name> bash
```

Then inside the container:

```bash
cat > /data/init.sh << 'EOF'
#!/bin/bash
# Wait for nginx config to be generated, then strip Cloudflare proxy headers
(
  while [ ! -f /etc/nginx/conf.d/openclaw.conf ]; do
    sleep 1
  done
  sleep 2
  sed -i 's/proxy_set_header X-Real-IP \$remote_addr;/proxy_set_header X-Real-IP "";/g' /etc/nginx/conf.d/openclaw.conf
  sed -i 's/proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/proxy_set_header X-Forwarded-For "";/g' /etc/nginx/conf.d/openclaw.conf
  sed -i 's/proxy_set_header X-Forwarded-Proto \$scheme;/proxy_set_header X-Forwarded-Proto "";/g' /etc/nginx/conf.d/openclaw.conf
  sed -i 's/proxy_set_header Host \$host;/proxy_set_header Host "localhost:18789";/g' /etc/nginx/conf.d/openclaw.conf
  nginx -s reload
) &
EOF
chmod +x /data/init.sh
```

### Step 2: Add environment variables in Coolify

Add these environment variables to your OpenClaw service in Coolify:

```
OPENCLAW_DOCKER_INIT_SCRIPT=/data/init.sh
```

Also add this to your existing environment variables to configure the gateway config properly on first run. In Coolify terminal run once:

```bash
cat > /data/.openclaw/openclaw.json << 'EOF'
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "trustedProxies": ["127.0.0.1"],
    "controlUi": {
      "enabled": true,
      "allowInsecureAuth": true,
      "dangerouslyDisableDeviceAuth": true,
      "allowedOrigins": ["https://YOUR-OPENCLAW-DOMAIN"]
    },
    "auth": {
      "mode": "token",
      "token": "YOUR-GATEWAY-TOKEN"
    }
  }
}
EOF
```

Replace `YOUR-OPENCLAW-DOMAIN` and `YOUR-GATEWAY-TOKEN` with your actual values.

### Step 3: Redeploy in Coolify

Trigger a redeploy — **not just restart**.

### Step 4: First browser visit

Open the dashboard URL with the token appended — **once per browser/device**:

```
https://YOUR-OPENCLAW-DOMAIN/?token=YOUR-GATEWAY-TOKEN
```

This stores the token in browser localStorage. After this, the normal URL works without the token parameter.

---

## Why this works

- `init.sh` runs before OpenClaw starts and waits for nginx config to be generated, then patches it
- Stripping the proxy headers makes OpenClaw treat the nginx connection as local loopback
- `dangerouslyDisableDeviceAuth: true` disables device pairing which always fails behind a reverse proxy
- `allowedOrigins` whitelists your domain for WebSocket connections
- The `?token=` URL parameter on first visit stores the token in localStorage so the Control UI can authenticate

---

## Root Cause

This is a bug in `coollabsio/openclaw`. The nginx config template in `scripts/entrypoint.sh` should not forward `X-Forwarded-For`, `X-Real-IP`, and `X-Forwarded-Proto` headers when running behind Cloudflare Tunnel, as OpenClaw uses these to determine whether a connection is local or remote.