# Harbor Registry on ARM64 (Oracle Cloud Ampere)

> **The problem:** Harbor does not officially support ARM64. All Harbor Docker images are AMD64 only.  
> **The solution:** Use QEMU user-space emulation with the `F` (fix-binary) flag to run AMD64 containers transparently on ARM64, plus a few critical kernel and compose fixes.

---

## Prerequisites

- Ubuntu 22.04/24.04 on ARM64 (Oracle Cloud Ampere A1 or similar)
- Docker + Docker Compose installed
- Cloudflare Tunnel configured for your domain

---

## Step 1: Install QEMU User Static

```bash
sudo apt-get update
sudo apt-get install -y qemu-user-static binfmt-support
```

> After install, you may see a message about a pending kernel upgrade — **reboot** before continuing.

```bash
sudo reboot
```

---

## Step 2: Upgrade QEMU to 9.x (Critical)

The default QEMU version on Ubuntu (8.2.x) has a bug that causes Go binaries to crash with `QEMU internal SIGSEGV`. Harbor's core, jobservice, registry and registryctl are all written in Go — they will crash on startup with QEMU 8.2.x.

**Fix: upgrade QEMU to 9.x via the canonical server backports PPA:**

```bash
sudo add-apt-repository ppa:canonical-server/server-backports -y
sudo apt-get update
sudo apt-get install -y qemu-user-static
```

Verify the version:
```bash
qemu-x86_64-static --version
# Should show: qemu-x86_64 version 9.0.2 (or higher)
```

---

## Step 3: Register QEMU for AMD64 with the F (fix-binary) Flag

The **F flag is critical** — without it, QEMU is not accessible *inside* Docker containers.

```bash
# Remove existing registration (if any)
echo -1 | sudo tee /proc/sys/fs/binfmt_misc/qemu-x86_64

# Register with F flag
echo ':qemu-x86_64:M:0:\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00\x3e\x00:\xff\xff\xff\xff\xff\xfe\xfe\x00\xff\xff\xff\xff\xff\xff\xff\xff\xfe\xff\xff\xff:/usr/bin/qemu-x86_64-static:F' | sudo tee /proc/sys/fs/binfmt_misc/register
```

Verify:
```bash
cat /proc/sys/fs/binfmt_misc/qemu-x86_64
# Should show: enabled, flags: F
```

---

## Step 4: Fix the Kernel Virtual Address Layout (Critical)

On Oracle Cloud ARM64, the kernel uses a **top-down mmap layout** by default, allocating memory from high addresses (~256TB). Go's garbage collector (`lfstack`) only supports pointer addresses below 128TB (bit 47 must be 0). This causes all Go-based Harbor containers to crash immediately with:

```
runtime: lfstack.push invalid packing
fatal error: lfstack.push
```

**Fix: force legacy (bottom-up) mmap layout:**

```bash
# Apply immediately (no reboot needed)
sudo sysctl -w vm.legacy_va_layout=1

# Make persistent across reboots
echo "vm.legacy_va_layout=1" | sudo tee -a /etc/sysctl.conf
```

---

## Step 5: Download and Extract Harbor

Use the **online installer** (not offline) so Docker pulls the correct images at runtime.

```bash
cd /opt
sudo mkdir harbor && cd harbor

sudo wget https://github.com/goharbor/harbor/releases/download/v2.12.0/harbor-online-installer-v2.12.0.tgz
sudo tar xzvf harbor-online-installer-v2.12.0.tgz --strip-components=1
```

---

## Step 6: Configure harbor.yml

```bash
sudo cp harbor.yml.tmpl harbor.yml
sudo nano harbor.yml
```

Key settings to change:

```yaml
hostname: registry2.yourdomain.com

http:
  port: 8888

# IMPORTANT: Comment out the entire https block — Cloudflare handles SSL
# https:
#   port: 443
#   certificate: /your/certificate/path
#   private_key: /your/private/key/path

external_url: https://registry2.yourdomain.com

harbor_admin_password: YOUR_ADMIN_PASSWORD
```

