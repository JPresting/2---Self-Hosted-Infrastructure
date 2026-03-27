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

Want to deploy another service tomorrow? Just set its domain to `http://anothername.yourdomain.com` in Coolify. No changes needed in Cloudflare — the wildcard tunnel handles all of them.

### ⚠️ CRITICAL: Use `http://` — NOT `https://`

The domain in Coolify **must** start with `http://`. This is the single most important setting and the most common source of errors. See "Common Errors" below for why.

---

## Port Routing: Why Some Services Get 502 and Others Don't

You followed every step above, the container is running, but the domain returns **502 Bad Gateway**. Meanwhile, n8n or Plausible deployed through Coolify work fine with the exact same setup. Here's why.

### How Coolify Determines the Internal Port

Traefik needs this label to know where to send traffic:

```
traefik.http.services.<hash>.loadbalancer.server.port=<PORT>
```

If this label is wrong or missing, Traefik defaults to port **80**. If the container doesn't listen on 80 — 502.

Coolify generates this label differently depending on how you deployed.

### Official Coolify Templates (n8n, Plausible, Uptime Kuma, etc.)

Services from Coolify's built-in template library have the port **hardcoded in the template**. Coolify's code knows that n8n listens on 5678, Plausible on 8000, etc. The correct label is always generated — no matter what you enter in the domain field.

That's why `http://n8n.yourdomain.com` works without any port suffix. The template handles it silently.

### Custom Docker Compose Deployments

When you bring your own `docker-compose.yml`, there's no template. Coolify tries to figure out the port through a fallback chain:

1. **Port suffix in the domain field** → e.g., `http://app.yourdomain.com:9000` → uses 9000 ✅
2. **Single `EXPOSE` directive** → if only one port is exposed, Coolify infers it ✅
3. **Multiple ports or no `EXPOSE`** → can't determine the port → **defaults to 80** ❌

If your container exposes multiple ports (e.g., a web UI on 9000 and a streaming port on 1935), Coolify sees multiple candidates, gives up, and falls back to 80.

### The Env Var Trap

You might think this solves it:

```yaml
environment:
  - SERVICE_FQDN_MYAPP_9000
  - SERVICE_URL_MYAPP_9000
```

It doesn't. The `_9000` suffix:
- ✅ Generates the correct FQDN/URL as an environment variable inside the container
- ✅ Creates a Coolify-internal association between this FQDN and port 9000
- ❌ Does **NOT** reliably control Traefik label generation for custom Compose services

The label generator reads the **domain field in the Coolify UI** as its primary source of truth. The env var suffix is a hint that doesn't propagate to `loadbalancer.server.port`.

### The Fix

Add the port to the domain field in the Coolify UI:

```
http://app.yourdomain.com:9000
```

This forces Coolify to generate:

```
traefik.http.services.<hash>.loadbalancer.server.port=9000
```

The `:9000` is purely an internal hint. It never appears externally — users access `https://app.yourdomain.com` as normal.

### Quick Reference

| Scenario | Domain Field | Result |
|----------|-------------|--------|
| Official Coolify template | `http://app.yourdomain.com` | ✅ Works — port from template |
| Custom Compose, single `EXPOSE` | `http://app.yourdomain.com` | ✅ Usually works — inferred |
| Custom Compose, multiple ports | `http://app.yourdomain.com` | ❌ 502 — defaults to port 80 |
| Custom Compose, explicit port | `http://app.yourdomain.com:9000` | ✅ Works — forces correct label |

**Rule of thumb:** For any custom Compose service, always add `:PORT` to the domain field. It costs nothing and eliminates ambiguity.

### How to Verify

```bash
docker inspect <container-name> | grep -i "traefik" | grep "loadbalancer"
```

Expected:
```
"traefik.http.services.<hash>.loadbalancer.server.port": "9000"
```

If it shows 80 or the label is missing, the domain field needs the port suffix.

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

### `502 Bad Gateway`

**Cause:** Traefik doesn't know the correct internal port of the container. This almost always affects custom Compose deployments where the container exposes multiple ports or no `EXPOSE` directive is set. Coolify defaults the `loadbalancer.server.port` to 80 when it can't determine the correct port. See the "Port Routing" section above for the full explanation.

**Fix (choose one):**
- Add `:PORT` to the domain field in Coolify: `http://app.yourdomain.com:9000`
- Or add label: `traefik.http.services.SERVICE.loadbalancer.server.port=XXXX`

### `Page Not Found` (404)

**Cause:** Usually the same root cause as 502 — wrong port. Traefik routes to port 80, but the container responds with a 404 because it has no handler on that port (some containers run a default web server on 80 that returns 404 for unknown routes).

**Fix:** Same as 502 above.

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
- [ ] Custom Compose with non-standard port? Add `:PORT` to domain field
- [ ] New service? Just add a domain in Coolify — no Cloudflare changes needed

---

## Enterprise Exception: Multiple Tunnels on Same Domain

### DNS Wildcard Limitation

**Critical:** You can only have **ONE wildcard CNAME** (`*`) per domain in DNS (RFC 1034 limitation).

If you already have:
- **Tunnel A:** `*.yourdomain.com` → `http://localhost:80` (Traefik wildcard)

And need to add a service on a **different tunnel**:
- You **CANNOT** create another `*` wildcard on Tunnel B
- You **MUST** use a specific subdomain route (e.g., `specific.yourdomain.com`)

### When You Need This

- Running services on **different servers** with different tunnels
- One tunnel has wildcard for Traefik, but you need specific routes elsewhere
- Multiple infrastructure setups on same domain

### Configuration

**For the specific subdomain route (Tunnel B), you MUST expose ports:**
```yaml
services:
  myservice:
    image: 'myapp/image:latest'
    ports:
      - '8080:8080'  # REQUIRED - cloudflared needs host port access
    environment:
      # your config
```

**In Cloudflare Tunnel B:**
- **Subdomain:** `specific` (exact name, not `*`)
- **Domain:** `yourdomain.com`
- **Service:** `http://localhost:8080`

### Why Ports Are Required

- Cloudflared runs on the **host** (not in Docker networks)
- Can only reach `http://localhost:PORT`
- Needs `ports:` mapping to access the container

### Summary

| Scenario | Cloudflare Route | Compose Config | Use Case |
|----------|-----------------|----------------|----------|
| **Wildcard (Traefik)** | `*` → `localhost:80` | `expose:` only | All services on same tunnel, Traefik routing |
| **Specific Route** | `subdomain` → `localhost:PORT` | `ports:` required | Service on different tunnel/server |
