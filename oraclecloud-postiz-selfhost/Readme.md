# Self-Hosting Postiz on Oracle Cloud with Auto-Updates

A complete guide to set up your own Postiz social media management platform on Oracle Cloud using Docker, Nginx, SSL certificates, and automatic updates.

## 📋 Prerequisites

- Oracle Cloud VM (free tier works)
- Domain name with DNS management access
- SSH access to your Oracle Cloud VM
- Basic command line knowledge

## 🚀 Quick Setup

### Step 1: Connect to Your VM

```bash
ssh -i ~/path/to/your-ssh-key.key ubuntu@YOUR_PUBLIC_IP
# REPLACE: YOUR_PUBLIC_IP with your actual Oracle Cloud VM IP
```

### Step 2: Configure Firewall Rules

**⚠️ CRITICAL:** Oracle Cloud has two firewall layers that both need configuration.

#### Oracle Cloud Security Rules
1. **Networking → Virtual Cloud Networks → Security Lists**
2. Add ingress rule: **Port 5000** (TCP), Source `0.0.0.0/0`

#### Ubuntu iptables Configuration
```bash
# Add port 5000 for Postiz
sudo iptables -I INPUT 6 -p tcp --dport 5000 -j ACCEPT

# Make rules permanent
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

### Step 3: DNS Configuration

Set up your subdomain to point to your Oracle Cloud VM:

| Record Type | Host | Value | TTL |
|-------------|------|--------|-----|
| A | `YOUR_SUBDOMAIN` | `YOUR_VM_IP` | 14400 |

**Examples**: 
- `posts.yourdomain.com` 
- `social.yourdomain.com`
- `postiz.yourdomain.com`
- `whatever.yourdomain.com` (you can choose ANY subdomain name!)

**REPLACE**: 
- `YOUR_SUBDOMAIN` = choose any name you want (posts, social, postiz, etc.)
- `YOUR_VM_IP` = your Oracle Cloud VM's public IP address

## 📦 Postiz Installation

### Step 1: Create Project Directory

```bash
mkdir ~/postiz
cd ~/postiz
```

### Step 2: Generate Security Keys

**IMPORTANT**: Save these values - you'll need them in the next step!

```bash
# Generate JWT Secret (SAVE THIS OUTPUT!)
echo "JWT_SECRET:"
openssl rand -base64 64

# Generate PostgreSQL password (SAVE THIS OUTPUT!)
echo "DB_PASSWORD:"
openssl rand -base64 32
```

**Copy and save both generated values somewhere safe!**

### Step 3: Create Docker Compose Configuration

```bash
nano docker-compose.yml
```

**Add this configuration and REPLACE ALL marked values:**

```yaml
version: '3.8'

services:
  postiz:
    image: ghcr.io/gitroomhq/postiz-app:latest
    container_name: postiz
    restart: unless-stopped
    environment:
      # REPLACE: your-subdomain.yourdomain.com with YOUR actual domain
      MAIN_URL: "https://your-subdomain.yourdomain.com"
      FRONTEND_URL: "https://your-subdomain.yourdomain.com"
      NEXT_PUBLIC_BACKEND_URL: "https://your-subdomain.yourdomain.com/api"
      
      # REPLACE: your-generated-jwt-secret-here with the JWT secret from Step 2
      JWT_SECRET: "your-generated-jwt-secret-here"
      
      # REPLACE: your-db-password with the PostgreSQL password from Step 2
      DATABASE_URL: "postgresql://postiz-user:your-db-password@postiz-postgres:5432/postiz-db-local"
      
      REDIS_URL: "redis://postiz-redis:6379"
      BACKEND_INTERNAL_URL: "http://localhost:3000"
      IS_GENERAL: "true"
      DISABLE_REGISTRATION: "false"  # Set to "true" after first account creation
      STORAGE_PROVIDER: "local"
      UPLOAD_DIRECTORY: "/uploads"
      NEXT_PUBLIC_UPLOAD_DIRECTORY: "/uploads"
      
      # OPTIONAL: Add your OpenAI API key for AI features
      # OPENAI_API_KEY: "sk-your-openai-api-key-here"

      # ADD ALL YOUR SOCIAL MEDIA ACCOUNTS HERE... CHEKC THEIR DOCUMENTATION FOR INSTRUCTIONS HOW TO DO IT IN EACH CASE: https://docs.postiz.com/providers/
      #X/Twitter
      X_API_KEY: "CLIENTID"
      X_API_SECRET: "CLIENT SECRET"
    
    
    volumes:
      - postiz-config:/config/
      - postiz-uploads:/uploads/
    ports:
      - "5000:5000"
    networks:
      - postiz-network
    depends_on:
      postiz-postgres:
        condition: service_healthy
      postiz-redis:
        condition: service_healthy

  postiz-postgres:
    image: postgres:17-alpine
    container_name: postiz-postgres
    restart: unless-stopped
    environment:
      # REPLACE: your-db-password with the SAME PostgreSQL password from Step 2
      POSTGRES_PASSWORD: your-db-password
      POSTGRES_USER: postiz-user
      POSTGRES_DB: postiz-db-local
    volumes:
      - postgres-volume:/var/lib/postgresql/data
    networks:
      - postiz-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postiz-user -d postiz-db-local"]
      interval: 10s
      timeout: 3s
      retries: 3

  postiz-redis:
    image: redis:7.2-alpine
    container_name: postiz-redis
    restart: unless-stopped
    volumes:
      - postiz-redis-data:/data
    networks:
      - postiz-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

