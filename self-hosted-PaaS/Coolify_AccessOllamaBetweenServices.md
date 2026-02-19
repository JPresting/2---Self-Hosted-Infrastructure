# Accessing Ollama Across Coolify Services

## How Service Communication Works

**Same stack (same docker-compose):** Services can always reach each other by service name. Even with only `expose:` (no `ports:`), `ollama-api:11434` is reachable from any other service in the same compose file. This is standard Docker networking — no extra configuration needed.

**Cross-stack (different docker-compose):** Services in different Coolify stacks are on separate Docker networks. They cannot see each other by service name. To communicate, the providing service must bind a port to the host (`ports:`), and the consuming service connects via `host.docker.internal`.

---

## A Note on `ports:` and External Access

`ports: '11434:11434'` binds the port on all host interfaces (`0.0.0.0`). On a traditional server setup this would make the port publicly reachable from the internet — Docker even bypasses UFW firewall rules.

**With a Cloudflare Tunnel** this is not an issue. The server has no publicly exposed ports. Only domains explicitly configured in the tunnel are reachable from outside. As long as you don't create a tunnel domain pointing to Ollama's port, it remains inaccessible from the internet. The `ports:` binding is only relevant for cross-stack communication between containers on the same host.

---

## Setup

Ollama runs in one Coolify stack and is shared with other stacks on the same server.

### Ollama Provider Stack (Unsecured)

If you don't need authentication (e.g. single-user server, trusted environment):

```yaml
services:
  ollama-api:
    image: ollama/ollama:latest
    ports:
      - '11434:11434'
    environment:
      - OLLAMA_HOST=0.0.0.0
      - 'OLLAMA_ORIGINS=*'
```

- `OLLAMA_HOST=0.0.0.0` – Required so Ollama accepts connections from outside the container
- `OLLAMA_ORIGINS=*` – Required to allow cross-origin requests from other services
- `ports: '11434:11434'` – Makes Ollama reachable on the host for cross-stack access

### Ollama Provider Stack (Secured with Nginx Proxy)

Ollama has no built-in authentication. Any container on the same host can access it without credentials. To restrict cross-stack access, place an Nginx reverse proxy in front that checks a Bearer token:

```yaml
services:
  ollama-api:
    image: ollama/ollama:latest
    expose:
      - '11434'
    # No ports: — only reachable within this stack or via ollama-proxy
    environment:
      - OLLAMA_HOST=0.0.0.0
      - 'OLLAMA_ORIGINS=*'

  ollama-proxy:
    image: nginx:alpine
    restart: always
    ports:
      - '11434:11434'
    volumes:
      - ./ollama-proxy.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - ollama-api
```

**`ollama-proxy.conf`:**

```nginx
events {}
http {
    server {
        listen 11434;

        location / {
            if ($http_authorization != "Bearer YOUR-SECRET-OLLAMA-KEY") {
                return 401 '{"error":"unauthorized"}';
            }
            proxy_pass http://ollama-api:11434;
            proxy_set_header Host $host;
            proxy_set_header Authorization "";
        }
    }
}
```

Replace `YOUR-SECRET-OLLAMA-KEY` with a strong random string.

Services **within the same stack** (like OpenWebUI) still connect directly to `ollama-api:11434` — they bypass the proxy entirely since they share the internal Docker network.

---

## Connecting From the Same Stack

Services in the same docker-compose connect by service name. No port binding, no `host.docker.internal`, no auth required:

```yaml
services:
  ollama-api:
    image: ollama/ollama:latest
    expose:
      - '11434'
    environment:
      - OLLAMA_HOST=0.0.0.0
      - 'OLLAMA_ORIGINS=*'

  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    environment:
      - 'OLLAMA_BASE_URL=http://ollama-api:11434'
    depends_on:
      - ollama-api
```

`expose:` is sufficient — `ports:` is only needed for cross-stack access.

---

## Connecting From Other Stacks

Any Coolify service on the same server in a **different stack** connects via `host.docker.internal`:

```yaml
services:
  my-service:
    image: whatever
    environment:
      - 'OLLAMA_BASE_URL=http://host.docker.internal:11434'
    extra_hosts:
      - host.docker.internal:host-gateway
```

- `host.docker.internal` resolves to the host machine
- `extra_hosts` line is required on Linux to enable this resolution
- Works regardless of which Coolify stack the consuming service is in

**If using the Nginx proxy:** The consuming service sends the same requests as before — the proxy is transparent. The Bearer token must be configured in the consuming service's settings.

For OpenWebUI in another stack, set the token in:
**Admin Panel → Settings → Ollama API → Edit Connection → Authentication → Bearer → `YOUR-SECRET-OLLAMA-KEY`**

---

## Connecting From Remote Servers (e.g. n8n)

Remote services cannot reach Ollama directly — it is not exposed to the internet.

Instead, connect through OpenWebUI's **OpenAI-compatible API**, which authenticates via `sk-` API keys and proxies requests to Ollama internally.

See the separate [n8n ↔ OpenWebUI Integration Guide](./n8n-openwebui-integration.md) for setup details.

---

## Verify Connection

```bash
# Unsecured setup — from any container terminal in Coolify:
curl http://host.docker.internal:11434/api/tags

# Secured setup — must include Bearer token:
curl http://host.docker.internal:11434/api/tags \
  -H "Authorization: Bearer YOUR-SECRET-OLLAMA-KEY"

# Without token should return 401:
curl http://host.docker.internal:11434/api/tags
# → {"error":"unauthorized"}
```

Should return a JSON list of all installed Ollama models.

---

## Important Notes

- Ollama is **not reachable from the internet** when using Cloudflare Tunnel (unless you explicitly create a tunnel domain for it)
- All services share the **same models** — no need to install models multiple times
- If Ollama's stack restarts, all connected services will briefly lose access until it's back up
- Same-stack services always connect by service name (`ollama-api:11434`) — no proxy, no auth
- Cross-stack services connect via `host.docker.internal:11434` — through the proxy if secured