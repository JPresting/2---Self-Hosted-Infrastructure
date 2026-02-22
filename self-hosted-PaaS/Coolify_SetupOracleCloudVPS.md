# Server & Cloudflare Tunnel Architecture Guide

> **Note:** It's important to remember that the entire Routing/Domain logic on Cloudflare is **TUNNEL-BASED** not **DOMAIN-BASED**.

## 1. The Strategy (One Tunnel Per Server)
To ensure stability and isolate networking issues, strictly follow this rule:

> **1 Physical Server = 1 Dedicated Cloudflare Tunnel**

* **Server A (Main/Home):** Uses its own dedicated tunnel.
* **Server B (Cloud/Remote):** Uses its own separate dedicated tunnel.
* **Rule:** Never share tokens. Each server gets its own dedicated line.

---

## 2. Step-by-Step Setup

### Case A: Fresh Server (Nothing Running Yet)

#### Phase A: Create Tunnel in Cloudflare
1.  Go to **Zero Trust Dashboard** -> **Networks** -> **Tunnels**.
2.  Click **Create a Tunnel**.
3.  Name it clearly (e.g., `your-server-name`).
4.  Click **Save Tunnel**.
5.  **Copy the Token.**

#### Phase B: Configure SSH Access in Cloudflare
Before leaving Cloudflare, define how to reach this server via SSH.
1.  In the Tunnel configuration, go to **Public Hostname**.
2.  **Add a new Public Hostname**:
    * **Subdomain:** Enter a unique SSH identifier (e.g., `ssh-server-01`).
    * **Domain:** Select your root domain (e.g., `example.com`).
    * **Service:** `SSH`
    * **URL:** `localhost:22`
    * **Path:** Leave empty.
3.  **Save hostname.**
    * *Result:* `ssh-server-01.example.com` now points securely to port 22 on this server.

#### Phase C: Generate SSH Key in Coolify
1.  Coolify → **Keys & Tokens → New Private Key**
2.  Click **Generate new ED25519 SSH Key**
3.  Give it a descriptive name (e.g., `your-server-name-key`)
4.  **Copy the Public Key** that appears

#### Phase D: Add Public Key to Server
SSH into the server directly (via its public IP), then run:

```bash
echo "ssh-ed25519 AAAA...your-public-key... coolify-generated-ssh-key" >> ~/.ssh/authorized_keys
```

> This authorizes Coolify to connect to the server via SSH.

#### Phase E: Add Server in Coolify
1.  Coolify → **Servers → Add Server**
2.  Fill in:

| Field | Value |
|---|---|
| **Name** | Descriptive name for this server |
| **IP Address/Domain** | Server **public IP** (not the tunnel domain!) |
| **Port** | `22` |
| **User** | `ubuntu` for Oracle Cloud / `root` for most other providers |
| **Private Key** | Key generated in Phase C |

3.  Click **Continue**
4.  Click **Validate Server & Install Docker Engine**
    * Wait until all checks show ✅

#### Phase F: Configure Cloudflare Tunnel in Coolify
1.  Server → **Configuration** -> **Cloudflare Tunnel** (left menu)
2.  Enter:
    * **Cloudflare Token:** Token from Phase A
    * **Configured SSH Domain:** `ssh-server-01.example.com` *(no http/https prefix)*
3.  Click **Continue**
    * Coolify installs cloudflared automatically as a Docker container.
    * No manual cloudflared installation on the server needed.
4.  Wait until the status shows **Proxy Running** ✅

---

### Case B: Existing Server (Apps Already Running)

> Use this when the server already has applications running and you want to add it
> to Coolify for future deployments without touching existing apps.

#### Phase A: Create Tunnel in Cloudflare
1.  Go to **Zero Trust Dashboard** -> **Networks** -> **Tunnels**.
2.  Click **Create a Tunnel** and name it clearly (e.g., `your-server-name`).
3.  **Copy the Token.**

#### Phase B: Configure SSH Access in Cloudflare
1.  In the Tunnel configuration, go to **Public Hostname**.
2.  **Add a new Public Hostname**:
    * **Subdomain:** Enter a unique SSH identifier (e.g., `ssh-server-01`).
    * **Domain:** Select your root domain (e.g., `example.com`).
    * **Service:** `SSH`
    * **URL:** `localhost:22`
    * **Path:** Leave empty.
