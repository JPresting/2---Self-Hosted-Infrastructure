
# Oracle Cloud Infrastructure Setup Guide

Generally important for Oracle cloud setup and interactions...

## 1. Get an Instance in the First Place

In order to get an instance in the first place it would be best to upgrade your account to a pay-as-you-go. My experience has been that as soon as you upgrade to pay as you go you can instantly get an instance in your claimed region. You just need to watch out to stay in the always free tier limits. If that's not an intent for you in the first place this does not matter but you need to go to Billing & Cost Management and Upgrade and Manage Payment and upgrade to pay as you go. Their systems are fairly reliable in checking for existing users so it's really just one account per person/credit card.

<img width="1840" height="586" alt="image" src="https://github.com/user-attachments/assets/2cf635ca-5347-47ab-80e7-e83dc38ebd20" />

## 2. Create an Instance

Go to the burger menu icon on the top left and click on **Compute** → **Instances**

<img width="1910" height="658" alt="Screenshot 2025-08-03 104642" src="https://github.com/user-attachments/assets/c59ef79e-5fa3-403d-a1d3-28a133fe775e" />

Click on **Create Instance**

<img width="1661" height="527" alt="Screenshot 2025-08-03 104653" src="https://github.com/user-attachments/assets/f9f696ab-5694-40cd-9ce3-0e835bbaeaa8" />

### Basic Information

Give it a name first of all. The Placement with about 3 different available domains does not matter under most circumstances.

With regard to our intent it would be best to change the image to an Ubuntu version (Canonical Ubuntu 24.04)

The Shape is very important.

<img width="928" height="333" alt="Screenshot 2025-08-03 152545" src="https://github.com/user-attachments/assets/136fae68-2494-4671-97e0-f601cc70c652" />

When it comes to making the most out of your free tier limits I suggest you select **Virtual Machine**, **Ampere A1 Flex** and adjust the OCPU cores to **4** (RAM automatically adjusts to 24 GB) which hands you a powerful server at 0 compute cost. But check the Always Free Tier documentation at: https://www.oracle.com/cloud/free/

<img width="899" height="856" alt="image" src="https://github.com/user-attachments/assets/f9890e23-38fa-4617-9b31-a9158bebe8d3" />

### Security

You can leave it as is

### Networking

