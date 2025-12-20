# 💎FreqTrade Installation Guide for ARM64 Ubuntu Server💎

Complete installation guide for FreqTrade on ARM64 Ubuntu servers, addressing common compilation issues and providing a production-ready setup.

## ◾Table of Contents
- [Prerequisites](#prerequisites)
- [Why Conda Instead of Virtual Environment](#why-conda-instead-of-virtual-environment)
- [Installation Steps](#installation-steps)
- [Configuration](#configuration)
- [Service Setup](#service-setup)
- [Web Server Setup](#web-server-setup)
- [SSL Certificate](#ssl-certificate)
- [Auto-Updates](#auto-updates)
- [Troubleshooting](#troubleshooting)

## ◾Prerequisites

- Ubuntu 22.04+ ARM64 server
- Domain name with DNS A record configured (e.g., freqtrade.yourdomain.com)
- Root/sudo access
- Basic Linux command line knowledge

## ◾Why Conda Instead of Virtual Environment

**Problem**: Standard Python virtual environments on ARM64 servers often fail when installing FreqTrade due to:
- TA-Lib compilation failures (missing ARM64 pre-built packages)
- Missing system development libraries
- Complex build dependencies for scientific Python packages

**Solution**: Miniforge (conda-forge for ARM64) provides pre-compiled packages that eliminate compilation issues.

### Failed Approaches (for reference):
```bash
# These typically fail on ARM64:
python3 -m venv freqtrade_env
pip install freqtrade[all]  # Fails at TA-Lib compilation
sudo apt install libta-lib-dev  # Not available for ARM64 Ubuntu
```

## ◾Installation Steps

### 📍Step 1: Install Miniforge (ARM64)

```bash
# Download Miniforge for ARM64
wget -O conda-installer.sh "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-aarch64.sh"

# Install Miniforge
bash conda-installer.sh -b -p $HOME/miniforge3

# Initialize conda
eval "$($HOME/miniforge3/bin/conda shell.bash hook)"

# Make conda available permanently
echo 'export PATH="$HOME/miniforge3/bin:$PATH"' >> ~/.bashrc
echo 'source $HOME/miniforge3/etc/profile.d/conda.sh' >> ~/.bashrc
source ~/.bashrc
```

### 📍Step 2: Create Directory Structure

```bash
# Create organized directory structure
sudo mkdir -p /opt/trading/freqtrade
sudo mkdir -p /opt/trading/shared/{data,logs,configs}
sudo chown -R $USER:$USER /opt/trading

# Create symlink for easier access
ln -s /opt/trading ~/trading
```

### 📍Step 3: Create FreqTrade Environment

```bash
# Create conda environment with Python 3.12
conda create -n freqtrade python=3.12 -y

# Activate environment
conda activate freqtrade

# Upgrade pip and install build tools
python -m pip install -U pip setuptools wheel
```

### 📍Step 4: Install FreqTrade

```bash
# Navigate to FreqTrade directory
cd /opt/trading/freqtrade

# Install FreqTrade (conda handles TA-Lib dependencies)
pip install freqtrade

# Verify installation
freqtrade --version
```

### 📍Step 5: Create Configuration Directories

```bash
# Create configuration structure
mkdir -p config/user_data/{data,logs,notebooks,plot,strategies,hyperopts,backtest_results}

# Initialize FreqTrade user directory
freqtrade create-userdir --userdir config/user_data
```

## ◾Configuration

### 📍Step 1: Base Configuration

```bash
# Create base configuration file
cat > /opt/trading/freqtrade/config/config.json << 'EOL'
{
    "max_open_trades": 1,
    "stake_currency": "USDT", 
    "stake_amount": 100,
    "dry_run": true,
    "trading_mode": "spot",
    "exchange": {
        "name": "binance",
        "key": "",
        "secret": "",
        "ccxt_config": {},
        "pair_whitelist": [
            "BTC/USDT"
        ],
        "pair_blacklist": []
    },
    "entry_pricing": {
        "price_side": "same",
        "use_order_book": true,
        "order_book_top": 1
    },
    "exit_pricing": {
        "price_side": "same", 
        "use_order_book": true,
        "order_book_top": 1
    },
    "pairlists": [
        {"method": "StaticPairList"}
    ],
    "dataformat_ohlcv": "json"
}
EOL
```

### 📍Step 2: Web Server Configuration

Create JWT secret and configuration:
```bash
# Generate JWT secret
export FREQTRADE_JWT_SECRET=$(openssl rand -hex 32)
echo "Your JWT Secret: $FREQTRADE_JWT_SECRET"

# Create web server configuration (replace JWT secret, domain, username, and password)
cat > /opt/trading/freqtrade/config/webserver_config.json << 'EOL'
{
    "api_server": {
        "enabled": true,
        "listen_ip_address": "0.0.0.0",
        "listen_port": 9501,
        "verbosity": "info",
        "jwt_secret_key": "REPLACE_WITH_YOUR_JWT_SECRET",
        "CORS_origins": ["https://freqtrade.yourdomain.com"],
        "username": "your-username",
        "password": "your-secure-password"
    }
}
EOL

# Edit the file to replace placeholders
nano /opt/trading/freqtrade/config/webserver_config.json
```

### 📍Step 3: Install Web UI

```bash
# Activate FreqTrade environment
conda activate freqtrade

# Install FreqTrade UI
freqtrade install-ui
```

## ◾Service Setup

### 📍Step 1: Configure Firewall

```bash
# Add port for FreqTrade API
sudo iptables -I INPUT 10 -p tcp --dport 9501 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

### 📍Step 2: Create Systemd Service

```bash
# Create systemd service file
sudo tee /etc/systemd/system/freqtrade-webserver.service << 'EOL'
[Unit]
Description=FreqTrade Web Server
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/trading/freqtrade/config
Environment=PATH=/home/ubuntu/miniforge3/envs/freqtrade/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/home/ubuntu/miniforge3/envs/freqtrade/bin/freqtrade webserver --config /opt/trading/freqtrade/config/config.json --config /opt/trading/freqtrade/config/webserver_config.json
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOL
```

### 📍Step 3: Enable and Start Service

```bash
# Reload systemd and start service
sudo systemctl daemon-reload
sudo systemctl enable freqtrade-webserver
sudo systemctl start freqtrade-webserver

# Check status
sudo systemctl status freqtrade-webserver
```

## ◾Web Server Setup

### 📍Step 1: Install and Configure Nginx

```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx configuration (replace freqtrade.yourdomain.com with your subdomain)
sudo tee /etc/nginx/sites-available/freqtrade.conf << 'EOL'
server {
    server_name freqtrade.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:9501;
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
EOL

# Edit the configuration to replace the domain
sudo nano /etc/nginx/sites-available/freqtrade.conf
```

### 📍Step 2: Enable Nginx Configuration

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/freqtrade.conf /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## ◾SSL Certificate

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Generate SSL certificate (replace with your subdomain)
sudo certbot --nginx -d freqtrade.yourdomain.com

# Follow the prompts to configure SSL
```

## ◾Auto-Updates

### 📍Step 1: Configure Sudoers for Service Management

```bash
# Create sudoers configuration for service management
sudo tee /etc/sudoers.d/freqtrade-service << 'EOL'
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl start freqtrade-webserver, /bin/systemctl stop freqtrade-webserver, /bin/systemctl restart freqtrade-webserver, /bin/systemctl status freqtrade-webserver
EOL

# Set correct permissions
sudo chmod 0440 /etc/sudoers.d/freqtrade-service
```

### 📍Step 2: Create Update Script

```bash
# Create the update script
cat > /opt/trading/freqtrade/update_freqtrade.sh << 'SCRIPT_EOF'
#!/bin/bash

LOG_FILE="/var/log/freqtrade_update.log"

echo "=== FreqTrade Update Started: $(date) ===" >> $LOG_FILE

source /home/ubuntu/miniforge3/etc/profile.d/conda.sh
conda activate freqtrade

BACKUP_DATE=$(date +'%Y-%m-%d_%H-%M-%S')
mkdir -p /opt/trading/backups/freqtrade_$BACKUP_DATE
cp -r /opt/trading/freqtrade/config /opt/trading/backups/freqtrade_$BACKUP_DATE/

echo "Current version:" >> $LOG_FILE
pip show freqtrade | grep Version >> $LOG_FILE

# Update FreqTrade (--no-deps prevents TA-Lib recompilation issues)
echo "Updating FreqTrade..." >> $LOG_FILE
pip install --upgrade --no-deps freqtrade >> $LOG_FILE 2>&1

echo "New version:" >> $LOG_FILE
pip show freqtrade | grep Version >> $LOG_FILE

sudo systemctl restart freqtrade-webserver

sleep 5
if sudo systemctl is-active --quiet freqtrade-webserver; then
    echo "Service restarted successfully" >> $LOG_FILE
else
    echo "Service restart failed" >> $LOG_FILE
fi

find /opt/trading/backups/freqtrade_* -maxdepth 0 -type d | sort | head -n -3 | xargs rm -rf 2>/dev/null

echo "=== FreqTrade Update Completed: $(date) ===" >> $LOG_FILE
SCRIPT_EOF

# Make executable
chmod +x /opt/trading/freqtrade/update_freqtrade.sh

# Create necessary directories and files
sudo mkdir -p /opt/trading/backups
sudo touch /var/log/freqtrade_update.log
sudo chown ubuntu:ubuntu /var/log/freqtrade_update.log /opt/trading/backups
```

### 📍Step 3: Schedule Updates

```bash
# Add to crontab (Sunday 2 AM)
crontab -e

# Add this line:
0 2 * * 0 /bin/bash /opt/trading/freqtrade/update_freqtrade.sh >/dev/null 2>&1
```

## ◾Troubleshooting

### Common Issues

**Issue**: TA-Lib compilation errors during installation
**Solution**: Use conda/miniforge instead of standard pip installation

**Issue**: Service fails to start with permission errors
**Solution**: Check file ownership and systemd service user configuration

**Issue**: Update script fails with TA-Lib errors
**Solution**: The `--no-deps` flag in the update script prevents dependency recompilation

**Issue**: Web UI not accessible
**Solution**: Check firewall rules and Nginx configuration

### Useful Commands

```bash
# Check FreqTrade status
sudo systemctl status freqtrade-webserver

# View logs
sudo journalctl -u freqtrade-webserver -f

# Test API connectivity
curl http://localhost:9501/api/v1/version

# Check conda environment
conda info --envs

# Manual update test
bash /opt/trading/freqtrade/update_freqtrade.sh
```

### Log Files

- Service logs: `sudo journalctl -u freqtrade-webserver`
- Update logs: `/var/log/freqtrade_update.log`
- Nginx logs: `/var/log/nginx/error.log`

## Security Notes

- **IMPORTANT**: Replace all placeholder values:
  - JWT secret in webserver_config.json
  - Username and password in webserver_config.json
  - Domain name (freqtrade.yourdomain.com) in all configurations
- Consider firewall restrictions for production environments
- Regularly update system packages alongside FreqTrade
- Monitor log files for unusual activity

## Performance Tips

- Use dry-run mode for testing strategies
- Monitor system resources during backtesting
- Configure appropriate log levels to manage disk usage
- Regular backup of configuration files

## DNS Configuration

Before starting, ensure your DNS A record is configured:
- Create an A record for `freqtrade.yourdomain.com` pointing to your server's IP address
- Wait for DNS propagation (usually 5-30 minutes) before requesting SSL certificate

This installation method resolves common ARM64 compilation issues and provides a production-ready FreqTrade setup with automatic updates and proper service management.
