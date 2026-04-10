# Fix: Slow Coolify Dashboard via Cloudflare Tunnel

## What's the problem?

Coolify's UI uses **Livewire** (a Laravel framework) which relies heavily on **Server-Sent Events (SSE)** to update the dashboard in real time — things like switching servers, toggling views, or loading resource lists.

**Cloudflare Tunnel buffers SSE responses by default.** Instead of forwarding these small UI events instantly, Cloudflare holds them until a buffer is full or a timeout is hit. The result:

- Switching between servers takes 10–30 seconds
- Toggling Developer / Normal view feels frozen
- Loading resource lists is sluggish

> Accessing Coolify directly via local IP (e.g. `http://192.168.1.100:8000`) is instant — this confirms the issue is Cloudflare, not the server.

---

## The fix: Disable response buffering for Coolify

We add a single **Cloudflare Transform Rule** that sets the `X-Accel-Buffering: no` response header for the Coolify domain. This tells Cloudflare to forward SSE events immediately instead of buffering them.

**No security impact.** Cloudflare Access, Zero Trust, and the Tunnel itself remain fully active.

---

## Step-by-step

### 1. Open Transform Rules & pick the right template

Go to [dash.cloudflare.com](https://dash.cloudflare.com) → select your domain → **Rules** → **Transform Rules** → **+ Create rule**

Select **"Transform requests or responses"** from the dropdown, then click **"Create from template"** under **"Add static header to response"**.

![Step 1 - Rule Templates](step1-rule-templates.png)

---

### 2. Name the rule & set the filter

You'll land on the rule creation page. Fill in:

- **Rule name:** `Coolify disable buffering`
- Select **"Custom filter expression"**
- Set **Field** → `Hostname`, **Operator** → `equals`, **Value** → `coolify.yourdomain.com`

![Step 2 - Create Rule](step2-create-rule.png)

---

### 3. Select Hostname from the field dropdown

In the field dropdown, scroll down and select **Hostname**.

![Step 3 - Hostname Field](step3-hostname-field.png)

---

### 4. Fill in the complete rule

The final rule should look like this:

| Field | Value |
|---|---|
| Rule name | `Coolify disable buffering` |
| Filter | `Hostname equals coolify.yourdomain.com` |
| Action | `Set static` |
| Header name | `X-Accel-Buffering` |
| Header value | `no` |

The Expression Preview will show:
```
(http.host eq "coolify.yourdomain.com")
```

![Step 4 - Complete Rule](step4-complete-rule.png)

---

### 5. Deploy — ignore the DNS warning

Click **Deploy**. Cloudflare will warn that the domain may not be proxied via a standard DNS record. This is expected — traffic runs through a Cloudflare Tunnel, not a classic proxied record.

Select **"Ignore and deploy rule anyway"** → **Deploy rule**.

![Step 5 - Deploy Warning](step5-deploy-warning.png)

---

## Result

| | Before | After |
|---|---|---|
| Server switch | ~20 seconds | ~1 second |
| View toggle | ~15 seconds | instant |
| Resource list load | ~30 seconds | ~2 seconds |

---

## Why does this work?

`X-Accel-Buffering: no` is a header originally used by nginx to disable proxy buffering. Cloudflare respects this header and disables its own response buffering when it's present — allowing SSE streams to flow through in real time.

---

## Notes

- This rule only applies to the Coolify subdomain, nothing else is affected
- Works with Cloudflare Free plan (uses 1 of 10 available Transform Rules)
- No changes needed to Coolify, the Tunnel config, or Cloudflare Access