3.  **Save hostname.**
    * *Result:* `ssh-server-01.example.com` → `ssh://localhost:22`

#### Phase C: Generate SSH Key in Coolify
1.  Coolify → **Keys & Tokens → New Private Key**
2.  Click **Generate new ED25519 SSH Key**
3.  Give it a descriptive name (e.g., `your-server-name-key`)
4.  **Copy the Public Key** that appears

#### Phase D: Add Public Key to Server
SSH into the server directly (via its public IP), then run:

```bash
echo "ssh-ed25519 AAAA...your-public-key... coolify-generated-ssh-key" >> ~/.ssh/authorized_keys
```

> This authorizes Coolify to connect to the server via SSH.

#### Phase E: Free up Port 80
> ⚠️ Some servers (e.g. Oracle Cloud) run Nginx on Port 80 by default.
> Coolify's Traefik requires Port 80 — any existing service on it must be stopped first.
> Apps running through that service will be offline until migrated to Coolify.

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

#### Phase F: Fix Docker
> Some cloud providers (e.g. Oracle Cloud) install Docker via the wrong method,
> resulting in a missing Compose plugin or a broken daemon.

```bash
# Install Docker via official script — includes the Compose plugin
curl -fsSL https://get.docker.com | sudo sh
# Wait through the 20 second warning — do NOT press Ctrl+C

# If the Docker daemon fails to start afterwards:
sudo systemctl restart containerd   # Docker depends on containerd — start it first
sudo systemctl start docker
```

#### Phase G: Add Server in Coolify
1.  Coolify → **Servers → Add Server**
2.  Fill in:

| Field | Value |
|---|---|
| **Name** | Descriptive name for this server |
| **IP Address/Domain** | Server **public IP** (not the tunnel domain!) |
| **Port** | `22` |
| **User** | `ubuntu` for Oracle Cloud / `root` for most other providers |
| **Private Key** | Key generated in Phase C |

3.  Click **Continue**
4.  Click **Validate Server & Install Docker Engine**

If validation fails:

| Error | Fix |
|---|---|
| `apt lock` error | `sudo kill <PID> && sudo rm /var/lib/apt/lists/lock` → Retry Validation |
| Docker Compose not found | Re-run Phase F → Retry Validation |
| Port 80 in use | Re-run Phase E → Retry Validation |

#### Phase H: Configure Cloudflare Tunnel in Coolify
1.  Server → **Configuration** -> **Cloudflare Tunnel** (left menu)
2.  Enter:
    * **Cloudflare Token:** Token from Phase A
    * **Configured SSH Domain:** `ssh-server-01.example.com` *(no http/https prefix)*
3.  Click **Continue**
    * Coolify installs cloudflared automatically as a Docker container.
    * No manual cloudflared installation on the server needed.
4.  Wait until the status shows **Proxy Running** ✅

---

## 3. Deploying Apps (Routing Logic)
When you deploy a new application (e.g., CMS, Database, API) on this server:

### Step 1: Configure your Coolify project (e.g. Docker Compose)
**Crucial:** Use `expose` to make the port visible to the internal proxy (Traefik). **Do NOT** use `ports`, as this would bypass the tunnel and open the port to the public internet.

**Correct Example:**
```yaml
services:
  my-app:
    image: my-image:latest
    expose:
      - "8080"   # ✅ CORRECT: Visible to Traefik/Coolify only
    # ports:
    #   - "8080:8080" ❌ WRONG: Exposes port to public internet (security risk + has to be mentioned in your Cloudflare Tunnel)
```

### Step 2: Configure Cloudflare (Tunnel Configuration)

In Cloudflare (Tunnel Configuration):
*   Open the **Dedicated Tunnel** for this server.
*   Add a **Public Hostname**.
*   **Subdomain:** Match the subdomain used in Coolify (e.g., `app`).
*   **Service:** `HTTP` -> `localhost:80`
*   **Save.**

**Why this works:**
Cloudflare sees the specific rule (`app.example.com`) in this specific Tunnel and routes it there immediately. It ignores any wildcards (`*.example.com`) that might exist on other tunnels or servers.