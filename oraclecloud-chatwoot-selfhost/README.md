# 🚀 Oracle Cloud VM Setup Guide for Chatwoot

Quick guide for setting up a VM instance on Oracle Cloud for self-hosting Chatwoot customer support platform.

**Key Focus:** The most critical steps are configuring firewall rules (ingress/egress) to allow traffic to reach your applications, and securing a static public IP so you can point your domain's DNS records to a fixed address.

## 🚨 CRITICAL: Oracle Cloud's Double Firewall

**Oracle Cloud has TWO firewall layers that BOTH need configuration:**

1. **Cloud-Level:** Security Groups (Oracle Console) - Configure ingress rules
2. **Server-Level:** iptables (Ubuntu instance) - Configure server firewall

**Why this matters:** Even with correct Security Groups, your applications will be inaccessible due to Ubuntu's default iptables rules blocking traffic. This causes SSL certificate generation to fail and prevents external access to your applications.

**This is unique to Oracle Cloud** - other providers typically only have one firewall layer.

## 💳 Account Setup (Recommended)

To increase chances of successful VM provisioning, upgrade to **Pay-as-you-go** account:
- Navigate to **Billing & Cost Management → Upgrade and Manage Payment**
- This maintains free tier eligibility while improving resource allocation success

![Screenshot 2025-06-11 141824](https://github.com/user-attachments/assets/85fb4595-7016-48da-8248-3ce60f948a5b)

## 🖥️ VM Instance Creation

![armScreenshot 2025-06-11 140741](https://github.com/user-attachments/assets/01bbc56d-cfe3-49c6-ab7c-99e10760bf93)

**Free Tier Limits:**
- **ARM A1 Flex**: Up to 4 vCPUs and 24 GB RAM (maximum free tier allocation)
- **AMD/Intel**: VM.Standard.E2.1.Micro (1 vCPU, 1 GB RAM)

**Basic Setup:**
1. Create VM instance with your preferred OS
2. Generate SSH key pair and **securely store private key** - losing this key means losing VM access
3. Choose appropriate shape based on your needs

## 🌐 Public IP Configuration

A static public IP is essential for hosting applications as it allows you to point your domain's DNS records to a fixed address.

### Method 1: Assign During VM Creation
- ✅ **Enable "Automatically assign public IPv4 address"** during VM setup
- IP becomes permanent and survives VM restarts
- **Recommended approach**

![Scr222eenshot 2025-06-11 140429](https://github.com/user-attachments/assets/635fe3ca-a628-4922-bdd4-18174d1c6988)

### Method 2: Reserve and Assign Later
- Create VM without public IP
- Navigate to **Networking → Reserved Public IPs**
- Create reserved IP address
- Manually assign to VM's private IP later

## 🔒 Step 1: Oracle Cloud Security Rules (Cloud-Level Firewall)

**Critical Step:** Configure cloud-level firewall rules to allow traffic to your applications.

**⚠️ Important:** This is only the FIRST firewall layer. You'll also need to configure the server-level firewall (see Step 2 below).

### Accessing Security Rules
1. **Compute → Instances → Your VM**
2. Click on **subnet link** under networking details
3. Navigate to **Security Rules** tab
4. Click **Add Ingress Rules**

### Essential Ingress Rules
Add these rules with **Source CIDR: `0.0.0.0/0`** and **IP Protocol: TCP**:

| Port | Service | Description |
|------|---------|-------------|
| 22 | SSH | Remote access (usually pre-configured) |
| 80 | HTTP | Web traffic |
| 443 | HTTPS | Secure web traffic |
| 3000 | Chatwoot | Customer support platform |

### Rule Configuration
- **Stateless:** Leave unchecked (use stateful rules)
- **Source Type:** CIDR
- **Source CIDR:** `0.0.0.0/0` (allows access from anywhere)
- **Destination Port Range:** Specific port number

### Ingress vs Egress
- **Ingress:** Incoming traffic TO your VM (what you need to configure)
- **Egress:** Outgoing traffic FROM your VM (usually allowed by default)

## 🔥 Step 2: Server-Level Firewall (iptables Configuration)

**⚠️ CRITICAL:** Oracle Cloud Ubuntu instances have restrictive iptables rules that block traffic despite correct Security Groups.

### Check Current iptables Rules
```bash
# View current INPUT rules (you'll see REJECT rules blocking everything except SSH)
sudo iptables -L INPUT -n -v

# This shows which ports are ACCEPTED vs REJECTED with packet statistics
```

### Fix iptables to Allow Traffic
**Add required ports BEFORE the REJECT rule:**

```bash
# Allow HTTP (port 80)
sudo iptables -I INPUT 4 -p tcp --dport 80 -j ACCEPT

# Allow HTTPS (port 443) 
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT

# Allow Chatwoot (port 3000)
sudo iptables -I INPUT 6 -p tcp --dport 3000 -j ACCEPT
```

### Make iptables Rules Permanent
```bash
# Install iptables-persistent to save rules across reboots
sudo apt install iptables-persistent -y

# Save current rules
sudo iptables-save | sudo tee /etc/iptables/rules.v4

# Verify rules are active and see which ports are ACCEPTED
sudo iptables -L INPUT -n -v
```

**Example output after configuration:**
```
Chain INPUT (policy ACCEPT 0 packets, 0 bytes)
 pkts bytes target     prot opt in     out     source               destination         
 996K 1150M ACCEPT     0    --  *      *       0.0.0.0/0            0.0.0.0/0            state RELATED,ESTABLISHED
    1    80 ACCEPT     1    --  *      *       0.0.0.0/0            0.0.0.0/0           
47094 5524K ACCEPT     0    --  lo     *       0.0.0.0/0            0.0.0.0/0           
17097 1006K ACCEPT     6    --  *      *       0.0.0.0/0            0.0.0.0/0            state NEW tcp dpt:22
    0     0 ACCEPT     6    --  *      *       0.0.0.0/0            0.0.0.0/0            tcp dpt:80
    0     0 ACCEPT     6    --  *      *       0.0.0.0/0            0.0.0.0/0            tcp dpt:443
    0     0 ACCEPT     6    --  *      *       0.0.0.0/0            0.0.0.0/0            tcp dpt:3000
  276 79229 REJECT     0    --  *      *       0.0.0.0/0            0.0.0.0/0            reject-with icmp-host-prohibited
```

**✅ Good:** ACCEPT rules for ports 80, 443, 3000 appear BEFORE the REJECT rule
**❌ Bad:** If ACCEPT rules appear AFTER REJECT rule, they won't work

### Why This is Required
- Oracle Cloud Ubuntu instances come with default iptables rules that **REJECT** all traffic except SSH
- These rules override Security Group settings
- **Other cloud providers don't have this issue**
- Chatwoot installation doesn't automatically fix this (unlike some other applications)

### Quick Test
```bash
# Test if port 80 is accessible externally
sudo python3 -m http.server 80
# Then check http://YOUR_PUBLIC_IP in browser
# Press Ctrl+C to stop test server
```

## 🌍 Step 3: DNS Configuration

Once you have your static public IP, point your domain to it:

### Adding A-Record to Domain Provider
1. Login to your domain registrar (e.g., Namecheap, GoDaddy, Cloudflare)
2. Navigate to DNS management/DNS settings
3. Add new **A Record**:
   - **Type:** A
   - **Host/Name:** @ (for root domain) or subdomain (e.g., chat, support)
   - **Value/Points to:** Your Oracle Cloud static IP
   - **TTL:** 14400 (or default)

![Screenshot 2025-06-11 142336](https://github.com/user-attachments/assets/dbf67c4a-dd29-44cc-ac87-0bc3761490d4)

**Example:**
- **Host:** chat
- **Value:** 130.162.214.12
- **Result:** chat.yourdomain.com points to your VM

## 🔧 Connecting to Your VM

Once your VM is running and you have the public IP address, connect via SSH:

```bash
ssh -i ~/path/to/your-private-key.key ubuntu@YOUR_PUBLIC_IP
```

**Example:**
```bash
ssh -i ~/Downloads/ssh-key-2025-06-11.key ubuntu@130.162.214.12
```

## 📦 Chatwoot Installation

After connecting to your VM and configuring firewalls, install Chatwoot:

```bash
# Update package repository
sudo apt update

# Download and run Chatwoot installation script
wget https://get.chatwoot.app/linux/install.sh
chmod +x install.sh
./install.sh
```

The installer will guide you through:
- Domain configuration (use your A-record domain)
- SSL certificate setup (Let's Encrypt)
- Basic configuration

## 🛠️ Managing Your Chatwoot Instance

### Manual Commands
```bash
# Stop Chatwoot
sudo systemctl stop chatwoot.target

# Start Chatwoot
sudo systemctl start chatwoot.target

# Check Status
sudo systemctl status chatwoot.target

# View Logs
sudo journalctl -u chatwoot.target -f

# Edit Configuration
sudo nano /home/chatwoot/chatwoot/.env
```

### Restart After Config Changes
```bash
sudo systemctl restart chatwoot.target
```

## 📧 Google Workspace Email Integration

### Quick Setup:
1. **Google Cloud Console** → Create OAuth 2.0 Client
2. **Add Redirect URIs:**
   - `https://your-domain.com/google/callback`
   - `https://your-domain.com/omniauth/google_oauth2/callback`
3. **Enable APIs:** Gmail API, Google Calendar API
4. **Add to .env:** (Find path via:  sudo find /home/chatwoot/ -name ".env" 2>/dev/null)
   ```bash
   GOOGLE_OAUTH_CLIENT_ID=your_client_id
   GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
   GOOGLE_OAUTH_CALLBACK_URL=https://your-domain.com/google/callback
   ```
5. **Restart:** `sudo systemctl restart chatwoot.target`

**Detailed instructions:** [Google Workspace Setup Guide](https://www.chatwoot.com/docs/self-hosted/configuration/features/email-channel/google-workspace-setup/)
Analog for **Microsoft Office365:** [Office365 Chatwoot Setup](https://developers.chatwoot.com/self-hosted/configuration/features/email-channel/azure-app-setup)

## 📱 Facebook & Instagram Integration

**⚠️ Note:** Facebook/Instagram setup requires **Facebook App Review** and approval, which can take several days/weeks. You need to:

1. Create Facebook Developer App
2. Configure webhooks and permissions
3. **Submit for Facebook review** (most complex part)
4. Wait for approval
5. Add environment variables:
   ```bash
   FB_APP_ID=your_app_id
   FB_APP_SECRET=your_app_secret
   FB_VERIFY_TOKEN=your_verify_token
   IG_VERIFY_TOKEN=your_instagram_token
   ```

**Detailed setup guides:**
- [Facebook Messenger Setup](https://www.chatwoot.com/docs/self-hosted/configuration/features/integrations/facebook-channel-setup)
- [Instagram Setup](https://www.chatwoot.com/docs/self-hosted/configuration/features/integrations/instagram-channel-setup)

## 🚨 Common Issues & Troubleshooting

### SSL Certificate Generation Fails
**Problem:** Let's Encrypt certificate generation fails with errors like:
- "Error getting validation data"
- "Connection refused"
- "Fetching http://yourdomain.com/.well-known/acme-challenge/ failed"

**Cause:** Oracle Cloud's iptables blocking HTTP traffic despite correct Security Groups

**Solution:**
1. Verify DNS resolves correctly: `nslookup yourdomain.com`
2. Check Security Groups allow ports 80 and 443
3. **Most importantly:** Configure server-level iptables (see Step 2 above)
4. Test with: `sudo python3 -m http.server 80` and visit http://yourdomain.com

### Chatwoot Not Accessible Despite Installation
**Problem:** Chatwoot runs internally (e.g., `netstat -tlnp | grep :3000` shows it's running) but not accessible externally

**Solution:**
1. Check both Security Groups AND iptables rules
2. Add port 3000 to both firewall layers
3. Restart Chatwoot after firewall changes

### Checking iptables Rule Order
**Problem:** Rules added but still not working

**Check current rules:**
```bash
sudo iptables -L INPUT -n -v
```

**Solution:** ACCEPT rules must appear BEFORE REJECT rules. If they're after REJECT, they won't work:
```bash
# Remove incorrectly placed rule (replace X with line number)
sudo iptables -D INPUT X

# Add rule at correct position (before REJECT rule)
sudo iptables -I INPUT 4 -p tcp --dport 80 -j ACCEPT

# Save changes
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```



This setup provides a solid foundation for hosting Chatwoot on Oracle Cloud's free tier with proper email integration and social media channels.