Here we want to create a new virtual cloud network (for multiple instances you can then later use existing ones so you don't have to redo all the Ingress Rules). What's important is that we want to make sure of 2 things here. We want to create a static public IP address (e.g. once we restart the instance or Oracle Cloud has issues that the IP stays the same (important for 24/7 hosting of various platforms) as well as downloading the private and public ssh keys)

<img width="877" height="800" alt="Screenshot 2025-08-03 154342" src="https://github.com/user-attachments/assets/0d1524ec-e64f-43ce-affa-e74adc390ebc" />

Click on **Download Private and Public Key**

<img width="903" height="316" alt="image" src="https://github.com/user-attachments/assets/b367a953-040c-4241-9cb7-193d7a47272b" />

I would suggest you store them somewhere safe immediately (synchronize them with your cloud provider as well) they will get names with the current date when they are downloaded... in my case I just moved them to the Documents folder and stored the command:

```bash
ssh -i ~/Documents/ssh-key-2025-05-30.key ubuntu@INSERTYOURPUBLICIPADDRESS
```

in a txt file so I can quickly connect to the server when opening the terminal.

### Boot Volume

Here you can click on **"Specify a custom boot volume size and performance setting"** and enter **200GB Boot Volume size** which is still included in the Always Free Tier. Or you can leave it as default (50) and change it later.

### That's it!

Click on **Create Instance** (you can check the estimated costs - I don't think they include the calculation of the Always Free tier Compute as the system doesn't check if you already have instances running just based on the selection)

<img width="1639" height="476" alt="image" src="https://github.com/user-attachments/assets/4454d356-12fb-48ea-aa53-f232a9c17ab9" />

Once the State says **succeeded** you can follow with the next steps

---

## 3. Reserve a Static IP & Configure DNS

### Reserve a Static IP Address in Oracle Cloud

Click on **Networking** and **Reserved Public IPs**...

<img width="1520" height="480" alt="Screenshot 2025-08-03 160811" src="https://github.com/user-attachments/assets/086a3ad6-1f31-4606-82e6-0120c41660a1" />

Click on **Reserve Public IP address** and give it a name.

<img width="718" height="132" alt="image" src="https://github.com/user-attachments/assets/c605ff99-faf3-46d0-b49d-1f4668bd5f29" />

Now go back to **Compute** → **Instances** → select your instance. Go to **Networking** and select your attached VNIC

<img width="1715" height="732" alt="Screenshot 2025-08-03 161504" src="https://github.com/user-attachments/assets/8e5373f5-dcd1-4008-8a2f-68c70337f177" />

Go to **IP administration** and click on **Edit** (don't click on Reserve IPv4 address - that is referring to the private IP)

<img width="1673" height="525" alt="Screenshot 2025-08-03 162341" src="https://github.com/user-attachments/assets/bbfcc40a-15cb-4cac-9122-88cb15afc7c7" />

Here you want to click on **No public IP** and click on **update** (so the current one gets unassigned - this step is a bit annoying)

Then click on **Edit** again. Now there should be a field named **Reserved Public IP** → select the one you created before and click on **Update**.

<img width="679" height="287" alt="Screenshot 2025-08-03 162721" src="https://github.com/user-attachments/assets/cfe37833-29c8-4008-8c26-7a1aa14f4943" />

Now it should say **reserved**. The IP is now not only attached to the instance for life but also does NOT get deleted should you create a new instance and want to move your DNS settings that are pointing to that IP to the new server.

<img width="387" height="75" alt="Screenshot 2025-08-03 162900" src="https://github.com/user-attachments/assets/e0b7907a-fff9-4242-9355-02eeb1b7d824" />

### Configure DNS

In your domain registrar's **DNS settings**, add an **A-record**:

| Host (subdomain)  | Type | Value (IPv4)         |
|-------------------|:----:|----------------------|
| `your-subdomain`  | A    | `<Your Static IPv4>` |

![DNS A-Record](https://github.com/user-attachments/assets/8876b8eb-e8eb-4c9b-8d46-778efb358d13)

---

## 4. Open PORTS (HTTP/HTTPS, etc.) in Oracle Cloud Security Lists

Very important is adding Ingress Rules to your server... Why? It tells the server to allow listening on certain ports...

What you need to do to add them:
Go to **Compute** → **Instances** → your instance

Go to **Networking** and click on the **Subnet** link

<img width="989" height="410" alt="Screenshot 2025-08-03 163320" src="https://github.com/user-attachments/assets/1d53328e-79ca-4557-9067-2318498d8409" />

Then click on **Security** and click on your **default security List**

<img width="802" height="288" alt="Screenshot 2025-08-03 163508" src="https://github.com/user-attachments/assets/df054568-dac4-4bdd-ba69-c5421638a086" />

Further advance to **Security rules** and there you can add ingress rules. Add these rules:

| Source CIDR   | IP Protocol | Port Range | Description         |
|-------------: |------------:|-----------:|---------------------|
| `0.0.0.0/0`   | TCP         | `80`       | Allow HTTP traffic  |
| `0.0.0.0/0`   | TCP         | `443`      | Allow HTTPS traffic |
| `0.0.0.0/0`   | TCP         | `22`       | Allow SSH traffic (should exist) |

<img width="1404" height="461" alt="image" src="https://github.com/user-attachments/assets/1415c683-373f-4794-8afb-b5006ef4a4da" />

**Note:** You can add all sorts of ports here. If you install PostgreSQL or Redis, you just need to add the appropriate port, and it will work.


Alternatively, to manage rules independently of a specific instance (useful for shared Virtual Cloud Networks across multiple instances):

1. Go to **Networking** → **Virtual Cloud Networks**.
2. Select your **Virtual Cloud Network**.
3. Navigate to **Security** → **Security Lists**.
4. Choose the **Security List** for your VCN.
5. Click on **Security Rules**.
6. Add your **Ingress/Egress Rules** as needed.



---

## 5. ⚠️ CRITICAL: Configure Ubuntu iptables Firewall ⚠️

> **THIS IS THE MOST IMPORTANT STEP FOR ORACLE CLOUD!**  
> Even with Oracle Security Lists configured, the Ubuntu instance has its own iptables firewall that blocks ports 80/443 by default. Without this step, Certbot will fail and your applications won't be accessible!

**First, check your current iptables rules:**
```bash
sudo iptables -L INPUT -n -v --line-numbers
```

You will most likely see that the REJECT rule appears BEFORE any ACCEPT rules for ports 80 and 443, which is the problem we need to fix.

**Why Oracle Cloud is Different:**
Oracle Cloud has **TWO firewall layers** that both need configuration:
1. **Cloud-Level:** Security Groups (Oracle Console - what we did in Step 4)
2. **Server-Level:** iptables (Ubuntu instance - what we do now)

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
sudo apt-get update
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
## 6. ⚠️ CRITICAL: Setup a Budget and Spending Alarm

First go to Budgets and create a new Budget

![image](https://github.com/user-attachments/assets/fb896c74-9c33-497a-9b34-7df23554dd27)

When creating a budget you should also add an alarm:

![image](https://github.com/user-attachments/assets/4c9ffce8-842c-408d-9a2f-e9dec9a3a509)

You can later edit the budget and add as many rules as you want so you effectively only need one Budget. I would recommend using the minimum of 1€ if you are planning to use the Always Free Tier (which is generous enough) so you get notified immediately as soon as spending occurs. This can happen due to unused Block volumes or if you misselected a Compute Unit that is not part of the Always-Free.

---

## 7. ⚠️ CRITICAL FOR LATER: Look for Unattached Volume Storage or Compute

This is very important (make sure you enter the link path exactly as I marked it in the image) as this shows you all the hidden costs - you can easily stop or terminate instances and will not pay for compute but other units like the block storage will continue to cost you money if you aren't careful.

![image](https://github.com/user-attachments/assets/a19cfb48-4b30-48d9-9a61-c4c0ba720712)

It shows you unattached and unused units. Click on the block volume recommended for deletion and follow the process.

![image](https://github.com/user-attachments/assets/22872211-6839-40ee-9df1-29b9b2b961d7)

Click on **Implement selected** and then on **Delete**:

![image](https://github.com/user-attachments/assets/0ca0ca34-67b3-4816-80e8-3e298bacc492)/>


---

## 8. Optional: OCI Boot Volume Resize Guide

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

---

## 7. Next Steps: Install Applications

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
2. **Ubuntu iptables firewall** must be configured (Step 5) - this is CRITICAL!
3. Different SSH username (`ubuntu` for Oracle vs your Google account name for GCP)
4. **Double firewall architecture** requires both cloud-level and server-level configuration

Once these Oracle-specific steps are complete, you can follow standard guides for application installation.



**Need a more advanced deployment, integration, or enterprise automation?** Visit [Stardawnai.com](https://stardawnai.com) for professional consulting and development on AI-driven process automation, SAP integration, self-hosted enterprise N8N workflows, and custom hybrid infrastructure solutions tailored to your business needs.
