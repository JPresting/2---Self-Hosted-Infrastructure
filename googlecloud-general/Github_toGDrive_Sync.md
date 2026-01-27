# 📂 GitHub to Google Drive Sync – Complete Guide

This guide explains how to set up an automated backup from GitHub to Google Drive.
You can use **both** methods in the same repository if needed.

* **Option A: Google Workspace (Best for Teams)** – Uses a Service Account "Robot". Works best with Shared Drives.
* **Option B: Private Google Account (Best for Personal Use)** – Uses OAuth (your personal login). Works with standard Google Drive folders.

---

# 🅰️ Option A: Google Workspace (Service Account)

**Setup Effort:** Once per Google Cloud Project.
**Reusability:** Unlimited repositories.
**Requirement:** You must use a "Shared Drive" to avoid quota errors.

## ✅ Phase 1: Google Cloud (One-Time)

*You only need to do this once. The resulting Key works for all your projects.*

1. Go to **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Create a **New Project** (e.g., `github-backup-bot`).
3. Search for **"Google Drive API"** and **enable** it.
4. Go to **IAM & Admin > Service Accounts** -> **Create Service Account**.
5. Click on the new account -> **Keys** -> **Add Key** -> **Create new key** -> **JSON**.
6. **Save the JSON file**. You will need its content later.
7. Copy the **Service Account Email** (e.g., `github-uploader@...`).

## ✅ Phase 2: Google Drive (Shared Drive)

<img width="586" height="345" alt="23" src="https://github.com/user-attachments/assets/85dc68b2-5053-429c-b115-e846a728154a" />

1. Go to Google Drive -> **Shared Drives**.
2. Create a new Shared Drive (or open an existing one).
3. **Manage Members** -> Add the **Service Account Email**.
4. **Role:** Set to **Content Manager** (Essential!).
5. Create/Open the target folder for your repo.
6. **Copy the Folder ID** from the browser URL (the string after `/folders/...`).

## ✅ Phase 3: GitHub Secrets (Workspace)

Go to your Repository -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.

| Secret Name | Value |
| --- | --- |
| `GCP_SA_KEY` | Paste the **entire content** of the JSON Key file here. |
| `WORKSPACE_FOLDER_ID` | Paste the **Folder ID** from Phase 2. |

## ✅ Phase 4: The Workflow Script (Workspace)

Create a file at `.github/workflows/google-drive-sync.yml`:

```yaml
name: Sync to Google Drive (Workspace)

on:
  push:
    branches:
      - main
  schedule:
    - cron: '0 2 * * *' # Runs daily at 2:00 AM
  workflow_dispatch:    # Allows manual trigger

jobs:
  backup-to-drive:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Install Rclone
        run: sudo apt-get update && sudo apt-get install -y rclone

      - name: Sync to Google Drive
        env:
          GCP_SA_KEY: ${{ secrets.GCP_SA_KEY }}
          # Connects to the Workspace Secret
          DRIVE_FOLDER_ID: ${{ secrets.WORKSPACE_FOLDER_ID }}
        run: |
          # 1. Create service account key file from secret
          echo "$GCP_SA_KEY" > sa_key.json

          # 2. Configure Rclone via environment variables
          export RCLONE_CONFIG_GDRIVE_TYPE=drive
          export RCLONE_CONFIG_GDRIVE_SERVICE_ACCOUNT_FILE=sa_key.json
          
          # IMPORTANT: Disable trash for Shared Drives to prevent errors
          export RCLONE_DRIVE_USE_TRASH=false

          # 3. Run Sync
          rclone sync . gdrive: \
            --drive-root-folder-id "$DRIVE_FOLDER_ID" \
            --exclude "node_modules/**" \
            --exclude ".git/**" \
            --exclude "sa_key.json" \
            --exclude "dist/**" \
            --progress

          # 4. Security Cleanup
          rm sa_key.json

```

---

---

# 🅱️ Option B: Private Account (OAuth)