networks:
  postiz-network:
    driver: bridge

volumes:
  postiz-config:
  postiz-uploads:
  postgres-volume:
  postiz-redis-data:
```

**⚠️ CRITICAL REPLACEMENTS NEEDED:**

1. **Replace ALL instances of `your-subdomain.yourdomain.com`** with your actual domain (e.g., `social.example.com`)
2. **Replace BOTH instances of `your-db-password`** with the PostgreSQL password you generated in Step 2
3. **Replace `your-generated-jwt-secret-here`** with the JWT secret you generated in Step 2
4. **Optionally replace `sk-your-openai-api-key-here`** with your OpenAI API key (remove # to enable)

### Step 4: Start Postiz

**Install docker-compose if not available:**
```bash
sudo apt install docker-compose
```

**Start services:**
```bash
# Start all services
sudo docker-compose up -d

# Check status
sudo docker-compose ps

# View logs (if something goes wrong)
sudo docker-compose logs -f postiz
```

## 🌐 SSL Setup with Nginx

### Step 1: Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/postiz.conf
```

**Add this configuration (REPLACE the domain!):**

```nginx
server {
    # REPLACE: your-subdomain.yourdomain.com with YOUR actual domain
    server_name your-subdomain.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    listen 80;
}
```

### Step 2: Enable Configuration and SSL

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/postiz.conf /etc/nginx/sites-enabled/

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate (REPLACE with YOUR domain!)
sudo certbot --nginx -d your-subdomain.yourdomain.com
```

## 🔐 Security Configuration

After creating your first account, secure your installation:

```bash
# Edit docker-compose.yml
nano ~/postiz/docker-compose.yml
```

**Change this line:**
```yaml
DISABLE_REGISTRATION: "true"  # Prevents new user registrations
```

**Restart containers:**
```bash
sudo docker-compose down
sudo docker-compose up -d
```

## 🔄 Automatic Updates

### Create Auto-Update Script

```bash
nano ~/update_postiz.sh
```

**Add this content:**

```bash
#!/bin/bash
LOG_FILE="/var/log/update_postiz.log"
BACKUP_DATE=$(date +'%Y-%m-%d_%H-%M-%S')

echo "=== Postiz Update Started: $(date) ===" >> $LOG_FILE

# Backup configuration
mkdir -p /home/ubuntu/postiz-backup-$BACKUP_DATE
cp /home/ubuntu/postiz/docker-compose.yml /home/ubuntu/postiz-backup-$BACKUP_DATE/

# Update Postiz
cd /home/ubuntu/postiz
sudo docker-compose down >> $LOG_FILE 2>&1
sudo docker-compose pull >> $LOG_FILE 2>&1
sudo docker-compose up -d >> $LOG_FILE 2>&1

# Wait for services to start
sleep 60

# Check container health
sudo docker-compose ps >> $LOG_FILE 2>&1

# Clean up old Postiz Docker images (only Postiz, not other services)
sudo docker image prune -f --filter "label=org.opencontainers.image.source=https://github.com/gitroomhq/postiz-app" >> $LOG_FILE 2>&1

# Clean up old backups (keep only 2 latest)
find /home/ubuntu/postiz-backup-* -maxdepth 0 -type d | sort | head -n -2 | xargs rm -rf

echo "=== Postiz Update Completed: $(date) ===" >> $LOG_FILE
```

### Setup Automated Updates

```bash
# Make script executable
chmod +x ~/update_postiz.sh

# Create log file
sudo touch /var/log/update_postiz.log
sudo chmod 666 /var/log/update_postiz.log

# Add to crontab
sudo crontab -e
```

**Add these lines:**

```bash
# Postiz auto-update every Sunday at 5 AM
0 5 * * 0 /bin/bash /home/ubuntu/update_postiz.sh >> /var/log/update_postiz.log 2>&1

# Auto-start after VM reboot
@reboot sleep 90 && cd /home/ubuntu/postiz && sudo docker-compose up -d
```

## 🤖 AI Integration

### Supported AI Providers

Add these environment variables to your `docker-compose.yml` under the postiz service:

```yaml
environment:
  # OpenAI (REPLACE with your actual API key)
  OPENAI_API_KEY: "sk-your-actual-openai-api-key"
  
  # Add other providers as supported:
  # ANTHROPIC_API_KEY: "your-actual-anthropic-key"
  # GOOGLE_AI_API_KEY: "your-actual-google-key"
