# Harbor Registry on ARM64 (Oracle Cloud Ampere)

> **The problem:** Harbor does not officially support ARM64. All Harbor Docker images are AMD64 only.  
> **The solution:** Use QEMU user-space emulation with the `F` (fix-binary) flag to run AMD64 containers transparently on ARM64.

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

> This may take a few minutes depending on your connection speed.  
> After install, you may see a message about a pending kernel upgrade — **reboot** before continuing.

```bash
sudo reboot
```

---

## Step 2: Register QEMU for AMD64 with the F (fix-binary) Flag

The **F flag is critical** — without it, QEMU is not accessible *inside* Docker containers.

```bash
# Remove existing registration (if any)
echo -1 | sudo tee /proc/sys/fs/binfmt_misc/qemu-x86_64

# Register with F flag
echo ':qemu-x86_64:M:0:\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00\x3e\x00:\xff\xff\xff\xff\xff\xfe\xfe\x00\xff\xff\xff\xff\xff\xff\xff\xff\xfe\xff\xff\xff:/usr/bin/qemu-x86_64-static:F' | sudo tee /proc/sys/fs/binfmt_misc/register
```

Verify it's registered:
```bash
sudo update-binfmts --display qemu-x86_64
```

---

## Step 3: Download and Extract Harbor

Use the **online installer** (not offline) so Docker pulls the correct images at runtime.

```bash
cd /opt
sudo mkdir harbor && cd harbor

sudo wget https://github.com/goharbor/harbor/releases/download/v2.12.0/harbor-online-installer-v2.12.0.tgz
sudo tar xzvf harbor-online-installer-v2.12.0.tgz --strip-components=1
```

---

## Step 4: Configure harbor.yml

```bash
sudo cp harbor.yml.tmpl harbor.yml
sudo nano harbor.yml
```

Key settings to change:

```yaml
hostname: registry2.stardawn-service.com

http:
  port: 8888

# IMPORTANT: Comment out the entire https block — no certs needed (Cloudflare handles SSL)
# https:
#   port: 443
#   certificate: /your/certificate/path
#   private_key: /your/private/key/path

external_url: https://registry2.stardawn-service.com

harbor_admin_password: YOUR_PASSWORD_HERE
```

> **Why comment out https?** Cloudflare Tunnel handles SSL termination externally.  
> Harbor runs plain HTTP internally on port 8888, Cloudflare serves it as HTTPS.

---

## Step 5: Run prepare and install

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

## Step 6: Verify Harbor is running

```bash
sudo docker compose ps
```

Wait until all containers show `healthy` (may take 2-3 minutes due to QEMU emulation overhead).

Then test the API:
```bash
curl -u "admin:YOUR_PASSWORD" http://localhost:8888/v2/_catalog
```

Expected response: `{"repositories":[]}`

---

## Step 7: Cloudflare Tunnel

In your Cloudflare Zero Trust dashboard, add a public hostname route:

| Field | Value |
|-------|-------|
| Subdomain | `registry2` |
| Domain | `stardawn-service.com` |
| Path | *(leave empty)* |
| Type | HTTP |
| URL | `localhost:8888` |

Harbor UI will be available at: `https://registry2.stardawn-service.com/harbor`

---

## Notes

- **QEMU only affects AMD64 containers** — all native ARM64 containers (Coolify, n8n, etc.) run unaffected at full speed.
- **Performance:** Harbor runs ~20-40% slower than native due to emulation. For a registry this is irrelevant — the bottleneck is always network/disk, not CPU.
- **Persistence:** The binfmt F-flag registration is lost on reboot. Add it to `/etc/rc.local` or a systemd service if you need it to survive reboots automatically.
- **Harbor management:** `cd /opt/harbor && sudo docker compose down/up -d`

---

## Reboot persistence (optional)

Create a systemd service so the QEMU registration survives reboots:

```bash
sudo nano /etc/systemd/system/qemu-binfmt-x86.service
```

```ini
[Unit]
Description=Register QEMU x86_64 binfmt with F flag
After=local-fs.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo -1 > /proc/sys/fs/binfmt_misc/qemu-x86_64 2>/dev/null; echo ":qemu-x86_64:M:0:\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00\x3e\x00:\xff\xff\xff\xff\xff\xfe\xfe\x00\xff\xff\xff\xff\xff\xff\xff\xff\xfe\xff\xff\xff:/usr/bin/qemu-x86_64-static:F" > /proc/sys/fs/binfmt_misc/register'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable qemu-binfmt-x86.service
sudo systemctl start qemu-binfmt-x86.service
```





