# Running Multiple PaaS Platforms on One Server

> **Use Case:** Coolify + Dokploy (or any combination of deployment platforms) on a single server with one domain.

## The Problem

Both Coolify and Dokploy require ports 80/443 for their Traefik reverse proxies. Running them side-by-side on the same host causes port conflicts.

## The Solution

Run one platform on the host, additional platforms in VMs. Each gets its own Cloudflare Tunnel for complete network isolation.

```
┌─────────────────────────────────────────────────────────────┐
│                      Physical Server                        │
│                                                             │
│  ┌─────────────────┐          ┌─────────────────────────┐  │
│  │   Host (Coolify) │          │   VM (Dokploy)          │  │
│  │   :80/:443       │          │   :80/:443 (isolated)   │  │
│  │   ↑              │          │   ↑                     │  │
│  │   host-tunnel    │          │   vm-tunnel             │  │
│  └─────────────────┘          └─────────────────────────┘  │
│           ↑                              ↑                  │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
     *.example.com                  app.example.com
      (wildcard)                   (specific CNAME)
```

---

## Why This Approach?

| Approach | Complexity | Reliability |
|----------|------------|-------------|
| Shared Traefik | High | ❌ Routing conflicts |
| Docker-in-Docker | Medium | ❌ Networking issues |
| **Separate VMs + Tunnels** | Low | ✅ Complete isolation |

---

## Quick Start

### Prerequisites

- Ubuntu 22.04/24.04 LTS server
- Domain with DNS managed by Cloudflare
- Cloudflare account with Zero Trust access

---

## Part 1: Install Coolify (Host)

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

### Fix SSH Connection Limits

Coolify's internal container maintains persistent SSH connections. The default limit causes failures.

```bash
sudo nano /etc/ssh/sshd_config
```

Add or modify:
```
MaxStartups 50:30:100
```

```bash
sudo systemctl reload ssh
```

---

## Part 2: Install Dokploy (VM)

### Check Available Resources

```bash
nproc    # CPU cores
free -h  # Available RAM
df -h /  # Disk space
```

### Create the VM

```bash
multipass launch 24.04 --name dokploy-box --cpus 10 --memory 12G --disk 200G
```

> **Resource Notes:**
> - **CPUs:** Time-shared, can over-allocate
> - **RAM:** Physically reserved by VM
> - **Disk:** Thin-provisioned, grows on demand

### Install Docker & Dokploy

```bash
# Enter VM
multipass shell dokploy-box

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
exit

# Restart VM to apply group changes
multipass restart dokploy-box

# Install Dokploy
multipass shell dokploy-box
curl -sSL https://dokploy.com/install.sh | sh
exit
```

---

## Part 3: Cloudflare Tunnels

> **Why two tunnels?** Host and VM have separate network namespaces. A single tunnel cannot route to both.

### Host Tunnel (for Coolify)

#### Install cloudflared

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings

curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
  sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update && sudo apt install cloudflared -y
```

#### Create Tunnel

1. Go to [Zero Trust Dashboard](https://one.dash.cloudflare.com/) → Networks → Tunnels
2. Click **Create a tunnel**
3. Name: `host-tunnel`
4. Copy and run the install command on your server

#### Configure DNS (Wildcard)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `*` | `<HOST-TUNNEL-ID>.cfargotunnel.com` | ✅ |

#### Configure Tunnel Routes

> ⚠️ **Order matters!** Cloudflare evaluates routes top-to-bottom.

| Priority | Subdomain | Domain | Service |
|----------|-----------|--------|---------|
| 1 | `coolify` | `example.com` | `http://localhost:8000` |
| 2 | `*` | `example.com` | `http://localhost:80` |
| 3 | — | — | `http_status:404` |

```bash
sudo systemctl restart cloudflared
```

---

### VM Tunnel (for Dokploy)

#### Install cloudflared in VM

```bash
multipass shell dokploy-box

sudo mkdir -p --mode=0755 /usr/share/keyrings

curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
  sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update && sudo apt install cloudflared -y
```

#### Create Tunnel

1. Dashboard → Create another tunnel
2. Name: `vm-tunnel`
3. Copy and run the install command **inside the VM**

#### Configure DNS (Dokploy UI)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `dokploy` | `<VM-TUNNEL-ID>.cfargotunnel.com` | ✅ |

#### Configure Tunnel Routes

| Priority | Subdomain | Domain | Service |
|----------|-----------|--------|---------|
| 1 | `dokploy` | `example.com` | `http://localhost:3000` |
| 2 | `*` | `example.com` | `http://localhost:80` |
| 3 | — | — | `http_status:404` |

```bash
sudo systemctl restart cloudflared
exit
```

---

## Part 4: Deploying Applications

### Coolify Apps (Automatic)

1. Deploy with domain: `myapp.example.com`
2. Wildcard DNS handles routing automatically ✅

### Dokploy Apps (Manual DNS Required)

1. Deploy with domain: `myapp.example.com`
2. **Manually add DNS record:**

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `myapp` | `<VM-TUNNEL-ID>.cfargotunnel.com` | ✅ |

> **Why manual?** The specific CNAME record overrides the `*` wildcard, routing traffic to the VM tunnel instead of the host.

---

## Result

| URL | Destination |
|-----|-------------|
| `coolify.example.com` | Coolify UI (host) |
| `dokploy.example.com` | Dokploy UI (VM) |
| `app1.example.com` | Coolify app (via wildcard) |
| `app2.example.com` | Dokploy app (via manual CNAME) |

---

## Advanced: Multi-Level Subdomains

You can extend this setup for environment separation:

```
*.example.com           → Production (Coolify)
*.dev.example.com       → Development (Dokploy)
*.staging.example.com   → Staging (Third platform)
```

Create additional wildcard DNS entries and tunnel routes as needed. Cloudflare matches the most specific wildcard first.

---

## Troubleshooting

### DNS Not Resolving

```bash
# Check tunnel status
sudo systemctl status cloudflared

# View tunnel logs
sudo journalctl -u cloudflared -f
```

### Port Conflicts

```bash
# Check what's using port 80
sudo lsof -i :80
```

### VM Network Issues

```bash
# Check VM status
multipass list

# Restart VM
multipass restart dokploy-box

# Get VM IP
multipass info dokploy-box | grep IPv4
```

---

## Recommendations

| Scenario | Recommendation |
|----------|----------------|
| Simple setup | Use one platform only |
| Test + Production | This dual setup |
| Multiple teams | Separate domains per platform |

