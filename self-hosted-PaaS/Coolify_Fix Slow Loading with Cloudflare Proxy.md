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

### 1. Open Transform Rules

Go to [dash.cloudflare.com](https://dash.cloudflare.com) → select your domain → **Rules** → **Transform Rules**

![Transform Rules in sidebar](https://i.imgur.com/placeholder-step1.png)

---

### 2. Create a new Response Header rule

Click **+ Create rule** → choose the template **"Add static header to response"** → **Create from template**

---

### 3. Fill in the rule

| Field | Value |
|---|---|
| Rule name | `Coolify disable buffering` |
| Field | `Hostname` |
| Operator | `equals` |
| Value | `coolify.yourdomain.com` |
| Header name | `X-Accel-Buffering` |
| Header value | `no` |
| Action | `Set static` |

The Expression Preview should show:
```
(http.host eq "coolify.yourdomain.com")
```

---

### 4. Deploy

Click **Deploy rule**. If Cloudflare warns that the DNS record may not be proxied, select **"Ignore and deploy rule anyway"** — this is expected when routing through a Cloudflare Tunnel.

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
- Works with Cloudflare Free plan
- Uses 1 out of 10 available Transform Rules on the Free plan
