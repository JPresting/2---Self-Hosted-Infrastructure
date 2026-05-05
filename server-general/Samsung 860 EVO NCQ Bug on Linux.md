# Samsung 860 EVO/QVO NCQ Bug on Linux

## Problem

Samsung 860/870 SATA SSDs have a known firmware bug with Linux NCQ (Native Command Queuing) and queued TRIM commands. Under server workloads (Docker, multiple containers, frequent small I/O operations), the SSD firmware can freeze for >30 seconds, causing the Linux kernel to reset the SATA bus and freezing the entire system.

The bug is especially likely to trigger on QLC drives (e.g. 860 QVO) under sustained mixed I/O. SMART reports the disk as healthy throughout — this is a firmware/protocol-level issue, not a hardware defect.

## Symptoms

- Random server freezes, often during nightly cron jobs (Docker auto-updates, backups, log rotation)
- SSH / Docker / web services completely unresponsive while CPU/RAM appear idle
- After hard reset, no graceful-shutdown markers in journald — last log line is a normal cron entry, then silence until next boot
- `dmesg` after the next boot shows entries like:

```
ataN.00: exception Emask 0x0 SAct 0xffffffff SErr 0x0 action 0x6 frozen
ataN.00: failed command: READ FPDMA QUEUED
ataN.00: status: { DRDY }
Emask 0x4 (timeout)
```

- `SAct 0xffffffff` = all 32 NCQ queue slots stuck simultaneously
- `Emask 0x4 (timeout)` = SSD did not respond within 30s
- `SErr 0x0` = no SATA link error (rules out cable/port issues)
- SMART output: `SMART overall-health self-assessment test result: PASSED`
- `POR_Recovery_Count` slowly increasing — each value represents one unclean power-off / freeze event

## Affected Hardware

- Samsung SSD 860 EVO, 860 QVO, 870 EVO, 870 QVO (all SATA models)
- Most commonly reported with AMD FCH / ASMedia SATA controllers, but also occurs on Intel chipsets
- Bug exists across multiple firmware versions; Samsung has not released a complete fix

## References

- Linux Kernel Bugzilla: [#201693](https://bugzilla.kernel.org/show_bug.cgi?id=201693), [#203475](https://bugzilla.kernel.org/show_bug.cgi?id=203475)
- ArchWiki: [Solid state drive — NCQ](https://wiki.archlinux.org/title/Solid_state_drive#NCQ)
- Phoronix: *Samsung 860/870 SSDs still have trouble with Queued TRIM on Linux*
- Linux source: `ATA_QUIRK_NO_NCQ_TRIM` entries in `drivers/ata/libata-core.c`

## Fix — Kernel Boot Parameter

Edit GRUB config:

```bash
sudo nano /etc/default/grub
```

Change:

```
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"
```

to:

```
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash libata.force=noncq,noncqtrim"
```

Apply and reboot:

```bash
sudo update-grub
sudo reboot
```

### What this does

- `noncq` — disables Native Command Queuing entirely. Commands are sent serially instead of in a 32-deep queue. This bypasses the firmware bug since there's no queue to mismanage.
- `noncqtrim` — disables queued TRIM specifically. Prevents the data corruption variant of the bug.

## Backup Safety Net — SATA Timeout

Even with NCQ disabled, raising the per-disk timeout from default 30s to 180s gives the SSD more headroom for internal operations (garbage collection, SLC cache flushes on QLC) without triggering bus resets:

```bash
sudo tee /etc/udev/rules.d/60-sda-timeout.rules > /dev/null <<'EOF'
ACTION=="add|change", KERNEL=="sda", ATTR{device/timeout}="180"
EOF

sudo udevadm control --reload-rules
```

This persists across reboots via udev.

## Verification After Reboot

```bash
# Kernel parameter active?
cat /proc/cmdline
# Must contain: libata.force=noncq,noncqtrim

# Timeout applied?
cat /sys/block/sda/device/timeout
# Must be: 180

# NCQ actually disabled?
sudo apt install -y hdparm
sudo hdparm -I /dev/sda | grep -i "queue depth\|ncq"
# NCQ should be missing or shown as not in use

# Monitor for new ATA errors over time
sudo journalctl -k --since "1 hour ago" | grep -c "FPDMA QUEUED"
# Should stay at 0
```

## Performance Impact

Minimal in practice (<5%) for typical server workloads (Docker, databases, web services). Multiple production reports on Proxmox, Arch, ODROID forums confirm "no noticeable impact on I/O performance" after applying the fix.

The trade-off (slightly lower theoretical max IOPS vs. eliminating random freezes) is overwhelmingly worth it for any non-desktop use case.

## Long-Term Recommendation

QLC SSDs are not designed for sustained server I/O patterns — the small SLC cache and slow QLC backing storage produce latency spikes that exacerbate this NCQ bug.

For replacement, prefer:

- **TLC SATA**: Samsung 870 EVO, Crucial MX500, WD Red SA500
- **TLC NVMe**: Samsung 990 Pro, WD Red SN700, Crucial T500
- **Avoid**: any SSD with QVO, QLC, or "value" branding for server use

## Related Issues That Look Similar But Aren't This Bug

- **CRC errors > 0 in SMART** → SATA cable problem, not this bug. Replace cable.
- **Reallocated_Sector_Ct increasing** → SSD actually failing. Replace disk.
- **Errors only during heavy writes that fill the SLC cache** → QLC cache exhaustion, not NCQ bug. Different symptom (slow writes, not freezes).
- **Errors with `SErr` non-zero** → SATA link/electrical problem, not this bug.
