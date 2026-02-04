# Supabase Email Redirect Setup - Coolify

## Problem
Email verification links redirect to wrong URL (API instead of Frontend).

## Solution

### 1. Coolify Dashboard → Service → Compose

Find in supabase-auth section:
```yaml
- 'GOTRUE_SITE_URL=${SERVICE_URL_SUPABASEKONG}'
```

Change to:
```yaml
- 'GOTRUE_SITE_URL=${GOTRUE_SITE_URL}'
```

### 2. Coolify Dashboard → Service → Environment Variables

```
GOTRUE_SITE_URL=https://example.com
API_EXTERNAL_URL=https://api.example.com
ADDITIONAL_REDIRECT_URLS=https://example.com/**, https://example.com/#/**, http://localhost:5173/**
```

### 3. Frontend: signUp call

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

## ENV Variables Reference

| Variable | Example Value | Purpose |
|----------|---------------|---------|
| `GOTRUE_SITE_URL` | `https://example.com` | Final redirect destination |
| `API_EXTERNAL_URL` | `https://api.example.com` | Supabase API URL |
| `ADDITIONAL_REDIRECT_URLS` | `https://example.com/**` | Allowed redirect URLs (** = all paths) |

---

## Compose Variable Mapping

| Compose uses | Set in ENV as |
|--------------|---------------|
| `${GOTRUE_SITE_URL}` | `GOTRUE_SITE_URL` |
| `${API_EXTERNAL_URL:-http://supabase-kong:8000}` | `API_EXTERNAL_URL` |
| `${ADDITIONAL_REDIRECT_URLS}` | `ADDITIONAL_REDIRECT_URLS` |

---

## After Changes
Coolify Dashboard → Service → Restart (not Deploy)
