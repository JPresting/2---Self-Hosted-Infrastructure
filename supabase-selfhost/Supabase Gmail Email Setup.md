# Supabase Self-Hosted Email Setup
## Gmail SMTP + Noreply Alias + Caddy Template Server + Cloudflare

A complete guide to setting up production-grade transactional emails for a self-hosted Supabase instance running on Coolify. This covers everything from SMTP configuration to custom branded HTML templates served via Caddy, routed through Cloudflare.

---

## Overview

The final architecture looks like this:

```
Supabase Auth (GoTrue)
  └── reads template HTML from Caddy (internal Docker network)
  └── sends email via Gmail SMTP as noreply@yourdomain.com
        └── Gmail fetches images from Caddy via Cloudflare HTTPS
              └── Cloudflare Access bypasses /assets/* for Google's proxy
```

---

## Part 1 — Gmail SMTP Setup

### 1.1 Enable 2-Step Verification

Before you can generate an App Password (required for Gmail SMTP), 2FA must be active on your Google Workspace account.

Go to [myaccount.google.com](https://myaccount.google.com) → **Security** → **2-Step Verification** and enable it.

![2FA enabled on Google Account](screenshots/02-2fa-myaccount.png)

> **Note:** As a Google Workspace admin, you also need to allow users to enable 2SV in the Admin Console under **Security → Authentication → 2-Step Verification**.

![2FA in Admin Console](screenshots/01-2fa-admin-console.png)

### 1.2 Generate an App Password

Once 2FA is active, go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords):

1. Enter a name, e.g. `Supabase SMTP`
2. Click **Create**
3. Copy the 16-character password — this is your `SMTP_PASS`

> ⚠️ The password has spaces when displayed — **remove them** before pasting into your ENV. `abcd efgh ijkl mnop` → `abcdefghijklmnop`

---

## Part 2 — Noreply Address via Google Group

Rather than sending from your personal admin account, you want emails to appear as `noreply@yourdomain.com`. The cleanest way to achieve this in Google Workspace is via a **Google Group** combined with a **Gmail Send-As alias**.

### Why a Group, not a direct alias?

A Google Group creates a real, deliverable mailbox at `noreply@yourdomain.com`. Without it, Gmail's verification email for the Send-As alias has nowhere to land. A simple routing rule or directory alias alone won't work for this purpose.

### 2.1 Create the Google Group

**Google Admin Console → Directory → Groups → Create Group**

- **Group name:** `Noreply`
- **Group email:** `noreply@yourdomain.com`
- **Description:** Noreply Auto Confirmation Emails

![Create Group form](screenshots/03-create-group.png)

On the next step, set **Access type** to **Announcement Only** and **Who can join** to **Only invited users**:

![Group access type](screenshots/04-group-access-type.png)

### 2.2 Add Yourself as Member

Open the group → **Members** → add your admin account as Owner with **Subscription: Each email**. This routes all group mail to your inbox.

![Group members with Each email subscription](screenshots/05-group-members.png)

### 2.3 Allow External Posting (Temporarily)

Gmail's verification email for the Send-As alias comes from `send-as-noreply@google.com` — an external sender. By default, Google Workspace blocks external emails to groups.

**Admin Console → Apps → Google Workspace → Groups for Business → Sharing settings**

✅ Check **"Group owners can allow incoming email from outside the organization"** → Save

![Groups for Business sharing settings](screenshots/06-groups-sharing-settings.png)

Without this setting, "Anyone on the web" is grayed out in the group's posting settings:

![Who can post blocked](screenshots/07-who-can-post-blocked.png)

After enabling it in Admin Console, go to the group settings → **Who can post** → **Anyone on the web** → Save.

> ⚠️ This is temporary. Revert to "Group managers" after completing verification.

### 2.4 Add Send-As Alias in Gmail

In Gmail (logged in as your admin account) → **Settings → Accounts → Send mail as → Add another email address**:

