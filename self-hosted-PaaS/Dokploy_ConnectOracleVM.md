# Adding Oracle Cloud Server to Dokploy as Remote Server

---

## Step 1: Generate SSH Key in Dokploy

Go to your Dokploy VM and navigate to **Settings → SSH Keys**. Click **Add SSH Key**.

<img width="1604" height="636" alt="image" src="https://github.com/user-attachments/assets/547d3ac1-f12e-4a53-a45e-1aca99a6f7dc" />

Click **Generate RSA SSH Key**, give it a name, and copy the generated public key.

<img width="649" height="669" alt="image" src="https://github.com/user-attachments/assets/fd25f4b5-8515-4e3b-ba37-57cef1ec9d3f" />

---

## Step 2: Add Public Key to Oracle Cloud Server

Connect to your Oracle Cloud VM and add the public key to the `authorized_keys` file:

```bash
echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys
```

### Enable Root Login

Dokploy requires root access. On the Oracle server run:

```bash
sudo nano /etc/ssh/sshd_config
# Change: #PermitRootLogin prohibit-password
# To:     PermitRootLogin yes

sudo systemctl restart ssh
sudo cp ~/.ssh/authorized_keys /root/.ssh/authorized_keys
```

---

## Step 3: Create Server in Dokploy

In Dokploy go to **Settings → Servers** and click **Create Server**.

<img width="1702" height="583" alt="image" src="https://github.com/user-attachments/assets/75856293-18ff-4c3d-a2d8-752c8da594d3" />

Fill in the details:
- **IP:** Your Oracle Cloud Public IP
- **Username:** `root`
- **SSH Key:** The key you just generated
- **Port:** `22`

<img width="814" height="705" alt="image" src="https://github.com/user-attachments/assets/1481dc93-f86f-4ad0-89ae-ae05134e2a0d" />

---

## Step 4: Setup Server

Open the server, go to the **Deployments** tab and click **Setup Server**.

<img width="999" height="597" alt="image" src="https://github.com/user-attachments/assets/e5a372e1-8cca-4a73-90b7-e839ea3de207" />

Dokploy will now automatically install Docker, Docker Swarm, Traefik and all required dependencies on your Oracle server.

---

## ⚠️ Port Conflict

If you already run another service (e.g. Coolify) on your Oracle server that uses Port 80/443, the Setup Server step will fail because both platforms ship their own Traefik reverse proxy. In that case a more advanced setup is required to isolate the two platforms from each other.
> For running Coolify and Dokploy side-by-side on the same server, [check this guide here](https://github.com/JPresting/2---Self-Hosted-Infrastructure/blob/main/self-hosted-PaaS/Coolify_Dokploy_DualSetup.md).
