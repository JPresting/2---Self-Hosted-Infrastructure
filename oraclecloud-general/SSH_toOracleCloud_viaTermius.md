# SSH to an Oracle Cloud Ubuntu VM via Termius (Windows)

## Key files
- Private key: `ssh-key-YYYY-MM-DD.key`
- Public key: `ssh-key-YYYY-MM-DD.key.pub`

## Verify key files (PowerShell)
```powershell
cd "C:\path\to\your\keys"
dir *ssh-key-*
```

## Test SSH from PowerShell
```powershell
ssh -i "C:\path\to\your\keys\ssh-key-YYYY-MM-DD.key" -o IdentitiesOnly=yes ubuntu@<VM_PUBLIC_IP>
```

## Termius setup

### Option A: Key + Host in one step (recommended)
1. **Keychain → Keys → Import from key file**
   - Import the private key: `ssh-key-YYYY-MM-DD.key` (NOT the `.pub` file)
2. On the imported key, click **Export to host**
3. In **Export to** field: type a new host name (e.g. `oracle jbpcapitalde`)
   - This creates a new host on the fly
   - Location: `.ssh` / Filename: `authorized_keys` → leave as is
4. Click **Export and Attach**
   - This creates the host AND assigns the key in one step

### Option B: Separate steps
1. **Keychain → Keys → Import from key file** → import private key
2. **Hosts → New Host**
   - Address: `<VM_PUBLIC_IP>`
   - Port: `22`
   - Username: `ubuntu`
3. In host settings, select the imported key under **SSH Key**
4. Connect

## Notes
- Always use the **private key** (file without `.pub`)
- Oracle Cloud VMs use username `ubuntu`, not `root`
- Option A and B achieve the same result — Option A is faster