# Oracle-Cloud-N8N-Setup

Setting up an Oracle Cloud VM can be tricky due to Always-Free tier restrictions. By default, free-tier capacity is limited, so provisioning may fail unless you optimize your region choice or account type.

---

## Prerequisites

- A valid Oracle Cloud account at cloud.oracle.com  
- A remembered **Account Name** (password managers often omit this)  
- An SSH key-pair (public & private)  

---

## 1. Register & Optimize Your Account

1. **Sign up** at cloud.oracle.com  
   - Provide Account Name, Email, Password  
   - **Remember** the Account Name for future logins  

2. **Boost provisioning success**  
   - **Select the right region**  
     - Some regions (default is Chicago – US-Central) may throttle Always-Free VMs  
   - **Upgrade** to **Pay As You Go**  
     - Retains eligibility for Always-Free resources  
     - Improves chances of successful VM creation  

> **Note:** Region selection is permanent for that tenancy.

---

## 2. Create Your Always-Free VM

1. From the Oracle Cloud **Dashboard**, click **Create Instance**.  
2. Under **Shape**, choose an Always-Free configuration:  
   - **RM1** processor  
   - **4 OCPUs** (cores)  
   - **24 GB RAM**  
3. Leave **Boot Volume** and **Network** settings at default.  
4. **Generate & Download** your SSH key-pair:  
   - Keep the **private key** secure (e.g. in Downloads)  
   - Note the location of your **public key**  

