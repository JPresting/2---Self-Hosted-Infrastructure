# RunPod Ollama Setup with Persistent Storage

A complete guide to setting up Ollama on RunPod with automatic model persistence and cost optimization.

## 🎯 Overview

This guide shows you how to:
- Set up Ollama on RunPod with automatic startup
- Create persistent storage for your models (survives pod restarts)
- Optimize costs by using network volumes
- Connect to Open WebUI for a ChatGPT-like interface

## 💰 Cost Structure

**Important**: Understanding RunPod's cost model:
- **GPU Time**: Only paid when pod is running (~$0.24-$2.00/hr depending on GPU)
- **Network Storage**: Fixed cost (~$2.80/month for 40GB) - **This runs 24/7**
- **Container Storage**: Temporary, lost when pod stops

**Storage Sizing Tip**: Be conservative with network storage size. You pay for it continuously, even when pods are stopped. 40GB is sufficient for 2-3 large models.

## 🚀 Step-by-Step Setup

### Step 1: Create Network Volume (Persistent Storage)

1. **Navigate to Storage** in RunPod Dashboard
2. **Click "New Network Volume"**
3. **Configure**:
   - **Name**: `ollama-models` (or your choice)
   - **Size**: `40GB` (adjust based on your needs)
   - **Datacenter**: Choose closest to you
4. **Click "Create Network Volume"**

**Why Network Volume?**
- Models persist when pods are stopped/restarted
- Can be shared between different pods
- Cheaper than disk volumes ($0.07/GB vs $0.10/GB)
- Only download models once

### Step 2: Create Custom Template

1. **Navigate to Templates** in RunPod Dashboard
2. **Click "Create New Template"**
3. **Configure Template**:

```yaml
Name: ollama-auto
Type: Pod
Compute: Nvidia GPU
Visibility: Private

Container Image: runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

Container Start Command:
/bin/bash -c "mkdir -p /workspace/ollama_models && export OLLAMA_MODELS=/workspace/ollama_models && export OLLAMA_HOST=0.0.0.0 && curl -fsSL https://ollama.com/install.sh | sh && ollama serve"

Container Disk: 5 GB
Volume Disk: 0 GB
Volume Mount Path: /workspace

HTTP Ports: 11434
```

4. **Click "Save Template"**

**Why Custom Template?**
- Automatic Ollama installation and startup
- Pre-configured environment variables
- No manual setup required after pod deployment
- Consistent deployments

### Step 3: Deploy Pod (Correct Order!)

**⚠️ Important**: Follow this exact order to avoid "volume must exist" errors:

1. **Go to Storage** → Find your `ollama-models` volume
2. **Click "Deploy"** on the storage volume
3. **You'll be redirected to pod creation with volume pre-selected**
4. **Select GPU**: Choose from available options (RunPod shows compatible GPUs)
5. **Select Template**: Choose your `ollama-auto` template
6. **Click "Deploy On-Demand"**

**Why This Order?**
- Network volumes must be attached during pod creation
- Cannot be attached to existing pods
- Starting from storage ensures proper volume mounting

### Step 4: Wait for Automatic Setup

**Pod will automatically**:
1. Start and pull the PyTorch image
2. Mount your network volume to `/workspace`
3. Create `/workspace/ollama_models` directory
4. Download and install Ollama
5. Configure Ollama to use persistent storage
6. Start Ollama server on port 11434

**Monitor Progress**: Check pod logs or wait for "Ready" status (2-3 minutes)

### Step 5: Install Models

**Connect to Web Terminal**:
1. **Pod → Connect → Start Web Terminal**
2. **Install your preferred models**:

```bash
# Install models (they'll persist in network storage)
ollama pull qwen2:7b-instruct-q4_K_M
ollama pull codellama:13b-instruct-q4_K_M
ollama pull llama3.1:70b-instruct

# Verify installation
ollama list
```

**Get your Pod URL**:
```bash
hostname
# Example output: h7xn1o16d5xocv
# Your Ollama API: https://h7xn1o16d5xocv-11434.proxy.runpod.net
```

### Step 6: Connect Open WebUI

**Update your Open WebUI instance**:
```bash
sudo docker stop openwebui
sudo docker rm openwebui

sudo docker run -d --name openwebui -p 3001:8080 \
  -e OLLAMA_BASE_URL='https://YOUR-POD-ID-11434.proxy.runpod.net' \
  -e ENABLE_SIGNUP='false' \
  -v /home/ubuntu/data:/app/backend/data \
  --restart unless-stopped \
  ghcr.io/open-webui/open-webui:main

# Multiple Ollama backends (local + cloud):
# -e OLLAMA_BASE_URL='http://localhost:11434;https://YOUR-POD-ID-11434.proxy.runpod.net' \
```

Replace `YOUR-POD-ID` with your actual pod ID from `hostname` command.

**Multiple Backends**: Separate URLs with semicolon (`;`) to access both local and cloud models simultaneously.

## 🔄 Model Performance & VRAM

**Model Loading**:
- **First chat**: 10-60 seconds (loads into VRAM)
- **Subsequent chats**: Instant (already in VRAM)
- **Auto-unload**: After 5 minutes of inactivity

**Keep Models in VRAM Longer**:
```bash
# In RunPod terminal
export OLLAMA_KEEP_ALIVE=1h
pkill ollama
ollama serve &
```

## 💡 Usage Tips

### Cost Optimization
- **Stop pods** when not in use (models persist in network storage)
- **Start pods** only when needed for inference
- **Size network storage** conservatively (it runs 24/7)

### Restart Workflow
1. **Stop Pod**: Models stay in network storage
2. **Start Pod**: Run your custom template
3. **Models available**: Automatically loaded from storage
4. **Update Open WebUI**: Use new pod ID

### Troubleshooting

**"Volume must exist" error**:
- Follow the exact deployment order: Storage → Deploy → GPU → Template

**Models not persisting**:
- Verify `OLLAMA_MODELS=/workspace/ollama_models`
- Check network volume is properly mounted

**Ollama not starting**:
- Check pod logs for installation progress
- Wait 2-3 minutes for automatic setup

## 📊 Example Costs

**Setup**: L40 GPU (44GB VRAM) + 40GB Network Storage
- **Storage**: $2.80/month (continuous)
- **GPU**: $1.20/hour (only when running)
- **Usage**: 2 hours/day = ~$72/month total

**Models that fit on L40**:
- Multiple 7B models (3-5GB each)
- Single 70B model (40-50GB)
- Mixed: 1x 70B + 2x 7B models

## 🎉 Success!

You now have:
- ✅ **Persistent Ollama** that survives pod restarts
- ✅ **Automatic startup** with custom template
- ✅ **Cost-optimized** storage solution
- ✅ **ChatGPT-like interface** via Open WebUI
- ✅ **Multiple models** ready for use

**Access your AI**: Open WebUI will show all installed models in the dropdown. Select any model and start chatting!

---

**Pro Tip**: Bookmark your RunPod pod URLs and Open WebUI for quick access. Models load into VRAM on first use and stay fast for subsequent conversations.