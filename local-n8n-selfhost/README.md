# 💎N8N Local Installation with Auto-Start on Windows💎

A comprehensive guide to install n8n locally using Docker with automatic startup functionality and quick-restart options.

## Prerequisites

Before beginning the installation process, ensure you have Docker Desktop installed on your Windows system. Docker Desktop provides the containerization environment necessary to run n8n in an isolated and consistent manner.

**Install Docker Desktop:**
- Download from [docker.com](https://docker.com)
- Run the installer with administrator privileges
- Restart your computer when prompted
- Verify installation by opening PowerShell and running `docker --version`

## Project Structure

This setup creates the following directory structure on your system:

```
C:\Users\[USERNAME]\Documents\
├── n8n-local\                          # N8N data persistence directory
└── Quick-Start\                        # Manual restart shortcuts

C:\Users\[USERNAME]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\
└── n8n-startup.bat                     # Auto-start script
```

## 📍Step 1: Create N8N Data Directory

The first step involves creating a dedicated directory where n8n will store all its data, including workflows, credentials, and configuration files. This approach ensures data persistence across container restarts and updates.

```cmd
mkdir C:\Users\[USERNAME]\Documents\n8n-local
```

Replace `[USERNAME]` with your actual Windows username throughout this guide.

## 📍Step 2: Install N8N with Docker

Execute the following Docker command to create and start your n8n container. This command includes comprehensive environment variables that optimize n8n for local development work.

**For Command Prompt (cmd):**
```cmd
docker run -d --name n8n-local --restart unless-stopped -p 5678:5678 -e N8N_HOST="localhost" -e WEBHOOK_URL="http://localhost:5678" -e WEBHOOK_TUNNEL_URL="http://localhost:5678" -e N8N_ENABLE_RAW_EXECUTION="true" -e NODE_FUNCTION_ALLOW_BUILTIN="crypto,fs,path" -e NODE_FUNCTION_ALLOW_EXTERNAL="" -e N8N_PUSH_BACKEND="websocket" -e N8N_DEFAULT_BINARY_DATA_MODE="filesystem" -e GENERIC_TIMEZONE="Europe/Berlin" -e TZ="Europe/Berlin" -e N8N_METRICS="true" -e N8N_LOG_LEVEL="info" -e N8N_LOG_OUTPUT="console,file" -v "C:\Users\[USERNAME]\Documents\n8n-local:/home/node/.n8n" n8nio/n8n
```

**For PowerShell:**
```powershell
docker run -d `
  --name n8n-local `
  --restart unless-stopped `
  -p 5678:5678 `
  -e N8N_HOST="localhost" `
  -e WEBHOOK_URL="http://localhost:5678" `
  -e WEBHOOK_TUNNEL_URL="http://localhost:5678" `
  -e N8N_ENABLE_RAW_EXECUTION="true" `
  -e NODE_FUNCTION_ALLOW_BUILTIN="crypto,fs,path" `
  -e NODE_FUNCTION_ALLOW_EXTERNAL="pdf-lib"
  -e N8N_PUSH_BACKEND="websocket" `
  -e N8N_DEFAULT_BINARY_DATA_MODE="filesystem" `
  -e GENERIC_TIMEZONE="Europe/Berlin" `
  -e TZ="Europe/Berlin" `
  -e N8N_METRICS="true" `
  -e N8N_LOG_LEVEL="info" `
  -e N8N_LOG_OUTPUT="console,file" `
  -v "C:\Users\[USERNAME]\Documents\n8n-local:/home/node/.n8n" `
  n8nio/n8n
```

### Environment Variables Explanation

The environment variables included in this setup serve specific purposes that enhance the n8n experience for local development:

**Basic Configuration:**
- `N8N_HOST="localhost"` sets the host for local access
- `WEBHOOK_URL` and `WEBHOOK_TUNNEL_URL` configure webhook endpoints for testing

**Advanced Features:**
- `N8N_ENABLE_RAW_EXECUTION="true"` enables advanced code execution capabilities
- `NODE_FUNCTION_ALLOW_BUILTIN="crypto,fs,path"` permits access to essential Node.js modules
- `N8N_PUSH_BACKEND="websocket"` improves real-time updates in the interface
- `NODE_FUNCTION_ALLOW_EXTERNAL="pdf-lib"` # External JavaScript Libraries
**Data Management:**
- `N8N_DEFAULT_BINARY_DATA_MODE="filesystem"` stores large files locally rather than in memory
- `GENERIC_TIMEZONE` and `TZ` set the timezone for all time-based operations

**Monitoring:**
- `N8N_METRICS="true"` enables performance metrics collection
- `N8N_LOG_LEVEL="info"` provides detailed logging for development purposes

## 📍Step 3: Verify Installation

After running the Docker command, verify that your n8n installation is functioning correctly:

```cmd
# Check container status
docker ps

# View container logs
docker logs n8n-local

# Verify data directory creation
dir C:\Users\[USERNAME]\Documents\n8n-local
```

Navigate to `http://localhost:5678` in your browser to access the n8n interface and complete the initial setup by creating your administrator account.

## 📍Step 4: Create Auto-Start Script

To ensure n8n starts automatically when your computer boots, create an auto-start script that will be placed in the Windows startup folder. This script includes user interaction to prevent unwanted automatic starts.

### Creating the Script with Administrator Rights

The Windows startup folder requires administrator privileges for file creation. Follow these steps carefully:

1. **Open Notepad as Administrator:**
   - Press the Windows key
   - Type `notepad`
   - Right-click on Notepad in the search results
   - Select "Run as administrator"

2. **Create the Auto-Start Script:**

Copy and paste the following batch script into Notepad:

```batch
@echo off
title N8N Startup Manager
color 0A

echo.
echo ========================================
echo          N8N STARTUP MANAGER
echo ========================================
echo.
echo Do you want to start N8N today? (y/n)
echo.
set /p choice="Your choice: "

if /i "%choice%"=="y" goto start_n8n
if /i "%choice%"=="yes" goto start_n8n
if /i "%choice%"=="n" goto skip_n8n
if /i "%choice%"=="no" goto skip_n8n
goto invalid_choice

:start_n8n
echo.
echo Starting Docker Desktop (minimized)...
echo Please wait, this may take 30-60 seconds...
start /min "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo.
echo Waiting for Docker to start...
:wait_docker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is still starting...
    goto wait_docker
)

echo.
echo Docker is ready! Waiting additional 8 seconds for full initialization...
timeout /t 8 /nobreak >nul

echo.
echo Starting N8N container...
docker start n8n-local >nul 2>&1

echo.
echo Waiting for N8N to be ready...
timeout /t 10 /nobreak >nul

echo.
echo Opening N8N in your browser...
start "" "http://localhost:5678"

echo.
echo ========================================
echo   N8N is ready! Happy automation! :)
echo ========================================
echo.
echo This window will close in 5 seconds...
timeout /t 5 /nobreak >nul
exit

:skip_n8n
echo.
echo N8N startup skipped. Have a great day!
echo.
echo This window will close in 3 seconds...
timeout /t 3 /nobreak >nul
exit

:invalid_choice
echo.
echo Invalid choice! Please type 'y' for yes or 'n' for no.
echo.
pause
goto start_n8n
```

3. **Save the Script:**
   - Click File → Save As
   - Navigate to: `C:\Users\[USERNAME]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`
   - Filename: `n8n-startup.bat`
   - File type: "All files (*.*)" (Important: Do not save as .txt)
   - Click Save

### Script Functionality Explanation

This auto-start script incorporates several intelligent features designed to provide a smooth startup experience:

**User Interaction:** The script prompts the user before starting n8n, preventing unwanted automatic starts during system boot.

**Docker Management:** The script checks if Docker Desktop is running and starts it minimized if necessary, reducing desktop clutter.

**Timing Optimization:** The script includes strategic wait periods to ensure Docker Desktop fully initializes before attempting to start the n8n container.

**Error Handling:** The script validates user input and provides clear feedback throughout the startup process.

## 📍Step 5: Create Quick-Start Shortcut

For situations where you need to manually restart n8n after closing Docker Desktop, create a convenient shortcut in your Documents folder.

### Manual Shortcut Creation

1. **Create Quick-Start Directory:**
```cmd
mkdir C:\Users\[USERNAME]\Documents\Quick-Start
```

2. **Create Shortcut:**
   - Navigate to `C:\Users\[USERNAME]\Documents\Quick-Start`
   - Right-click in the empty space
   - Select "New" → "Shortcut"
   - Enter the target path: `C:\Users\[USERNAME]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\n8n-startup.bat`
   - Click "Next"
   - Name the shortcut: `Start N8N`
   - Click "Finish"

### Alternative: PowerShell Automation

You can also create the shortcut automatically using PowerShell:

```powershell
# Create Quick-Start directory
mkdir "C:\Users\[USERNAME]\Documents\Quick-Start" -Force

# Create shortcut automatically
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("C:\Users\[USERNAME]\Documents\Quick-Start\Start N8N.lnk")
$Shortcut.TargetPath = "C:\Users\[USERNAME]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\n8n-startup.bat"
$Shortcut.WorkingDirectory = "C:\Users\[USERNAME]\Documents"
$Shortcut.Description = "Start N8N and Docker Desktop"
$Shortcut.Save()
```

## Usage Instructions

### Automatic Startup
After completing the installation, n8n will automatically prompt you to start during each system boot. Simply respond with 'y' or 'yes' to begin the startup process.

### Manual Startup
If you need to restart n8n after closing Docker Desktop:
1. Navigate to `C:\Users\[USERNAME]\Documents\Quick-Start`
2. Double-click on "Start N8N" shortcut
3. Follow the prompts in the command window

### Container Management
For advanced users who prefer direct Docker commands:

```cmd
# Start n8n container
docker start n8n-local

# Stop n8n container
docker stop n8n-local

# View container status
docker ps

# View n8n logs
docker logs n8n-local

# Access container shell for debugging
docker exec -it n8n-local /bin/bash
```

## Data Persistence and Backup

Your n8n data persists in the `C:\Users\[USERNAME]\Documents\n8n-local` directory. This includes workflows, credentials, and all configuration files. To create a backup of your n8n installation:

```cmd
# Create compressed backup
tar -czf n8n-backup-%date:~-4,4%%date:~-10,2%%date:~-7,2%.tar.gz "C:\Users\[USERNAME]\Documents\n8n-local"
```

## Troubleshooting

### Common Issues and Solutions

**Container Not Starting:**
- Verify Docker Desktop is running: `docker info`
- Check container logs: `docker logs n8n-local`
- Restart Docker Desktop and try again

**Browser Cannot Connect:**
- Ensure container is running: `docker ps`
- Wait additional time for n8n to fully initialize
- Check Windows Firewall settings for port 5678

**Permission Errors:**
- Run Notepad as administrator when editing startup scripts
- Verify Docker Desktop has necessary permissions
- Check that the data directory is accessible

**Auto-Start Not Working:**
- Verify the script exists in the startup folder
- Test the script manually by double-clicking it
- Check Windows startup settings and ensure startup programs are enabled

### Performance Optimization

For optimal performance on lower-end systems, consider adjusting the Docker Desktop resource allocation:
- Open Docker Desktop Settings
- Navigate to Resources
- Adjust CPU and Memory limits as needed
- Restart Docker Desktop after changes

## Security Considerations

This local installation runs n8n on localhost port 5678, making it accessible only from your local machine. The setup includes no external network exposure, ensuring your workflows and data remain private. However, consider the following security practices:

- Regularly update the n8n Docker image by pulling the latest version
- Use strong passwords for your n8n administrator account
- Backup your data directory regularly to prevent data loss
- Monitor the n8n logs for any unusual activity or errors

## Conclusion

This installation provides a robust local n8n environment suitable for development, testing, and personal automation projects. The auto-start functionality ensures convenience while maintaining user control over system resources. The data persistence setup guarantees that your workflows and configurations survive container updates and system restarts.