- **Name:** `YourCompany` (display name recipients see)
- **Email address:** `noreply@yourdomain.com`
- **Treat as alias:** ✅
- **Reply-to:** leave empty

![Add email alias form](screenshots/08-add-alias.png)

Click **Next Step** → Gmail sends a verification email to `noreply@yourdomain.com` → it lands in your inbox via the Group → click **Confirm**:

![Alias confirmed](screenshots/09-alias-confirmed.png)

### 2.5 Revert Group Posting Settings

Set **Who can post** back to **Group managers** and optionally uncheck the Admin Console setting from step 2.3.

### 2.6 Result

Your Gmail **Send mail as** section now shows the alias:

![Send mail as result](screenshots/10-send-mail-as.png)

---

## Part 3 — Caddy Template Server

Supabase Auth (GoTrue) loads HTML templates via URL at email-send time. We host these on a dedicated Caddy file server running on the same host as Supabase.

### 3.1 Compose

```yaml
services:
  templates-server:
    image: caddy:2.9.1
    volumes:
      - ./templates:/templates:ro
    entrypoint: caddy file-server -r /templates --listen :80
    expose:
      - "80"
    ports:
      - "8085:80"
```

> `expose` is for internal Docker networking. `ports` maps to the host so Cloudflare Tunnel can reach it via `localhost:8085`.

### 3.2 File Structure

```
volumes/templates/
  assets/
    logo.png
    icon.png
  yourbrand/
    en/
      magic-link.html
      confirmation.html
      recovery.html
    de/
      magic-link.html
      confirmation.html
      recovery.html
  otherbrand/
    en/
      ...
```

### 3.3 Connect to Supabase Docker Network

After deploying, Supabase Auth runs in its own Docker network. Connect the Caddy container to it:

```bash
docker network connect <supabase-network-id> templates-server-<service-id>
```

Find the Supabase network:
```bash
docker inspect supabase-auth-<id> | grep -A3 "Networks"
```

> ⚠️ **Important:** This connection is lost on every Coolify **Deploy** (not Restart). Consider making it permanent via Coolify's network settings or the Compose file.

Verify from inside the Supabase Auth container:
```bash
docker exec supabase-auth-<id> wget -qO- http://templates-server-<id>/yourbrand/en/confirmation.html | head -5
```

---

## Part 4 — Supabase ENV Configuration

```env
# SMTP
SMTP_ADMIN_EMAIL=noreply@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=admin@yourdomain.com         # your actual Gmail account
SMTP_PASS=abcdefghijklmnop             # App Password, no spaces
SMTP_SENDER_NAME=YourCompany

# Templates — internal Docker URL for GoTrue to load HTML
MAILER_TEMPLATES_CONFIRMATION=http://templates-server-<id>/yourbrand/en/confirmation.html
MAILER_TEMPLATES_MAGIC_LINK=http://templates-server-<id>/yourbrand/en/magic-link.html
MAILER_TEMPLATES_RECOVERY=http://templates-server-<id>/yourbrand/en/recovery.html

# Subject lines
MAILER_SUBJECTS_CONFIRMATION=Confirm your email — YourCompany
MAILER_SUBJECTS_MAGIC_LINK=Your login link — YourCompany
MAILER_SUBJECTS_RECOVERY=Reset your password — YourCompany
MAILER_SUBJECTS_EMAIL_CHANGE=Your email has been changed — YourCompany
MAILER_SUBJECTS_INVITE=You've been invited — YourCompany

# URL paths
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_MAGIC_LINK=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
```

> **Key distinction:**
> - Template HTML files → loaded by **GoTrue internally** → use `http://templates-server-<id>/...`
> - Images inside the HTML → loaded by **Gmail's proxy externally** → must use `https://your-public-domain.com/assets/...`

---

## Part 5 — Cloudflare Configuration

### 5.1 Tunnel — Add Public Hostname