**Setup Effort:** Once per PC (to generate the token).
**Reusability:** Unlimited repositories (using the same secret).
**Requirement:** Local installation of Rclone to generate the config.

## ✅ Phase 1: Google Cloud Setup (One-Time)

1. Go to **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Create a Project and enable the **Google Drive API**.
3. **Configure Consent Screen:**
* Select **External** User Type.
* Fill in App Name (e.g., "Rclone") and Support Email.
* **CRITICAL STEP:** Go to the **Audience** tab. Under **"Test users"**, click **Add Users** and enter your own Google Email address. **If you skip this, the login will fail!**


4 Configure OAuth Consent (CRUCIAL STEP)

a. Go to **APIs & Services** > **OAuth consent screen**.
b. Select **External** and fill in the required names (email etc.).
c. **IMPORTANT:** Once created, go to the **Audience** tab (or check the Dashboard).
d. Click the button **PUBLISH APP** (or "In production").
   * *Ignore the verification warning (Click "Confirm").*
   * **Why?** If the status stays on "Testing", your connection will break every 7 days!

     
<img width="570" height="295" alt="image" src="https://github.com/user-attachments/assets/abe69ace-b832-494c-bcf0-31e891fc14ae" />



5. **Create Credentials:**
* Go to **Credentials** -> **Create Credentials** -> **OAuth client ID**.
* Application type: **Desktop app**.
* Copy the **Client ID** and **Client Secret**.



## ✅ Phase 2: Generate Config Locally

You need to authorize GitHub to act on your behalf. Do this on your local PC:

1. Install Rclone.
2. Open your terminal and run: `rclone config`
3. Create a new remote (`n`):
* **Name:** `myprivatedrive`
* **Storage:** `22` (Google Drive)
* **Client ID & Secret:** Paste the ones from Phase 1.
* **Scope:** `1` (Full Access)
* **Service Account:** Leave empty.
* **Advanced config:** `n`
* **Use web browser:** `y` (Login with your Google account and click "Continue" -> "Allow").


4. Once finished, run:
```powershell
rclone config show

```


5. **Copy the entire block** (from `[myprivatedrive]` down to the closing curly brace `}`).

## ✅ Phase 3: GitHub Secrets (Private)

Go to your Repository -> **Settings** -> **Secrets and variables** -> **Actions**.

| Secret Name | Value |
| --- | --- |
| `RCLONE_CONF` | Paste the **entire config block** you copied from the terminal. |
| `PRIVATE_FOLDER_ID` | Paste the **Folder ID** of your private Google Drive folder. |

## ✅ Phase 4: The Workflow Script (Private)

Create a file at `.github/workflows/deploy-private.yml`. This script automatically detects your remote name.

```yaml
name: Sync to Private Drive

on:
  push:
    branches:
      - main
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  backup-to-drive:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Install Rclone
        run: sudo apt-get update && sudo apt-get install -y rclone

      - name: Sync to Google Drive
        env:
          # Load the config block directly from the secret
          RCLONE_CONF: ${{ secrets.RCLONE_CONF }}
          # Connects to the Private Secret
          DRIVE_FOLDER_ID: ${{ secrets.PRIVATE_FOLDER_ID }}
        run: |
          # 1. Restore Rclone Config file
          mkdir -p ~/.config/rclone
          echo "$RCLONE_CONF" > ~/.config/rclone/rclone.conf

          # 2. Automatically detect the remote name from the config
          # (Extracts the string inside the square brackets [ ] from the first line)
          REMOTE_NAME=$(grep "^\[" ~/.config/rclone/rclone.conf | head -n 1 | tr -d '[]')
          echo "Detected Remote Name: $REMOTE_NAME"

          # 3. Start Sync
          rclone sync . $REMOTE_NAME: \
            --drive-root-folder-id "$DRIVE_FOLDER_ID" \
            --exclude "node_modules/**" \
            --exclude ".git/**" \
            --exclude "dist/**" \
            --progress

```
