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

### Phase A: Create Tunnel in Cloudflare
1.  Go to **Zero Trust Dashboard** -> **Networks** -> **Tunnels**.
2.  Click **Create a Tunnel**.
3.  Name it clearly (e.g., `client-cloud-server`).
4.  Click **Save Tunnel**.
5.  **Copy the Token:** Copy the command/token block for the relevant OS (Debian/Ubuntu).

### Phase B: Configure SSH Access (Critical)
Before leaving Cloudflare, define how to reach this server via SSH.
1.  In the Tunnel configuration, go to **Public Hostname**.
2.  **Add a new Public Hostname**:
    * **Subdomain:** Enter a unique SSH identifier (e.g., `ssh-server-01`).
    * **Domain:** Select your root domain (e.g., `example.com`).
    * **Service:** `SSH` (Select from dropdown).
    * **URL:** `localhost:22`
3.  **Save hostname.**
    * *Result:* `ssh-server-01.example.com` now points securely to port 22 on this specific server.

### Phase C: Connect in Coolify
1.  Log in to Coolify.
2.  Navigate to **Servers** -> Select the **Target Server**.
3.  Go to **Configuration** -> **Cloudflare Tunnel**.
4.  **Paste Token:** Paste the token from Phase A into the "Cloudflare Token" field.
5.  **Configured SSH Domain:** Enter the FQDN you set in Phase B (e.g., `ssh-server-01.example.com`).
    * *Note: Do not add http/https prefix here.*
6.  Click **(Re)Start Proxy** or **Install**.
    * Wait for the logs to show "Healthy".

---

## 3. Deploying Apps (Routing Logic)
When you deploy a new application (e.g., CMS, Database, API) on this server:

1.  **In Coolify:**
    * Set the domain (e.g., `app.example.com`).
    * **Do not** expose ports (0.0.0.0:80). The internal proxy handles it.

2.  **In Cloudflare (Tunnel Configuration):**
    * Open the **Dedicated Tunnel** for this server.
    * Add a **Public Hostname**.
    * **Subdomain:** Match the subdomain used in Coolify (e.g., `app`).
    * **Service:** `HTTP` -> `localhost:80`
    * **Save.**

**Why this works:**
Cloudflare sees the specific rule (`app.example.com`) in this specific Tunnel and routes it there immediately. It ignores any wildcards (`*.example.com`) that might exist on other tunnels or servers.