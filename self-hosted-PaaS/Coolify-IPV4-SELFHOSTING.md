# Fixing Docker IPv6 Issues on Self-Hosted Servers

> **TL;DR:** Docker prefers IPv6 when available. If your ISP or network has unstable IPv6, Docker pulls fail. Solution: Disable IPv6 system-wide.

## The Problem

When pulling Docker images, you see errors like:

```
failed to copy: read tcp [2a02:908:c221:6500:...]:39464->[2606:4700:2ff9::1]:443: read: connection reset by peer
```

**What's happening:**
1. Docker Hub uses Cloudflare CDN
2. Your server resolves `registry-1.docker.io` to IPv6 addresses
3. IPv6 connection is unstable or blocked
4. Pull fails with "connection reset"

---

## Quick Diagnosis

```bash
# Check if IPv6 is enabled (0 = enabled, 1 = disabled)
cat /proc/sys/net/ipv6/conf/all/disable_ipv6

# Check DNS resolution for Docker Hub
dig registry-1.docker.io AAAA +short    # IPv6 addresses
dig registry-1.docker.io A +short       # IPv4 addresses

# If AAAA returns results and your IPv6 is unstable → problem found
```

---

## The Fix

### Step 1: Disable IPv6 (Immediate)

```bash
sudo sysctl -w net.ipv6.conf.all.disable_ipv6=1
sudo sysctl -w net.ipv6.conf.default.disable_ipv6=1
```

### Step 2: Make it Permanent

```bash
# Check if already configured
grep -i "disable_ipv6" /etc/sysctl.conf

# If NOT present, add the settings
echo "net.ipv6.conf.all.disable_ipv6 = 1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv6.conf.default.disable_ipv6 = 1" | sudo tee -a /etc/sysctl.conf

# Apply changes
sudo sysctl -p
```

### Step 3: Verify

```bash
# Should return "1"
cat /proc/sys/net/ipv6/conf/all/disable_ipv6
```

### Step 4: Restart Docker

```bash
sudo systemctl restart docker
```

### Step 5: Test

```bash
docker pull hello-world
```

---

## ⚠️ Important: DNS May Break

If your server's DNS is configured with **IPv6-only DNS servers** (common with some routers), disabling IPv6 will break DNS resolution.

### Check DNS Configuration

```bash
resolvectl status | head -15
```

**Problem indicator:**
```
Current DNS Server: fd28:2381:5c4e:0:...    ← IPv6 only!
       DNS Servers: fd28:... 2a02:...       ← All IPv6!
```

### Fix: Configure IPv4 DNS

```bash
# Create config directory
sudo mkdir -p /etc/systemd/resolved.conf.d/

# Add IPv4 DNS servers
sudo tee /etc/systemd/resolved.conf.d/dns.conf << 'EOF'
[Resolve]
DNS=192.168.178.1 8.8.8.8 1.1.1.1
FallbackDNS=8.8.4.4
EOF

# Restart DNS resolver
sudo systemctl restart systemd-resolved

# Verify
resolvectl status | grep -A2 "Global"
```

> **Note:** Replace `192.168.178.1` with your router's IP (run `ip route | grep default` to find it).

---

## Verify Everything Works

```bash
# 1. IPv6 disabled
cat /proc/sys/net/ipv6/conf/all/disable_ipv6
# Expected: 1

# 2. DNS works
dig google.com +short
# Expected: IP address(es)

# 3. Docker pulls work
docker pull alpine:latest
# Expected: Success
```

### Verify IPv4 is Used (Optional)

While pulling an image, check active connections:

```bash
# Should show IPv4 addresses (like 100.x.x.x, 34.x.x.x)
ss -tn | grep -E "100\.|34\.|44\.|98\."

# Should be EMPTY (no IPv6)
ss -tn | grep "2600:"
```

---

## What About daemon.json?

You might see advice to add this to `/etc/docker/daemon.json`:

```json
{
  "ipv6": false,
  "ip6tables": false
}
```

**This does NOT fix the problem!** These settings only affect Docker's internal container networks, not outbound connections to Docker Registry.

The system-level `sysctl` fix is the correct solution.

---

## Complete Setup Script

For fresh Ubuntu 22.04/24.04 servers:

```bash
#!/bin/bash
# disable-ipv6.sh - Run with sudo

set -e

echo "=== Disabling IPv6 ==="

# Disable IPv6 immediately
sysctl -w net.ipv6.conf.all.disable_ipv6=1
sysctl -w net.ipv6.conf.default.disable_ipv6=1

# Make permanent (avoid duplicates)
if ! grep -q "disable_ipv6" /etc/sysctl.conf; then
    echo "net.ipv6.conf.all.disable_ipv6 = 1" >> /etc/sysctl.conf
    echo "net.ipv6.conf.default.disable_ipv6 = 1" >> /etc/sysctl.conf
fi

sysctl -p

echo "=== Configuring IPv4 DNS ==="

# Get default gateway (router IP)
ROUTER_IP=$(ip route | grep default | awk '{print $3}')

mkdir -p /etc/systemd/resolved.conf.d/

cat > /etc/systemd/resolved.conf.d/dns.conf << EOF
[Resolve]
DNS=${ROUTER_IP} 8.8.8.8 1.1.1.1
FallbackDNS=8.8.4.4
EOF

systemctl restart systemd-resolved

echo "=== Restarting Docker ==="
systemctl restart docker

echo "=== Testing ==="
echo "IPv6 disabled: $(cat /proc/sys/net/ipv6/conf/all/disable_ipv6)"
echo "DNS test: $(dig +short google.com | head -1)"
echo "Docker test:"
docker pull hello-world

echo "=== Done! ==="
```

**Usage:**
```bash
curl -O https://your-server/disable-ipv6.sh
chmod +x disable-ipv6.sh
sudo ./disable-ipv6.sh
```

---

## Reverting Changes

If you need IPv6 back:

```bash
# Remove from sysctl.conf
sudo sed -i '/disable_ipv6/d' /etc/sysctl.conf

# Enable IPv6
sudo sysctl -w net.ipv6.conf.all.disable_ipv6=0
sudo sysctl -w net.ipv6.conf.default.disable_ipv6=0

# Remove custom DNS config
sudo rm /etc/systemd/resolved.conf.d/dns.conf
sudo systemctl restart systemd-resolved

# Restart Docker
sudo systemctl restart docker
```

---

## Summary

| Change | File | Purpose |
|--------|------|---------|
| Disable IPv6 | `/etc/sysctl.conf` | Force all connections to use IPv4 |
| IPv4 DNS | `/etc/systemd/resolved.conf.d/dns.conf` | Ensure DNS works without IPv6 |

Both changes survive reboots.

---

## When to Use This

✅ **Do use if:**
- Docker pulls fail with IPv6 connection errors
- Your ISP has unstable IPv6
- You're behind NAT with broken IPv6
- You don't need IPv6 for anything

❌ **Don't use if:**
- You have services that require IPv6
- Your network is IPv6-only
- You need IPv6 for specific containers
