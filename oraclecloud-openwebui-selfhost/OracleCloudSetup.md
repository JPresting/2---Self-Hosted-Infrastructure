# 💎Self-Hosting Open WebUI on Oracle Cloud with Auto-Updates

A complete guide to set up your own Open WebUI instance on Oracle Cloud using Docker, Nginx, SSL certificates, and automatic updates.

For a detailed instruction on how to set up the VM in Oracle Cloud in general check this [guide](https://github.com/JPresting/2---Self-Hosted-Infrastructure/blob/main/oraclecloud-general/Readme.md).

## 📋 Prerequisites

- Oracle Cloud account (free tier works)
- Domain name with DNS management access
- SSH access to your Oracle Cloud VM
- Basic command line knowledge

## 🚀 Step 1: Oracle Cloud VM Setup

### 📍1.1 Create VM Instance
1. Login to Oracle Cloud Console
2. Create a new VM instance (or install to existing one):
   - **Shape**: ARM1 4 cores 24GB RAM (Always Free)
   - **Image**: Ubuntu 24.04 LTS
   - **SSH Keys**: Generate and download your key pair
   - **Networking**: Allow HTTP (80) and HTTPS (443) traffic

### 📍1.2 Reserve Static IP
1. Go to **Networking → Virtual Cloud Networks → Public IPs**
2. Click on your VM's external IP → **Reserve Static IP**
3. Note down your static IP address (e.g., `123.456.78.90`)

### 📍1.3 Configure Security Rules
1. **Networking → Virtual Cloud Networks → Security Lists**
2. Add ingress rules:
   - **Port 80** (HTTP): Source `0.0.0.0/0`
   - **Port 443** (HTTPS): Source `0.0.0.0/0`
   - **Port 3001** (Open WebUI): Source `0.0.0.0/0`

**Important:** Port 3001 (you can use 3000 I used it as I already used 3000 on the same VM) is required for Oracle Cloud firewall to allow access to Open WebUI. Without this rule, you'll get connection timeouts even with Nginx proxy.

## 🌐 Step 2: DNS Configuration

Set up your subdomain to point to your Oracle Cloud VM:

| Record Type | Host | Value | TTL |
|-------------|------|--------|-----|
| A | `chat` | `123.456.78.90` | 14400 |

**Example**: If your domain is `example.com`, create `chat.example.com` pointing to your VM's IP.

## 🖥️ Step 3: Server Setup

### 📍3.1 Connect to Your VM
```bash
ssh -i ~/Documents/your-ssh-key.key ubuntu@123.456.78.90
```

### 📍3.2 Update System & Install Dependencies
```bash
sudo apt update
sudo apt install nginx git docker.io curl -y
```

### 📍3.3 Start Docker
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### 📍3.4 Install Certbot
```bash
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
```

## 📦 Step 4: Open WebUI Installation

### 📍4.1 Create Data Directory
```bash
mkdir -p ~/data
cd ~
```

### 📍4.2 Start Open WebUI
```bash
sudo docker run -d \
 --name openwebui \
 -p 3001:8080 \
 -v /home/ubuntu/data:/app/backend/data \
 --restart unless-stopped \
 ghcr.io/open-webui/open-webui:main
```

**Port Configuration:**
- **Port 3001** is used instead of the standard 3000 to avoid conflicts with other services (e.g., Supabase Studio)
- **Standard ports** would be 3000 or 8080, but 3001 ensures no conflicts
- **Oracle Cloud**: You MUST add port 3001 to your Security Rules in **Step 1.3** above

### 📍4.3 Verify Installation
```bash
# Check if container is running
sudo docker ps | grep openwebui

# Test local access
curl -f http://localhost:3001
```

## 🔒 Step 5: SSL Certificate Setup

### 📍5.1 Create Basic Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/openwebui.conf
```

**Add this basic configuration** (replace `chat.example.com` with your domain):

```nginx
server {
    server_name chat.example.com;
    # IP WHITELIST - UNCOMMENT AND MODIFY BELOW
    # allow 203.0.113.0/24;        # Your company IP range
    # allow 198.51.100.50;         # Your home IP
    # deny all;                    # Block everyone else
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
    
    listen 80;
}
```

### 📍5.2 Enable Configuration
```bash
sudo ln -s /etc/nginx/sites-available/openwebui.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 📍5.3 Get SSL Certificate
```bash
sudo certbot --nginx -d chat.example.com
```

Follow the prompts:
- Enter your email address
- Accept terms of service
- Choose whether to share email with EFF

**Certbot will automatically modify your Nginx configuration to include SSL.**

## ✅ Step 6: Access Your Open WebUI Instance

Open your browser and navigate to: `https://chat.example.com`

You should see the Open WebUI interface. Create your first admin account.

## 🔄 Step 7: Automatic Updates

### 📍7.1 Create Auto-Update Script

```bash
cd ~
nano update_openwebui.sh
```

**Add this content:**
```bash
#!/bin/bash

LOG_FILE="/var/log/openwebui_update.log"

echo "=== Open WebUI Update Started: $(date) ===" >> $LOG_FILE

# Stop and remove old container
echo "Stopping Open WebUI container..." >> $LOG_FILE
sudo docker stop openwebui >> $LOG_FILE 2>&1
sudo docker rm openwebui >> $LOG_FILE 2>&1

# Pull latest Open WebUI image
echo "Pulling latest Open WebUI image..." >> $LOG_FILE
sudo docker pull ghcr.io/open-webui/open-webui:main >> $LOG_FILE 2>&1

# Start new container with correct data path
echo "Starting updated Open WebUI container..." >> $LOG_FILE
sudo docker run -d \
 --name openwebui \
 -p 3001:8080 \
 -v /home/ubuntu/data:/app/backend/data \
 --restart unless-stopped \
 ghcr.io/open-webui/open-webui:main >> $LOG_FILE 2>&1

# Wait for container to start
echo "Waiting for Open WebUI to start..." >> $LOG_FILE
sleep 30

# Health check
if curl -f http://localhost:3001 >/dev/null 2>&1; then
    echo "Open WebUI is accessible" >> $LOG_FILE
else
    echo "Open WebUI not accessible" >> $LOG_FILE
fi

# Check container status
echo "Container status:" >> $LOG_FILE
sudo docker ps --format "table {{.Names}}\t{{.Status}}" | grep openwebui >> $LOG_FILE

# Clean up old Docker images
echo "Cleaning up old Docker images..." >> $LOG_FILE
sudo docker image prune -af >> $LOG_FILE 2>&1

echo "=== Open WebUI Update Completed: $(date) ===" >> $LOG_FILE
echo "" >> $LOG_FILE
```

### 📍7.2 Make Script Executable & Setup Log
```bash
chmod +x ~/update_openwebui.sh
sudo touch /var/log/openwebui_update.log
sudo chmod 666 /var/log/openwebui_update.log
```

### 📍7.3 Set Up Cronjobs

```bash
sudo crontab -e
```

Add these lines:
```bash
# Auto-update Open WebUI every Sunday at 4 AM
0 4 * * 0 /bin/bash /home/ubuntu/update_openwebui.sh >/dev/null 2>&1

# Auto-start Open WebUI after VM reboot
@reboot sleep 60 && sudo docker run -d --name openwebui -p 3001:8080 -v /home/ubuntu/data:/app/backend/data --restart unless-stopped ghcr.io/open-webui/open-webui:main
```

### 📍7.4 Test Auto-Update
```bash
# Test the update script manually
sudo bash ~/update_openwebui.sh

# Check logs
tail -f /var/log/openwebui_update.log

# Verify cronjobs
sudo crontab -l
```

## 🤖 Step 8: Connect Local Ollama Models 

Transform your Open WebUI into a powerhouse by connecting your local RTX 3080 GPU for AI model processing while keeping the convenient cloud-based interface.

### 📍8.1 Install Ollama Locally

**Windows:**
1. Download from https://ollama.com
2. Install `OllamaSetup.exe`
3. Verify installation: `ollama --version`

### 📍8.2 Install Models for RTX 3080 (10GB VRAM)
All relative to self-hostable models of course - not comparable to the top models out there...
```bash
# Light models (1-3GB VRAM) - Very fast
ollama pull llama3.2:1b        # ~1GB - Extremely fast
ollama pull llama3.2:3b        # ~2GB - Fast, good quality
ollama pull qwen2.5:3b         # ~2GB - Very smart

# Medium models (4-6GB VRAM) - Excellent balance  
ollama pull llama3.2:8b        # ~5GB - Excellent quality
ollama pull mistral:7b         # ~4GB - Mature, reliable
ollama pull qwen2.5:7b         # ~4GB - Very intelligent

# Heavy models (7-9GB VRAM) - Maximum quality
ollama pull codellama:13b      # ~8GB - Best for programming
ollama pull llama3.2:11b       # ~7GB - Top quality
ollama pull qwen2.5:14b        # ~8GB - Extremely intelligent

# Extreme models (9-10GB VRAM) - Pushing limits
ollama pull llama3.1:70b-q4    # ~9GB - Huge model, quantized

# Check installed models
ollama list
```

### 📍8.3 Setup ngrok Account & Static Domain

1. **Create Account**: https://ngrok.com (free)
2. **Install ngrok**: 
```bash
winget install ngrok.ngrok
```
3. **Get Authtoken**: Dashboard → "Your Authtoken"  
4. **Setup Authtoken**:
```bash
ngrok config add-authtoken YOUR_TOKEN_FROM_DASHBOARD
```
5. **Reserve Static Domain**: Dashboard → "Cloud Edge" → "Domains"
   - Choose subdomain: e.g., `your-subdomain.ngrok-free.app`

### 📍8.4 Create Autostart Script

**Create file:** `C:\ollama-autostart.bat`

```batch
@echo off
echo Starting Ollama Auto-Service...

REM Wait for Windows to fully boot
timeout /t 30 /nobreak >nul

REM Start Ollama with all origins allowed (required for ngrok!) and keep models loaded for 30 minutes
set OLLAMA_ORIGINS=*
set OLLAMA_KEEP_ALIVE=30m
echo Starting Ollama server...
start /B ollama serve

REM Wait for Ollama to start
timeout /t 15 /nobreak >nul

REM Start ngrok tunnel with permanent URL and host header
echo Starting ngrok tunnel...
start /B ngrok http 11434 --url=your-subdomain.ngrok-free.app --host-header="localhost:11434"

REM Wait for ngrok to start
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo Ollama Auto-Service READY!
echo ========================================
echo Ollama:    http://localhost:11434
echo Public:    https://your-subdomain.ngrok-free.app
echo Keep-Alive: 30 minutes
echo ========================================
echo.

REM Keep window open for monitoring
pause
```

### 📍8.5 Enable Autostart

**Copy script to:**
```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
```

**Remove any existing "Ollama" shortcuts from startup to avoid conflicts.**

### 📍8.6 Connect Open WebUI to Local Ollama

**Update Oracle Cloud container:**

```bash
# SSH to Oracle Cloud VM
ssh -i your-key.key ubuntu@your-oracle-ip

# Stop current container
sudo docker stop openwebui
sudo docker rm openwebui

# Start with local Ollama connection and security
sudo docker run -d \
  --name openwebui \
  -p 3001:8080 \
  -e OLLAMA_BASE_URL="https://your-subdomain.ngrok-free.app" \
  -e ENABLE_SIGNUP="false" \
  -v /home/ubuntu/data:/app/backend/data \
  --restart unless-stopped \
  ghcr.io/open-webui/open-webui:main
```

**Update auto-update script:**
```bash
nano ~/update_openwebui.sh
```

**Add Ollama connection and security to the docker run command:**
```bash
sudo docker run -d \
 --name openwebui \
 -p 3001:8080 \
 -e OLLAMA_BASE_URL="https://your-subdomain.ngrok-free.app" \
 -e ENABLE_SIGNUP="false" \
 -v /home/ubuntu/data:/app/backend/data \
 --restart unless-stopped \
 ghcr.io/open-webui/open-webui:main >> $LOG_FILE 2>&1
```

### 📍8.7 Test Setup

1. **Restart your PC** (test autostart)
2. **Wait 2-3 minutes** for services to start
3. **Test ngrok URL**: `https://your-subdomain.ngrok-free.app/api/tags`
4. **Test Open WebUI**: `https://chat.example.com`
5. **Should show your local models** in model selector

### 📍8.8 Model Management

**Automatic behavior:**
- **New models**: Appear automatically in Open WebUI after `ollama pull`
- **Model loading**: 5-10 seconds when first selected
- **Memory management**: Models auto-unload after 5 minutes of inactivity
- **GPU efficiency**: Only active model uses VRAM

**Manual commands:**
```bash
ollama list        # Show all installed models
ollama ps          # Show currently loaded models  
ollama rm model    # Remove model
ollama pull model  # Install new model
```

## 🔐 Security Considerations for Local Models

**⚠️ IMPORTANT:** Your local GPU power is accessible via your public Open WebUI!

**Risk:** Anyone who creates an account can use your RTX 3080 for free.

**Solutions:**

**1. Disable Public Registration (Recommended):**
- **`ENABLE_SIGNUP="false"`** prevents new account creation
- **Existing accounts** continue to work normally
- **Perfect after you've created your admin account**

## 🎯 Complete Workflow

**After setup:**
1. **PC starts** → Ollama + ngrok auto-start (2-3 minutes)
2. **Install new model** → `ollama pull modelname` → Appears in Open WebUI
3. **Select model** → Loads in 5-10 seconds → Ready for chat
4. **Model idles** → Auto-unloads after 5 minutes → Frees VRAM
5. **Automatic updates** → Open WebUI updates Sundays, keeps local connection

**Your RTX 3080 models are now accessible worldwide via your secure Open WebUI instance!**

## 🔧 Port Overview

Your Open WebUI instance uses these ports:

- **Port 3001**: Open WebUI Web Interface (proxied through Nginx)
- **Port 80**: HTTP (redirects to HTTPS)
- **Port 443**: HTTPS (SSL-secured access)
- **Port 11434**: Ollama API (local only, tunneled via Ngrok or Cloudflare)

## 🛠️ Managing Your Instance

### Manual Commands
```bash
# Stop Open WebUI
sudo docker stop openwebui

# Start Open WebUI
sudo docker run -d --name openwebui -p 3001:8080 -e OLLAMA_BASE_URL="https://your-subdomain.ngrok-free.app" -e ENABLE_SIGNUP="false" -v /home/ubuntu/data:/app/backend/data --restart unless-stopped ghcr.io/open-webui/open-webui:main

# View Logs
sudo docker logs openwebui -f

# Manual Update
sudo bash ~/update_openwebui.sh

# Check running containers
sudo docker ps
```

### Monitor Updates
```bash
# Check update logs
tail -n 50 /var/log/openwebui_update.log

# Check Open WebUI version
sudo docker inspect openwebui | grep -A 5 "RepoTags"

# Check latest GitHub release
curl -s https://api.github.com/repos/open-webui/open-webui/releases/latest | grep "tag_name"
```

## 📊 Auto-Update Features

- **Automatic updates** every Sunday at 4 AM
- **Auto-start** after VM reboot (60 second delay)
- **Data preservation** (user accounts, chats, settings preserved)
- **Detailed logging** of all operations
- **Health checks** after updates
- **Automatic cleanup** of old Docker images
- **Preserves Ollama connection** during updates

## 🔐 Data Safety

### What Gets Preserved
- ✅ **User accounts**: `/home/ubuntu/data/webui.db`
- ✅ **Chat history**: Stored in database
- ✅ **File uploads**: `/home/ubuntu/data/uploads/`
- ✅ **Vector database**: `/home/ubuntu/data/vector_db/`
- ✅ **Cache**: `/home/ubuntu/data/cache/`
- ✅ **Ollama connection**: OLLAMA_BASE_URL preserved in updates

### What Gets Updated
- 🔄 **Open WebUI software**: Latest features and bug fixes
- 🔄 **Docker image**: Updated to latest main branch
- 🔄 **Dependencies**: All underlying libraries

## 🛠️ Troubleshooting

### 502 Bad Gateway
1. Check if container is running: `sudo docker ps | grep openwebui`
2. Verify port accessibility: `sudo netstat -tlnp | grep :3001`
3. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
4. Restart container: `sudo docker restart openwebui`

### Ollama Models Not Showing
1. **Check ngrok tunnel**: Browser to your ngrok URL + `/api/tags`
2. **Should return JSON** with your models
3. **If 403 error**: Restart ollama with `set OLLAMA_ORIGINS=*`
4. **If offline**: Check if both ollama and ngrok are running

### Container Won't Start
```bash
# Check Docker logs
sudo docker logs openwebui

# Check data directory permissions
ls -la /home/ubuntu/data/

# Restart with fresh container
sudo docker stop openwebui
sudo docker rm openwebui
sudo bash ~/update_openwebui.sh
```

### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates manually
sudo certbot renew
sudo systemctl reload nginx
```

### Lost Data After Update
If you see a blank Open WebUI after update, the data path may be wrong:

```bash
# Check data directory
ls -la /home/ubuntu/data/webui.db

# If empty, check alternative locations
find /home -name "webui.db" 2>/dev/null

# Stop container and fix data path
sudo docker stop openwebui
sudo docker rm openwebui

# Start with correct data path
sudo docker run -d --name openwebui -p 3001:8080 -e OLLAMA_BASE_URL="https://your-subdomain.ngrok-free.app" -e ENABLE_SIGNUP="false" -v /home/ubuntu/data:/app/backend/data --restart unless-stopped ghcr.io/open-webui/open-webui:main
```

## 🔐 Security Considerations

1. **Change default admin password** after first login
2. **Disable user registration** with `ENABLE_SIGNUP="false"`
3. **Regularly monitor update logs** for security patches
4. **Keep your domain DNS secure**
5. **Monitor Oracle Cloud billing** (shouldn't exceed free tier)
6. **Monitor ngrok usage** (free tier has bandwidth limits)
7. **Consider enabling additional authentication** (OAuth, LDAP)

## 📚 API Usage

Once installed, your Open WebUI API will be available at:

- **Base URL**: `https://chat.example.com/api/`
- **Documentation**: `https://chat.example.com/docs`

Use API keys generated in the Open WebUI settings for authentication.

## 🎉 Success!

You now have a fully automated, self-hosted Open WebUI instance that:

- ✅ **Runs 24/7** on Oracle Cloud free tier
- ✅ **Auto-updates** every Sunday at 4 AM
- ✅ **Auto-starts** after VM reboots
- ✅ **Preserves all data** during updates
- ✅ **Uses SSL encryption** with automatic renewal
- ✅ **Accessible via custom domain**
- ✅ **Includes health monitoring** and logging
- ✅ **Connected to local RTX 3080** for AI processing
- ✅ **Secured against unauthorized usage**

## 🔗 Additional Resources

- [Open WebUI GitHub](https://github.com/open-webui/open-webui)
- [Open WebUI Documentation](https://docs.openwebui.com/)
- [Ollama Documentation](https://ollama.com/)
- [ngrok Documentation](https://ngrok.com/docs)
- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

**Need a more advanced deployment, integration, or enterprise automation?** Visit [Stardawnai.com](https://stardawnai.com) for professional consulting and development on AI-driven process automation, SAP integration, self-hosted enterprise N8N workflows, and custom hybrid infrastructure solutions tailored to your business needs.