In the Cloudflare Tunnel for your server, add a new Public Hostname:

- **Subdomain:** `supabasetemplates` (or similar)
- **Domain:** `yourdomain.com`
- **Service:** `http://localhost:8085`

![Cloudflare Tunnel routes](screenshots/12-cloudflare-tunnel-routes.png)

This exposes your Caddy server as `https://supabasetemplates.yourdomain.com`.

### 5.2 Image URLs in Templates

Images inside the HTML templates must use the **public HTTPS URL** so Gmail's image proxy can fetch them:

```html
<img src="https://supabasetemplates.yourdomain.com/assets/logo.png" />
```

Use `sed` to update all templates at once:

```bash
find /path/to/templates -name "*.html" -exec sed -i \
  's|http://templates-server-<id>/assets/|https://supabasetemplates.yourdomain.com/assets/|g' {} \;
```

### 5.3 Cloudflare Access — Bypass for Assets

If you have Cloudflare Access protecting your internal domains, Google's image proxy (`66.102.0.0/20` etc.) will be blocked. 

**The fix:** Create a Cloudflare Access Application with a **Bypass** policy specifically for `/assets/`:

- **Application type:** Self-hosted
- **Domain:** `supabasetemplates.yourdomain.com`
- **Path:** `/assets/`
- **Policy action:** Bypass

This allows Google's caching proxy to fetch images without authentication, while keeping the rest of the domain protected.

### 5.4 Cloudflare Security Rules — WAF Skip

Cloudflare injects JavaScript challenge scripts into HTML responses by default (Bot Fight Mode / JS Detections). This corrupts your template HTML when GoTrue fetches it via the external URL.

**Solution:** Keep template HTML fetched internally (via Docker network, not Cloudflare). Only images go through Cloudflare.

If you still see JS injection in responses, create a WAF Security Rule:

**Security → Security Rules → Create Rule**

- **Name:** `Allow Templates Server`
- **Match:** Hostname equals `supabasetemplates.yourdomain.com`
- **Action:** Skip
- **Skip:** All remaining custom rules, Browser Integrity Check, Security Level, Bot Fight Mode Rules

![Cloudflare security rules](screenshots/13-cloudflare-security-rules.png)

![WAF Skip rule config](screenshots/14-cloudflare-waf-rule.png)

![WAF components to skip](screenshots/15-waf-components-skip.png)

---

## Part 6 — Final Result

With everything in place, emails arrive from `noreply@yourdomain.com` with full branding:

![Working email template](screenshots/11-email-template-no-images.png)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Default Supabase template instead of custom | GoTrue can't reach Caddy URL | Check Docker network connection |
| Images not loading in Gmail | Images served over HTTP or Cloudflare blocking | Use HTTPS for image URLs, add Access Bypass for `/assets/` |
| JS challenge code in template HTML | Cloudflare injecting into HTML response | Fetch templates via internal Docker URL, not external HTTPS |
| `Error sending confirmation email` | SMTP credentials wrong | Check App Password (no spaces), verify SMTP_USER is real Gmail account |
| Verification email for alias never arrives | Group blocks external senders | Temporarily set "Who can post" to "Anyone on the web" |
| `docker network connect` lost after redeploy | Coolify resets networks on Deploy | Use Restart instead of Deploy, or make network permanent in Compose |

---

## Summary of Key Decisions

| Decision | Why |
|---|---|
| Google Group for `noreply@` | Creates a real deliverable address; needed for Gmail Send-As verification |
| Caddy as template server | Lightweight, zero-config static file server; serves templates live without restart |
| Internal Docker URL for templates | Avoids Cloudflare JS injection corrupting HTML |
| External HTTPS URL for images | Gmail's image proxy is external; needs public HTTPS access |
| Cloudflare Access Bypass on `/assets/` | Google's proxy IPs are not authenticated; would be blocked without bypass |
