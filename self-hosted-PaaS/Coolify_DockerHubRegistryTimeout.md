# Docker Hub Registry Timeout - ISP Peering Issue

> **TL;DR:** `registry-1.docker.io` runs on AWS us-east-1. Some ISPs have poor or broken routing to that AWS region. Docker pulls time out completely. Fix: use a registry mirror that routes around it.

## The Problem

When pulling Docker images, you see:

```
Error response from daemon: Get "https://registry-1.docker.io/v2/": 
net/http: request canceled while waiting for connection 
(Client.Timeout exceeded while awaiting headers)
```

**What's happening:**
- `registry-1.docker.io` resolves to AWS us-east-1 IPs (e.g. `52.71.55.113`)
- Your ISP has poor or no routing to that AWS region
- TCP connection never establishes → timeout
- DNS works fine, the problem is at the network routing layer

---

## Quick Diagnosis

```bash
# Step 1: Check if DNS resolves (should return an IP)
nslookup registry-1.docker.io

# Step 2: Check if the IP is actually reachable (this is where it fails)
curl -v https://registry-1.docker.io/v2/ --max-time 10

# Step 3: Check if general internet works fine
curl https://google.com --max-time 5

# Step 4: Check if Cloudflare-based Docker CDN works (alternative registry path)
curl -v https://production.cloudflare.docker.com --max-time 10
```

**If Step 1 works but Step 2 times out → ISP routing problem confirmed.**

---

## Root Cause: ISP Peering Issues

This is **not** a Docker bug, not a server misconfiguration, and not a firewall issue.

Docker Hub's API endpoint (`registry-1.docker.io`) runs on AWS us-east-1 (Virginia, USA). Some ISPs — especially in Germany — have reduced or eliminated their direct peering with AWS, meaning traffic has to take suboptimal routes that can result in packet loss or complete timeouts.

### Known affected ISPs (non-exhaustive)

| ISP | Region | Issue |
|-----|--------|-------|
| Vodafone Germany | DE | Pulled back from DE-CIX public peering, poor routing to AWS us-east-1 |
| Deutsche Telekom | DE | Similar peering reduction, known issues to Cloudflare/CDNs at peak times |
| Various US ISPs | US | Depending on region, routing to AWS us-east-1 can also be degraded |

> This can happen to **any ISP in any country** that doesn't maintain direct peering with the AWS region that Docker Hub's registry runs on. If you're in the US and hit this issue, same diagnosis applies.

### How to confirm it's your ISP

```bash
# Install traceroute if needed
sudo apt install traceroute

# Trace the route to Docker Hub's IP
traceroute -n 52.71.55.113

# If it dies at a hop that belongs to your ISP → confirmed ISP routing issue
# If it reaches AWS but connection still fails → could be AWS-side or firewall
```

---

## The Fix: Registry Mirror

Route Docker pulls through a mirror that your ISP has good peering with.

```bash
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "ipv6": false,
  "ip6tables": false,
  "default-address-pools": [
    {"base":"10.0.0.0/8","size":24}
  ],
  "registry-mirrors": [
    "https://mirror.gcr.io"
  ]
}
EOF

sudo systemctl restart docker
docker pull hello-world
```

### Mirror options

| Mirror | Provider | Notes |
|--------|----------|-------|
| `https://mirror.gcr.io` | Google | Most reliable globally, good EU peering |
| `https://registry.docker-cn.com` | Docker China | Avoid, often outdated |

> ⚠️ **Speed note:** Even with a working mirror, speeds may be lower than your line's maximum. `mirror.gcr.io` routes through Google's US infrastructure. It works around the AWS routing problem but adds geographic distance. If you need maximum pull speed, consider hosting a local registry mirror on a VPS that has direct peering to Docker Hub.

---

## Preserve Your Existing daemon.json

If you already have settings in `/etc/docker/daemon.json` (log limits, IP pools, IPv6 settings), **don't overwrite them blindly**. Just add the `registry-mirrors` key to your existing config:

```bash
# Check what you already have
cat /etc/docker/daemon.json
```

Then manually add:
```json
"registry-mirrors": [
  "https://mirror.gcr.io"
]
```

---

## Verify the Fix

```bash
# Should pull successfully now
docker pull hello-world

# Confirm which registry was used (check output for mirror URL)
docker info | grep -A5 "Registry Mirrors"
```

---

## When to Suspect This Problem

✅ **This is likely the issue if:**
- `nslookup registry-1.docker.io` returns an IP
- `curl https://registry-1.docker.io/v2/` times out
- `curl https://google.com` works fine
- No firewall rules blocking outbound 443
- Problem is intermittent or started suddenly without any config changes

❌ **Probably something else if:**
- DNS also fails (check `/etc/resolv.conf`)
- All outbound HTTPS fails (check UFW / iptables)
- IPv6 is causing issues (see `Coolify_IPV4-SELFHOSTING.md`)

---

## Related Docs

- [`Coolify_IPV4-SELFHOSTING.md`](./Coolify_IPV4-SELFHOSTING.md) — IPv6 issues causing Docker pull failures