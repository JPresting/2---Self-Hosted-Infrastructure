# RunPod Ollama Setup with Persistent Storage

A complete guide to setting up Ollama on RunPod with automatic model persistence and cost optimization.

## 🎯 Overview

This guide shows you how to:
- Set up Ollama on RunPod with automatic startup
- Create persistent storage for your models (survives pod restarts)
- Optimize costs by using network volumes
- Connect to Open WebUI for a ChatGPT-like interface

## 💰 Cost Structure & Storage Types

**Important**: Understanding RunPod's cost model and storage options:

### Network Storage vs Volume Storage

#### 📡 Network Storage
**Pros:**
- **Lower cost**: ~$0.07/GB per month
- **Multi-GPU access**: Can be attached to different GPU types
- **Shared across pods**: Use the same storage with multiple configurations

**Cons:**
- **Pod must be terminated** (not stopped) - URL changes every time
- **URL management**: Must update OpenWebUI `OLLAMA_BASE_URL` with new pod ID each deployment
- **Less convenient**: No persistent pod URLs

**Cost Example**: 40GB = $2.80/month

#### 💾 Volume Storage  
**Pros:**
- **Pod can be stopped/started**: Same URL maintained
- **Convenient**: No need to update OpenWebUI configuration
- **Persistent URLs**: Better for consistent access

**Cons:**
- **Higher cost**: ~$0.10/GB per month  
- **GPU-bound**: Tied to specific GPU type
- **More expensive when stopped**: Still costs more than network storage

**Cost Example**: 40GB = $4.00/month

### 🤔 Which Storage Should You Choose?

**For Individual Use:**
- **Network Storage** = More cost-effective but requires URL updates
- **Volume Storage** = More convenient but significantly more expensive
- **Recommendation**: Consider if RunPod is cost-effective for solo OpenWebUI use

**For Teams/Service Providers:**
- **Volume Storage** recommended for consistent URLs and team access
- Higher costs justified by multiple users and service reliability

**⚠️ Important Consideration**: RunPod may not be the most cost-effective solution for individual OpenWebUI usage due to the URL management overhead (network storage) or higher costs (volume storage). It's better suited for teams or service providers where costs can be distributed.

## 🚀 Step-by-Step Setup

### Step 1: Create Persistent Storage

#### Option A: Network Volume (Cost-Effective)

1. **Navigate to Storage** in RunPod Dashboard
2. **Click "New Network Volume"**
3. **Configure**:
   - **Name**: `ollama-models`
   - **Size**: `40GB` 
   - **Datacenter**: Choose closest to you
4. **Click "Create Network Volume"**

#### Option B: Volume Storage (Convenient)

1. **During pod creation**, set **Volume Disk** to desired size
2. **Volume Mount Path**: `/workspace`
3. Pod can be stopped/started maintaining same URL

### Step 2: Create Custom Template

1. **Navigate to Templates** in RunPod Dashboard
2. **Click "Create New Template"**
3. **Configure Template**:

```yaml
Name: ollama-auto
Type: Pod
Compute: Nvidia GPU
Visibility: Private

Container Image: runpod/pytorch:2.2.0-py3.11-cuda12.4.1-devel-ubuntu22.04

Container Start Command:
/bin/bash -c "mkdir -p /workspace/ollama_models && export OLLAMA_MODELS=/workspace/ollama_models && export OLLAMA_HOST=0.0.0.0 && curl -fsSL https://ollama.com/install.sh | sh && ollama serve"

Container Disk: 5 GB
Volume Disk: 0 GB (for network storage) OR 40 GB (for volume storage)
Volume Mount Path: /workspace

HTTP Ports: 11434
```

4. **Click "Save Template"**

### Step 3: Deploy Pod

#### For Network Storage:
1. **Go to Storage** → Find your network volume
2. **Click "Deploy"** on the storage volume
3. **Select GPU and Template**
4. **Deploy** - **Remember: Must terminate (not stop) when done**

