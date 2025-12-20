

# 💎Deployment Guide: Google AI Studio to Hostinger💎

This guide documents the setup process to deploy any React/Vite project exported from Google AI Studio to Hostinger Shared Hosting using GitHub Actions.

## 1. Export & Push Code

1. **Google AI Studio:** Export your project code.
2. **GitHub:** Create a new **empty repository**.
3. **Upload:** Push your project files to the `main` branch.

## 2. Get Hostinger FTP Details

1. Log in to **Hostinger Dashboard**.
2. Go to **Websites** -> **Manage** -> **Files** -> **FTP Accounts**.
3. Note down:
* **FTP IP** (Use the numeric IP, e.g., `185.x.x.x`).
* **FTP Username** (e.g., `u123456789...`).
* **FTP Password** (If forgotten, click "Change Password").



## 3. Configure GitHub Secrets

1. In your GitHub Repository, go to **Settings** -> **Secrets and variables** -> **Actions**.
2. Click **New repository secret**.
3. Add the following **4 secrets** (names must be exact):

| Secret Name | Value |
| --- | --- |
| `FTP_SERVER` | Your Hostinger **FTP IP** (e.g., `213.130.145.50`). Do **not** add `ftp://`. |
| `FTP_USERNAME` | Your full Hostinger **FTP Username**. |
| `FTP_PASSWORD` | Your Hostinger **FTP Password**. |
Depending on the project:
| `GEMINI_API_KEY` | Your Google **API Key** (starts with `AIza...`). |
| `OTHER_KEY` |Whatever Key you need to run your project (e.g. Google Maps). |

## 4. Create the Deploy Workflow

1. In your repository, create a new file at this **exact path**:
`.github/workflows/deploy.yml`
2. Paste the following template.
*(This script automatically fixes Google's code structure, removes `importmap` bugs, fixes paths, and injects the API key during the build)*.

```yaml
name: Deploy to Hostinger

on:
  # Standard: Deploy immediately when code is pushed to main
  push:
    branches:
      - main

  # Optional: Trigger on a schedule (e.g., daily at 2:00 AM German Time)
  # schedule:
  #   - cron: '0 1 * * *'

  # Allow manual trigger via GitHub Actions tab
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      # 1. Checkout Code
      - name: Checkout
        uses: actions/checkout@v4

      # 2. Setup Node
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      # 3. Install Dependencies
      - name: Install Dependencies
        run: npm install

      # 4. AUTO-FIX: Clean up Google AI Code for Hostinger
      # This step automates the manual fixes for new projects!
      - name: Auto-Fix Configs (Google cleanup)
        run: |
          echo "Starting automatic code repair..."
          
          # A. Remove 'importmap' (Fixes the white screen crash)
          sed -i '/<script type="importmap">/,/<\/script>/d' index.html
          
          # B. Inject base: './' into vite.config.ts (Fixes asset paths)
          # Finds "return {" and replaces it with "return { base: './',"
          sed -i "s/return {/return { base: '.\/',/" vite.config.ts
          
          # C. Ensure the start script is present in index.html
          # (In case Google forgot it or it was inside the deleted importmap)
          if ! grep -q "src=\"./index.tsx\"" index.html; then
             sed -i 's/<\/body>/<script type="module" src=".\/index.tsx"><\/script><\/body>/' index.html
          fi
          
          echo "Repair complete. Ready to build."

      # 5. Build Project (Creates the 'dist' folder)
      # IMPORTANT: We inject the API Key here so it gets baked into the code!
      - name: Build Project
        run: npm run build
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}

      # 6. Deploy
      - name: Deploy to Hostinger via FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.4
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          local-dir: ./dist/
          server-dir: ./public_html/

```

## 5. Run Deployment

1. Go to the **Actions** tab in GitHub.
2. If you enabled `on: push`, it starts automatically.
3. Otherwise, select **Deploy to Hostinger** on the left and click **Run workflow**.
4. Wait for the green checkmark.
5. Check your website (use Incognito mode to bypass cache).
<img width="1048" height="312" alt="image" src="https://github.com/user-attachments/assets/69e267d4-0d90-40c5-b9a5-14db6016b58e" />
