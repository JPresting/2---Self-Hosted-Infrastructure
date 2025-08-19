# Self-Hosting Crawl4AI with Auto-Updates & Basic Authentication

A comprehensive guide to deploy your own production-ready Crawl4AI instance featuring Docker containerization, Nginx reverse proxy, SSL certificates, Basic Authentication, and automated updates. Complete with n8n workflow integration examples covering multiple extraction strategies (simple link extraction, LLM-powered content analysis, deep recursive crawling), plus local AI model integration for 100% free web crawling (excluding time and energy costs ;-)).

## 🌐 DNS Configuration

Set up your subdomain to point to your Oracle Cloud VM:

| Record Type | Host | Value | TTL |
|-------------|------|--------|-----|
| A | `crawl` | `203.0.113.50` | 14400 |

**Example**: If your domain is `example.com`, create `crawl.example.com` pointing to your VM's IP.

## 🖥️ Server Setup

### Connect to Your VM
```bash
ssh -i ~/path/to/your-ssh-key.key ubuntu@203.0.113.50
```

### Update System & Install Dependencies
```bash
sudo apt update
sudo apt install nginx git docker.io curl -y
```

### Start Docker
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### Install Certbot
```bash
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
```

## 🔥 Critical Oracle Cloud Firewall Fix

**⚠️ CRITICAL:** Oracle Cloud has TWO firewall layers that BOTH need configuration:

1. **Cloud-Level:** Security Groups (done in Step 1.3)
2. **Server-Level:** iptables (Ubuntu instance)

**Configure server-level iptables:**
```bash
# Allow HTTP (port 80)
sudo iptables -I INPUT 4 -p tcp --dport 80 -j ACCEPT

# Allow HTTPS (port 443) 
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT

# Allow Crawl4AI (port 11235)
sudo iptables -I INPUT 6 -p tcp --dport 11235 -j ACCEPT

# Install iptables-persistent to save rules permanently
sudo apt install iptables-persistent -y

# Save current rules
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

**Why this is required:** Oracle Cloud Ubuntu instances block all traffic except SSH by default, even with correct Security Groups.

## 📦 Crawl4AI Installation

### Create Environment File
```bash
mkdir -p ~/crawl4ai
cd ~/crawl4ai
nano .llm.env
```

**Add your API keys:**
```env
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
GOOGLE_API_KEY=AIza-your-google-api-key-here
OPENROUTER_API_KEY=sk-or-your-openrouter-key-here
```

### Start Crawl4AI Container
```bash
sudo docker run -d \
  -p 11235:11235 \
  --name crawl4ai \
  --env-file /home/ubuntu/crawl4ai/.llm.env \
  --shm-size=1g \
  --restart unless-stopped \
  unclecode/crawl4ai:latest
```

### Verify Installation
```bash
# Check if container is running
sudo docker ps | grep crawl4ai

# Test local access
curl -f http://localhost:11235/health
```

## 🌐 Nginx Configuration with Basic Auth

### Create Basic Auth Password File
```bash
# Generate password hash (replace 'your-secure-password' with your actual password)
# you can also rename "admin" to e.g. your name. This now protects the API calls as well as the console when entering `crawl.yourdomain.com` in your browser.
sudo bash -c 'echo "admin:$(openssl passwd -apr1 your-secure-password)" > /etc/nginx/.htpasswd'
```

### Create Initial Nginx Configuration (HTTP only)
```bash
sudo nano /etc/nginx/sites-available/crawl4ai.conf
```

**Add this configuration** (replace `crawl.example.com` with your subdomain):

```nginx
server {
    listen 80;
    server_name crawl.example.com;
    
    # Basic Authentication
    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    location / {
        proxy_pass http://localhost:11235;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_set_header Authorization $http_authorization;
        client_max_body_size 100M;
    }
}
```

### Enable Configuration
```bash
sudo ln -s /etc/nginx/sites-available/crawl4ai.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 SSL Certificate Setup

### Get SSL Certificate
```bash
sudo certbot --nginx -d crawl.example.com
```

Follow the prompts:
- Enter your email address
- Accept terms of service
- Choose whether to share email with EFF
- **Choose option 2** to redirect HTTP to HTTPS

**Certbot will automatically update your nginx configuration with SSL settings!**

## ✅ Test Your Setup

