# Coolify Wildcard Subdomain Routing with Cloudflare Tunnels

## Overview

This guide explains how to let Coolify handle subdomain routing for all your services using a single Cloudflare Tunnel wildcard entry — so you never have to touch Cloudflare again when deploying a new service. It also covers the most common configuration mistakes that cause redirect loops or 404 errors.

---

## Architecture

```
User (HTTPS) → Cloudflare Edge (TLS termination) → Tunnel (HTTP) → localhost:80 → Traefik (Coolify Proxy) → Container
```

Cloudflare handles HTTPS for the end user. The tunnel sends plain HTTP to your server. Coolify's built-in Traefik proxy on port 80 receives the request, matches the hostname, and routes it to the correct container. You only configure subdomains inside Coolify — Cloudflare just forwards everything.

---

## Prerequisites

- A domain with DNS managed by Cloudflare
- Coolify installed and running on your server
- A Cloudflare Tunnel configured (Zero Trust → Networks → Tunnels)

---

## Step 1: Cloudflare Tunnel — One Wildcard, Set and Forget

Create a single wildcard public hostname in your tunnel:

| Field     | Value                      |
|-----------|----------------------------|
| Subdomain | `*`                        |
| Domain    | `yourdomain.com`           |
| Path      | *(leave empty)*            |
| Type      | **HTTP**                   |
| URL       | **localhost:80**           |

This sends **all** `*.yourdomain.com` traffic to Coolify's Traefik proxy. From here on, Coolify decides where each subdomain goes — you never need to add individual hostnames in Cloudflare.

### Cloudflare SSL/TLS Settings

Go to **SSL/TLS → Overview** and set encryption mode to **Full** (not Flexible, not Full Strict).

---

## Step 2: Docker Compose in Coolify

Example: Ollama API + Open WebUI stack.

```yaml
services:
  ollama-api:
    image: 'ollama/ollama:latest'
    restart: always
    volumes:
      - 'ollama-data:/root/.ollama'
    environment:
      - OLLAMA_HOST=0.0.0.0
      - 'OLLAMA_ORIGINS=*'
    expose:
      - '11434'

  open-webui:
    image: 'ghcr.io/open-webui/open-webui:main'
    restart: always
    volumes:
      - 'open-webui-data:/app/backend/data'
    depends_on:
      - ollama-api
    environment:
      - 'OLLAMA_BASE_URL=http://ollama-api:11434'
    expose:
      - '8080'

volumes:
  ollama-data:
  open-webui-data:
```

**Important:** Use `expose:` (not `ports:`). Traefik handles routing internally — no host port mapping needed. These exposed port numbers are internal so you can reuse them for every new service. The only thing that should stay unique to a service is its subdomain.

---

## Step 3: Assign Subdomains in Coolify

For each service, click **Settings** in Coolify and configure:

| Field             | Value                                    |
|-------------------|------------------------------------------|
| **Domains**       | `http://myapp.yourdomain.com`            |
| **Ports Exposes** | The container's internal port (e.g. `8080`) |

Want to deploy another service tomorrow? Just set its domain to `http://anothername.yourdomain.com` in Coolify. No changes needed in Cloudflare — the wildcard tunnel already covers it.

### ⚠️ CRITICAL: Use `http://` — NOT `https://`

The domain in Coolify **must** start with `http://`. This is the single most important setting and the most common source of errors. See "Common Errors" below for why.

---

## Alternative: Traefik Labels in Docker Compose

If your domains are set to `https://` in Coolify and you're getting redirect loops or 404s, you can fix this at the Traefik level using labels directly in your Compose file — without changing the domain settings.

Two labels solve the two most common problems:

| Label | Fixes | What it does |
|-------|-------|--------------|
| `traefik.http.routers.SERVICE.entrypoints=web` | `ERR_TOO_MANY_REDIRECTS` | Forces Traefik to accept HTTP instead of redirecting to HTTPS |
| `traefik.http.services.SERVICE.loadbalancer.server.port=XXXX` | `404 / 502` | Tells Traefik the correct internal container port (otherwise it guesses port 80) |

### Example with Labels

```yaml
services:
  ollama-api:
    image: 'ollama/ollama:latest'
    restart: always
    volumes:
      - 'ollama-data:/root/.ollama'
    environment:
      - OLLAMA_HOST=0.0.0.0
      - 'OLLAMA_ORIGINS=*'
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.ollama-api.rule=Host(`ollama.yourdomain.com`)"
      - "traefik.http.routers.ollama-api.entrypoints=web"
      - "traefik.http.services.ollama-api.loadbalancer.server.port=11434"

  open-webui:
    image: 'ghcr.io/open-webui/open-webui:main'
    restart: always
    volumes:
      - 'open-webui-data:/app/backend/data'
    depends_on:
      - ollama-api
    environment:
      - 'OLLAMA_BASE_URL=http://ollama-api:11434'
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.open-webui.rule=Host(`openwebui.yourdomain.com`)"
      - "traefik.http.routers.open-webui.entrypoints=web"
      - "traefik.http.services.open-webui.loadbalancer.server.port=8080"

volumes:
  ollama-data:
  open-webui-data:
```

