# Supabase Self-Hosted on Coolify — Troubleshooting Guide

> **Context:** Deploying Supabase via Coolify's built-in template on a remote server (e.g., Oracle Cloud VPS managed by Coolify from a home server). No manual changes were made — only domains for Studio and API were set in the Coolify UI before deploying.

---

## Root Cause: Init Script Race Condition

Supabase's Docker Compose stack consists of ~15 interdependent services. PostgreSQL is the foundation — every other service depends on it. On first boot, Postgres is supposed to execute SQL files mounted into `/docker-entrypoint-initdb.d/` which create databases, schemas, roles, and set passwords.

**The problem:** PostgreSQL's entrypoint scripts only run when the data volume is completely empty. Coolify creates the named volume (`supabase-db-data`) and the bind-mounts (SQL files from `./volumes/db/`) simultaneously during `docker compose up -d`. If Docker initializes the volume even slightly before the bind-mounts are ready, Postgres sees a "fresh but empty" init directory, completes initialization without running any scripts, and marks the volume as initialized. The scripts never run again.

**Result:** The database starts successfully but is missing everything the other services need — databases, schemas, roles, passwords, and functions.

This is **not a user error**. It is a timing issue in how Coolify orchestrates the Supabase template deployment.

---

## Problem 1: `supabase-analytics` Container Unhealthy

### Symptom

```
dependency failed to start: container supabase-analytics is unhealthy
```

All containers that depend on Analytics (Kong, Studio, Auth, Rest, Meta, Edge Functions, Supavisor, Realtime) fail to start because of `condition: service_healthy` in the Compose file.

### Diagnosis

```bash
docker logs supabase-analytics-<SERVICE_ID>
```

Output:
```
FATAL 3D000 (invalid_catalog_name) database "_supabase" does not exist
Kernel pid terminated (application_controller) ({application_start_failure,logflare,...})
```

The Analytics service (Logflare) connects to a dedicated database called `_supabase` with a schema `_analytics`. Neither exists because the init script `97-_supabase.sql` was never executed.

### Fix

```bash
# Find the SQL file Coolify prepared but never ran
find /data/coolify/services -name "_supabase.sql" 2>/dev/null
# Example: /data/coolify/services/<SERVICE_ID>/volumes/db/_supabase.sql

# Execute it manually against Postgres
docker exec -i supabase-db-<SERVICE_ID> psql -U supabase_admin -d postgres \
  < /data/coolify/services/<SERVICE_ID>/volumes/db/_supabase.sql

# Create the analytics schema inside the new database
docker exec -i supabase-db-<SERVICE_ID> psql -U supabase_admin -d _supabase \
  -c "CREATE SCHEMA IF NOT EXISTS _analytics;"

# Restart Analytics
docker restart supabase-analytics-<SERVICE_ID>
```

### Verification

```bash
docker logs --tail 10 supabase-analytics-<SERVICE_ID>
```

Expected output — no errors, just normal log lines:
```
[info] All logs logged!
[info] Logs last second!
```

---

## Problem 2: Remaining Init Scripts Never Executed

### Symptom

After fixing Analytics, other containers start but many are in `Restarting` state. Auth, Rest, Storage, Supavisor all fail with various database-related errors because their required schemas and roles don't exist.

### Diagnosis

The `docker-entrypoint-initdb.d/` directory contained 6 additional SQL files that were also never executed:

| File | Creates |
|---|---|
| `roles.sql` | Database roles (`supabase_auth_admin`, `authenticator`, `supabase_storage_admin`, etc.) |
| `jwt.sql` | JWT-related database settings |
| `webhooks.sql` | Webhook infrastructure in the `supabase_functions` schema |
| `logs.sql` | Logging schema |
| `realtime.sql` | `_realtime` schema for the Realtime service |
| `pooler.sql` | `_supavisor` schema for connection pooling |

### Fix

```bash
cd /data/coolify/services/<SERVICE_ID>

for f in volumes/db/roles.sql volumes/db/jwt.sql volumes/db/webhooks.sql \
         volumes/db/logs.sql volumes/db/realtime.sql volumes/db/pooler.sql; do
  echo "=== Running $f ==="
  docker exec -i supabase-db-<SERVICE_ID> psql -U supabase_admin -d postgres < "$f" 2>&1 | tail -3
done
```

> **Note:** `roles.sql` may show an error about `supabase_functions_admin` not existing. This is expected — the webhooks script creates it. Running the scripts in this order still works because the critical roles are created first.

