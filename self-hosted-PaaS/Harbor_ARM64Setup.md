# Harbor Registry — Setup & Cloudflare Integration Guide

This guide covers two things:
1. How to install Harbor on an ARM64 server (e.g. Oracle Cloud Ampere)
2. How to connect Harbor to GHCR via Pull-based Replication — bypassing Cloudflare Bot Fight Mode entirely

---

## Part 1 — Harbor on ARM64 (Oracle Cloud / Ampere)

> Harbor does not officially support ARM64. All Harbor Docker images are AMD64-only. The solution is QEMU user-space emulation with a few critical fixes.

### Step 1 — Install QEMU

```bash
sudo apt-get update
sudo apt-get install -y qemu-user-static binfmt-support
sudo reboot
```

### Step 2 — Upgrade QEMU to 9.x (Critical)

The default QEMU version on Ubuntu (8.2.x) has a bug that causes Go binaries to crash with `QEMU internal SIGSEGV`. Harbor's core, jobservice, registry and registryctl are all written in Go — they will crash on startup with QEMU 8.2.x.

```bash
sudo add-apt-repository ppa:canonical-server/server-backports -y
sudo apt-get update
sudo apt-get install -y qemu-user-static
```

Verify:
```bash
qemu-x86_64-static --version
# Should show: qemu-x86_64 version 9.0.2 or higher
```

### Step 3 — Register QEMU with the F Flag (Critical)

Without the `F` flag, QEMU is not accessible inside Docker containers.

```bash
echo -1 | sudo tee /proc/sys/fs/binfmt_misc/qemu-x86_64
echo ':qemu-x86_64:M:0:\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00\x3e\x00:\xff\xff\xff\xff\xff\xfe\xfe\x00\xff\xff\xff\xff\xff\xff\xff\xff\xfe\xff\xff\xff:/usr/bin/qemu-x86_64-static:F' | sudo tee /proc/sys/fs/binfmt_misc/register
```

Verify:
```bash
cat /proc/sys/fs/binfmt_misc/qemu-x86_64
# Should show: enabled, flags: F
```

### Step 4 — Fix Kernel Virtual Address Layout (Critical)

On Oracle Cloud ARM64, Go's garbage collector crashes with `lfstack.push invalid packing` because the kernel allocates memory above 128TB. Fix:

```bash
sudo sysctl -w vm.legacy_va_layout=1
echo "vm.legacy_va_layout=1" | sudo tee -a /etc/sysctl.conf
```

### Step 5 — Download and Install Harbor

```bash
cd /opt
sudo mkdir harbor && cd harbor
sudo wget https://github.com/goharbor/harbor/releases/download/v2.12.0/harbor-online-installer-v2.12.0.tgz
sudo tar xzvf harbor-online-installer-v2.12.0.tgz --strip-components=1
```

### Step 6 — Configure harbor.yml

```bash
sudo cp harbor.yml.tmpl harbor.yml
sudo nano harbor.yml
```

Key settings:

```yaml
hostname: registry2.yourdomain.com

http:
  port: 8888

# Comment out the entire https block — Cloudflare Tunnel handles SSL
# https:
#   port: 443
#   certificate: ...
#   private_key: ...

external_url: https://registry2.yourdomain.com

harbor_admin_password: YOUR_ADMIN_PASSWORD
```

### Step 7 — Install Harbor

```bash
sudo ./prepare
sudo ./install.sh
```

You will see warnings about `linux/amd64` platform mismatch — this is expected, QEMU handles it.

### Step 8 — Docker Compose Override (Critical)

`harbor-db` crashes under QEMU. Replace it with native ARM64 PostgreSQL and disable all healthchecks (they also crash under QEMU).

First, get the DB password Harbor generated:
```bash
sudo grep POSTGRESQL_PASSWORD /opt/harbor/common/config/core/env
```

Then create the override:
```bash
sudo tee /opt/harbor/docker-compose.override.yml << 'EOF'
services:
  postgresql:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: "YOUR_DB_PASSWORD_FROM_ABOVE"
      POSTGRES_DB: registry
    healthcheck:
      disable: true
  core:
    healthcheck:
      disable: true
  jobservice:
    healthcheck:
      disable: true
  redis:
    healthcheck:
      disable: true
  registry:
    healthcheck:
      disable: true
  registryctl:
    healthcheck:
      disable: true
EOF
```

Restart:
```bash
cd /opt/harbor
sudo docker compose down -v
sudo docker compose up -d
```

### Step 9 — Cloudflare Tunnel

In Cloudflare Zero Trust, add a public hostname:

| Field | Value |
|-------|-------|
| Subdomain | `registry2` |
| Domain | `yourdomain.com` |
| Type | HTTP |
| URL | `localhost:8888` |

Harbor UI: `https://registry2.yourdomain.com/harbor`

### Step 10 — Reboot Persistence for binfmt

The F-flag registration is lost on reboot. Create a systemd service:

