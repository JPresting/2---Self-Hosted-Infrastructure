**Summary of Steps**  
1. Register on Oracle Cloud and optimize your account  
2. Create an Always-Free VM with SSH keys  
3. SSH into your instance  
4. Reserve a static IP and configure an A-record  
5. **CRITICAL: Configure Ubuntu iptables firewall**
6. Install n8n (per the GCP guide)  
7. Open HTTP/HTTPS & enable Load Balancing  

---

# Oracle-Cloud-N8N-Setup

Setting up an Oracle Cloud VM can be tricky due to Always-Free tier restrictions. By default, free-tier capacity is limited, so provisioning may fail unless you optimize your region choice or account type.

This guide focuses mainly on the iptables that are relevant for N8N to work. For a detailed instruction on how to set up the VM in Oracle Cloud in general check this [guide](https://github.com/JPresting/2---Self-Hosted-Infrastructure/blob/main/oraclecloud-general/Readme.md).

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
     - Some regions (e.g. Chicago – US-Central) may throttle Always-Free VMs  
     - Choose a region with lighter demand (e.g. Frankfurt, Germany)  
   - **Optionally upgrade** to **Pay As You Go**  
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

---

## 4. Reserve a Static IP & Configure DNS

1. In Oracle Cloud, go to **Network → Virtual Cloud Networks → Public IPs**  
   - **Assign** a reserved (static) Public IPv4 to your instance  
   - For detailed instructions how to do it after you created your instance, check out this [guide]((https://github.com/JPresting/2---Self-Hosted-Infrastructure/blob/main/oraclecloud-general/README.md#3-reserve-a-static-ip--configure-dns))
   

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
> Even with Oracle Security Lists configured, the Ubuntu instance has its own iptables firewall that blocks ports 80/443 by default. Without this step, Certbot will fail and your n8n instance won't be accessible!

SSH into your instance and run these commands:

```bash
# Add rules to allow HTTP and HTTPS traffic
sudo iptables -I INPUT 4 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT

# Install iptables-persistent to save rules permanently
sudo apt-get install iptables-persistent -y

# Save the current iptables rules
sudo netfilter-persistent save
```

To verify the rules are added:
```bash
sudo iptables -L INPUT -n -v --line-numbers
```

You should see the rules for ports 80 and 443 in the list.

> **Note:** This is the KEY DIFFERENCE between Oracle Cloud and GCP. GCP doesn't have this local firewall issue, but Oracle Ubuntu instances do!

---

## 7. Install n8n

From here, the installation process is identical to the GCP guide:

🔗 **[Continue with the n8n on GCP guide from Step 3 »](https://github.com/JPresting/2---Self-Hosted-Infrastructure/tree/main/googlecloud-n8n-selfhost)**

The remaining steps include:
- Installing Docker
- Setting up n8n with Docker
- Installing and configuring Nginx
- Setting up SSL with Certbot
- Creating auto-update scripts and cronjobs

All commands and configurations from the GCP guide work exactly the same on Oracle Cloud once you've completed the iptables configuration above.

---

## Summary

The main differences between Oracle Cloud and GCP setup are:
1. **Oracle Security Lists** instead of GCP Firewall rules
2. **Ubuntu iptables firewall** must be configured (Step 6) - this is CRITICAL!
3. Different SSH username (`ubuntu` for Oracle vs your Google account name for GCP)

Once these Oracle-specific steps are complete, follow the GCP guide for all n8n installation and configuration steps.



**Need a more advanced deployment, integration, or enterprise automation?** Visit [Stardawnai.com](https://stardawnai.com) for professional consulting and development on AI-driven process automation, SAP integration, self-hosted enterprise N8N workflows, and custom hybrid infrastructure solutions tailored to your business needs.