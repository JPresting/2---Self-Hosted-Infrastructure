# Coolify + Dokploy Dual Setup on one Server (one Domain)

**Why both?** Multiple deployment platforms on one server - one for tests one for production (could be the same PaaS multiple times but it's important how to deploy it for one domain with multiple tunnels - not via the same Traefik Proxy).

**The conflict:** Both need ports 80/443 for Traefik.

**The solution:** Coolify on host, Dokploy in VM. VM gives complete network isolation - simpler and more reliable than Docker-in-Docker or custom network bridges which often cause routing issues.



## Important: Multiple (PaaS) Platforms on One Domain

Running multiple deployment platforms (e.g., 1x Coolify, 1x Dokploy, 1x other) on one physical server and one domain is complex.

**Two approaches:**

1. **Single shared Traefik (risky):** All platforms use the same reverse proxy. This is complicated and often causes routing conflicts and failures.

2. **Multiple tunnels + VMs (this guide):** Each platform gets its own tunnel and isolated environment. This requires:
   - Separate VM for each additional platform (network isolation)
   - Separate Cloudflare Tunnel per platform
   - Manual DNS CNAME records that override the host wildcard

**The challenge:** DNS wildcard `*.example.com` points to ONE tunnel. To route specific subdomains to different PaaS providers (e.g. one to Coolify one to Dokploy), you must create individual CNAME records for each app that override the wildcard. This is why deploying multiple platforms on one domain is difficult - it requires manual DNS management per app for non-host platforms (see further below).

**Recommendation:** If possible, use separate domains per platform to avoid this complexity.





## Setup

### Install Coolify (Host)
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

**Fix SSH limits:**

Coolify's internal container makes persistent SSH connections to Docker daemon. Default limit causes connection failures.
```bash
sudo nano /etc/ssh/sshd_config
# Set: MaxStartups 50:30:100
sudo systemctl reload ssh
```

### Install Dokploy (VM)

**Check your system resources first:**
```bash
nproc    # CPU cores
free -h  # RAM
df -h /  # Disk
```

**Create VM with appropriate resources:**
```bash
multipass launch 24.04 --name dokploy-box --cpus 10 --memory 12G --disk 200G
```

**Resource notes:**
- **CPUs:** Time-shared, not physically reserved. Can allocate more than you have.
- **RAM:** Physically reserved by VM. Choose based on available RAM.
- **Disk:** Thin-provisioned, grows as needed.

Adjust numbers based on your hardware.
```bash
multipass shell dokploy-box
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
exit
multipass restart dokploy-box

multipass shell dokploy-box
curl -sSL https://dokploy.com/install.sh | sh
```

## Cloudflare Tunnel

**Why two tunnels?** Host and VM have separate network namespaces. One tunnel cannot access both.

### Host Tunnel (e.g. Coolify)

**Install:**
```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update && sudo apt install cloudflared
```

**Create tunnel:**
1. [Zero Trust Dashboard](https://one.dash.cloudflare.com/) → Networks → Tunnels → Create
2. Name: `host-tunnel`
3. Run install command

**Add DNS:**
```
Type: CNAME
Name: *
Target: <HOST-TUNNEL-ID>.cfargotunnel.com
Proxy: Enabled
```

Routes all subdomains to tunnel.

**Tunnel Routes:**

Routes tell tunnel which local port for each subdomain.

**Order matters** - Cloudflare checks top to bottom.

Route 1:
```
Subdomain: coolify
Domain: example.com
Service: http://localhost:8000
```

Route 2:
```
Subdomain: *
Domain: example.com
Service: http://localhost:80
```

Route 3: `http_status:404`
```bash
sudo systemctl restart cloudflared
```

### VM Tunnel (Dokploy)

**Install in VM:**
```bash
multipass shell dokploy-box

sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update && sudo apt install cloudflared
```

**Create tunnel:**
1. Dashboard → Create second tunnel
2. Name: `vm-tunnel`
3. Run install command in VM

**DNS for Dokploy UI:**
```
Type: CNAME
Name: dokploy
Target: <VM-TUNNEL-ID>.cfargotunnel.com
Proxy: Enabled
```

**VM Tunnel Routes:**

Route 1:
```
Subdomain: dokploy
Domain: example.com
Service: http://localhost:3000
```

Route 2:
```
Subdomain: *
Domain: example.com
Service: http://localhost:80
```

Route 3: `http_status:404`
```bash
sudo systemctl restart cloudflared
exit
```

## Deploying Apps

### Coolify Apps

Deploy with domain `myapp.example.com` - automatic routing via wildcard DNS.

### Dokploy Apps

Deploy with domain `myapp.example.com`, then manually add DNS:
```
Type: CNAME
Name: myapp
Target: <VM-TUNNEL-ID>.cfargotunnel.com
Proxy: Enabled
```

**Why manual?** Specific DNS entry overrides * wildcard, routing to VM tunnel instead of host, otherwise everything would be routed to the Traefik proxy listening on port 80.

## Result

- `coolify.example.com` → Coolify UI
- `dokploy.example.com` → Dokploy UI  
- `app1.example.com` → Coolify app (wildcard)
- `app2.example.com` → Dokploy app (manual CNAME)

**Note:** You can extend this setup to multiple subdomain levels (e.g., `*.dev.example.com`, `*.test.dev.example.com`) by creating additional wildcard DNS entries and tunnel routes. Cloudflare will always match the most specific wildcard first, allowing clean separation between different environments or platforms on the same domain.