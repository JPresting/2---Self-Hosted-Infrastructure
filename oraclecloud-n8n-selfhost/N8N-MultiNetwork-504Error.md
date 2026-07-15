# n8n Self-Hosting: The Multi-Network 504 Trap

**Applies to:** n8n deployed as a Docker Compose service behind a reverse proxy (Traefik / Coolify, Dokploy, or plain Compose), where the n8n container is attached to **more than one Docker network** — for example to reach a self-hosted database, a vector store, or another internal service.

**Symptom:** Intermittent `504 Gateway Timeout`. Works for weeks, then breaks after an unrelated restart. Other services on the same host and the same proxy keep working fine.

---

## 1. The short version

A container attached to *N* Docker networks has *N* IP addresses. A reverse proxy can only forward to **one**. If you never tell it which one, it picks whatever Docker hands it first — and that order is not guaranteed to be stable across container re-creation.

As long as it happens to pick a network the proxy is also attached to, everything works. The day it picks a network the proxy is **not** attached to, packets go nowhere and you get a `504`.

Nothing "broke". The ambiguity was there from the moment you attached the second network. The restart just re-rolled the dice.

---

## 2. Why this is so hard to diagnose

The failure mode lies to you in three ways:

| What you observe | What you conclude | What's actually true |
|---|---|---|
| It worked yesterday, broke today | "The restart corrupted something" | The restart only changed which IP got picked |
| Sometimes works, sometimes doesn't | "Flapping container / network issue / ISP" | Deterministic per container lifetime, random across restarts |
| `504`, not `404` or `502` | "Backend is down" | Backend is perfectly healthy — the proxy is talking to a dead address |

And critically: **the app itself is fine.** Its healthcheck passes, its logs are clean, it answers on localhost. Everything points away from the real cause.

---

## 3. Diagnosis — four commands, in order

Run these on the Docker host. Do not skip ahead; each one eliminates a layer.

### Step 1 — Is the app actually alive?

```bash
docker exec <n8n-container> wget -qO- http://127.0.0.1:5678/healthz
```

Expected: `{"status":"ok"}`

If you get this, the application is **not** the problem. Stop looking at n8n logs, environment variables, or image versions.

### Step 2 — Is the proxy the problem, or is it upstream (CDN / tunnel)?

```bash
docker exec <proxy-container> \
  wget -qO- --header='Host: n8n.example.com' http://127.0.0.1/ -S 2>&1 | head -5
```

This asks the proxy directly, bypassing any CDN or tunnel in front of it.

| Result | Meaning |
|---|---|
| `404 page not found` | Proxy doesn't know this route → labels / router config problem |
| `504 Gateway Timeout` | Proxy **knows** the route but can't reach the backend → **you are here** |
| `200 OK` | Proxy is fine → problem is upstream (CDN, tunnel, DNS) |

Getting a `504` from the proxy itself is the key finding. It rules out everything in front of the proxy in one shot.

### Step 3 — Enumerate the addresses

```bash
docker inspect <n8n-container> \
  --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} => {{$v.IPAddress}}{{"\n"}}{{end}}'
```

```bash
docker inspect <proxy-container> \
  --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} => {{$v.IPAddress}}{{"\n"}}{{end}}'
```

Compare the two lists. **Any network that appears on the app but not on the proxy is a landmine.**

Typical output:

```
# n8n
<project-id>            => 10.0.2.6     <- proxy is here  ✅
<project-id>_default    => 10.0.4.3     <- proxy is NOT here  💣
<external-db-network>   => 10.0.3.8     <- proxy is here  ✅

# proxy
proxy-network           => 10.0.1.6
<project-id>            => 10.0.2.7
<external-db-network>   => 10.0.3.13
```

### Step 4 — Prove it

Reach each IP *from inside the proxy container*:

```bash
docker exec <proxy-container> wget -qO- --timeout=5 http://10.0.2.6:5678/healthz   # ok
docker exec <proxy-container> wget -qO- --timeout=5 http://10.0.3.8:5678/healthz   # ok
docker exec <proxy-container> wget -qO- --timeout=5 http://10.0.4.3:5678/healthz   # times out
```

