# Self-Hosting Open WebUI on Oracle Cloud with Auto-Updates

A complete guide to set up your own Open WebUI instance on Oracle Cloud using Docker, Nginx, SSL certificates, and automatic updates.

## 📋 Prerequisites

- Oracle Cloud account (free tier works)
- Domain name with DNS management access
- SSH access to your Oracle Cloud VM
- Basic command line knowledge

## 🚀 Step 1: Oracle Cloud VM Setup

### 1.1 Create VM Instance
1. Login to Oracle Cloud Console
2. Create a new VM instance:
   - **Shape**: VM.Standard.E2.1.Micro (Always Free)
   - **Image**: Ubuntu 22.04 LTS
   - **SSH Keys**: Generate and download your key pair
   - **Networking**: Allow HTTP (80) and HTTPS (443) traffic

### 1.2 Reserve Static IP
1. Go to **Networking → Virtual Cloud Networks → Public IPs**
2. Click on your VM's external IP → **Reserve Static IP**
3. Note down your static IP address (e.g., `123.456.78.90`)

### 1.3 Configure Security Rules
1. **Networking → Virtual Cloud Networks → Security Lists**
2. Add ingress rules:
   - **Port 80** (HTTP): Source `0.0.0.0/0`
   - **Port 443** (HTTPS): Source `0.0.0.0/0`
   - **Port 3001** (Open WebUI): Source `0.0.0.0/0`

**Important:** Port 3001 is required for Oracle Cloud firewall to allow access to Open WebUI. Without this rule, you'll get connection timeouts even with Nginx proxy.

## 🌐 Step 2: DNS Configuration

Set up your subdomain to point to your Oracle Cloud VM:

| Record Type | Host | Value | TTL |
|-------------|------|--------|-----|
| A | `chat` | `123.456.78.90` | 14400 |

**Example**: If your domain is `example.com`, create `chat.example.com` pointing to your VM's IP.

## 🖥️ Step 3: Server Setup

### 3.1 Connect to Your VM
```bash
ssh -i ~/Documents/your-ssh-key.key ubuntu@123.456.78.90
```

### 3.2 Update System & Install Dependencies
```bash
sudo apt update
sudo apt install nginx git docker.io curl -y
```

### 3.3 Start Docker
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### 3.4 Install Certbot
```bash
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
```

## 📦 Step 4: Open WebUI Installation

### 4.1 Create Data Directory
```bash
mkdir -p ~/data
cd ~
```

### 4.2 Start Open WebUI
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

**Important:** If you're only running Open WebUI and no other services, you can use port 3000 instead:
```bash
# Alternative with standard port 3000
sudo docker run -d \
 --name openwebui \
 -p 3000:8080 \
 -v /home/ubuntu/data:/app/backend/data \
 --restart unless-stopped \
 ghcr.io/open-webui/open-webui:main
```

### 4.3 Verify Installation
```bash
# Check if container is running
sudo docker ps | grep openwebui

# Test local access
curl -f http://localhost:3001
```

## 🔒 Step 5: SSL Certificate Setup

### 5.1 Create Basic Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/openwebui.conf
```

**Add this basic configuration** (replace `chat.example.com` with your domain):

```nginx
server {
    server_name chat.example.com;
    
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

### 5.2 Enable Configuration
```bash
sudo ln -s /etc/nginx/sites-available/openwebui.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5.3 Get SSL Certificate
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

### 7.1 Create Auto-Update Script

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

### 7.2 Make Script Executable & Setup Log
```bash
chmod +x ~/update_openwebui.sh
sudo touch /var/log/openwebui_update.log
sudo chmod 666 /var/log/openwebui_update.log
```

### 7.3 Set Up Cronjobs

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

### 7.4 Test Auto-Update
```bash
# Test the update script manually
sudo bash ~/update_openwebui.sh

# Check logs
tail -f /var/log/openwebui_update.log

# Verify cronjobs
sudo crontab -l
```

## 🔧 Port Overview

Your Open WebUI instance uses these ports:

- **Port 3001**: Open WebUI Web Interface (proxied through Nginx)
- **Port 80**: HTTP (redirects to HTTPS)
- **Port 443**: HTTPS (SSL-secured access)

## 🛠️ Managing Your Instance

### Manual Commands
```bash
# Stop Open WebUI
sudo docker stop openwebui

# Start Open WebUI
sudo docker run -d --name openwebui -p 3001:8080 -v /home/ubuntu/data:/app/backend/data --restart unless-stopped ghcr.io/open-webui/open-webui:main

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

## 🔐 Data Safety

### What Gets Preserved
- ✅ **User accounts**: `/home/ubuntu/data/webui.db`
- ✅ **Chat history**: Stored in database
- ✅ **File uploads**: `/home/ubuntu/data/uploads/`
- ✅ **Vector database**: `/home/ubuntu/data/vector_db/`
- ✅ **Cache**: `/home/ubuntu/data/cache/`

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
sudo docker run -d --name openwebui -p 3001:8080 -v /home/ubuntu/data:/app/backend/data --restart unless-stopped ghcr.io/open-webui/open-webui:main
```

## 🔐 Security Considerations

1. **Change default admin password** after first login
2. **Enable user registration controls** in Open WebUI settings
3. **Regularly monitor update logs** for security patches
4. **Keep your domain DNS secure**
5. **Monitor Oracle Cloud billing** (shouldn't exceed free tier)
6. **Consider enabling additional authentication** (OAuth, LDAP)

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

## 🔗 Additional Resources

- [Open WebUI GitHub](https://github.com/open-webui/open-webui)
- [Open WebUI Documentation](https://docs.openwebui.com/)
- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

**Need help?** Check the [official Open WebUI documentation](https://docs.openwebui.com/) or [GitHub issues](https://github.com/open-webui/open-webui/issues).