#### For Volume Storage:
1. **Go to Pods** → **Deploy**
2. **Select GPU, Template, and configure volume size**
3. **Deploy** - **Can stop/start as needed**

### Step 4: Wait for Automatic Setup

**Pod will automatically**:
1. Start and pull the PyTorch image
2. Mount your storage to `/workspace`
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
# Install models (they'll persist in storage)
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

#### For Volume Storage (Easy):
```bash
sudo docker stop openwebui
sudo docker rm openwebui

sudo docker run -d --name openwebui -p 3001:8080 \
  -e OLLAMA_BASE_URL='https://YOUR-POD-ID-11434.proxy.runpod.net' \
  -e ENABLE_SIGNUP='false' \
  -v /home/ubuntu/data:/app/backend/data \
  --restart unless-stopped \
  ghcr.io/open-webui/open-webui:main
```

#### For Network Storage (Requires URL Updates):
- **Must update `OLLAMA_BASE_URL`** with new pod ID after each deployment
- **Get new pod ID** with `hostname` command each time
- **Less convenient** but more cost-effective

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

## 💡 Usage Tips & Workflows

### Network Storage Workflow
1. **Terminate pod** when done (don't stop)
2. **Deploy new pod** when needed
3. **Update OpenWebUI** with new pod URL
4. **Models persist** automatically

### Volume Storage Workflow  
1. **Stop pod** when done
2. **Start same pod** when needed
3. **Same URL** - no OpenWebUI updates needed
4. **Models persist** automatically

### Cost Optimization
- **Network Storage**: Lower monthly cost, higher management overhead
- **Volume Storage**: Higher monthly cost, lower management overhead
- **Size storage conservatively**: You pay continuously
- **Consider alternatives**: Local setup might be more cost-effective for individual use

### Troubleshooting

**"Volume must exist" error**:
- Follow the exact deployment order for network storage

**Models not persisting**:
- Verify `OLLAMA_MODELS=/workspace/ollama_models`
- Check storage is properly mounted

**URL changes**:
- **Network storage**: Expected behavior, update OpenWebUI
- **Volume storage**: Should persist, check if pod was stopped vs terminated

## 📊 Example Costs (L40 GPU + 40GB Storage)

### Network Storage Option
- **Storage**: $2.80/month (continuous)
- **GPU**: $1.20/hour (only when running)
- **Usage**: 2 hours/day = ~$74.80/month total
- **Trade-off**: Lower cost, URL management required

### Volume Storage Option  
- **Storage**: $4.00/month (continuous)
- **GPU**: $1.20/hour (only when running)
- **Usage**: 2 hours/day = ~$76.00/month total
- **Trade-off**: Higher cost, convenient URLs

## ⚠️ Cost-Effectiveness Warning

**For Individual Users**: RunPod may not be the most cost-effective solution for personal OpenWebUI usage:
- **Network Storage**: Cheaper but requires constant URL management
- **Volume Storage**: Convenient but expensive for solo use
- **Alternative**: Consider local GPU setup or other cloud providers

**For Teams/Services**: RunPod makes more sense when:
- Costs are shared across multiple users
- Service reliability justifies the expense
- Professional/commercial usage

## 🎉 Success!

You now have:
- ✅ **Persistent Ollama** that survives pod restarts
- ✅ **Automatic startup** with custom template
- ✅ **Storage solution** matched to your needs
- ✅ **ChatGPT-like interface** via Open WebUI (with caveats)
- ✅ **Multiple models** ready for use

**Access your AI**: Open WebUI will show all installed models in the dropdown. Select any model and start chatting!

---

**Pro Tip**: Evaluate your usage patterns and costs carefully. For occasional personal use, a local setup might be more economical than cloud solutions.


**Need a more advanced deployment, integration, or enterprise automation?** Visit [Stardawnai.com](https://stardawnai.com) for professional consulting and development on AI-driven process automation, SAP integration, self-hosted enterprise N8N workflows, and custom hybrid infrastructure solutions tailored to your business needs.