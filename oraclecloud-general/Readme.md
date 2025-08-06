# Oracle Cloud Infrastructure Setup Guide

Generally important for Oracle cloud setup and interactions...

## Get an Instance in the First Place

In order to get an instance in the first place it would be best to upgrade your account to a pay-as-you-go. My experience has been that as soon as you upgrade to pay as you go you can instantly get an instance in your claimed region. You just need to watch out to stay in the always free tier limits. If that's not an intent for you in the first place this does not matter but you need to go to Billing & Cost Management and Upgrade and Manage Payment and upgrade to pay as you go. Their systems are fairly reliable in checking for existing users so it's really just one account per person/credit card.

<img width="1840" height="586" alt="image" src="https://github.com/user-attachments/assets/2cf635ca-5347-47ab-80e7-e83dc38ebd20" />

## Create an Instance

Go to the burger menu icon on the top left and click on **Compute** → **Instances**

<img width="1910" height="658" alt="Screenshot 2025-08-03 104642" src="https://github.com/user-attachments/assets/c59ef79e-5fa3-403d-a1d3-28a133fe775e" />

Click on **Create Instance**

<img width="1661" height="527" alt="Screenshot 2025-08-03 104653" src="https://github.com/user-attachments/assets/f9f696ab-5694-40cd-9ce3-0e835bbaeaa8" />

### 1. Basic Information

Give it a name first of all. The Placement with about 3 different available domains does not matter under most circumstances.

With regard to our intent it would be best to change the image to an Ubuntu version (Canonical Ubuntu 24.04)

The Shape is very important.

<img width="928" height="333" alt="Screenshot 2025-08-03 152545" src="https://github.com/user-attachments/assets/136fae68-2494-4671-97e0-f601cc70c652" />

When it comes to making the most out of your free tier limits I suggest you select **Virtual Machine**, **Ampere A1 Flex** and adjust the OCPU cores to **4** (RAM automatically adjusts to 24 GB) which hands you a powerful server at 0 compute cost. But check the Always Free Tier documentation at: https://www.oracle.com/cloud/free/

<img width="899" height="856" alt="image" src="https://github.com/user-attachments/assets/f9890e23-38fa-4617-9b31-a9158bebe8d3" />

### 2. Security

You can leave it as is

### 3. Networking

Here we want to create a new virtual cloud network (for multiple instances you can then later use existing ones so you don't have to redo all the Ingress Rules). What's important is that we want to make sure of 2 things here. We want to create a static public IP address (e.g. once we restart the instance or Oracle Cloud has issues that the IP stays the same (important for 24/7 hosting of various platforms) as well as downloading the private and public ssh keys)

<img width="877" height="800" alt="Screenshot 2025-08-03 154342" src="https://github.com/user-attachments/assets/0d1524ec-e64f-43ce-affa-e74adc390ebc" />

Click on **Download Private and Public Key**

<img width="903" height="316" alt="image" src="https://github.com/user-attachments/assets/b367a953-040c-4241-9cb7-193d7a47272b" />

I would suggest you store them somewhere safe immediately (synchronize them with your cloud provider as well) they will get names with the current date when they are downloaded... in my case I just moved them to the Documents folder and stored the command: 

```bash
ssh -i ~/Documents/ssh-key-2025-05-30.key ubuntu@INSERTYOURPUBLICIPADDRESS
```

in a txt file so I can quickly connect to the server when opening the terminal.

## SSH Connection Timeout Configuration

To prevent SSH connections from timing out too quickly (default is usually 15-30 minutes), you can configure the server to send keep-alive signals to maintain active connections for longer periods.

### Edit SSH Configuration
```bash
sudo nano /etc/ssh/sshd_config
```

Find and modify these lines (remove the # to uncomment them):
```
ClientAliveInterval 600
ClientAliveCountMax 12
```

### What these settings mean:
- `ClientAliveInterval 600` = Server sends a keep-alive signal every 600 seconds (10 minutes)
- `ClientAliveCountMax 12` = After 12 failed keep-alive attempts, the connection is terminated
- **Total timeout**: 600 × 12 = 7200 seconds = **2 hours**

### Apply changes:
After editing the file, restart the SSH service:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ssh
```

### Security considerations:
- **Benefit**: Prevents disconnection during long periods of inactivity, useful for long-running tasks
- **Risk**: Keeps potentially compromised connections alive longer
- **Recommendation**: Use only on trusted networks or when extended sessions are needed

### 4. Boot Volume

Here you can click on **"Specify a custom boot volume size and performance setting"** and enter **200GB Boot Volume size** which is still included in the Always Free Tier. Or you can leave it as default (50) and change it later.

### That's it!

Click on **Create Instance** (you can check the estimated costs - I don't think they include the calculation of the Always Free tier Compute as the system doesn't check if you already have instances running just based on the selection)

<img width="1639" height="476" alt="image" src="https://github.com/user-attachments/assets/4454d356-12fb-48ea-aa53-f232a9c17ab9" />

Once the State says **succeeded** you can follow with the next steps

---

## Very Important Navigation Points That You Will Definitely Need

### Get Static IP Address

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

### Add Ingress Rules

Very important is adding Ingress Rules to your server... Why? It tells the server to allow listening on certain ports...

What you need to do to add them:
Go to **Compute** → **Instances** → your instance

Go to **Networking** and click on the **Subnet** link

<img width="989" height="410" alt="Screenshot 2025-08-03 163320" src="https://github.com/user-attachments/assets/1d53328e-79ca-4557-9067-2318498d8409" />

Then click on **Security** and click on your **default security List**

<img width="802" height="288" alt="Screenshot 2025-08-03 163508" src="https://github.com/user-attachments/assets/df054568-dac4-4bdd-ba69-c5421638a086" />

Further advance to **Security rules** and there you can add ingress rules

Useful ones are for example:

<img width="1404" height="461" alt="image" src="https://github.com/user-attachments/assets/1415c683-373f-4794-8afb-b5006ef4a4da" />

## Important to Note

**Two firewalls must allow traffic:**

### 1. Oracle Cloud Security Lists (cloud-level)
- Configure in OCI Console to allow or block on cloud level (as they can be reused)
- Add Ingress Rule: Source `0.0.0.0/0`, Port `80`

### 2. VM iptables (OS-level)
```bash
# Allow port 80
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT

# Save rules permanently
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

**Both must be open or traffic fails!**
