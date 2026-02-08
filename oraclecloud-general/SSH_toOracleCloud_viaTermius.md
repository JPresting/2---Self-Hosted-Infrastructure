````md
# SSH to an Oracle Cloud Ubuntu VM via Termius (Windows)

## Key files
- Private key: `ssh-key-YYYY-MM-DD.key`
- Public key: `ssh-key-YYYY-MM-DD.key.pub`

## Verify key files (PowerShell)
```powershell
cd "C:\path\to\your\keys"
dir *ssh-key-*
````

## Test SSH from PowerShell

```powershell
ssh -i "C:\path\to\your\keys\ssh-key-YYYY-MM-DD.key" -o IdentitiesOnly=yes ubuntu@<VM_PUBLIC_IP>
```

## Termius setup

1. **Keychain → Keys → Import**

   * Import the private key: `ssh-key-YYYY-MM-DD.key`
2. **Hosts → New Host**

   * Address: `<VM_PUBLIC_IP>`
   * Port: `22`
   * Username: `ubuntu`
3. In the host settings, select the imported **Key/Identity**.
4. Connect.

## Notes

* Use the **private key** (NOT the `.pub` file) for connecting.
* Use **Key Export** only if you need to install the public key into `~/.ssh/authorized_keys` on a UNIX host.

```
::contentReference[oaicite:0]{index=0}
```