---

## Problem 3: Auth and Rest Fail with Password Authentication Errors

### Symptom

```
failed SASL auth (FATAL: password authentication failed for user "supabase_auth_admin" (SQLSTATE 28P01))
```
```
FATAL: password authentication failed for user "authenticator"
```

### Diagnosis

The `roles.sql` script creates roles and sets their passwords using environment variable substitution (`:'PGPASSWORD'`). When executed manually via `docker exec ... < roles.sql`, the shell variables aren't available inside the Postgres session, so roles are created **without passwords** or with literal string `'$PGPASSWORD'`.

### Fix

Get the password from Coolify's generated `.env` file and set it on all roles:

```bash
# Get the password
grep SERVICE_PASSWORD_POSTGRES /data/coolify/services/<SERVICE_ID>/.env
# Example output: SERVICE_PASSWORD_POSTGRES=bKCp56CFVNvr8uOE95GPxWIqZD3imt58

# Set passwords (replace YOUR_PASSWORD with the actual value)
docker exec -i supabase-db-<SERVICE_ID> psql -U supabase_admin -d postgres <<'EOF'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN PASSWORD 'YOUR_PASSWORD';
  ELSE
    ALTER ROLE supabase_auth_admin WITH PASSWORD 'YOUR_PASSWORD';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN PASSWORD 'YOUR_PASSWORD';
  ELSE
    ALTER ROLE authenticator WITH PASSWORD 'YOUR_PASSWORD';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin LOGIN PASSWORD 'YOUR_PASSWORD';
  ELSE
    ALTER ROLE supabase_storage_admin WITH PASSWORD 'YOUR_PASSWORD';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN
    CREATE ROLE supabase_functions_admin LOGIN PASSWORD 'YOUR_PASSWORD';
  ELSE
    ALTER ROLE supabase_functions_admin WITH PASSWORD 'YOUR_PASSWORD';
  END IF;
END
$$;
ALTER ROLE supabase_admin WITH PASSWORD 'YOUR_PASSWORD';
EOF
```

---

## Problem 4: Auth Fails with "must be owner of function" Errors

### Symptom

First occurrence:
```
ERROR: must be owner of function uid (SQLSTATE 42501)
```

After partial fix:
```
ERROR: must be owner of function email (SQLSTATE 42501)
```

### Diagnosis

GoTrue (the Auth service) runs database migrations on startup. These migrations include `CREATE OR REPLACE FUNCTION` statements for `auth.uid()`, `auth.role()`, `auth.email()`, etc. In PostgreSQL, only the owner of a function can replace it. The functions were created by `supabase_admin` during the initial Postgres setup, but GoTrue connects as `supabase_auth_admin` — a different role that doesn't own these functions.

This is a cascading effect: the init scripts were supposed to create the `auth` schema with `supabase_auth_admin` as owner from the start, but since they never ran, the schema was bootstrapped by the Postgres image's built-in setup under a different owner.

### Fix

Transfer ownership of the entire `auth` schema and **all** its functions to `supabase_auth_admin`:

```bash
docker exec -i supabase-db-<SERVICE_ID> psql -U supabase_admin -d postgres <<'EOF'
-- Transfer schema ownership
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;

-- Transfer ownership of ALL functions in auth schema
DO $$
DECLARE
  func record;
BEGIN
  FOR func IN
    SELECT routine_name, routine_schema
    FROM information_schema.routines
    WHERE routine_schema = 'auth'
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I OWNER TO supabase_auth_admin',
                   func.routine_schema, func.routine_name);
  END LOOP;
END
$$;
EOF
```

> **Important:** Don't just fix `uid()` and `role()` individually — there are more functions (`email()`, etc.) that GoTrue's later migrations also need to replace. The loop approach catches all of them in one shot.

### Verification

```bash
docker restart supabase-auth-<SERVICE_ID>
sleep 10 && docker logs --tail 5 supabase-auth-<SERVICE_ID>
```

Expected:
```
"count":47,"level":"info","msg":"GoTrue migrations applied successfully"
"level":"info","msg":"GoTrue API started on: 0.0.0.0:9999"
```

---

## Problem 5: Kong Crashes with "failed parsing declarative configuration"

### Symptom

```
failed parsing declarative configuration: expected an object
cat: can't open '/home/kong/temp.yml': Permission denied
```

### Diagnosis

