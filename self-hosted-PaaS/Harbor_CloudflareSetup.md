# Harbor Registry — Cloudflare Setup Guide

This guide explains how to connect your private Harbor registry to GitHub Actions when your registry is behind Cloudflare.

---

## The Problem

If your Harbor registry domain is proxied through Cloudflare, GitHub Actions requests will be blocked by Cloudflare's Bot Fight Mode. This affects both direct Docker pushes and API calls to the Harbor replication endpoint.

> **Note:** Deselecting the DNS Proxy in Cloudflare won't help here — when using Cloudflare Tunnel, the proxy is enforced automatically and cannot be disabled per-record.

![DNS Proxy greyed out](https://github.com/user-attachments/assets/0cddfa0e-3e33-4e06-bcd1-6953cd7accf7)

---

## Option 1 — Cloudflare WAF Skip Rule (Pro Plan Only)

On a **paid Cloudflare plan**, you can create a custom WAF rule to skip bot protection for your registry API path.

Go to **Security → WAF → Custom Rules** and create a new rule.

![WAF Custom Rules](https://github.com/user-attachments/assets/aeff8a8d-70c4-40ad-977d-9b3c7b0f67b1)

Click **Edit Expression** and add a rule targeting your Harbor registry domain and the `/api/v2.0/` path. The goal is to prevent Bot Fight Mode from triggering on requests coming from GitHub Actions.

> See also: [docker/login-action Issue #461](https://github.com/docker/login-action/issues/461)  
> *"Cloudflare detects requests from GitHub Actions as bots and blocks them."*

![WAF Expression](https://github.com/user-attachments/assets/8862bfb8-9421-411b-a66f-325500cd6ea5)

> **Free Plan Limitation:** On the free Cloudflare plan, Bot Fight Mode **cannot** be bypassed via WAF rules. In that case, you need to disable Bot Fight Mode entirely for the domain.

![Bot Fight Mode](https://github.com/user-attachments/assets/f5f4323a-6568-4e21-b23c-58f7ed1f7f9d)

---

## Option 2 — Pull-Based Replication (Recommended)

The simpler and more reliable solution is to configure Harbor to **pull** the image from GHCR directly, bypassing Cloudflare entirely.

### Step 1 — Add GHCR as a Registry Endpoint in Harbor

Go to **Administration → Registries → New Endpoint**:

- **Provider:** Docker Registry  
- **Endpoint URL:** `https://ghcr.io`  
- **Access ID:** Your GitHub username *(not the org name)*  
- **Access Secret:** A GitHub PAT with `read:packages` scope

Test the connection, then save.

![Registry Endpoint](https://github.com/user-attachments/assets/f8170253-b900-4ba2-b26b-f4dd84294e11)

### Step 2 — Create a Replication Rule

Go to **Administration → Replications → New Replication Rule**:

- **Replication Mode:** Pull-based  
- **Source Registry:** Your GHCR endpoint  
- **Source Filter Name:** `your-org/your-image`  
- **Destination Namespace:** Your Harbor project name  
- **Trigger:** Scheduled — Cron `0 0 * * * *` (every hour)

![Replication Rule](https://github.com/user-attachments/assets/493fbe2c-c842-49c4-9c24-efd6bd42eb3c)

Harbor will automatically check for new images and only pull if something has changed.

---

## Optional — Trigger Replication from GitHub Actions

If you want Harbor to replicate immediately after every push, add this step at the end of your workflow:

```yaml
- name: Trigger Harbor Replication
  run: curl -sf -X POST "https://YOUR-HARBOR-DOMAIN/api/v2.0/replication/executions" -u "admin:${{ secrets.HARBOR_PASSWORD }}" -H "Content-Type: application/json" -d '{"policy_id": 1}'
```

> Replace `YOUR-HARBOR-DOMAIN` with your actual domain and verify the `policy_id` matches your replication rule. You can find the ID via the Harbor Swagger UI at `/harbor/api-explorer` under `GET /replication/policies`.

---

## Summary

| Approach | Cloudflare Plan | Complexity |
|---|---|---|
| WAF Skip Rule | Pro ($20/mo) or higher | Medium |
| Disable Bot Fight Mode | Free | Low |
| Pull-based Replication | Any | Low ✅ |

The **pull-based replication** approach is recommended — it avoids all Cloudflare restrictions and keeps your setup clean.