This approach works when domains in Coolify are set to `https://` and the tunnel points to `localhost:443`. The labels override Traefik's default HTTPS redirect behavior per service.

---

## Subdomains vs. Path-Based Routing

### Subdomains (recommended)

```
app1.yourdomain.com  →  Container A
app2.yourdomain.com  →  Container B
```

This just works. Each service gets its own subdomain in Coolify. The wildcard tunnel handles all of them. No extra configuration needed.

### Path-Based Routing (possible but tricky)

```
apps.yourdomain.com/app1  →  Container A
apps.yourdomain.com/app2  →  Container B
```

This is **not recommended** unless you have a specific reason. The problems:

1. **The app must support a path prefix.** Most self-hosted apps generate internal links, CSS paths, and API routes starting from `/`. If the app doesn't know it's running under `/app1`, everything breaks (missing styles, broken redirects, 404s on API calls).

2. **You need Traefik middleware** to strip the prefix before forwarding to the container. In Coolify, this means adding custom Traefik labels to your service.

3. **Each app handles this differently.** Some examples:
   - n8n: Supports it via `N8N_PATH=/instance1` environment variable
   - Open WebUI: No native path prefix support
   - Most apps: No support at all

**Bottom line:** Use subdomains. They're free (wildcard covers them), they always work, and they require zero app-level configuration.

---

## Common Errors

### `ERR_TOO_MANY_REDIRECTS`

**Cause:** Domain in Coolify is set to `https://...` while the tunnel uses HTTP/port 80.

**What happens:**
1. Cloudflare sends HTTP traffic through the tunnel to Traefik on port 80
2. Traefik sees the domain is configured as HTTPS → responds with redirect
3. Cloudflare follows the redirect → Traefik redirects again → infinite loop

**Fix (choose one):**
- Change domain in Coolify from `https://` to `http://`
- Or add label: `traefik.http.routers.SERVICE.entrypoints=web`

### `Page Not Found` (404) / `502 Bad Gateway`

**Cause:** Traefik doesn't know the correct internal port of the container.

**Fix:** Add label: `traefik.http.services.SERVICE.loadbalancer.server.port=XXXX`

### Configuration Alignment

All settings must match. Mixing values from different columns breaks:

| Setting                    | Simple Setup (recommended) | Full TLS Setup (advanced) |
|----------------------------|----------------------------|---------------------------|
| Tunnel Type / URL          | HTTP / localhost:80        | HTTPS / localhost:443     |
| Coolify Domain             | `http://...`               | `https://...`             |
| Cloudflare SSL Mode        | Full                       | Full (Strict)             |
| Origin Certificate needed? | No                         | Yes                       |

---

## Full TLS Setup (optional, advanced)

Only needed if your application requires true end-to-end HTTPS (e.g. secure cookies that check the protocol).

1. Create an **Origin Certificate** in Cloudflare (SSL/TLS → Origin Server) for `*.yourdomain.com`
2. Install the certificate on your server and configure Traefik to use it
3. Set Cloudflare SSL/TLS to **Full (Strict)**
4. Change tunnel to Type **HTTPS**, URL **localhost:443**, and set **Origin Server Name** under Additional Application Settings → TLS
5. Change Coolify domains to `https://...`

---

## Quick Checklist

- [ ] Cloudflare Tunnel: **one** wildcard entry (`*`), Type **HTTP**, URL **localhost:80**
- [ ] Cloudflare SSL/TLS: **Full**
- [ ] Coolify Domains: start with **`http://`** (or use Traefik labels to allow HTTP)
- [ ] Compose uses **`expose:`** (not `ports:`)
- [ ] Ports Exposes in Coolify matches the container's internal port
- [ ] New service? Just add a domain in Coolify — no Cloudflare changes needed

---

## Reference

- [Coolify: Cloudflare Tunnels — All Resources](https://coolify.io/docs/knowledge-base/cloudflare/tunnels/all-resource)
- [Coolify: Full TLS Setup](https://coolify.io/docs/knowledge-base/cloudflare/tunnels/full-tls)
- [Coolify: Cloudflare Tunnels Overview](https://coolify.io/docs/knowledge-base/cloudflare/tunnels/overview)