```bash
sudo tee /etc/systemd/system/qemu-binfmt-x86.service << 'EOF'
[Unit]
Description=Register QEMU x86_64 binfmt with F flag
After=local-fs.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo -1 > /proc/sys/fs/binfmt_misc/qemu-x86_64 2>/dev/null; echo ":qemu-x86_64:M:0:\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00\x3e\x00:\xff\xff\xff\xff\xff\xfe\xfe\x00\xff\xff\xff\xff\xff\xff\xff\xff\xfe\xff\xff\xff:/usr/bin/qemu-x86_64-static:F" > /proc/sys/fs/binfmt_misc/register'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable qemu-binfmt-x86.service
sudo systemctl start qemu-binfmt-x86.service
```

> On Oracle Cloud, `systemctl status` for oneshot services may return `Failed to get properties: Invalid argument` — this is a known Oracle Cloud kernel quirk. Verify it actually worked:
> ```bash
> cat /proc/sys/fs/binfmt_misc/qemu-x86_64
> # Should show: enabled, flags: F
> ```

---

## Part 2 — Connecting Harbor to GHCR via Pull-Based Replication

### The Cloudflare Problem

If your Harbor domain is behind Cloudflare, GitHub Actions requests will be blocked by Bot Fight Mode.

> **Note:** Deselecting the DNS Proxy in Cloudflare won't work — when using Cloudflare Tunnel, the proxy is enforced automatically.

![DNS Proxy greyed out](https://github.com/user-attachments/assets/0cddfa0e-3e33-4e06-bcd1-6953cd7accf7)

**Option A — WAF Skip Rule (Pro Plan only):** Create a custom WAF rule to skip bot protection for `/api/v2.0/*`.

![WAF Custom Rules](https://github.com/user-attachments/assets/aeff8a8d-70c4-40ad-977d-9b3c7b0f67b1)

![WAF Expression](https://github.com/user-attachments/assets/8862bfb8-9421-411b-a66f-325500cd6ea5)

> See: [docker/login-action Issue #461](https://github.com/docker/login-action/issues/461) — *"Cloudflare detects GitHub Actions requests as bots and blocks them."*

**Option B — Disable Bot Fight Mode entirely (Free Plan):** The free plan cannot bypass Bot Fight Mode via rules — it must be disabled completely.

![Bot Fight Mode](https://github.com/user-attachments/assets/f5f4323a-6568-4e21-b23c-58f7ed1f7f9d)

**Option C — Pull-Based Replication (Recommended):** Harbor pulls from GHCR directly on a schedule — no GitHub Actions involvement, Cloudflare is bypassed entirely.

---

### Step 1 — Add GHCR as a Registry Endpoint

Go to **Administration → Registries → New Endpoint**:

- **Provider:** `Github GHCR` (or `Docker Registry` — both work)
- **Endpoint URL:** `https://ghcr.io`
- **Access ID:** Your GitHub username *(not the org name)*
- **Access Secret:** A GitHub PAT with `read:packages` scope

Test the connection, then save.

![Registry Endpoint](https://github.com/user-attachments/assets/f8170253-b900-4ba2-b26b-f4dd84294e11)

### Step 2 — Create Replication Rules

Go to **Administration → Replications → New Replication Rule**. Create one rule per image:

| Field | Value |
|-------|-------|
| Replication Mode | Pull-based |
| Source Registry | Your GHCR endpoint |
| Source Filter Name | `your-org/your-image` |
| Destination Namespace | Your Harbor project name |
| Trigger | Scheduled — `0 0 * * * *` (hourly) |

![Replication Rule](https://github.com/user-attachments/assets/493fbe2c-c842-49c4-9c24-efd6bd42eb3c)

Harbor only pulls if the image digest has changed — no unnecessary transfers.

> **Find your Policy ID:** Go to `https://your-harbor-domain/harbor/api-explorer` → `GET /replication/policies` → Execute. The `"id"` field in the response is your policy ID.

### Step 3 — Trigger Replication from GitHub Actions (Optional)

Add this at the end of your workflow to trigger replication immediately after every push instead of waiting for the hourly schedule:

```yaml
- name: Trigger Harbor Replication
  env:
    HARBOR_PASSWORD: ${{ secrets.HARBOR_PASSWORD }}
  run: |
    curl -sf -X POST "https://your-harbor-domain/api/v2.0/replication/executions" \
      -u "admin:${HARBOR_PASSWORD}" \
      -H "Content-Type: application/json" \
      -d "{\"policy_id\":1}"
```

Replace `your-harbor-domain` and `policy_id` with your actual values.

---

## ARM64 Fix Summary

| Problem | Fix |
|---------|-----|
| QEMU 8.2.x SIGSEGV in Go binaries | Upgrade to QEMU 9.x via PPA |
| Go `lfstack.push` crash | `vm.legacy_va_layout=1` |
| harbor-db SIGSEGV under QEMU | Replace with `postgres:15-alpine` |
| Healthcheck SIGSEGV → restart loops | Disable all healthchecks |
| binfmt F-flag lost on reboot | systemd service |

## Cloudflare Approach Summary

| Approach | Cloudflare Plan | Complexity |
|----------|----------------|------------|
| WAF Skip Rule | Pro ($20/mo) | Medium |
| Disable Bot Fight Mode | Free | Low |
| Pull-based Replication | Any | Low ✅ |
