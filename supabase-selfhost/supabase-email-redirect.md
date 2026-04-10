# Supabase Email Redirect Setup - Coolify

**This guide is using Coolify as Deployment Service!**

## Problem
Email verification links redirect to wrong URL (API instead of Frontend).

**Root Cause:** Coolify's default Supabase compose hardcodes `GOTRUE_SITE_URL` to `${SERVICE_URL_SUPABASEKONG}` (the API URL). This means GoTrue always uses the API URL as redirect target — no matter what you set in the ENV variables. The compose value **overrides** the ENV value.

---

## ⚠️ CRITICAL: Compose vs ENV Variables

Coolify has **two** places where environment variables are set:

1. **Compose file** — defines which ENV variable name is mapped (e.g., `GOTRUE_SITE_URL=${SOME_VARIABLE}`)
2. **Environment Variables** — defines the actual values (e.g., `GOTRUE_SITE_URL=https://example.com`)

**If the compose maps to the wrong variable, your ENV changes are ignored.**

Example of the problem:
```yaml
# In Compose — maps GOTRUE_SITE_URL to the API URL variable
- 'GOTRUE_SITE_URL=${SERVICE_URL_SUPABASEKONG}'

# In ENVs — you set the correct frontend URL
GOTRUE_SITE_URL=https://example.com

# Result: GoTrue gets SERVICE_URL_SUPABASEKONG (API URL), your ENV is ignored!
```

This is why changing the ENV alone does nothing — **you must fix the compose first**.

---

## Solution

### Step 1: Fix the Compose (Coolify Dashboard → Service → Compose Editor)

Find in the `supabase-auth` section:
```yaml
- 'GOTRUE_SITE_URL=${SERVICE_URL_SUPABASEKONG}'
```

Change to:
```yaml
- 'GOTRUE_SITE_URL=${GOTRUE_SITE_URL}'
```

Now the compose references `GOTRUE_SITE_URL` from your ENVs instead of `SERVICE_URL_SUPABASEKONG`.

### Step 2: Set the ENV Variables (Coolify Dashboard → Service → Environment Variables)

```
GOTRUE_SITE_URL=https://example.com
API_EXTERNAL_URL=https://api.example.com
ADDITIONAL_REDIRECT_URLS=https://example.com/**, https://example.com/#/**, http://localhost:5173/**
```

### Step 3: Deploy (not just Restart!)

**Compose changes require a Deploy, not a Restart.**

- **Restart** = reloads containers with existing compose → compose changes are NOT applied
- **Deploy** = rebuilds containers from updated compose → compose changes ARE applied

If the service is already running and there is no Deploy button:
1. Use **Advanced → Pull Latest Images & Restart**, OR
2. **Stop** the service, then **Deploy**

<img width="473" height="243" alt="image" src="https://github.com/user-attachments/assets/49e53f21-deb5-4a9b-a204-3deac381a410" />


### Step 4 (Optional): Frontend signUp call

```typescript
await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: 'https://example.com/#/redirect/success',
  }
});
```

---

## How to Verify the Fix

After deploy, check what GoTrue actually received:

```bash
sudo docker exec $(sudo docker ps --filter "name=supabase-auth" -q) env | grep SITE_URL
```

Expected output:
```
GOTRUE_SITE_URL=https://example.com
```

If it still shows the API URL, the compose change was not applied. Repeat Step 3.

---

## ENV Variables Reference

| Variable | Example Value | Purpose |
|----------|---------------|---------|
| `GOTRUE_SITE_URL` | `https://example.com` | Where users land after clicking verify link |
| `API_EXTERNAL_URL` | `https://api.example.com` | Public Supabase API URL (used in verify link) |
| `ADDITIONAL_REDIRECT_URLS` | `https://example.com/**` | Allowed redirect URLs (** = all paths) |

**Important:** `API_EXTERNAL_URL` must also be set to the public HTTPS URL. If left as default (`http://supabase-kong:8000`), verify links will point to an internal Docker hostname that users cannot reach.

---

## Compose Variable Mapping

| Compose uses | Set in ENV as |
|--------------|---------------|
| `${GOTRUE_SITE_URL}` | `GOTRUE_SITE_URL` |
| `${API_EXTERNAL_URL:-http://supabase-kong:8000}` | `API_EXTERNAL_URL` |
| `${ADDITIONAL_REDIRECT_URLS}` | `ADDITIONAL_REDIRECT_URLS` |

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Only changed ENV, not Compose | `redirect_to` still shows API URL | Fix compose mapping (Step 1) |
| Used Restart instead of Deploy | Compose changes not applied | Use Deploy or Pull Latest & Restart |
| `API_EXTERNAL_URL` not set | Verify link goes to `http://supabase-kong:8000` | Set to public HTTPS API URL |
| `GOTRUE_SITE_URL` set to API URL | Users redirected to API after verification | Set to frontend URL |
