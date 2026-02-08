# Coolify Terminal WebSocket Setup (Cloudflare)
## Cloudflare Tunnel Routes (Order Matters!)
| # | Hostname | Service |
|---|----------|---------|
| 1 | `coolify.domain.com/terminal/ws` | `http://localhost:6002` |
| 2 | `coolify.domain.com` | `http://localhost:8000` |
| 3 | `realtime.domain.com` | `http://localhost:6001` |
> **Important:** `/terminal/ws` route MUST be BEFORE the main coolify route! Realtime position does NOT matter! 
> **Cloudflare Tunnel Notes:** Ensure WebSockets are allowed for the tunnel route and avoid caching for `/terminal/ws` (e.g., Bypass Cache) to prevent WS upgrade issues.
---
## Coolify .env Configuration
Edit on server:
```bash
sudo -i
nano /data/coolify/source/.env
```
Required settings:
```
PUSHER_SCHEME=https
PUSHER_HOST=realtime.domain.com
PUSHER_PORT=443
```
> **Tip:** This forces WSS over Cloudflare on port 443 to avoid mixed-content or blocked WebSocket connections.
Restart Coolify:
```bash
docker restart coolify coolify-realtime
```
---
## Useful Container Terminal Commands
### Enter Coolify container (from host)
```bash
docker exec -it coolify bash
```
### Find mounted volumes
```bash
df -h
```
### List files in specific path
```bash
ls /path/to/volume
```
### Find files in container
```bash
find / -type f 2>/dev/null | head -50
```
### Edit files (if nano available)
```bash
nano /path/to/file
```
### Edit files with vi (always available)
```bash
vi /path/to/file
```
- Press `i` to insert/edit
- Press `ESC` then `:wq` to save and quit
- Press `ESC` then `:q!` to quit without saving
### View file contents
```bash
cat /path/to/file
```
### Create/overwrite file
```bash
cat > /path/to/file << 'EOF'
content here
EOF
```
### Check running processes
```bash
ps aux
```
### Check environment variables
```bash
env
```
---

## Direct SSH Access (Alternative)
If the Coolify terminal is too limited, SSH directly into the server:
```bash
ssh user@server
sudo -i
cd /data/coolify/services/{PROJECT_ID}/volumes/{VOLUME_NAME}
```
Path structure:
```
/data/coolify/services/{PROJECT_ID}/
├── docker-compose.yml
└── volumes/
    ├── templates/
    ├── storage/
    └── ...
```
Find your project ID in Coolify URL or run:
```bash
ls /data/coolify/services/
```
