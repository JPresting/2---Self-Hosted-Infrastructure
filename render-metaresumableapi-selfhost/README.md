# Meta's Resumable Upload API
Meta's Resumable API with Node.JS

## 1. Clone the repo and move it to the project directory

## 2. Update your credentials in .env
```
PORT=2002
// META GRAPH API AND IT's VERSION
META_API_URI=https://graph.facebook.com/v23.0
// DEVELOPER APP ID
META_APP_ID=xxxxxxx
// WHATSAPP BUSINESS SYSTEM USER's ACCESS TOKEN 
META_ACCESS_TOKEN=xxxxxxx
// BUSINESS ACCOUNT ID
META_BUSINESS_ACC_ID=xxxxxxx
```

## 3. NPM install
```
npm install
```

## 5. Run
```
node index.js
```

## 6. Upload media using resumable upload API
Use Postman or any API explorer, Select your media file for upload
```
curl --location 'http://localhost:2002/uploadMedia' \
--form 'file=@"/path to media"'
```
#### Response:
```
{
    "message": "Uploaded!",
    "body": {
        "h": "4:SU1HLTIwMjMwODA4LVdBMDA1Ny5qcGc=:aW1hZ2UvanBlZw==:ARaRZtSxg-sdfsd fsdfsdfs:e:1691919924:1183230345850902:100083655871696:ARb0Rx-OeipQSkQMkMc"
    }
}
```
#### This is a request and response 
![259396102-b6c518a5-3245-4bd5-9363-f3af318e6804](https://github.com/turivishal/meta-resumable-upload-api/assets/10988772/312fb5bf-9060-4e97-8d09-eb7c2eda3fe4)

## 7. Create Template
Put the uploaded media code in `header_handle` from the above API's response
```
curl --location 'http://localhost:2002/createTemplate' \
--header 'Content-Type: application/json' \
--data '{
  "name": "welcome_to_the_demo",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    {
      "type": "HEADER",
      "format": "IMAGE",
      "example": {
        "header_handle": [
          "4:SU1HLTIwMjMwODA4LVdBMDA1Ny5qcGc=:aW1hZ2UvanBlZw==:ARaRZtSxg-sdfsd fsdfsdfs:e:1691919924:1183230345850902:100083655871696:ARb0Rx-OeipQSkQMkMc"
        ]
      }
    },
    {
      "type": "BODY",
      "text": "Shop now through the end of August and use code 25OFF to get 25% off of all merchandise."
    }
  ]
}'
```
#### Response:
```
{
    "message": "Template Created!",
    "body": {
        "id": "1495664324171758",
        "status": "PENDING",
        "category": "MARKETING"
    }
}
```
#### This is a request and response 
![259397683-c36d9cce-9fc8-4840-bcfc-b13287ed33dd](https://github.com/turivishal/meta-resumable-upload-api/assets/10988772/e4d95e61-89d5-4c8b-a4d9-e369dca62169)

## Reference
https://developers.facebook.com/docs/graph-api/guides/upload/





**Providing GitHub deployment guide**

The user needs a step-by-step guide for deploying their GitHub repo on Render. I need to include several specific details: New Web Service with their public Git repository, build and start commands, environment variables, how to add a subdomain via an A record, and info about the input data field name 'data' in n8n. I'll also offer two deployment options, either direct deployment or via Google Form automation, and a n8n template link. Of course, I'll need to search for specific citations like the Render A record IP.


Thought for 4 seconds


Here’s the **ultimate guide** (in English) to deploying your existing fork — **JimPresting/meta-resumable-upload-api** — on Render, plus two ways to expose it (direct HTTP service or Google Form automation), setting up a subdomain, API Key auth, and the final `curl` to test.

---

## Two Deployment Options

1. **Self‑hosted on Render** (detailed below)
2. **Google Form → n8n → Render** (automated file‑upload service; template link at the end)

---

# 1. Self‑Host on Render

### 1.1. Create a New Web Service

1. Log in to Render and click **New → Web Service**.
2. Choose **Public Git repository**.
3. Paste your repo URL:

   ```
   https://github.com/JimPresting/meta-resumable-upload-api
   ```
4. Click **Continue**.

### 1.2. Configure Build & Start

| Setting        | Value           |
| -------------- | --------------- |
| Environment    | Node            |
| Branch         | main            |
| Build Command  | `npm install`   |
| Start Command  | `node index.js` |
| Root Directory | *(leave blank)* |

*Render automatically sets* `PORT` *to an ephemeral port (10000 in your logs).* ([Render][1])

### 1.3. Add Environment Variables (Defaults)

1. Go to the **Environment** tab.
2. Click **Add Environment Variable** for each key from your README:

   ```
   PORT=2002
   META_API_URI=https://graph.facebook.com/v14.0
   META_APP_ID=xxxxxxx
   META_ACCESS_TOKEN=xxxxxxx
   META_BUSINESS_ACC_ID=xxxxxxx
   ```
3. Click **Save, rebuild, and deploy**.

### 1.4. Add API Key Auth

1. In the same **Environment** tab, add:

   ```
   API_KEY=d6bd63a37f727c74712cc68d197c51a5
   ```
2. Click **Save, rebuild, and deploy**.

*Your code checks* `Authorization: Bearer <API_KEY>`.

### 1.5. Verify the Service

* Wait for “Live” in the **Deploys** tab.
* Confirm logs:

  ```
  Listening on port 10000
  ```
* Your Render URL is now:

  ```
  https://meta-resumable-upload-api.onrender.com
  ```

---

# 2. (Optional) Add Custom Subdomain

1. In your service’s **Settings → Custom Domains**, click **+ Add Custom Domain**.

2. Enter your domain, e.g. `watemplate.yourdomain.com` and **Verify**. ([Render][1])

3. At your DNS provider, add:

   * **Type**: A
   * **Name**: `watemplate` (for watemplate.yourdomain.com)
   * **Value**: `YOUREXTERNALIP` ([Render][2])

4. Wait for verification. SSL is automatic.

5. Your new endpoint:

   ```
   https://watemplate.yourdomain.com/uploadMedia
   ```

---

# 3. Test with curl

```bash
curl -X POST https://watemplate.yourdomain.com/uploadMedia \
  -H "Authorization: Bearer d6bd63a37f727c74712cc68d197c51a5" \
  -F "file=@/path/to/your/file.pdf" \
  -F "META_APP_ID=1234567890" \
  -F "META_ACCESS_TOKEN=EAAXXX..." \
  -F "META_BUSINESS_ACC_ID=9876543210" \
  -F "META_API_URI=https://graph.facebook.com/v14.0" \
  -F "PORT=10000"
```
He will simply overwrite the .env! Doing it like this, you can use it for multiple WABA's!
---

# 4. n8n Template

In n8n, use an **HTTP Request** node:

* **Method**: POST
* **URL**: `https://watemplate.yourdomain.com/uploadMedia`
* **Body Content Type**: `multipart/form-data`

**Binary Parameter**

| Name | Input Data Field Name |
| ---- | --------------------- |
| file | data                  |

**Form Parameters**

| Key                     | Value/Expression                    |
| ----------------------- | ----------------------------------- |
| META\_APP\_ID           | `={{ $json["metaAppId"] }}`         |
| META\_ACCESS\_TOKEN     | `={{ $json["metaAccessToken"] }}`   |
| META\_BUSINESS\_ACC\_ID | `={{ $json["metaBusinessAccId"] }}` |
| META\_API\_URI          | `=https://graph.facebook.com/v14.0` |
| PORT                    | `=10000`                            |

> Use **data** as Input Data Field Name so the binary from your Google Drive node is sent as `file`.

You can import this sample workflow via n8n’s import feature:

```
[ n8n workflow JSON placeholder – replace with your actual template link ]
```

---

# 5. Alternative: Google Form → n8n → Render

A service I built to simplify setup, requiring trust with your credentials.  
1. Create an "account": [Link](https://forms.gle/vvi6vUQd7YPfkU5X8)  
2. Create a template: [Link](https://forms.gle/MnPQ9AQ8n2F8AosX8)  

Note: This creates a basic template using one of three document-related options, editable later in WhatsApp Business Manager.


This gives a no‑code front‑end for non‑technical users.

---

You now have a complete, secure, and flexible deployment—either direct HTTP API or via Google Form automation.

[1]: https://render.com/docs/custom-domains?utm_source=chatgpt.com "Custom Domains on Render"
[2]: https://render.com/docs/configure-other-dns?utm_source=chatgpt.com "Configuring DNS Providers – Render Docs"



**Need a more advanced deployment, integration, or enterprise automation?** Visit [Stardawnai.com](https://stardawnai.com) for professional consulting and development on AI-driven process automation, SAP integration, self-hosted enterprise N8N workflows, and custom hybrid infrastructure solutions tailored to your business needs.