## Private Harbor Registry Behind Cloudflare Tunnel

If you have a Cloudflare Tunnel in front of a private Harbor registry, make sure the registry hostname resolves through the intended public path and reaches Harbor itself, not a different local reverse proxy. Otherwise, requests may be sent to the wrong listener, which can lead to errors such as `503 Service Unavailable`, default reverse-proxy certificates, or missing backend responses.


### Typical setup
```text
registry.example.com
→ Cloudflare
→ Cloudflare Tunnel
→ localhost:8888
→ Harbor
```

### What to verify

#### 1. Harbor public URL
Harbor should use the same public hostname that clients use for Docker login and pull operations.

Example:
```yaml
external_url: https://registry.example.com
```

#### 2. Local Harbor response
The Harbor service itself should respond locally on its internal listener.

```bash
curl -v -H 'Host: registry.example.com' http://127.0.0.1:8888/v2/
```

Expected result:
- `401 Unauthorized`
- `WWW-Authenticate` header pointing to `https://registry.example.com/service/token`

This is the expected Docker registry authentication flow.

#### 3. Public registry response
The public hostname should return the same authentication challenge.

```bash
curl -vk https://registry.example.com/v2/
curl -skI https://registry.example.com/v2/ | grep -i www-authenticate
```

Expected result:
- `401 Unauthorized`
- `WWW-Authenticate` header present

#### 4. Token endpoint
The token endpoint should respond successfully.

```bash
curl -vk -u 'admin:REDACTED_PASSWORD' \
  'https://registry.example.com/service/token?service=harbor-registry&scope=repository:example/image:pull'
```

Expected result:
- `200 OK`
- token returned in the response body

#### 5. Docker login and pull
After the checks above succeed, Docker login and pull should work normally.

```bash
sudo docker logout registry.example.com
sudo docker login registry.example.com
sudo docker pull registry.example.com/example/image:latest
```

### Important note about local hostname overrides
Avoid adding a temporary `/etc/hosts` override for the registry hostname unless the hostname, port, TLS endpoint, and listener are fully aligned.

A common failure pattern is:

```text
registry.example.com
→ /etc/hosts
→ 127.0.0.1
→ port 443
→ local reverse proxy
```

In that case Docker may reach a proxy service instead of Harbor, which can result in errors such as:
- `503 Service Unavailable`
- default proxy certificates
- missing backend errors

### Recommended approach
Use one consistent path for the registry hostname:

```text
registry.example.com
→ Cloudflare
→ Tunnel
→ Harbor
```

Do not mix:
- public tunnel routing
- local hostname overrides
- unrelated reverse proxy listeners

### Validation summary
A healthy private Harbor registry behind Cloudflare Tunnel usually looks like this:

- `/v2/` returns `401 Unauthorized`
- `WWW-Authenticate` header is present
- `/service/token` returns `200 OK`
- `docker login` succeeds
- `docker pull` starts downloading image layers

If all of these checks pass, the registry path is aligned correctly.

