# Coolify Internal Documentation – Service Networking

## Overview

How services communicate on a Coolify server using Traefik reverse proxy, Cloudflare Tunnel, and cross-stack communication.

---

## Architecture

```
Internet → Cloudflare Tunnel → Traefik (Port 80/443) → Containers
```

---

## Networking Modes

### 1. `expose` – Traefik-Managed Routing

Use for any service that needs a **frontend / domain** (web apps, dashboards, APIs).

```yaml
services:
  my-app:
    image: my-app:latest
    expose:
      - '8080'
```

**How it works:**
- The container's port is only visible inside the Docker network
- Traefik discovers the service and routes traffic based on the **domain/subdomain** assigned in Coolify's UI
- No host port is occupied – **port conflicts are impossible**
- Multiple services can all internally listen on the same port (e.g. 8080) without issues
- Each service just needs a **unique subdomain** (e.g. `app1.example.com`, `app2.example.com`)
- Cloudflare Tunnel forwards all traffic to Traefik, which then decides which container handles which subdomain

**Rules:**
- ✅ No port conflicts – Traefik handles everything internally
- ✅ No host ports occupied
- ⚠️ Each service must have a **unique subdomain** – two services cannot share the same domain

---

### 2. `ports` – Direct Host Port Binding

Use for **backend services shared across Docker Compose stacks** that don't need a domain (e.g. Ollama, shared databases).

```yaml
services:
  ollama-api:
    image: ollama/ollama:latest
    ports:
      - '11434:11434'
```

**How it works:**
- Binds the container port directly to a port on the host machine
- **Bypasses Traefik entirely** – no domain, no reverse proxy
- Other containers (even in completely separate Coolify stacks) reach it via `host.docker.internal:PORT`
- Not reachable from the internet unless explicitly added to the Cloudflare Tunnel

**Rules:**
- ⚠️ **Port conflicts possible** – each host port can only be used once across all services
- ⚠️ You must track which host ports are already in use
- ✅ Not externally accessible by default (secure for internal APIs)

---

## Cross-Stack Communication Pattern

When one Coolify stack needs to access a service from a different stack:

### Provider Stack (the one sharing the service)
```yaml
services:
  ollama-api:
    image: ollama/ollama:latest
    ports:
      - '11434:11434'       # Bind to host so other stacks can reach it
    environment:
      - OLLAMA_HOST=0.0.0.0
```

### Consumer Stack (the one connecting to it)
```yaml
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    environment:
      - 'OLLAMA_BASE_URL=http://host.docker.internal:11434'
    extra_hosts:
      - host.docker.internal:host-gateway   # Required to resolve host address
```

`host.docker.internal` resolves to the host machine's network interface. The `extra_hosts` line is required on Linux to make this work. Together, this lets any container reach any host-bound port on the server.

---

## Quick Reference

| Scenario | Method | How it works | Conflicts? |
|----------|--------|-------------|------------|
| Service needs a domain/frontend | `expose` | Traefik sees the container internally, routes by subdomain. No host port used. | No port conflicts. Subdomains must be unique. |
| Internal API shared across stacks | `ports` | Binds directly to a host port. Other containers access via `host.docker.internal:PORT`. | Host port must be unique across all services. |
| Service only used within same stack | Neither needed | Services in the same compose reach each other by service name (e.g. `http://searxng:8080`). | No conflicts. Fully internal. |