### Test Authentication
```bash
# Test without credentials (should return 401)
curl -I https://crawl.example.com/

# Test with credentials (should return 200)
curl -u admin:your-secure-password https://crawl.example.com/health
```

### Test API Endpoint
```bash
curl -u admin:your-secure-password \
  -X POST https://crawl.example.com/crawl \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com"]}'
```

## 🔄 Automatic Updates

### Create Auto-Update Script
```bash
nano ~/update_crawl4ai.sh
```

**Add this content:**
```bash
#!/bin/bash

CONTAINER_NAME="crawl4ai"
IMAGE_NAME="unclecode/crawl4ai:latest"
ENV_FILE="/home/ubuntu/crawl4ai/.llm.env"
LOG_FILE="/var/log/update_crawl4ai.log"

echo "=== Crawl4AI Update Started: $(date) ===" >> $LOG_FILE

if sudo docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Stopping existing container..." >> $LOG_FILE
    sudo docker stop $CONTAINER_NAME >> $LOG_FILE 2>&1
    sudo docker rm $CONTAINER_NAME >> $LOG_FILE 2>&1
fi

echo "Pulling latest image..." >> $LOG_FILE
sudo docker pull $IMAGE_NAME >> $LOG_FILE 2>&1

echo "Starting container..." >> $LOG_FILE
sudo docker run -d \
  -p 11235:11235 \
  --name $CONTAINER_NAME \
  --env-file $ENV_FILE \
  --shm-size=1g \
  --restart unless-stopped \
  $IMAGE_NAME >> $LOG_FILE 2>&1

echo "=== Crawl4AI Update Completed: $(date) ===" >> $LOG_FILE
```

### Make Script Executable & Setup Log
```bash
chmod +x ~/update_crawl4ai.sh
sudo touch /var/log/update_crawl4ai.log
sudo chmod 666 /var/log/update_crawl4ai.log
```

### Set Up Cronjobs
```bash
sudo crontab -e
```

Add these lines:
```bash
# Auto-update Crawl4AI every Sunday at 4 AM
0 4 * * 0 /bin/bash /home/ubuntu/update_crawl4ai.sh >/dev/null 2>&1

# Auto-start Crawl4AI after VM reboot
@reboot sleep 60 && sudo docker run -d --name crawl4ai -p 11235:11235 --env-file /home/ubuntu/crawl4ai/.llm.env --shm-size=1g --restart unless-stopped unclecode/crawl4ai:latest
```

## 🔌 n8n Integration

### Configure n8n HTTP Request Node

**Authentication:**
- **Type**: Basic Auth
- **Username**: `admin`
- **Password**: `your-secure-password`

**Request Settings:**
- **Method**: POST
- **URL**: `https://crawl.example.com/crawl` or `https://crawl.example.com/crawl/job`
- **Headers**: `Content-Type: application/json`

## 📚 API Usage Examples

### Simple Extraction (Links Only)

**Endpoint:** `POST https://crawl.example.com/crawl`

```json
{
  "urls": ["https://example.com/operations/"],
  "extraction_strategy": {
    "type": "SimpleExtractionStrategy", 
    "params": {
      "extract": ["links"]
    }
  }
}
```

### LLM-based Extraction (Cloud Models)

**Endpoint:** `POST https://crawl.example.com/crawl`

```json
{
  "urls": ["https://example.com"],
  "browser_config": {
    "type": "BrowserConfig",
    "params": { "headless": true }
  },
  "crawler_config": {
    "type": "CrawlerRunConfig",
    "params": {
      "extraction_strategy": {
        "type": "LLMExtractionStrategy",
        "params": {
          "llm_config": {
            "type": "LLMConfig",
            "params": {
              "provider": "gemini/gemini-2.5-pro",
              "api_token": "env:GOOGLE_API_KEY",
              "temperature": 0.5
            }
          },
          "instruction": "Summarize the main content of the page.",
          "schema": {
            "type": "dict",
            "value": {
              "type": "object",
              "properties": {
                "title": { "type": "string" },
                "content": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

### Local Ollama Integration

**Endpoint:** `POST https://crawl.example.com/crawl`

