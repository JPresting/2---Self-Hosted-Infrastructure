# AMD Vega 56 — Fan Control & Monitoring (Ubuntu 24.04 / amdgpu)

## Problem

The AMD Vega 56 (gfx900) has a firmware-level **Zero-RPM mode**: any PWM value below **100** (out of 255) results in fans being completely off — not slow, **off**. The default Linux `amdgpu` driver and tools like `amdgpu-fan` use **Edge temperature** for fan curves, but Edge can read 40°C lower than **Junction temperature** (the actual hotspot). This causes the GPU to hit 100°C+ Junction with fans barely spinning or completely off.

Additionally, `fan1_input` reports **phantom RPM values** (~3100 RPM) even when fans are physically stopped. Do not rely on this sensor alone — verify fan operation visually.

## Hardware Reference

| Property | Value |
|---|---|
| GPU | AMD Radeon RX Vega 56 (gfx900) |
| VRAM | 8176 MB HBM2 |
| hwmon path | `/sys/class/drm/card1/device/hwmon/hwmon2` |
| Fan start threshold | PWM 100 / 255 (~39%) |
| Max fan RPM | ~3843 RPM (PWM 255) |
| Junction throttle | ~105°C |

### PWM-to-RPM Map

```
PWM:  40 → RPM: 0 (fans off)
PWM:  60 → RPM: 0 (fans off)
PWM:  80 → RPM: 0 (fans off)
PWM: 100 → RPM: 1272
PWM: 120 → RPM: 1686
PWM: 140 → RPM: 2065
PWM: 160 → RPM: 2381
PWM: 180 → RPM: 2722
PWM: 200 → RPM: 2992
PWM: 220 → RPM: 3261
PWM: 255 → RPM: 3843
```

## Find Your PWM Threshold

Run this to discover where your fans actually start spinning:

```bash
echo 1 > /sys/class/drm/card1/device/hwmon/hwmon2/pwm1_enable

for pwm in 40 60 80 100 120 140 160 180 200 220 255; do
    echo $pwm > /sys/class/drm/card1/device/hwmon/hwmon2/pwm1
    sleep 3
    RPM=$(cat /sys/class/drm/card1/device/hwmon/hwmon2/fan1_input)
    echo "PWM: $pwm → RPM: $RPM"
done
```

Look for the first non-zero RPM value. That's your minimum PWM.

## Ollama with Vulkan (Docker Compose)

The Vega 56 (gfx900) cannot use ROCm reliably — the KFD/SDMA driver causes kernel panics. Use the **Vulkan backend** instead, which bypasses `/dev/kfd` entirely and uses Mesa's RADV driver via `/dev/dri`.

```yaml
services:
  ollama-api:
    image: 'ollama/ollama:latest'
    restart: always
    devices:
      - '/dev/dri:/dev/dri'
    volumes:
      - 'ollama-data:/root/.ollama'
    environment:
      - OLLAMA_HOST=0.0.0.0
      - 'OLLAMA_ORIGINS=*'
      - OLLAMA_VULKAN=1
      - OLLAMA_DEBUG=1
      - OLLAMA_KEEP_ALIVE=5m
      - OLLAMA_FLASH_ATTENTION=1
      - OLLAMA_MAX_LOADED_MODELS=1
    expose:
      - '11434'
  open-webui:
    image: 'ghcr.io/open-webui/open-webui:main'
    restart: always
    volumes:
      - 'open-webui-data:/app/backend/data'
    depends_on:
      - ollama-api
    environment:
      - 'OLLAMA_BASE_URL=http://ollama-api:11434'
    expose:
      - '8080'
volumes:
  ollama-data: null
  open-webui-data: null
```

### Key Configuration

| Variable | Value | Why |
|---|---|---|
| `devices` | `/dev/dri:/dev/dri` | Vulkan render nodes only. Do **NOT** mount `/dev/kfd` — this triggers the SDMA kernel panic. |
| `OLLAMA_VULKAN` | `1` | Enables experimental Vulkan backend (Ollama v0.12.6+). |
| `OLLAMA_KEEP_ALIVE` | `5m` | Keep model in VRAM for 5 minutes. Must include unit (`m`). Without it, `5` = 5 seconds → constant reload → garbage output. |
| `OLLAMA_FLASH_ATTENTION` | `1` | Reduces VRAM usage for KV cache. |
| `OLLAMA_MAX_LOADED_MODELS` | `1` | 8GB VRAM fits one model at a time. |
| `expose` | `11434` / `8080` | Internal ports. Map via reverse proxy (Coolify, Cloudflare Tunnel, etc.). |

### Recommended Models (8GB VRAM)

| Model | VRAM | Command |
|---|---|---|
| `llama3.1:8b` | ~5.1 GB | `ollama pull llama3.1:8b` |
| `qwen3:8b` | ~5.2 GB | `ollama pull qwen3:8b` |
| `gemma2:9b` | ~6.0 GB | `ollama pull gemma2:9b` |
| `mistral:7b` | ~4.5 GB | `ollama pull mistral:7b` |
| `phi4-mini` | ~3.8 GB | `ollama pull phi4-mini` |