One address times out. That's the one the proxy picked. Diagnosis complete — this is now a proven fact, not a theory.

---

## 4. The fix

Pin the proxy's network choice explicitly. In the n8n service definition:

```yaml
services:
  n8n:
    image: 'n8nio/n8n:<version>'
    networks:
      - default
      - external-db-network
    labels:
      - 'traefik.docker.network=<project-id>'
    # ... rest unchanged
```

Set it to a network that **both** the proxy and n8n are attached to, and that is intended for web routing.

Then **redeploy** — not restart. A restart re-uses the existing container definition; only a redeploy re-renders labels.

### Verify the fix holds

```bash
# 1. Route works
docker exec <proxy-container> \
  wget -qO- --header='Host: n8n.example.com' http://127.0.0.1/ -S 2>&1 | head -5
# expect: HTTP/1.1 200 OK

# 2. Label survived the render
docker inspect <n8n-container> \
  --format '{{index .Config.Labels "traefik.docker.network"}}'
# expect: <project-id>
```

Both must pass. Some platforms re-render service labels themselves and may drop what you wrote in the Compose file — the second check is what tells you whether it stuck. If it comes back empty, set the label in the platform's own **Labels** field instead.

---

## 5. What NOT to do

**Don't remove `- default` from the networks list.** It looks like the clean fix — kill the unreachable network, problem gone. But sibling services (`postgresql`, `redis`) usually have no explicit `networks:` entry, which means they live in `<project>_default`. Remove it from n8n and n8n loses its database. Pin the label instead; leave the topology alone.

**Don't route web traffic through your database network.** It may be technically reachable from the proxy, but it couples two concerns that should stay separate. Use the project network.

**Don't chase the wrong suspects.** In a real incident, all of these were blamed before the actual cause was found — and none of them can produce a `504`:

- `TZ` / `GENERIC_TIMEZONE` — display strings for cron and dates. No network effect whatsoever.
- Custom runner images — task runners are not in the request path. A broken runner gives you Code node errors, never a gateway timeout.
- `N8N_EDITOR_BASE_URL` / `WEBHOOK_URL` — text templates for generating OAuth callback and webhook URLs. They do not affect routing.
- Client IP / office network / firewall — if another service on the same proxy and the same tunnel loads fine, the network path is proven good.

Every minute spent on these is a minute not spent running Step 3.

---

## 6. Related: `http://` vs `https://` behind a tunnel

Frequently conflated with the above, but a separate issue. If you front your host with a tunnel or CDN that terminates TLS at the edge:

| Setting | Value | Why |
|---|---|---|
| Platform **domain field** | `http://n8n.example.com` | Describes the **last hop**: tunnel → proxy → container, unencrypted inside Docker |
| `N8N_EDITOR_BASE_URL`, `WEBHOOK_URL` | `https://n8n.example.com` | Describes the **public identity**: how the browser and OAuth providers reach you |

Both are correct at the same time. They describe different segments of the path.

Set the domain field to `https://` behind a tunnel and the proxy will answer the tunnel's HTTP request with a `301` to HTTPS. The edge follows it, the tunnel sends HTTP again, the proxy redirects again → **redirect loop**. This produces a loop, not a `504` — which is exactly why it's a different bug with a different signature.

---

## 7. Prevention checklist

Any time you attach an n8n container to an additional Docker network:

- [ ] Set `traefik.docker.network` explicitly, in the same change
- [ ] Verify with `docker inspect` that the label survived the deploy
- [ ] Confirm the proxy is attached to the network you pinned
- [ ] Restart the stack once and re-test — the whole point is that it must survive a re-roll

The cost is one line. The cost of not doing it is an unbounded outage at the worst possible moment, with every diagnostic signal pointing somewhere else.

---

## 8. Fast reference

| Response | Layer | Next step |
|---|---|---|
| `504` from proxy directly | Proxy → container | Enumerate IPs (Step 3) |
| `404` from proxy directly | Router config | Check labels / router rule |
| `502` from proxy directly | Container refused connection | Container down or wrong port |
| `200` from proxy, `504` in browser | Upstream (CDN / tunnel) | Check tunnel config, ingress rules |
| Redirect loop | Scheme mismatch | Domain field → `http://` (see §6) |
