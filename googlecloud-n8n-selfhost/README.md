# 💎Self-Hosting N8N on the Google Cloud with Auto-Updates💎
Guide on how to fully self-host n8n in a GCP project with up to no monthly costs (depending on the workflows you might pay networking costs, see: [GCP Network Pricing](https://cloud.google.com/vpc/network-pricing)) as well as auto-update the Docker image whenever the open-source GitHub repo of n8n has another release. The only two things you need to replicate this process 100% are a **credit/debit card** and a **domain**.

**⚠️ CRITICAL ALERT (Version 2.x+):**
Starting with n8n version 2.0, **Free Tier resources (e2-micro) are NO LONGER SUFFICIENT** in most cases. This is due to the new default "Task Runner" sub-processes, which significantly increase RAM usage, leading to timeouts and crashes on 1GB instances. To use the Free Tier with v2.x+, you **must** likely disable these sub-processes by setting the environment variable `N8N_RUNNERS_ENABLED=false`.

# 📍Step 1: Setting up the GCP

1. Go to cloud.google.com and click on Console
2. Click on Try for free
![Screenshotgcptrial](https://github.com/user-attachments/assets/a35cdfad-fd96-440e-ac0d-2b650d094da2)
4. You need to add a billig method to verify your identity.
5. After you added your payment method and verified your identity you should click on Activate full account: 
![youreinfreetrial](https://github.com/user-attachments/assets/cbc28977-2088-4b31-a3f4-74264ba54d02)
--> This allows you to use the account after the 90-day trial period expires.
--> Bear in mind that after the trial period ends or if the credits are used up, you will be charged on the provided payment method. However, you can limit this risk by setting up budget alerts. Check [Google Cloud Budgets](https://cloud.google.com/billing/docs/how-to/budgets).

6. **Adding a New Project:** If you are starting with a new Google Cloud account, it may take some time before you can create a new project. Alternatively, you can click on the settings of your existing **"My First Project"** and rename it for better association with your project.
![image](https://github.com/user-attachments/assets/5ee0947d-3879-4d6b-8489-ebcf41aa2c18)
7. Whichever way you are using it, when selecting your project in the top left, it should say, "You've activated your full account."

# 📍Step 2: Setting up the Cloud VM Instance

Now we set up the instance where N8N will run.

1. Make sure your project is selected
2. Click on VM Instances
![image](https://github.com/user-attachments/assets/c236c3d9-d07a-403e-b8dd-002b7979bdcd)
3. It might ask you to enable the Compute Engine API first (if you have just set up the account). Click **"Enable"** to proceed.
![image](https://github.com/user-attachments/assets/c5da1c83-f2cb-4c34-91c5-7e4cf8dbca0b)
4. Click on Create Instance
5. In the configuration, you are generally free to set it up as you like. However, to host this instance for free, you need to check Google's requirements for the free-tier cloud setup: [Google Cloud Free Tier](https://cloud.google.com/free/docs/free-cloud-features#compute).  

As of now, the free-tier configuration is limited to:  
- **1 non-preemptible e2-micro VM instance** per month in one of the following US regions:  
  - **Oregon:** `us-west1`  
  - **Iowa:** `us-central1`  
  - **South Carolina:** `us-east1`  
- **30 GB-months** of standard persistent disk  
- **1 GB of outbound data transfer** from North America to all region destinations (excluding China and Australia) per month

6. So, click on **E2** and select the **Preset**. ![image](https://github.com/user-attachments/assets/d550b1e6-01e7-4025-9a6f-2a8cf2f5aa00)
Select e2-micro
7. Click on **OS and Storage**, then select **Change**.
![image](https://github.com/user-attachments/assets/60433d75-23bf-42c1-97cd-61ed870cf1d4)
8. Change Size (GB) to 30 and the Boot disk type to Standard Persistent Disk as per the guidelines.
9. It will show you a monthly estimate, as running multiple instances 24/7 would incur these costs for what you selected. However, since you have only one project, you will stay within the free-tier limits, and the only potential costs will be for bandwidth, depending on your workflows.
10. Give the instance a name (it doesn't really matter—just make sure it's written without spaces) and click **Create**. Wait a minite until the Status says that it has compelted the setup. If it takes longer, refresh the page.
![image](https://github.com/user-attachments/assets/06328659-e37a-4350-8790-5113790a1a4a)
11. Before setting up everything in the shell make sure to make the external IP static so that when an error occurs and you need to restart the instance it will still be pointing on your subdomain. 
- click on VPC Network, IP addresses.
![image](https://github.com/user-attachments/assets/f2fcb8bb-7ce2-473e-adb9-6fd66b48fd37)
- It will show **two IP addresses**: one **internal** and one **external**. For the **external** IP, click on the **three dots** and select **"Promote to static IP address."**. Name again doesn't matter.
![Screenshot 2025-02-15 114830](https://github.com/user-attachments/assets/e7177a19-c62a-42d8-98fd-8830492b6a00)

Lastly Select "Allow" on these 3 traffic sources. You can edit that later in the VM instance as well but we need it in order to reach our domain via our subdomain.
![image](https://github.com/user-attachments/assets/d6bf6370-64c9-4417-9dcd-ab78b8188059)

# 📍Step 2.1: Connecting via Local SSH (Recommended Alternative)

Instead of using the unreliable browser SSH, use your local terminal for a stable connection:

## Install Google Cloud SDK

**Windows:**
```bash
winget install Google.CloudSDK
```

**Mac:**
```bash
brew install google-cloud-sdk
```

**Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

## Setup Authentication & Connect

```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID
gcloud config set project YOUR-PROJECT-ID

# Connect with keep-alive to prevent 10-minute timeout
gcloud compute ssh YOUR-VM-NAME --zone=YOUR-ZONE 

# Example:
# gcloud compute ssh n8ninstancecurrent --zone=us-central1-a --ssh-flag="-o ServerAliveInterval=30"
```
<img width="212" alt="Screenshot 2025-07-01 125522" src="https://github.com/user-attachments/assets/fcec861f-f7ad-4238-977f-95c3a420b953" />



This method prevents the random disconnects that occur with browser SSH and provides a much more stable connection.

# 📍Step 3: Setting up N8N

Now, go back to the **VM instance** we created and click on **"Connect SSH."** or use the local SSH method above.
![image](https://github.com/user-attachments/assets/038ee935-c057-4067-b5f0-e155eaf1855d)

**Note:** If using browser SSH, the connection may drop frequently. The local SSH method above is much more reliable.

Now enter the following commands after one another:

1. **Update the Package Index:**
   ```bash
   sudo apt update

2. **Install Docker:**
    ```bash
    sudo apt install docker.io
Click on Y

3.  **Start Docker:**
    ```bash
    sudo systemctl start docker

4. **Enable Docker to Start at Boot:**
    ```bash
    sudo systemctl enable docker

## 📍Step 3.1: Setting up a Subdomain to point to your Google Cloud Instance

Now we want to add a subdomain of your domain which makes it easy to access your N8N instance from everywhere (dont worry you will need an account). 
With your domain provider go to Edit DNS settings (every domain provider has this) then you want to add a New Record. 

copy the external IP address which we made static before:
![Screenshot 2025-02-15 120154](https://github.com/user-attachments/assets/ea068f0c-8076-40ca-b86d-4f74b82a12fb)

For the **new record**, select **Type A** and name it whatever you like, but keep it **short and precise**. **Points to:** Paste the **external IP address**. **TTL:** Default is **14400**; you can leave it as is.
![image](https://github.com/user-attachments/assets/615b06e7-ab76-4dbc-8927-8dc355f4ba73)

## 📍Step 3.2: Starting n8n in Docker
Run the following command to start n8n in Docker. Replace **your-domain.com** with your actual domain name. **Make sure you don't copy and paste it with the "bash" part and the three backticks (` ``` `), or it won't work.**

We are using a subdomain, it should look like this: 
(The subdomain is what we defined as the name—in my example, **myn8n**.)


**Important:** When setting up via Oracle Cloud, there is no Google account or path to that folder. First run:

```bash
sudo mkdir -p /home/ubuntu/.n8n
sudo chown -R 1000:1000 /home/ubuntu/.n8n
sudo chmod -R 777 /home/ubuntu/.n8n
```

Then change the last line to:

```bash
-v /home/ubuntu/.n8n:/home/node/.n8n \
n8nio/n8n
```





    ```bash
    sudo docker run -d --restart unless-stopped -it \
      --name n8n \
      -p 5678:5678 \
      -e N8N_HOST="your-subdomain.your-domain.com" \
      -e WEBHOOK_URL="https://your-subdomain.your-domain.com/" \
      -e GENERIC_TIMEZONE=Europe/Berlin
      -e N8N_DEFAULT_BINARY_DATA_MODE="default" \
      -e NODE_FUNCTION_ALLOW_BUILTIN="*" \
      -e NODE_FUNCTION_ALLOW_EXTERNAL= "*"\
      -e N8N_PUSH_BACKEND=websocket \
      -v /home/your-google-account/.n8n:/home/node/.n8n \
      n8nio/n8n
    ```


-e N8N_DEFAULT_BINARY_DATA_MODE="default" Choosing memory (default) or filesystem depends on your instance. 


It now downloads the latest **n8n** image. Since this is the first installation, it obviously can't find **n8n:latest** in your directory, so that's not a problem.
![image](https://github.com/user-attachments/assets/dd85386c-8807-43af-b25a-77ab298a659e)

## 📍Step 3.3: Installing Nginx

We need **Nginx** as a **reverse proxy** to route traffic to n8n, handle **SSL encryption**, and allow access via a custom domain. Without it, n8n would only be reachable through its internal port (5678), which is not ideal for public access. An alternative is using a **Google Cloud Load Balancer**, but it's more complex and can incur additional costs. Nginx is lightweight, free, and gives full control over traffic and security. It simplifies setup while ensuring a secure and accessible deployment.

1. **Install Nginx:**
    ```bash
    sudo apt install nginx

  Click Y

2. **Configuring Nginx**
    
Configure Nginx as a reverse proxy for the n8n web interface. This can be a bit tricky, so proceed carefully.

```bash
sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
```
Now edit the config file. 
```bash
sudo nano /etc/nginx/sites-available/n8n.conf
```
Paste the following content (replace with your actual domain and subdomain):  

```nginx
server {
    server_name your-subdomain.your-domain.com;
    
    client_max_body_size 500M; # Allows uploads up to 500MB (default 1MB) - fixes 413 errors for video uploads

    location / {
        client_max_body_size 500M; # Same limit for this location block
        chunked_transfer_encoding off; # Disables HTTP chunking - required for WebSocket connections to work properly
        proxy_buffering off; # Streams responses immediately instead of collecting full response - better for real-time data
        proxy_cache off; # No caching - every request hits n8n backend for fresh data
        proxy_read_timeout 3600; # Single HTTP request can take 1 hour before nginx gives up - for slow API calls
        
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    listen 80;
}

```
Save with **Ctrl + O**, **Enter**, then exit with **Ctrl + X**.  
Certbot later then automatically adds the required lines!

```bash
sudo ln -s /etc/nginx/sites-available/n8n.conf /etc/nginx/sites-enabled/
```

```bash
sudo nginx -t
sudo systemctl restart nginx
```

**Note:** Only relevant if Nginx is already installed. If `sudo nginx -t` fails (does not say syntax is ok - test is successful) due to Certbot SSL setup lines, comment them out temporarily, retest, restart Nginx, and then proceed with Certbot.

```nginx
server {
    server_name your-subdomain.your-domain.com; # Replace with your subdomain and domain

    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 86400;
    }

    # These sections are managed by Certbot and need to be commented out for the initial Nginx test
    #listen 443 ssl; # managed by Certbot
    #ssl_certificate /etc/letsencrypt/live/your-subdomain.your-domain.com/fullchain.pem; # managed by Certbot
    #ssl_certificate_key /etc/letsencrypt/live/your-subdomain.your-domain.com/privkey.pem; # managed by Certbot
    #include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    #ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    # This redirect is managed by Certbot and needs to be commented out for the initial Nginx test
    #if ($host = your-subdomain.your-domain.com) { # Replace with your subdomain and domain
    #    return 301 https://$host$request_uri;
    #} # managed by Certbot

    listen 80;
    server_name your-subdomain.your-domain.com; # Replace with your subdomain and domain
    #return 404; # managed by Certbot - Also comment this out
}
```


## 📍Step 3.4: Setting up SSL with Certbot

Certbot will obtain and install an SSL certificate from Let's Encrypt.

1. **Install Certbot and the Nginx Plugin:**
    ```bash
    sudo apt install certbot python3-certbot-nginx
Click Y

2. **Obtain an SSL Certificate:**

Here, we need to configure the firewall settings to allow HTTP and HTTPS traffic. If you haven't done this before, you can easily add firewall rules globally for the project or edit the VM instance settings.
    
Adjust the subdomain and domain.
```bash
sudo certbot --nginx -d myn8n.your-domain.com
```
Enter an Email and select Y
Second one you can enter Y or N doesn't matter. It should work. If an error occurs it's propably due to the Firewall settings not being set up correctly. 
<img width="1867" height="199" alt="Screenshot 2025-08-06 102610" src="https://github.com/user-attachments/assets/660ca19e-875f-441c-87da-99a2460d55bc" />

![image](https://github.com/user-attachments/assets/bfb16d7e-be0d-455f-b18b-25c6bbf08df2)

When entering your domain (with the subdomain) in the browser, it should look like this:
![image](https://github.com/user-attachments/assets/84372133-c1d3-4df6-a5db-94871cb97943)

Bear in mind that this has nothing to do with any n8n accounts you might already have. You are setting it up from scratch, and it will only work on this VM instance.

#### **Troubleshooting: SSL/HTTPS Not Working After nginx Fix**

If your n8n shows up correctly on HTTP but HTTPS doesn't work:

```bash
# Check if server_name in your config matches your actual domain
cat /etc/nginx/sites-available/n8n.conf

# If it shows "your-subdomain.your-domain.com", edit it:
sudo nano /etc/nginx/sites-available/n8n.conf
# Change to your actual domain (e.g., testn8n.markenbuilder.com)

# Reload nginx and reinstall SSL certificate
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d your-actual-domain.com
# Select option 1 when prompted
```
<img width="1177" height="261" alt="Screenshot 2025-08-06 113412" src="https://github.com/user-attachments/assets/226742cd-768c-47b1-a2a7-96ebff9fa538" />





# 📍Step 4: Setting up Auto Updates for N8N

Since the official n8n repository regularly adds new features, it's important to stay updated without manually downloading, uploading workflows, or reconfiguring credentials. To automate this, we create a **cronjob** that checks for new **stable releases** (not pre-releases) in the n8n GitHub repository every **Sunday night**. If an update is available, it automatically updates the Docker image. Before updating, it saves your configurations in a new folder named **update_n8n**.

Bear in mind that the first part of your SSH prompt is your Google Account name, and the second part is the name of your VM instance.  
For example, if your VM instance is called **myvmn8n** and your Google Account is **johndoe@gmail.com**, your SSH prompt will show:  
```bash
johndoe@myvmn8n
```
![image](https://github.com/user-attachments/assets/9d6aeada-7047-4b45-8b0c-1b86548e795a)

After the updates execute it might show you errors: "Cannot GET /home   "   dont worry just dont let you browser auto-complete the URL. Enter subdomain.yourdomain.com  then it will redirect you to the correct path.

### **Auto-Update Script for n8n**  

#### **1. Create or Edit the Update Script**  
```bash
nano /home/mygoogleaccount/update_n8n.sh
```
**Add the following content:**  
```bash
#!/bin/bash
# Backup current n8n directory
BACKUP_DATE=$(date +'%Y-%m-%d_%H-%M-%S')
cp -r /home/mygoogleaccount/.n8n /home/mygoogleaccount/.n8n-backup-$BACKUP_DATE

# Stop and remove old container
sudo docker stop n8n
sudo docker rm n8n

# Pull latest n8n version
sudo docker pull n8nio/n8n:latest

# Start new container with correct volume
sudo docker run -d --restart unless-stopped -it \
  --name n8n \
  -p 5678:5678 \
  -e N8N_HOST="myn8n.your-domain.com" \
  -e WEBHOOK_TUNNEL_URL="https://myn8n.your-domain.com/" \
  -e WEBHOOK_URL="https://myn8n.your-domain.com/" \
  -e NODE_FUNCTION_ALLOW_BUILTIN="crypto" \ # adding Javascript Package Crypto just to show how the packages would be added
  -e N8N_BINARY_DATA_MODE="memory" \ # for instances that need a lot of loops handling large data e.g. Sales
  -e NODE_FUNCTION_ALLOW_EXTERNAL="" \ # needed for external 
  -e N8N_PUSH_BACKEND=websocket \
  -v /home/mygoogleaccount/.n8n:/home/node/.n8n \
  n8nio/n8n

# Clean up old unused Docker images - don't use image prune -af 
sudo docker image prune -f
```
Save with **Ctrl + O, Enter**, then exit with **Ctrl + X**.

#### **2️⃣ Make the Script Executable**  
```bash
chmod +x /home/mygoogleaccount/update_n8n.sh
```

#### **3. Set Up a Weekly Cronjob (Sunday at 3 AM)**  
Open the crontab:  
```bash
sudo crontab -e
```
(to be 100% sure open both the "sudo crontab -e" and the "crontab -e" and enter the same commands twice)
Select nano
![image](https://github.com/user-attachments/assets/bd9c300d-eacb-4b79-a1ee-471c85e301cd)

Add this line (you can remove the comments before):  
```bash
0 3 * * 0 /bin/bash /home/mygoogleaccount/update_n8n.sh >> /var/log/update_n8n.log 2>&1
30 3 * * 0 sudo find /home/mygoogleaccount/.n8n-backup* -maxdepth 0 -type d | sort | head -n -2 | sudo xargs rm -rf
@reboot sudo chown -R 1000:1000 ~/.n8n && sudo chmod -R 777 ~/.n8n
```
Save and exit.

0 3 * * 0 means:  
- **0** → Minute (Runs at minute **0**, i.e., the start of the hour)  
- **3** → Hour (Runs at **3 AM**)  
- **`*`** → Day of the month (Runs **every day within a month**)  
- **`*`** → Month (Runs **every month**)  
- **`0`** → Day of the week (**0 = Sunday**, 1 = Monday, ..., 6 = Saturday)  

This schedule runs the script **every Sunday at 3:00 AM**.

Regarding the Update file deletion (-maxdepth 0 -type d | sort | head -n -2 | xargs rm -rf):

* `find /home/mygoogleaccount/.n8n-backup* -maxdepth 0 -type d`
   * `find` is the command to search for files
   * `/home/mygoogleaccount/.n8n-backup*` is the search pattern - it finds all directories that start with ".n8n-backup"
   * `-maxdepth 0` means that only the directly specified directories are searched, not in subdirectories
   * `-type d` finds only directories, not regular files
* `| sort`
   * The pipe (`|`) forwards the output of find to sort
   * `sort` arranges the list alphabetically, which for your backup names with dates is also chronological
   * e.g., ".n8n-backup-2025-02-15..." comes before ".n8n-backup-2025-03-09..."
* `| head -n -2`
   * The pipe forwards the sorted list to head
   * `head -n -2` takes all entries EXCEPT the last two
   * These last two are the newest backups (because of the previous sorting)
* `| xargs rm -rf`
   * The pipe forwards the directory names to be deleted to xargs
   * `xargs rm -rf` executes the command `rm -rf` for each directory name
   * `rm -rf` deletes directories and all their contents recursively

#### **4. Test & Verify**  
- **Run the script manually:**  
  ```bash
  /home/mygoogleaccount/update_n8n.sh
  ```
  Since we just installed N8N it should not find a newer version so it should look like this:
  ![image](https://github.com/user-attachments/assets/5ff92c8d-11d2-4bc5-aebd-72c79e9d1c49)
  
- **Check backup directory:**  
  ```bash
  ls /home/mygoogleaccount/ | grep .n8n-backup
  ```
- **Verify Docker volume binding:**  
  ```bash
  docker inspect n8n | grep Mounts -A 10
  ```
  Expected output:  
  ```json
  "Source": "/home/mygoogleaccount/.n8n",
  "Destination": "/home/node/.n8n",
  ```

### **Summary**
 A **backup** of `.n8n` is created before each update.  
 The **container restarts** with the old data preserved.  
 The **cronjob automates updates** every Sunday at 3 AM. 

Now, please make sure that when setting up your private n8n account, you watch out for the correct path the next time you use it. It should be **`.../home`** so that it doesn't ask you to sign up again, as there is no login page from the signup screen. It may seem trivial, but if you don't notice it, you might think your data is lost.

If the Cronjob does not work and it does not auto update enter:
```bash
sudo touch /var/log/update_n8n.log
sudo chmod 666 /var/log/update_n8n.log
```
this hands the log file the permissions it may need.

and change the Cronjob to: 
```bash
0 3 * * 0 /bin/bash /home/stand_4_business/update_n8n.sh >> /var/log/update_n8n.log 2>&1
```
the "/bin/bash" tells him that he should execute it like that. Normally just entering the path to the file should work. 

At worst case you can simply open the shell and enter it manually so it updates whenever you need it:
 ```bash
sudo bash /home/mygoogleaccount/update_n8n.sh
```

Hope this helps you set up and automate your n8n instance! 🚀 For more on how to effectively set up workflows that truly help you or your business be more efficient, check out our YouTube channel: [StardawnAI](https://www.youtube.com/@StardawnAI). Thank you! 😊

---

## 📍Appendix #1: Additional Note

### **Fixing n8n 502 Bad Gateway after GCP VM Restart (if you changed your CPU/configs)**  

#### **1️⃣ Fix Permissions**  
After restarting the VM, n8n couldn't access its config due to permission issues which leads to a 502 BAD GATEWAY. Fix it with:  
```bash
sudo chown -R 1000:1000 ~/.n8n
sudo chmod -R 777 ~/.n8n
```

#### **2️⃣ Restart n8n Container**  
```bash
sudo docker stop n8n
sudo docker rm n8n
sudo docker run -d --restart unless-stopped -it \
--name n8n \
-p 5678:5678 \
-e N8N_HOST="myn8n.my-domain.com" \
-e WEBHOOK_TUNNEL_URL="https://myn8n.my-domain.com/" \
-e WEBHOOK_URL="https://myn8n.my-domain.com/" \
-v ~/.n8n:/home/node/.n8n \
n8nio/n8n
```

#### **3 Verify n8n is Running**  
```bash
sudo docker ps
```
- `docker ps` should show `Up X minutes`  
- `curl` should return `HTTP/1.1 200 OK` or `403 Forbidden`  

#### **4 Final Check**  
Open in browser:  
```
https://myn8n.my-domain.com
```
![Screenshot 2025-02-18 104846](https://github.com/user-attachments/assets/d5d8dba5-fee6-4cf1-972e-65a37c5144d8)

```bash
crontab -e
```
Add the following line at the end to fix n8n folder permissions on startup:  

```bash
@reboot sudo chown -R 1000:1000 ~/.n8n && sudo chmod -R 777 ~/.n8n
```

This ensures **n8n always has full access** to its config directory after a reboot. 

![Screenshot 2025-02-18 111733](https://github.com/user-attachments/assets/2c31e3d6-8734-4d2a-9992-01cd11d34042)


---

## 📍Appendix #2: Advanced Execute Command Usage with Custom Dependencies

#### Using Execute Command Nodes for External Tools

The Execute Command node is extremely powerful when you understand how to leverage it. You can run any command-line tool, Python scripts, or system utilities that aren't directly available as n8n nodes - essentially extending n8n's capabilities infinitely.

#### Installing Python Packages in n8n Docker Container

For tools requiring Python dependencies (like yt-dlp for YouTube downloads), create a custom Docker image:

**1. Create Dockerfile:**
```bash
cd ~/n8n
nano Dockerfile
```

**Add content:**
```dockerfile
FROM n8nio/n8n:latest

USER root
RUN apk add --no-cache python3 wget && \
    wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

USER node
```

**2. Build custom image:**
```bash
sudo docker build -t n8n-with-ytdlp .
```

**3. Update your container start command to use `n8n-with-ytdlp` instead of `n8nio/n8n`**

**4. Adapt update script:**
Replace `sudo docker pull n8nio/n8n:latest` with `sudo docker build -t n8n-with-ytdlp /home/ubuntu/n8n/` (or whatever your path is) and change the image name in the docker run command to `n8n-with-ytdlp`.

**Usage in Execute Command node:**
```bash
yt-dlp -x --audio-format mp3 -o output-{{ $json.now_unix }}.mp3 '{{ $json.videoUrl }}'
```




## 📍Appendix #3: Emergency Debugging When Everything Breaks

### When SSH Won't Connect Anymore

**Enable serial console access:**
1. VM instances → Your VM → Edit  <img width="1184" height="443" alt="Screenshot 2025-09-12 122351" src="https://github.com/user-attachments/assets/db2a8e73-8f69-44b0-afbd-88c7b4a790ca" />

2. Check "Enable connecting to serial ports" → Save   <img width="707" height="443" alt="Screenshot 2025-09-12 122605" src="https://github.com/user-attachments/assets/d9e0be17-cade-4990-8100-2abd2d178c30" />

3. VM overview → "Connect to serial console"   <img width="838" height="555" alt="Screenshot 2025-09-12 122718" src="https://github.com/user-attachments/assets/4f3b2d1e-9450-4c65-8fe5-e5bd39e90b24" />

**If serial console shows spam/errors and won't let you type:**
- Press **Ctrl+C** multiple times to stop running processes
- Press **Enter** to get a login prompt
- If still spamming: **Ctrl+Z** then **Enter**
- Login with your username/password

### Diagnose What Broke

```bash
# Check basic system health
df -h                    # Disk full = SSH fails
free -h                  # Out of RAM = system hangs
sudo docker ps -a        # Container status

# Check n8n specifically  
sudo docker logs n8n --tail=50    # What error killed it?
```

### Fix Common Production Failures

**License renewal spam (kills performance):**
```bash
sudo docker exec -it n8n /bin/sh
rm -rf /home/node/.n8n/license*
exit
sudo docker restart n8n
```

**Disk full:**
```bash
sudo docker system prune -f
# Delete old backups (keep newest 2)
sudo find /home/yourgoogleaccount/.n8n-backup* -type d | sort | head -n -2 | xargs rm -rf
```

**Container completely broken:**
```bash
sudo docker stop n8n
sudo docker rm n8n
sudo docker pull n8nio/n8n:latest
# Run your original docker run command
```

**VM restart (last resort):**
- Google Console → VM instances → Your VM → Stop → Start


## 📍 Appendix #4

If 1 GB of RAM with the Free Tier proves to be insufficient and the instance continuously crashes, try adding virtual RAM (Swap) via a startup script.

1. Click on **Edit** for your VM Instance.
2. Scroll down to the **Automation** section.
<img width="618" height="268" alt="image" src="https://github.com/user-attachments/assets/7f4bea8c-e320-4d94-92df-65e26ab10f6c" />
3. Add the following script to the **Startup script** field:

```bash
#!/bin/bash
# Check if swap exists, if not create 2GB swap file to prevent OOM kills
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    # Make permanent
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # Tune swappiness for low memory
    sysctl vm.swappiness=10
fi

```

4. Click on **Save** and **Reset/Restart** your instance.


**Need a more advanced deployment, integration, or enterprise automation?** Visit [Stardawnai.com](https://stardawnai.com) for professional consulting and development on AI-driven process automation, SAP integration, self-hosted enterprise N8N workflows, and custom hybrid infrastructure solutions tailored to your business needs.