```

**Get API Keys:**
- OpenAI: [platform.openai.com](https://platform.openai.com/api-keys)
- Anthropic: [console.anthropic.com](https://console.anthropic.com/)
- Google AI: [aistudio.google.com](https://aistudio.google.com/)

## 📱 Social Media Integration

Connect your social media accounts through the Postiz web interface at `https://your-subdomain.yourdomain.com` (REPLACE with your actual domain).

**Supported Platforms:**
- Facebook Pages & Groups
- Instagram Business
- Twitter/X
- LinkedIn Personal & Company Pages  
- TikTok Business
- YouTube
- Pinterest Business
- Reddit

**Setup Requirements:**
1. Create developer apps for each platform
2. Configure OAuth callbacks to your domain
3. Add API credentials through Postiz interface

**Helpful Resources:**
- [Facebook Developer Console](https://developers.facebook.com/)
- [Twitter Developer Portal](https://developer.twitter.com/)
- [LinkedIn Developer Network](https://www.linkedin.com/developers/)

## 🔌 MCP Integration (Claude Desktop)

Your Postiz instance provides an MCP endpoint for integration with Claude Desktop:

```json
"postiz": {
  "command": "npx",
  "args": [
    "-y",
    "supergateway", 
    "--sse",
    "https://your-subdomain.yourdomain.com/api/mcp/YOUR_MCP_TOKEN/sse"
  ]
}
```

**REPLACE:**
- `your-subdomain.yourdomain.com` with your actual domain
- `YOUR_MCP_TOKEN` with the token found in your Postiz settings after installation

## 🛠️ Managing Your Instance

### Manual Commands

```bash
# Stop Postiz
cd ~/postiz
sudo docker-compose down

# Start Postiz  
sudo docker-compose up -d

# View logs
sudo docker-compose logs -f

# Manual update
sudo bash ~/update_postiz.sh
```

### Monitor Updates

```bash
# Check update logs
tail -n 50 /var/log/update_postiz.log

# List configuration backups
ls -la ~/postiz-backup-*
```

## 🛠️ Troubleshooting

### Common Issues

**Port 5000 not accessible:**
- Check Oracle Cloud Security Rules
- Verify iptables configuration: `sudo iptables -L INPUT -n -v`

**Container startup failures:**
- Check logs: `sudo docker-compose logs`
- Verify environment variables in docker-compose.yml
- Ensure PostgreSQL and Redis are healthy

**SSL certificate issues:**
- Verify DNS resolves: `nslookup your-subdomain.yourdomain.com` (REPLACE with your domain)
- Check Nginx configuration: `sudo nginx -t`
- Renew certificates: `sudo certbot renew`

### Reset Installation

If you need to start fresh:

```bash
cd ~/postiz
sudo docker-compose down
sudo docker volume rm postiz_postgres-volume postiz_postiz-config postiz_postiz-uploads postiz_postiz-redis-data
sudo docker-compose up -d
```

**⚠️ Warning:** This deletes all data including posts, accounts, and uploads.

## 📊 Auto-Update Features

- **Automatic updates** every Sunday at 5 AM  
- **Auto-start** after VM reboot (90-second delay)
- **Configuration backups** before each update
- **Health checks** after updates
- **Keeps only 2 latest backups** (prevents disk filling)
- **Database data preserved** during updates

## 🎉 Success!

You now have a fully automated, self-hosted Postiz instance that:

- ✅ **Runs 24/7** on Oracle Cloud free tier
- ✅ **Auto-updates** every Sunday at 5 AM
- ✅ **Auto-starts** after VM reboots  
- ✅ **Uses SSL encryption** with automatic renewal
- ✅ **Supports AI integration** for content generation
- ✅ **Provides MCP integration** for Claude Desktop
- ✅ **Secured against unauthorized registration**

**Access your instance:** `https://your-subdomain.yourdomain.com` (REPLACE with your actual domain)

---

## 📝 SUMMARY OF WHAT YOU NEED TO REPLACE:

1. **Domain/Subdomain**: Replace `your-subdomain.yourdomain.com` with your actual domain (e.g., `social.example.com`)
2. **JWT Secret**: Replace `your-generated-jwt-secret-here` with output from `openssl rand -base64 64`
3. **Database Password**: Replace BOTH instances of `your-db-password` with output from `openssl rand -base64 32`
4. **API Keys**: Replace `sk-your-actual-openai-api-key` with your real OpenAI API key (optional)
5. **VM IP**: Replace `YOUR_PUBLIC_IP` with your Oracle Cloud VM's public IP
6. **SSH Key Path**: Replace `~/path/to/your-ssh-key.key` with your actual SSH key path

**Need a more advanced deployment, integration, or enterprise automation?** Visit [Stardawnai.com](https://stardawnai.com) for professional consulting and development on AI-driven process automation, SAP integration, self-hosted enterprise N8N workflows, and custom hybrid infrastructure solutions tailored to your business needs.