# n8n ↔ OpenWebUI Integration Guide

## Architecture

```
n8n → OpenWebUI (OpenAI-compatible API) → LLM Backend
```

n8n connects to OpenWebUI using the **OpenAI Chat Model** node — not the Ollama node.

## OpenWebUI Setup

### 1. Enable API Keys (Admin)
**Admin Panel → Settings → General:**
- Toggle **"Enable API Keys"** → ON

### 2. Create Group with API Key Permission
**Admin Panel → Groups → New Group:**
- Enable the **"API Keys"** feature
- Add user(s) to the group
- Save

### 3. Generate API Key
**Profile Icon → Settings → Account → API Keys:**
- Click **"Create new secret key"**
- Copy the `sk-...` key — it is shown only once

> ⚠️ Regenerating a key invalidates all previous keys immediately.

## n8n Setup

### Credential Type: OpenAI

| Field | Value |
|---|---|
| **API Key** | `sk-...` from OpenWebUI |
| **Base URL** | `https://your-openwebui-domain.com/api` |

> **Important:** Base URL must end with `/api`. Without it you get `405 Method Not Allowed`.

### Node: OpenAI Chat Model

| Field | Value |
|---|---|
| **Model** | Switch to **"By ID"** → type your model name |
| **Use Responses API** | OFF |

The model dropdown will not populate — this is expected. Enter the model name manually.

Works as sub-node in **AI Agent**, **Basic LLM Chain**, etc.

## Verify Connection

```bash
curl -X POST https://your-openwebui-domain.com/api/chat/completions \
  -H "Authorization: Bearer sk-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"your-model","messages":[{"role":"user","content":"hello"}]}'
```

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `405 Method Not Allowed` | Base URL missing `/api` | Add `/api` to end of Base URL |
| `401 Unauthorized` | Wrong key type or expired | Use `sk-` key from Account settings, not admin connection tokens |
| Generate button does nothing | Missing group permission | Create group with "API Keys" feature, add user |
| Model dropdown empty | Known n8n limitation with custom endpoints | Switch to "By ID" and type model name manually |

## Notes

- The **Admin Panel → Ollama/OpenAI API connections** are for OpenWebUI's internal backend connections — they cannot be used for external API access.
- For external access (n8n, other tools), always use the `sk-` API key from your **user account settings**.