```json
{
  "urls": ["https://example.com"],
  "browser_config": {
    "type": "BrowserConfig",
    "params": { "headless": true }
  },
  "crawler_config": {
    "type": "CrawlerRunConfig",
    "params": {
      "extraction_strategy": {
        "type": "LLMExtractionStrategy",
        "params": {
          "llm_config": {
            "type": "LLMConfig",
            "params": {
              "provider": "ollama/mistral:7b-instruct",
              "base_url": "https://your-ngrok-url.ngrok-free.app",
              "api_token": null
            }
          },
          "instruction": "Summarize the main content of the page.",
          "schema": {
            "type": "dict",
            "value": {
              "type": "object",
              "properties": {
                "title": { "type": "string" },
                "content": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

### Deep Crawl (Asynchronous Jobs)

**Submit Job:** `POST https://crawl.example.com/crawl/job`

```json
{
  "urls": ["https://example.com/"],
  "browser_config": {
    "type": "BrowserConfig",
    "params": {
      "headless": true
    }
  },
  "crawler_config": {
    "type": "CrawlerRunConfig",
    "params": {
      "deep_crawl_strategy": {
        "type": "BFSDeepCrawlStrategy",
        "params": {
          "max_depth": 2,
          "max_pages": 20,
          "include_external": false
        }
      },
      "extraction_strategy": {
        "type": "LLMExtractionStrategy",
        "params": {
          "llm_config": {
            "type": "LLMConfig",
            "params": {
              "provider": "gemini/gemini-2.5-flash",
              "api_token": "env:GOOGLE_API_KEY"
            }
          },
          "instruction": "Extract mine names and locations. Return JSON only.",
          "schema": {
            "type": "dict",
            "value": {
              "type": "object",
              "properties": {
                "mines": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "name": { "type": "string" },
                      "location": { "type": "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**Response:** `{"task_id": "abc123-def456-ghi789"}`

**Check Status:** `GET https://crawl.example.com/crawl/job/{task_id}`

## 🛠️ Managing Your Instance

### Manual Commands
```bash
# Stop Crawl4AI
sudo docker stop crawl4ai

# Start Crawl4AI
sudo docker start crawl4ai

# View Logs
sudo docker logs crawl4ai -f

# Manual Update
sudo bash ~/update_crawl4ai.sh

# Check running containers
sudo docker ps
```

### Monitor Updates
```bash
# Check update logs
tail -n 50 /var/log/update_crawl4ai.log

# Check container status
sudo docker ps --format "table {{.Names}}\t{{.Status}}"
```

## 🔐 Security Features

- ✅ **Basic HTTP Authentication** protects all endpoints
- ✅ **SSL/TLS encryption** with automatic certificate renewal
- ✅ **Oracle Cloud firewall** (dual-layer protection)
- ✅ **Regular security updates** via automated container updates
- ✅ **API key protection** (stored securely in environment variables)

## 📊 Auto-Update Features

- **Automatic updates** every Sunday at 4 AM
- **Auto-start** after VM reboot (60 second delay)
- **Data preservation** (environment variables and configs preserved)
- **Detailed logging** of all operations
- **Health checks** after updates
- **Automatic cleanup** of old Docker images

## 🛠️ Troubleshooting

### Container Issues
```bash
# Check if container is running
sudo docker ps | grep crawl4ai

# Check container logs
sudo docker logs crawl4ai

# Restart container
sudo docker restart crawl4ai
```

### Nginx Issues
```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates manually
sudo certbot renew
sudo systemctl reload nginx
```

## 🎉 Success!

You now have a fully automated, self-hosted Crawl4AI instance that:

- ✅ **Runs 24/7** on Oracle Cloud free tier
- ✅ **Auto-updates** every Sunday at 4 AM
- ✅ **Auto-starts** after VM reboots
- ✅ **Protected by Basic Authentication**
- ✅ **Uses SSL encryption** with automatic renewal
- ✅ **Accessible via custom domain**
- ✅ **Integrates with n8n** for workflow automation
- ✅ **Supports multiple LLM providers** (OpenAI, Anthropic, Gemini, Ollama)

## 🔗 Additional Resources

- [Crawl4AI GitHub](https://github.com/unclecode/crawl4ai)
- [Crawl4AI Documentation](https://docs.crawl4ai.com/)
- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

**Need a more advanced deployment, integration, or enterprise automation?** Visit [Stardawnai.com](https://stardawnai.com) for professional consulting and development on AI-driven process automation, SAP integration, self-hosted enterprise N8N workflows, and custom hybrid infrastructure solutions tailored to your business needs.
