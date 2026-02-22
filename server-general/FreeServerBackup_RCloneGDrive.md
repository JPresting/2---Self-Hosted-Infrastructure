# Server Backup – restic + rclone → Google Drive

## Overview

Cheapest viable backup solution for a self-hosted Ubuntu 24 server running Docker/Coolify.  
No extra storage costs – uses an existing Google Drive subscription.

**Tools:**
- **rclone** – connects to Google Drive
- **restic** – encrypted, deduplicated backups over rclone

---

## Google Drive Structure

Each server gets its own folder in Google Drive:

| Folder | Server |
|--------|--------|
| `YOUR_SERVER_BACKUP_FOLDER` | YOUR_SERVER_NAME (main server) |
| `YOUR_SERVER2_BACKUP_FOLDER` | YOUR_SERVER2_NAME (second server) |

Files are encrypted – you will only see cryptic folder/file names in Drive, not readable content. Restore only works via restic with the correct password.

---

## What Gets Backed Up

| Path | Contents |
|------|----------|
| `/etc` | System configuration files |
| `/home/YOUR_USERNAME` | N8N data, credentials, workflows, Cloudflared config |
| `/data/coolify` | Coolify internal data |
| `/var/lib/docker/volumes` | All Docker app data (~12GB) |

**Excluded:** Docker images (~42GB) – these are re-pulled automatically on redeploy.

---

## Initial Setup

### 1. Install tools

```bash
sudo apt install restic rclone -y
```

### 2. (Optional) Create own Google API Credentials

> **Cost: completely free.** Google confirms that all use of the Google Drive API is available at no additional cost. Exceeding quota limits doesn't incur extra charges and your account is never billed. The only cost is your existing Google One storage subscription – no API fees, no per-request charges, nothing extra.

By default, rclone uses a shared API key used by thousands of users worldwide. This causes rate limit errors (`Quota exceeded`) especially during the **first large backup**. For daily incremental backups (only a few MB of changes), this is rarely an issue.

> **TL;DR:** You can skip this entirely. Rate limits on the first backup are annoying but restic retries automatically and will complete. For daily incremental backups it's a non-issue.

If you want your own quota, follow these steps:

**Step 1 – Create project and enable API**
1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "rclone-backup")
3. **APIs & Services** → **Library** → search "Google Drive API" → Enable

**Step 2 – OAuth Consent Screen**
1. **APIs & Services** → **OAuth consent screen** (or "Google Auth Platform")
2. App name: anything (e.g. "rclone-backup")
3. User support email: your Gmail address
4. Click **Next** through all steps → **Create**
5. Go to **Audience** tab → Publishing status shows "Testing"
6. Click **"Publish app"** → Confirm → status changes to "In production"
   - This is required so your own Google account can authorize without being added as a test user
   - No Google review needed for personal use

**Step 3 – Create OAuth Client ID**
1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
2. Application type: **Desktop app**
3. Copy **Client ID** and **Client Secret** → enter during `rclone config` instead of leaving blank

---

### 3. Configure rclone → Google Drive

```bash
rclone config
```

- `n` → New remote
- Name: `YOUR_GDRIVE_REMOTE`
- Storage: `18` (Google Drive)
- Client ID & Secret: leave blank (Enter)
- Scope: `1` (full access)
- Service account file: leave blank (Enter)
- Edit advanced config: `n`
- Use auto config: `n` (headless server)
- Run on local machine with browser: `rclone authorize "drive" "eyJzY29wZSI6ImRyaXZlIn0"`
- Paste returned token
- Shared Drive: `n`
- Confirm: `y`
- Quit: `q`

### 3. Copy rclone config to root

```bash
sudo mkdir -p /root/.config/rclone
sudo cp /home/YOUR_USERNAME/.config/rclone/rclone.conf /root/.config/rclone/rclone.conf
```

### 4. Initialize restic repository

```bash
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER init
```

> ⚠️ Save the password somewhere safe – without it, restore is impossible.

