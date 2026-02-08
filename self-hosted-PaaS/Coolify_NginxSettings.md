# Coolify Nginx Down File Issue

## Problem
When modifying service configs in Coolify UI (e.g., realtime/websocket settings), Coolify sometimes creates a `down` file in `/run/s6-rc/servicedirs/nginx/down`. This prevents s6-overlay from starting nginx, causing the container to become unhealthy even after restarts.

## Symptoms
- Container status: `unhealthy`
- Health check fails: `curl: (7) Failed to connect to 127.0.0.1 port 8080`
- Nginx process not running despite container being up
- `docker logs coolify` shows: `App\Events\ServiceChecked ... FAIL`

## Manual Fix
```bash
docker exec coolify rm -f /run/s6-rc/servicedirs/nginx/down
docker exec coolify rm -f /run/s6-rc/servicedirs/nginx/down-signal
docker restart coolify
```

## Automated Watchdog
Create `/root/coolify-nginx-watchdog.sh`:
```bash
#!/bin/bash
if docker exec coolify test -f /run/s6-rc/servicedirs/nginx/down 2>/dev/null; then
    docker exec coolify rm -f /run/s6-rc/servicedirs/nginx/down /run/s6-rc/servicedirs/nginx/down-signal
    docker restart coolify
    echo "$(date): Nginx down file removed" >> /var/log/coolify-watchdog.log
fi
```

Make executable and add to crontab:
```bash
chmod +x /root/coolify-nginx-watchdog.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /root/coolify-nginx-watchdog.sh") | crontab -
```

## Why This Matters
Production Coolify instances become unreachable without manual intervention. This watchdog ensures automatic recovery.

## Root Cause
Known Coolify bug when updating service configurations. The `down` file persists across container restarts by design of s6-overlay.