# Healthcheck Configuration for Major Application Updates in Coolify

## The Problem

When a containerized application like Nextcloud undergoes a **major version update**, it typically runs database migrations, cache rebuilds, and integrity checks on first startup. This process can take anywhere from **2 to 30 minutes** depending on the application and data size.

If your Docker Compose healthcheck is configured too aggressively — with a short interval and no `start_period` — the following chain reaction occurs:

1. Container starts, application begins migrations
2. Healthcheck fires too early, application is still busy → returns error
3. Coolify marks container as `unhealthy`
4. Container gets restarted
5. Migration starts over from scratch
6. Loop repeats indefinitely → application never comes up

This is not a bug in Coolify or the application. It is a misconfiguration of the healthcheck.

---

## Real-World Example: Nextcloud 33 Major Update

**What happened:**

- Watchtower automatically pulled Nextcloud 33 (major release) at 03:14 AM
- Nextcloud began running database migrations for Talk, Mail, Richdocuments, and Contacts
- The healthcheck was configured with `interval: 2s` and `retries: 15` — meaning only **30 seconds** before marking unhealthy
- Nextcloud needs several minutes to complete migrations
- Result: restart loop, 504 Gateway Timeout on all requests

**Additional compounding factor — PHP-FPM worker exhaustion:**

Nextcloud Talk uses **long-polling** for real-time notifications. Each device with the app open holds a PHP-FPM worker occupied for up to 60 seconds. With the default `pm.max_children = 5`, just 3 family members with the app open = all workers blocked = no workers available for normal requests or migrations.

---

## The Fix: Proper Healthcheck Configuration

### Bad Configuration (what caused the issue)

```yaml
healthcheck:
  test:
    - CMD
    - curl
    - '-f'
    - 'http://127.0.0.1:80'
  interval: 2s       # Too aggressive
  timeout: 10s
  retries: 15        # 2s × 15 = only 30 seconds total
  # No start_period!
```

### Good Configuration

```yaml
healthcheck:
  test:
    - CMD
    - curl
    - '-f'
    - 'http://127.0.0.1:80'
  interval: 10s      # Check every 10 seconds, not every 2
  timeout: 10s
  retries: 10        # 10 × 10s = 100 seconds to respond
  start_period: 60s  # Ignore ALL failures for the first 60 seconds
```

### What `start_period` does

`start_period` tells Docker to **completely ignore healthcheck failures** during the startup grace period. The container will not be marked unhealthy during this window, no matter what. Only after `start_period` expires do retries start counting toward the failure threshold.

This is the most important setting for applications that run migrations on startup.

---

## General Guidelines by Application Type

| Application Type | Recommended `start_period` | Notes |
|---|---|---|
| Simple web apps (no migrations) | `15s` | PHP, Node.js static apps |
| Apps with small DB migrations | `30s` | Minor version updates |
| Apps with large DB migrations | `60–120s` | Nextcloud, Ghost, Gitea major updates |
| Apps with data re-indexing | `120–300s` | Meilisearch, Elasticsearch |

---

## PHP-FPM Worker Sizing (Nextcloud / lsio images)

The `lscr.io/linuxserver/nextcloud` image defaults to `pm.max_children = 5`. This is fine for a minimal setup but breaks immediately when Talk long-polling is involved.

The `PHP_MAX_CHILDREN` environment variable is **not supported** by the lsio image. The only way to override this persistently is via a volume-mounted config file.

### Step 1: Create the config file on the host

```bash
sudo mkdir -p /opt/nextcloud
echo '[www]
pm.max_children = 10' | sudo tee /opt/nextcloud/php-fpm-custom.conf
```

### Step 2: Mount it in your Compose

```yaml
volumes:
  - 'nextcloud-config:/config'
  - 'nextcloud-data:/data'
  - '/opt/nextcloud/php-fpm-custom.conf:/etc/php84/php-fpm.d/zzz-custom.conf:ro'
```

The `zzz-` prefix ensures this file is loaded **last**, overriding the image defaults.

### Worker sizing formula

```
available_ram_for_php = total_ram - ram_used_by_other_services
max_children = available_ram_for_php / avg_ram_per_worker (~100MB for Nextcloud)
```

For a home server with 13GB RAM and multiple services, **10–15 workers** is the right range for a small family Nextcloud instance. Do not set this above 20–30 unless you have very high concurrent usage — too many workers spawning simultaneously during a major update will spike CPU and destabilize the entire server.

---

## Preventing Future Issues

### Disable automatic updates for major applications

Watchtower pulls and applies updates automatically, including major versions. For critical applications, consider excluding them from automatic updates:

```yaml
# In your Nextcloud service
labels:
  - "com.centurylinklabs.watchtower.enable=false"
```

Then update manually during a maintenance window when you can monitor the migration.

### Summary checklist for Coolify Docker Compose deployments

- [ ] Always set `start_period` in healthchecks (minimum 30s, 60s+ for apps with migrations)
- [ ] Use `interval: 10s` or higher — `2s` is almost never appropriate
- [ ] For PHP-FPM apps: mount a custom `www.conf` to override `pm.max_children`
- [ ] Disable Watchtower for major applications, update manually
- [ ] After a major update, monitor `docker stats` for CPU spikes — migrations are expected and temporary