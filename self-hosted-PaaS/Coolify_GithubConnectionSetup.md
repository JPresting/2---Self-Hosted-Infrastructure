
### Setting up the GitHub App in Coolify

### Why do we need this? (The Benefits)

Connecting Coolify to GitHub via a GitHub App unlocks full CI/CD automation for your workflow:

* **Automated Deployments:** As soon as you push new code to your connected GitHub repository, Coolify is instantly notified via webhooks. It automatically pulls the new code, builds the project, and deploys the update without any manual intervention.
* **Secure Access:** Coolify securely authenticates with your private repositories using modern, scoped tokens. You no longer need to manually manage SSH keys or expose passwords on your server.
* **Pull Request Previews:** Coolify can automatically deploy temporary test environments for every new pull request. This allows you to preview changes live before merging them into your main branch.

---

1. Go to **Sources**, enter a name, and provide the EXACT organization name. *(Note: If you leave this empty because you don't have an organization, it will default to your personal GitHub account.)*

<img width="578" height="351" alt="image" src="[https://github.com/user-attachments/assets/ab164126-22b5-4d67-afd0-6990e4abdcfa](https://github.com/user-attachments/assets/ab164126-22b5-4d67-afd0-6990e4abdcfa)" />

2. Select your Webhook Endpoint. It might show the exact same domain twice (pulled from your `.env` file and your FQDN settings). This is a visual bug—simply select either one.

<img width="1099" height="290" alt="image" src="[https://github.com/user-attachments/assets/e715ee6f-5593-4eb8-81a7-aa9b4299f086](https://github.com/user-attachments/assets/e715ee6f-5593-4eb8-81a7-aa9b4299f086)" />

3. Click on **Register now**. This will redirect you to GitHub to create a new GitHub App.

<img width="1278" height="468" alt="image" src="[https://github.com/user-attachments/assets/e6cfa630-706e-4d76-a117-f8eacc337716](https://github.com/user-attachments/assets/e6cfa630-706e-4d76-a117-f8eacc337716)" />

4. Once the app is created, click on **Install Repositories on GitHub**.

<img width="1087" height="440" alt="image" src="[https://github.com/user-attachments/assets/5d77ce47-582f-4ca2-9702-23b529f15746](https://github.com/user-attachments/assets/5d77ce47-582f-4ca2-9702-23b529f15746)" />

5. Authorize the application and select whether Coolify should have access to **All repositories** or **Only select repositories** (recommended for security). Click **Install**.

<img width="900" height="676" alt="image" src="[https://github.com/user-attachments/assets/a3b8acc8-8b3b-4542-bedf-3331df793bce](https://github.com/user-attachments/assets/a3b8acc8-8b3b-4542-bedf-3331df793bce)" />

6. **Finished!** You will be redirected back to Coolify, and your setup is complete.

<img width="1096" height="585" alt="image" src="[https://github.com/user-attachments/assets/e8589f86-afb1-442b-98c9-b1b7d57cd401](https://github.com/user-attachments/assets/e8589f86-afb1-442b-98c9-b1b7d57cd401)" />

### Using the GitHub App

1. Select a Project and create a new Application.

<img width="1093" height="243" alt="image" src="[https://github.com/user-attachments/assets/f508c304-dd76-44e2-909b-73378cbd6539](https://github.com/user-attachments/assets/f508c304-dd76-44e2-909b-73378cbd6539)" />

2. Select **Private Repository (with GitHub App)** and choose your newly created GitHub App.

<img width="1068" height="324" alt="image" src="[https://github.com/user-attachments/assets/60c8305a-9afe-4442-991c-b8ae07d68729](https://github.com/user-attachments/assets/60c8305a-9afe-4442-991c-b8ae07d68729)" />

3. You can now load and deploy all of your repositories, including the private ones.

<img width="1096" height="423" alt="image" src="[https://github.com/user-attachments/assets/c26a2692-00eb-4b9a-a195-392214541039](https://github.com/user-attachments/assets/c26a2692-00eb-4b9a-a195-392214541039)" />

**Troubleshooting:**

* **Empty Repositories:** Coolify cannot deploy completely empty repositories. Ensure your repository contains files (e.g., a `Dockerfile` or source code) before trying to select it.
* **Permission Sync (N/A):** If your private repositories still do not load, go to your GitHub App settings in Coolify and click **Refetch**. The permissions should display `read` and `write` instead of `N/A`. *(Note: Caching layers like Cloudflare might cause a visual delay here).*

<img width="1099" height="230" alt="image" src="[https://github.com/user-attachments/assets/0e5bf3e4-873a-473d-b4af-c1d6b886e9fc](https://github.com/user-attachments/assets/0e5bf3e4-873a-473d-b4af-c1d6b886e9fc)" />