Kong's entrypoint runs a shell command that reads `~/temp.yml` (bind-mounted from `./volumes/api/kong.yml`), performs environment variable substitution, and writes the result to `~/kong.yml`. Inside the container, Kong runs as a non-root user. The bind-mounted file had permissions `-rwxr-x---` (750), which means only the file owner and group can read it — the Kong user inside the container is neither.

Because Kong can't read the template, the substitution produces an empty file, and Kong fails to parse it.

### Fix

```bash
chmod 644 /data/coolify/services/<SERVICE_ID>/volumes/api/kong.yml
docker restart supabase-kong-<SERVICE_ID>
```

### Verification

```bash
docker logs --tail 5 supabase-kong-<SERVICE_ID>
```

Expected:
```
[kong] init.lua:426 declarative config loaded from /home/kong/kong.yml
```

---

## Problem 6: Edge Functions Crash with "Is a directory"

### Symptom

```
Caused by:
    0: worker boot error
    1: failed to create the graph
    2: Is a directory (os error 21)
```

### Diagnosis

The Compose file bind-mounts specific TypeScript files:

```yaml
source: ./volumes/functions/main/index.ts
target: /home/deno/functions/main/index.ts
```

When Docker Compose processes a bind-mount and the source path doesn't exist, it creates a **directory** with that name instead of failing. Coolify's template expects these files to exist, but they weren't created during deployment. Result: `index.ts` is a directory, not a file, and the Deno runtime crashes.

### Fix

```bash
# Verify the problem
ls -la /data/coolify/services/<SERVICE_ID>/volumes/functions/main/index.ts
# Shows: drwxr-x--- (it's a directory!)

# Remove the directories
rm -rf /data/coolify/services/<SERVICE_ID>/volumes/functions/main/index.ts
rm -rf /data/coolify/services/<SERVICE_ID>/volumes/functions/hello/index.ts

# Create actual files
cat > /data/coolify/services/<SERVICE_ID>/volumes/functions/main/index.ts << 'TSEOF'
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
serve(async (req) => {
  const { pathname } = new URL(req.url);
  const service_name = pathname.split("/").filter(Boolean)[0];
  const servicePath = `/home/deno/functions/${service_name}`;
  const { default: handler } = await import(`${servicePath}/index.ts`);
  return handler(req);
});
TSEOF

cat > /data/coolify/services/<SERVICE_ID>/volumes/functions/hello/index.ts << 'TSEOF'
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
serve(async (_req) => {
  return new Response(
    JSON.stringify({ message: "Hello from Supabase Edge Functions!" }),
    { headers: { "Content-Type": "application/json" } }
  );
});
TSEOF

docker restart supabase-edge-functions-<SERVICE_ID>
```

---

## Complete Fix Order

If you encounter these issues on a fresh Coolify Supabase deployment, execute the fixes in this order:

| Step | Fixes Problem | Unblocks |
|---|---|---|
| 1. Create `_supabase` DB | Analytics can't connect | Analytics → everything downstream |
| 2. Create `_analytics` schema | Analytics migration fails | Analytics health check |
| 3. Run remaining init SQL scripts | Missing schemas and roles | Auth, Rest, Storage, Realtime, Supavisor |
| 4. Set role passwords | Auth/Rest can't authenticate | Auth, Rest, Storage |
| 5. Fix auth schema ownership | GoTrue migration fails | Auth |
| 6. Fix Kong file permissions | Kong can't read config | API gateway |
| 7. Fix Edge Functions bind-mounts | Deno crashes on directory | Edge Functions |
| 8. `docker compose up -d --force-recreate` | Restart all services | Full stack |

After completing all steps, verify with:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep supabase
```

All containers should show `(healthy)`.

---

## Prevention & Notes

- **This only affects the initial deployment.** Once the DB volume has all schemas and roles, subsequent Coolify redeploys work correctly.
- **Coolify does not expose container ports to the host by default.** Services are accessible via Coolify's built-in reverse proxy (`coolify-proxy`) on port 80. Point your Cloudflare Tunnel routes to `http://localhost:80` — the proxy routes by hostname.
- **If you need a completely fresh start:** `docker compose down -v` destroys all data and volumes. The next `docker compose up -d` will likely hit the same race condition — be prepared to repeat the fix steps.
- **Consider filing a bug with Coolify.** The fix would be to add a startup script or health-check gate that ensures all init scripts have run before declaring the DB container healthy.