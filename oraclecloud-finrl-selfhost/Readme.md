# 💎FinRL Deployment Guide💎

Complete installation and deployment guide for FinRL with Jupyter Lab on Ubuntu server with SSL and domain access.

## Prerequisites

- Ubuntu Server (tested on 22.04)
- Domain pointing to your server (A record: `research.yourdomain.com`)
- Root/sudo access
- Miniconda/Miniforge installed

## 1. Create Conda Environment

```bash
cd ~/trading/finrl
conda create -n finrl python=3.10 -y
conda activate finrl
```
If you don't have conda on your instance, install it first:

### Failed Approaches (for reference):
```bash
# These typically fail on ARM64:
python3 -m venv freqtrade_env
pip install freqtrade[all]  # Fails at TA-Lib compilation
sudo apt install libta-lib-dev  # Not available for ARM64 Ubuntu
```

## Installation Steps

### Step 1: Install Miniforge (ARM64)

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







## 2. Install FinRL

Clone and install FinRL from source:

```bash
git clone https://github.com/AI4Finance-Foundation/FinRL.git
cd FinRL
pip install -e .
```

Install additional dependencies:

```bash
pip install jupyterlab yfinance pandas numpy matplotlib seaborn notebook
```

## 3. Configure Jupyter Lab

### Generate Jupyter Config

```bash
jupyter lab --generate-config
```

This creates `~/.jupyter/jupyter_lab_config.py`

### Set Password

Generate password hash:

```bash
python3 -c "from jupyter_server.auth import passwd; print(passwd('YourSecurePassword123'))"
```

### Configure Jupyter

Edit `~/.jupyter/jupyter_lab_config.py`:

```python
c.ServerApp.ip = '127.0.0.1'
c.ServerApp.port = 8888
c.ServerApp.allow_origin = '*'
c.ServerApp.allow_remote_access = True
c.ServerApp.allow_credentials = True
c.PasswordIdentityProvider.hashed_password = 'argon2:$argon2id$v=19$m=10240,t=10,p=8$YOUR_HASH_HERE'
```

## 4. Create Startup Script

Create `~/trading/finrl/start_jupyter.sh`:

```bash
#!/bin/bash
source ~/miniforge3/etc/profile.d/conda.sh
conda activate finrl
cd /opt/trading/finrl
jupyter lab --ip=127.0.0.1 --port=8888 --no-browser
```

Make executable:

```bash
chmod +x ~/trading/finrl/start_jupyter.sh
```

## 5. Create Systemd Service

Create service file `/etc/systemd/system/jupyter-finrl.service`:

```ini
[Unit]
Description=Jupyter Lab (FinRL)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/trading/finrl
ExecStart=/home/ubuntu/trading/finrl/start_jupyter.sh
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable jupyter-finrl
sudo systemctl start jupyter-finrl
sudo systemctl status jupyter-finrl
```

## 6. Configure Nginx Reverse Proxy

Create Nginx virtual host `/etc/nginx/sites-available/research.yourdomain.com`:

```nginx
server {
    server_name research.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_http_version 1.1;
        proxy_buffering off;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/research.yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Setup SSL Certificate

Install Certbot and obtain SSL certificate:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d research.yourdomain.com
```

## 8. Access and Test

- **URL**: `https://research.yourdomain.com`
- **Login**: Use your configured password
- **Test FinRL**: Create new notebook and run:

```python
import finrl
import yfinance as yf
print("FinRL is ready! 🚀")

# Test data download
data = yf.download('AAPL', start='2023-01-01', end='2024-01-01')
print(f"Downloaded {len(data)} records for AAPL")
```

## 9. Update Script

Create automatic update script `~/trading/finrl/update_finrl.sh`:

```bash
#!/bin/bash
echo "=== FinRL Update Script ==="

# Activate conda environment
source ~/miniforge3/etc/profile.d/conda.sh
conda activate finrl

# Stop Jupyter service
echo "Stopping Jupyter Lab service..."
sudo systemctl stop jupyter-finrl

# Update FinRL from repository
echo "Updating FinRL repository..."
cd ~/trading/finrl/FinRL
git pull origin master
pip install -e . --upgrade

# Update Python dependencies  
echo "Updating Python packages..."
pip install --upgrade yfinance pandas numpy matplotlib seaborn jupyterlab notebook

# Update system packages (optional)
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Restart Jupyter service
echo "Starting Jupyter Lab service..."
sudo systemctl start jupyter-finrl
sudo systemctl status jupyter-finrl --no-pager

echo "=== Update completed successfully! ==="
echo "Access your installation: https://research.yourdomain.com"
```

Make executable:

```bash
chmod +x ~/trading/finrl/update_finrl.sh
```

### Automatic Updates (Optional)

Setup weekly automatic updates (Sundays at 3 AM):

```bash
sudo crontab -e
```

Add line:

```bash
0 3 * * 0 /home/ubuntu/trading/finrl/update_finrl.sh >> /var/log/finrl_update.log 2>&1
```

## 10. Troubleshooting

### Check Service Status

```bash
sudo systemctl status jupyter-finrl
sudo journalctl -u jupyter-finrl -f
```

### Check Jupyter Locally

```bash
curl -I http://127.0.0.1:8888/lab
```

### Check Nginx Logs

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Common Issues

1. **403 Forbidden**: Check `allow_remote_access = True` in config
2. **502 Bad Gateway**: Jupyter service not running
3. **SSL Issues**: Run `sudo certbot renew --dry-run`

## Security Notes

- Keep your Jupyter password secure
- Regularly update FinRL and dependencies
- Monitor access logs for suspicious activity
- Consider IP restrictions in Nginx if needed

## What's Next?

You can now:
- Build reinforcement learning trading algorithms
- Analyze financial data with FinRL's built-in tools
- Deploy automated trading strategies
- Create custom environments for your trading scenarios

## Support

- **FinRL Documentation**: https://github.com/AI4Finance-Foundation/FinRL
- **Issues**: Check systemd logs and Nginx error logs
- **Updates**: Run the update script regularly

---

**Happy Trading! 📈🤖**