> **Why comment out https?** Cloudflare Tunnel handles SSL termination externally. Harbor runs plain HTTP internally on port 8888, Cloudflare serves it as HTTPS.

---

## Step 7: Run prepare and install

```bash
sudo ./prepare
sudo ./install.sh
```

You will see warnings like:
```
WARNING: The requested image's platform (linux/amd64) does not match the detected host platform (linux/arm64/v8)
```

<img width="1033" height="277" alt="image" src="https://github.com/user-attachments/assets/af421f7f-9a1f-492e-b6f8-52c3c929b81d" />

**This is expected and harmless** — QEMU is doing its job.

---

## Step 8: Create the Docker Compose Override (Critical)

Two problems require a `docker-compose.override.yml`:

1. **harbor-db** (`goharbor/harbor-db`) crashes under QEMU — PostgreSQL is unstable under AMD64 emulation on ARM64. Replace it with the official `postgres:15-alpine` which has native ARM64 support.
2. **Healthchecks** run via QEMU and cause SIGSEGV crashes, marking healthy containers as `unhealthy` and triggering restart loops. Disable them all.

First, find the DB password Harbor generated during `./prepare`:
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

Restart Harbor with the override applied:
```bash
cd /opt/harbor
sudo docker compose down -v
sudo docker compose up -d
```

---

## Step 9: Verify Harbor is running

```bash
sudo docker compose ps
```

All containers should show `Up` (no `Restarting`, no `unhealthy`):

```
harbor-core         Up
harbor-db           Up
harbor-jobservice   Up
harbor-log          Up (healthy)
harbor-portal       Up (healthy)
nginx               Up (healthy)
redis               Up
registry            Up
registryctl         Up
```

Test the API:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8888
# Expected: 200
```

---

## Step 10: Cloudflare Tunnel

In your Cloudflare Zero Trust dashboard, add a public hostname route:

| Field | Value |
|-------|-------|
| Subdomain | `registry2` |
| Domain | `yourdomain.com` |
| Path | *(leave empty)* |
| Type | HTTP |
| URL | `localhost:8888` |

Harbor UI will be available at: `https://registry2.yourdomain.com/harbor`  
Login: `admin` / your configured admin password

---

## Step 11: Reboot Persistence for binfmt

The binfmt F-flag registration is lost on reboot. Create a systemd service:

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

> **Note:** On Oracle Cloud, `systemctl status` for oneshot services may return `Failed to get properties: Invalid argument` — this is a known Oracle Cloud kernel quirk and can be safely ignored. Verify it actually worked:
> ```bash
> cat /proc/sys/fs/binfmt_misc/qemu-x86_64
> # Should show: enabled, flags: F
> ```

---

## Summary of Fixes Applied

| Problem | Fix |
|---------|-----|
| QEMU 8.2.x SIGSEGV in Go binaries | Upgrade to QEMU 9.x via PPA |
| Go `lfstack.push` crash (high VA addresses) | `vm.legacy_va_layout=1` in sysctl |
| harbor-db SIGSEGV under QEMU | Replace with `postgres:15-alpine` (native ARM64) |
| Healthcheck SIGSEGV → restart loops | Disable all healthchecks in compose override |
| binfmt F-flag lost on reboot | systemd service |

---

## Notes

- **QEMU only affects AMD64 containers** — all native ARM64 containers (Coolify, n8n, etc.) run unaffected at full speed.
- **vm.legacy_va_layout=1** has no functional impact on native ARM64 apps — it only changes how mmap allocates addresses, keeping them in the lower VA range that Go expects.
- **Performance:** Harbor runs ~20-40% slower than native due to emulation overhead. For a registry this is irrelevant — the bottleneck is always network/disk, not CPU.
- **Harbor management:** `cd /opt/harbor && sudo docker compose down/up -d`
