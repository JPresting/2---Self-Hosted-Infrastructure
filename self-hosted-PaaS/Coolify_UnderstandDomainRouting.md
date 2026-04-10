# Coolify Port Routing: Why Your Custom Docker Compose Service Returns 502

## The Problem

You deploy a Docker Compose service on Coolify. The container starts, logs look clean, health checks pass — but when you open the domain, you get a **502 Bad Gateway**.

Meanwhile, other services deployed through Coolify's built-in templates (like n8n or Plausible) work fine with the exact same domain setup.

The issue is almost always the same: Traefik doesn't know which port to route traffic to.

## How Coolify Generates the `loadbalancer.server.port` Traefik Label

Every service behind Coolify's Traefik proxy needs this label:

```
traefik.http.services.<hash>.loadbalancer.server.port=<PORT>
```

This tells Traefik which internal container port to forward HTTP traffic to. If it's wrong or missing, Traefik defaults to port **80** — and if your app doesn't listen there, you get a 502.

Coolify determines this port differently depending on how you deployed.

## Templates vs. Custom Compose: Two Different Code Paths

### Official Coolify Service Templates

When you deploy from Coolify's template library (n8n, Plausible, Uptime Kuma, Gitea, etc.), the port is **hardcoded in the template definition**. Coolify's internal code knows that n8n listens on 5678, Plausible on 8000, and so on.

The `loadbalancer.server.port` label is generated correctly from the template — **regardless of what you enter in the domain field**. That's why `http://n8n.example.com` works without any port suffix.

You might even see a port warning in the UI about `SERVICE_FQDN_N8N_5678`, but it doesn't matter. The template handles it.

### Custom Docker Compose Deployments

When you bring your own `docker-compose.yml`, Coolify has no template to fall back on. It tries to figure out the correct port through this fallback chain:

1. **Port suffix in the domain field** → e.g., `http://app.example.com:9000` → uses 9000 ✅
2. **Single `EXPOSE` directive** → if only one port is exposed, Coolify infers it ✅
3. **Multiple ports or no `EXPOSE`** → Coolify can't determine the correct port → **defaults to 80** ❌

This is where most people get stuck. If your container exposes multiple ports (e.g., a web UI on 9000 and a streaming port on 1935), Coolify sees multiple candidates, can't pick one, and falls back to 80.

## The Env Var Trap: `SERVICE_FQDN_*` Does NOT Fix This

This is the most common misunderstanding. You might think this solves it:

```yaml
environment:
  - SERVICE_FQDN_MYAPP_9000
  - SERVICE_URL_MYAPP_9000
```

The `_9000` suffix does two things:
- ✅ Generates the correct FQDN/URL as an environment variable inside the container
- ✅ Creates a Coolify-internal association between this FQDN and port 9000

But it does **NOT** reliably control Traefik label generation for custom Compose services. The label generator reads the **domain field in the Coolify UI** as its primary source of truth. If the domain field doesn't include the port, the label defaults to 80.

## The Fix

Add the port to the domain field in the Coolify UI:

```
http://app.example.com:9000
```

This tells Coolify to generate:

```
traefik.http.services.<hash>.loadbalancer.server.port=9000
```

The `:9000` is purely an internal hint to Coolify's label generator. It never appears externally — users access `https://app.example.com` as normal.

### Why `http://` and not `https://`

If you use Cloudflare Tunnel or any other external SSL termination, Traefik receives plain HTTP internally. Using `http://` prevents Coolify from provisioning its own certificate, which would fail behind a tunnel. If you let Coolify handle SSL directly (no tunnel), use `https://`.

## Quick Reference

| Scenario | Domain Field | Result |
|----------|-------------|--------|
| Official Coolify template | `http://app.example.com` | ✅ Works — port from template |
| Custom Compose, single `EXPOSE` | `http://app.example.com` | ✅ Usually works — inferred |
| Custom Compose, multiple ports | `http://app.example.com` | ❌ 502 — defaults to port 80 |
| Custom Compose, explicit port | `http://app.example.com:9000` | ✅ Works — forces correct label |

**Rule of thumb:** For any custom Compose service, always add `:PORT` to the domain field. It costs nothing and eliminates ambiguity.

## Compose Syntax Reminder

In Coolify, `expose` takes only a port number — never mapping syntax:

```yaml
# Correct
expose:
  - '9000'

# Wrong
ports:
  - '9000:9000'
```

## How to Verify

Check the generated Traefik labels on the running container:

```bash
docker inspect <container-name> | grep -i "traefik" | grep "loadbalancer"
```

You should see:

```
"traefik.http.services.<hash>.loadbalancer.server.port": "9000"
```

If it shows 80 or the label is missing entirely, the domain field needs the port suffix.

## Cloudflare Tunnel Reminder

If your Cloudflare Tunnel does not have a wildcard DNS entry for your domain, you need to manually add a Public Hostname for every new subdomain:

- **Subdomain**: `app`
- **Domain**: `example.com`
- **Service**: `http://localhost:80`

Traefik listens on port 80 and routes based on the Host header internally.