---

## Running a Backup

```bash
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER backup \
  /etc \
  /home/YOUR_USERNAME \
  /data/coolify \
  /var/lib/docker/volumes
```

First run: slow (full upload ~13-14GB).  
Subsequent runs: fast (only changes uploaded).

---

## Automated Daily Backup (Cronjob)

Restic only uploads **changes** on every run – the first backup uploads everything (~12GB), subsequent runs only upload new/modified files (usually a few MB). This is restic's built-in deduplication.

```bash
sudo crontab -e
```

Add this line (runs every day at 3:00 AM):

```
0 3 * * * restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER backup /etc /home/YOUR_USERNAME /data/coolify /var/lib/docker/volumes >> /var/log/restic-backup.log 2>&1
```

Check the log anytime with:

```bash
cat /var/log/restic-backup.log
```

> ⚠️ **Note on Google Drive:** Backup files in Google Drive are fully encrypted – you will only see cryptic folder/file names, not readable content. This is intentional and secure. Files can only be restored via restic using your password.

---

## Restore

### List available snapshots

```bash
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER snapshots
```

### Restore latest snapshot

```bash
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER restore latest --target /
```

### Restore specific snapshot

```bash
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER restore <snapshot-id> --target /
```

### Restore single file/folder only

```bash
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER restore latest \
  --target / \
  --include /home/YOUR_USERNAME/n8n/n8n_data
```

---

## Full Server Restore – Step by Step

**Scenario: your server is dead. You have a brand new empty Ubuntu 24 machine and need to get everything back.**

### Step 1 – Install tools on the new server

```bash
sudo apt install restic rclone -y
```

### Step 2 – Set up rclone → Google Drive again

On the new server, run `rclone config` and reconnect to Google Drive (same process as initial setup). Use your own Client ID and Secret so you have your own quota.

Then copy the config to root:

```bash
sudo mkdir -p /root/.config/rclone
sudo cp /home/YOUR_USERNAME/.config/rclone/rclone.conf /root/.config/rclone/rclone.conf
```

### Step 3 – Restore all data from Google Drive

This pulls everything from your backup straight onto the new server:

```bash
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER restore latest --target /
```

This restores: `/etc`, `/home/YOUR_USERNAME`, `/data/coolify`, `/var/lib/docker/volumes` (all app data, databases, credentials).

> ⚠️ Takes a while depending on backup size and internet speed. Let it finish completely.

### Step 4 – Install Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Coolify's database volume was just restored in Step 3. When Coolify starts it finds its existing database and loads all your old projects, services, domains and environment variables automatically.

### Step 5 – Redeploy all services in Coolify

Docker images are not in the backup (they can always be re-pulled). In the Coolify dashboard:

1. Open each service/application
2. Click **Redeploy**
3. Coolify pulls the image and starts the container – it automatically mounts the restored volume, so all data (N8N workflows, credentials, databases) is instantly there

**That's it. The server is back.**

---

### Restore a single file or folder only

If the server is fine but you just need one specific thing back:

```bash
# Restore only N8N data
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER restore latest \
  --target / \
  --include /home/YOUR_USERNAME/n8n/n8n_data

# Restore only a specific Docker volume
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER restore latest \
  --target / \
  --include /var/lib/docker/volumes/coolify-db
```

---

## Useful Commands

```bash
# Check backup integrity
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER check

# Show backup size and stats
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER stats

# Remove old snapshots (keep last 7)
sudo restic -r rclone:"YOUR_GDRIVE_REMOTE":YOUR_SERVER_BACKUP_FOLDER forget --keep-last 7 --prune
```

---

## Environment Variable (optional, avoid typing password every time)

```bash
export RESTIC_PASSWORD="your-password-here"
export RESTIC_REPOSITORY='rclone:YOUR_GDRIVE_REMOTE:YOUR_SERVER_BACKUP_FOLDER'
```

Add to `/root/.bashrc` to persist.