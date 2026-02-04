# Supabase Email Templates - Coolify Setup

## Design Tool
https://supa-tools.com - Create templates, copy HTML

## Template Location
```bash
/data/coolify/services/YOUR_SERVICE_ID/volumes/templates/
```

## Templates Server (docker-compose.yml)
```yaml
templates-server:
  image: 'caddy:2.9.1'
  container_name: supabase-templates-server
  volumes:
    - './volumes/templates:/templates:ro,z'
  entrypoint: 'caddy file-server -r /templates --listen :80'
```

## Auth Templates
| File | ENV Variable |
|------|--------------|
| confirmation.html | `GOTRUE_MAILER_TEMPLATES_CONFIRMATION=http://templates-server/confirmation.html` |
| invite.html | `GOTRUE_MAILER_TEMPLATES_INVITE=http://templates-server/invite.html` |
| recovery.html | `GOTRUE_MAILER_TEMPLATES_RECOVERY=http://templates-server/recovery.html` |
| magic-link.html | `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK=http://templates-server/magic-link.html` |
| email_change.html | `GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE=http://templates-server/email_change.html` |

## Subject Lines (ENV)
```
GOTRUE_MAILER_SUBJECTS_CONFIRMATION=Your Subject
GOTRUE_MAILER_SUBJECTS_RECOVERY=Your Subject
GOTRUE_MAILER_SUBJECTS_MAGIC_LINK=Your Subject
GOTRUE_MAILER_SUBJECTS_INVITE=Your Subject
GOTRUE_MAILER_SUBJECTS_EMAIL_CHANGE=Your Subject
```

## Security Notifications (Path + Enable Flag)
```
MAILER_TEMPLATES_PASSWORD_CHANGED_NOTIFICATION=/templates/password_changed.html
MAILER_NOTIFICATIONS_PASSWORD_CHANGED_ENABLED=true

MAILER_TEMPLATES_EMAIL_CHANGED_NOTIFICATION=/templates/email_changed.html
MAILER_NOTIFICATIONS_EMAIL_CHANGED_ENABLED=true

MAILER_TEMPLATES_PHONE_CHANGED_NOTIFICATION=/templates/phone_changed.html
MAILER_NOTIFICATIONS_PHONE_CHANGED_ENABLED=true

MAILER_TEMPLATES_IDENTITY_LINKED_NOTIFICATION=/templates/identity_linked.html
MAILER_NOTIFICATIONS_IDENTITY_LINKED_ENABLED=true

MAILER_TEMPLATES_IDENTITY_UNLINKED_NOTIFICATION=/templates/identity_unlinked.html
MAILER_NOTIFICATIONS_IDENTITY_UNLINKED_ENABLED=true

MAILER_TEMPLATES_MFA_FACTOR_ENROLLED_NOTIFICATION=/templates/mfa_enrolled.html
MAILER_NOTIFICATIONS_MFA_FACTOR_ENROLLED_ENABLED=true

MAILER_TEMPLATES_MFA_FACTOR_UNENROLLED_NOTIFICATION=/templates/mfa_unenrolled.html
MAILER_NOTIFICATIONS_MFA_FACTOR_UNENROLLED_ENABLED=true
```

## Template Variables
```
{{ .ConfirmationURL }}  - Full confirmation link
{{ .Token }}            - 6-digit OTP code
{{ .TokenHash }}        - Hashed token
{{ .RedirectTo }}       - emailRedirectTo from frontend
{{ .SiteURL }}          - Base site URL
{{ .Email }}            - User email
{{ .OldEmail }}         - Old email (email_change)
```

## Custom Confirmation Link Example
```html
<a href="https://YOUR-API.com/auth/v1/verify?token={{ .TokenHash }}&type=signup&redirect_to={{ .RedirectTo }}">
  Confirm Email
</a>
```

## After Changes
Restart supabase-auth container in Coolify.