![VM Creation](https://github.com/user-attachments/assets/eee9688f-eb67-4f61-9650-db0a171cde94)

---

## 3. SSH Access

1. Locate your VM's **Public IPv4**:  
   - **Compute → Instances → Your Instance → Networking**  
   - Copy the Public IP  

   ![Networking Panel](https://github.com/user-attachments/assets/fce460e8-6b9a-4c83-9b4d-4c64e0d07a74)

2. From your local terminal, run:  
   ```bash
   ssh -i ~/Downloads/ssh-key-2025-04-29.key ubuntu@YOUR_PUBLIC_IP
   ```  
   - Replace the key path and IP as needed  

   ![SSH Login](https://github.com/user-attachments/assets/0956a199-d477-4e33-92fd-653a16a74866)

### SSH Connection Timeout Configuration (Optional)

To prevent SSH connections from timing out too quickly (default is usually 15-30 minutes), you can configure the server to send keep-alive signals to maintain active connections for longer periods.

#### Edit SSH Configuration
```bash
sudo nano /etc/ssh/sshd_config
```

Find and modify these lines (remove the # to uncomment them):
```
ClientAliveInterval 600
ClientAliveCountMax 12
```

#### What these settings mean:
- `ClientAliveInterval 600` = Server sends a keep-alive signal every 600 seconds (10 minutes)
- `ClientAliveCountMax 12` = After 12 failed keep-alive attempts, the connection is terminated
- **Total timeout**: 600 × 12 = 7200 seconds = **2 hours**

#### Apply changes:
After editing the file, restart the SSH service:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ssh
```

#### Security considerations:
- **Benefit**: Prevents disconnection during long periods of inactivity, useful for long-running tasks
- **Risk**: Keeps potentially compromised connections alive longer
- **Recommendation**: Use only on trusted networks or when extended sessions are needed

---

## 4. Reserve a Static IP & Configure DNS

1. In Oracle Cloud, go to **Network → Virtual Cloud Networks → Public IPs**  
   - **Assign** a reserved (static) Public IPv4 to your instance  
   - For detailed instructions, watch this video: https://www.youtube.com/watch?v=-IVG9hTwN_Q
   - If you already created an instance before, you can also later configure this by clicking on your Instance → Networking and then on your VNIC

2. In your domain registrar's **DNS settings**, add an **A-record**:  

| Host (subdomain)  | Type | Value (IPv4)         |
|-------------------|:----:|----------------------|
| `your-subdomain`  | A    | `<Your Static IPv4>` |

![DNS A-Record](https://github.com/user-attachments/assets/8876b8eb-e8eb-4c9b-8d46-778efb358d13)

---

## 5. Open HTTP/HTTPS in Oracle Cloud Security Lists

1. In the Oracle Cloud Console, navigate to **Networking → Virtual Cloud Networks**.  
2. Select the VCN associated with your project (only one if new account).  
3. Click **Security** in the left sidebar, then choose the **Default Security List** for that VCN.  
4. Switch to the **Security Rules** tab, then click **Add Ingress Rules**.  
5. Add these rules:  

| Source CIDR   | IP Protocol | Port Range | Description         |
|-------------: |------------:|-----------:|---------------------|
| `0.0.0.0/0`   | TCP         | `80`       | Allow HTTP traffic  |
| `0.0.0.0/0`   | TCP         | `443`      | Allow HTTPS traffic |

![Screenshot 2025-04-30 125503](https://github.com/user-attachments/assets/4354a2e2-79d3-42fa-aa31-d40d3a8f1e3e)
![image](https://github.com/user-attachments/assets/d1c3dd0e-02ae-4f1d-be58-511cd9b76824)

6. Click **Save**.
7. Note: You can add all sorts of ports here. If you install PostgreSQL or Redis, you just need to add the appropriate port, and it will work.

---

## 6. ⚠️ CRITICAL: Configure Ubuntu iptables Firewall ⚠️

> **THIS IS THE MOST IMPORTANT STEP FOR ORACLE CLOUD!**  
> Even with Oracle Security Lists configured, the Ubuntu instance has its own iptables firewall that blocks ports 80/443 by default. Without this step, Certbot will fail and your applications won't be accessible!

**First, check your current iptables rules:**
```bash
sudo iptables -L INPUT -n -v --line-numbers
```

You will most likely see that the REJECT rule appears BEFORE any ACCEPT rules for ports 80 and 443, which is the problem we need to fix.

**Why Oracle Cloud is Different:**
Oracle Cloud has **TWO firewall layers** that both need configuration:
1. **Cloud-Level:** Security Groups (Oracle Console)
2. **Server-Level:** iptables (Ubuntu instance)

Other cloud providers (AWS/GCP) typically only have one firewall layer. Oracle's default iptables REJECT rule blocks all traffic except SSH for security.

**Understanding the REJECT Rule:**
The default REJECT rule (`reject-with icmp-host-prohibited`) serves as Oracle's security-by-default mechanism:
- Blocks ALL traffic except what you explicitly allow
- Sends "Connection refused" immediately (better than DROP which just ignores)
- Forces you to consciously open ports - good security practice

**Critical Rule Order:**
In iptables, **first matching rule wins**! ACCEPT rules must come BEFORE the REJECT rule:

```
✅ Correct order:
1. ACCEPT SSH (22)
2. ACCEPT HTTP (80) ← Works!
3. ACCEPT HTTPS (443) ← Works!
4. REJECT ALL ← Only blocks unwanted ports

❌ Wrong order:
1. ACCEPT SSH (22)  
2. REJECT ALL ← Blocks everything here!
3. ACCEPT HTTP (80) ← Never reached
4. ACCEPT HTTPS (443) ← Never reached
```

SSH into your instance and run these commands:

```bash
# Add rules to allow HTTP and HTTPS traffic BEFORE the REJECT rule
sudo iptables -I INPUT 4 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT

# Install iptables-persistent to save rules permanently
sudo apt-get install iptables-persistent -y

# Save the current iptables rules
sudo netfilter-persistent save
```

To verify the rules are added in correct order:
```bash
sudo iptables -L INPUT -n -v --line-numbers
```

You should see the ACCEPT rules for ports 80 and 443 BEFORE the REJECT rule in the list.

**Troubleshooting Wrong Order:**
If your ACCEPT rules appear AFTER the REJECT rule, fix it:
```bash
# Remove incorrectly placed rules
sudo iptables -D INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -D INPUT -p tcp --dport 443 -j ACCEPT

# Insert them in correct positions (before REJECT)
sudo iptables -I INPUT 4 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT

# Save changes
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

> **Note:** This is the KEY DIFFERENCE between Oracle Cloud and GCP. GCP doesn't have this local firewall issue, but Oracle Ubuntu instances do!

---


## 7. OCI Boot Volume Resize Guide

This section shows how to expand a boot volume in Oracle Cloud Infrastructure (OCI) without requiring an instance reboot. The process involves resizing the volume in the OCI console and then extending the partition and filesystem from within the running instance.

#### Check Current Status (Before Resize)
```bash
sudo fdisk -l
df -h
lsblk
```

#### Resize Volume in OCI Console
- Navigate to Block Storage → Boot Volumes
- Edit your boot volume and increase size
- Save changes
<img width="943" height="329" alt="Screenshot 2025-08-06 161219" src="https://github.com/user-attachments/assets/6c32755d-6ebd-4bed-b033-72edf8d0af9f" />



#### Rescan System After Resize
```bash


echo 1 | sudo tee /sys/class/block/sda/device/rescan

# or alternatively (might not work):
sudo partprobe
```

#### Extend Partition and Filesystem
```bash
# Extend partition (replace sda/1 with your actual device)
sudo growpart /dev/sda 1

# Extend filesystem
sudo resize2fs /dev/sda1

# Verify results
df -h
lsblk
```

**Note:** This process can be done online without downtime. The system will show warnings about GPT table mismatches until the partition is extended - this is normal and will be automatically corrected.



## 8. Install n8n, Supabase, or Other Applications

From here, the installation process for various self-hosted applications follows the same pattern:

🔗 **[Continue with application-specific guides »](https://github.com/JPresting/2---Self-Hosted-Infrastructure)**

Available guides include:
- **n8n Workflow Automation** - Docker-based setup with auto-updates
- **Supabase Backend-as-a-Service** - PostgreSQL, authentication, real-time features
- **Open WebUI** - ChatGPT-like interface for local AI models
- **Chatwoot Customer Support** - Open-source customer service platform

The remaining steps for each application include:
- Installing Docker (if needed)
- Setting up the application with Docker
- Installing and configuring Nginx
- Setting up SSL with Certbot
- Creating auto-update scripts and cronjobs

All commands and configurations work exactly the same on Oracle Cloud once you've completed the iptables configuration above.

---

## Summary

The main differences between Oracle Cloud and GCP setup are:
1. **Oracle Security Lists** instead of GCP Firewall rules
2. **Ubuntu iptables firewall** must be configured (Step 6) - this is CRITICAL!
3. Different SSH username (`ubuntu` for Oracle vs your Google account name for GCP)
4. **Double firewall architecture** requires both cloud-level and server-level configuration

Once these Oracle-specific steps are complete, follow the GCP guide for all n8n installation and configuration steps.
