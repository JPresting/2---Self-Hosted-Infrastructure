## Control and Analyze Unexpected Costs

When you run automations (e.g., n8n), it’s normal to reuse one API key across multiple workflows and sometimes even multiple environments/projects.  
That can get messy fast: a single key can generate costs “out of nowhere”, and without a budget alert you may notice it too late.  
So: create a **Budget** for early warning, then use **Cost table → API Metrics → Credentials filter** to pinpoint the exact key.

### 0) Create a Budget (to get notified early)
1. Go to **Billing** → **Budgets & alerts**.
2. Create a budget and add alert thresholds (e.g., 50%, 90%, 100%) + email recipients.

### 1) Find the cost source (Billing → Cost table)
1. Open **Billing account**.
2. Go to the **Cost table** tab.
3. Identify the cost driver by checking:
   - **Project**
   - **Service**
   - **SKU**
4. (Optional) Download the CSV for offline analysis.

<img width="930" height="247" alt="image" src="https://github.com/user-attachments/assets/1fe2ba06-fb96-48c2-8e84-1118ba7e4c26" />

### 2) Open the API that generates costs
1. Switch to the project that showed up in Cost table.
2. Go to **APIs & Services** → **Enabled APIs & services**.
3. Click the API that caused costs (e.g., **Generative Language API / Gemini**) and open **Metrics**.

<img width="1251" height="649" alt="image" src="https://github.com/user-attachments/assets/b50bd0e4-d83a-48a8-af44-b9abbdbb7894" />

### 3) Identify the exact credential (which API key is responsible)
1. In **Metrics**, open the **Credentials** filter.
2. Deselect everything.
3. Select credentials **one by one**.
4. The credential that shows traffic (e.g., many `200` responses) is the key causing usage/cost.

<img width="1098" height="358" alt="image" src="https://github.com/user-attachments/assets/7670897c-51d3-4912-879a-7b960acec8b4" />

### 4) Stop it (delete or restrict the key)
1. Go back to **APIs & Services** → **Credentials**.
2. Find the responsible key (even if several keys have the same name).
3. Action:
   - **Delete** the key to make it invalid (stops further usage after propagation), or
   - Restrict it to only the required API + lock it to IP/referrer.

<img width="890" height="284" alt="image" src="https://github.com/user-attachments/assets/4f70a242-abe9-4d22-96ae-b882bc95cebc" />