Do **not** use models ≥12B at Q4_K_M — they exceed 8GB VRAM and spill to CPU, causing Vulkan instability.

### Verify Vulkan is Active

```bash
docker logs <container> 2>&1 | grep -i vulkan
```

Expected output:
```
runner.inference="[{ID:00000000-0b00-0000-0000-000000000000 Library:Vulkan}]"
```

## Fan Control Script (Junction Temperature)

### Install

Create the script:

```bash
cat > /usr/local/bin/junction-fan.sh << 'SCRIPT'
#!/bin/bash
HWMON=/sys/class/drm/card1/device/hwmon/hwmon2
echo 1 > $HWMON/pwm1_enable
while true; do
    JUNC=$(( $(cat $HWMON/temp2_input) / 1000 ))
    if   [ $JUNC -ge 100 ]; then PWM=255   # 100% → ~3843 RPM
    elif [ $JUNC -ge 90 ];  then PWM=220   # 86%  → ~3261 RPM
    elif [ $JUNC -ge 80 ];  then PWM=180   # 70%  → ~2722 RPM
    elif [ $JUNC -ge 70 ];  then PWM=140   # 55%  → ~2065 RPM
    elif [ $JUNC -ge 60 ];  then PWM=120   # 47%  → ~1686 RPM
    else                          PWM=100   # 39%  → ~1272 RPM (minimum)
    fi
    echo $PWM > $HWMON/pwm1
    sleep 2
done
SCRIPT

chmod +x /usr/local/bin/junction-fan.sh
```

Create the systemd service:

```bash
cat > /etc/systemd/system/junction-fan.service << 'EOF'
[Unit]
Description=GPU Fan Control (Junction Temp)
After=multi-user.target

[Service]
ExecStart=/usr/local/bin/junction-fan.sh
ExecStopPost=/bin/bash -c 'echo 2 > /sys/class/drm/card1/device/hwmon/hwmon2/pwm1_enable'
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable --now junction-fan
```

On service stop or crash, `ExecStopPost` restores the GPU to automatic fan mode (`pwm1_enable = 2`).

### Verify

```bash
systemctl status junction-fan
cat /sys/class/drm/card1/device/hwmon/hwmon2/pwm1
cat /sys/class/drm/card1/device/hwmon/hwmon2/fan1_input
```

Visually confirm the fans are spinning.

## GPU Monitoring

Live monitoring (updates every 2 seconds):

```bash
watch -n 2 bash -c '
HWMON=/sys/class/drm/card1/device/hwmon/hwmon2
echo "=== GPU (Vega 56) ==="
echo "---"
cat $HWMON/temp1_input | awk "{printf \"Edge:     %.0f°C\n\", \$1/1000}"
cat $HWMON/temp2_input | awk "{printf \"Junction: %.0f°C\n\", \$1/1000}"
cat $HWMON/temp3_input | awk "{printf \"Mem:      %.0f°C\n\", \$1/1000}"
echo "---"
cat $HWMON/fan1_input | xargs -I{} echo "Fan:  {} RPM"
cat $HWMON/pwm1 | awk "{printf \"PWM:  %d/255 (%.0f%%)\n\", \$1, \$1/255*100}"
echo "---"
cat $HWMON/power1_input 2>/dev/null | awk "{printf \"Power: %.0fW\n\", \$1/1000000}" || echo "Power: N/A"
cat $HWMON/in0_input 2>/dev/null | awk "{printf \"Voltage: %dmV\n\", \$1}"
echo ""
echo "=== CPU ==="
sensors k10temp-pci-00c3 2>/dev/null | grep -E "Tctl|Tdie"
echo "---"
free -h | grep Mem | awk "{printf \"RAM: %s used / %s total\n\", \$3, \$2}"
uptime | awk -F"load average:" "{printf \"Load: %s\n\", \$2}"
'
```

## Sensor Paths Reference

| Sensor | Path | Description |
|---|---|---|
| Edge temp | `temp1_input` | PCB surface temperature |
| Junction temp | `temp2_input` | Hotspot / die temperature |
| Memory temp | `temp3_input` | HBM2 temperature |
| Fan RPM | `fan1_input` | Reported RPM (unreliable at low PWM) |
| Fan PWM | `pwm1` | 0-255, fans start at 100 |
| Fan mode | `pwm1_enable` | 1 = manual, 2 = auto |
| Power | `power1_input` | Microwatts |
| Voltage | `in0_input` | GPU core voltage (mV) |

## Notes

- All commands require **root**. Use `sudo -i` first.
- `sudo echo X > sysfs_file` does **not** work because the redirect runs as the unprivileged user. Always switch to root first.
- The `fan1_input` sensor reports ~3100 RPM even when fans are physically off. This is a known Vega firmware bug in manual PWM mode. Only trust RPM readings when PWM ≥ 100.
- `amdgpu-fan` (chestm007) only supports Edge temperature — not Junction. Do not use it for Vega cards with large Edge/Junction deltas.
- The hwmon number (`hwmon2`) can change after reboot. For a robust setup, resolve the path dynamically:

```bash
HWMON=$(ls -d /sys/class/drm/card1/device/hwmon/hwmon*)
```