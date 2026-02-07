# Motorized Fader Control - Deployment Guide (Volumio4)

## Quick Start

### Prerequisites
- Volumio 4.x running on Raspberry Pi 4
- Node.js 20.5+ installed
- USB serial adapter for MIDI communication (optional for initial testing)

### Setup Scripts

This plugin includes two helper scripts for easy deployment and testing:

#### 1. **test_plugin.sh** - Pre-deployment Validation

Runs comprehensive checks before deploying:

```bash
./test_plugin.sh
```

**What it validates:**
- JavaScript syntax in index.js
- All npm dependencies installed
- Configuration files present (config.json, UIConfig.json)
- Core library modules loadable
- i18n translation files present

**Output example:**
```
✅ index.js syntax: PASS
✅ Module loading: PASS
✅ serialport@11.0.1
✅ socket.io-client@4.8.3
✅ config.json (5234 bytes)
✅ UIConfig.json (14521 bytes)
✅ lib/ directory (12 files)
✅ All Tests: PASSED ✅
```

#### 2. **deploy_plugin.sh** - Deployment & Log Monitoring

Deploys plugin to Volumio and monitors startup:

```bash
# Standard deployment with log watching
./deploy_plugin.sh

# Clean install (reset configuration to defaults)
./deploy_plugin.sh --reset-config

# Watch logs only (no restart)
./deploy_plugin.sh --watch-only
```

**What deploy_plugin.sh does:**
1. Validates plugin structure
2. Copies plugin to Volumio installation directory
3. Restarts Volumio daemon
4. Watches system logs for startup messages
5. Shows plugin initialization progress
6. Displays any errors in real-time

**Output example:**
```
[PHASE 1] Validating plugin structure...
[PHASE 2] Copying files to Volumio...
[PHASE 3] Restarting Volumio daemon...
[PHASE 4] Watching startup logs...

== motorized_fader_control starting ==
[INFO] Initializing FaderController...
[INFO] Connecting to serial port /dev/ttyUSB0...
[INFO] Fader control ready
```

## Deployment Workflow

### Step 1: Validate Plugin
```bash
./test_plugin.sh
```
Expected: All tests pass ✅

### Step 2: Deploy to Volumio
```bash
./deploy_plugin.sh
```
Expected: Plugin starts without errors, fuser can be accessed via web UI

### Step 3: Configure Hardware
1. Access Volumio web interface: `http://<rpi-ip>/`
2. Go to Plugin → motorized_fader_control
3. Configure:
   - **Serial Port**: `/dev/ttyUSB0` (or your device)
   - **Baud Rate**: `1000000`
   - **Fader Count**: `2` (or number of faders)
   - **Fader Behavior**: Volume, Track, Album, etc.

### Step 4: Test Hardware Connection
1. Power on motorized faders
2. Plug in USB serial adapter
3. Check serial port: `ls -la /dev/ttyUSB*`
4. Watch logs: `journalctl -u volumio -f`
5. Move a fader → check Volumio responds

## Troubleshooting

### Issue: "Serial port not found"
```bash
# Check available ports
ls -la /dev/ttyUSB*

# Check if permission issue
sudo chmod 666 /dev/ttyUSB0

# Or add volumio user to dialout group
sudo usermod -aG dialout volumio
```

### Issue: "Module not found"
```bash
# Reinstall dependencies
cd /home/volumio/volumio-plugins-sources-bookworm/motorized_fader_control
npm install
./test_plugin.sh
```

### Issue: "Plugin not loading"
```bash
# Check plugin directory
ls -la /volumio/app/plugins/system_hardware/motorized_fader_control/

# View recent errors
journalctl -u volumio -n 50 -p err
```

### Issue: "Faders unresponsive"
1. Check MIDI parsing: `journalctl -u volumio | grep "MIDI"`
2. Verify serial connection: `cat /dev/ttyUSB0`
3. Check calibration: Access UI → Hardware Settings → Calibrate

## Deployment Verification

### ✅ Successful Deployment Indicators
After running `./deploy_plugin.sh`, watch for these log messages:

```
info: [motorized_fader_control] [MAIN] Starting motorized fader control plugin...
info: [motorized_fader_control] [MAIN] Initializing FaderController...
debug: [motorized_fader_control] [FaderController] Device check attempt 1/10
debug: [motorized_fader_control] [FaderController] MIDI device ready signal received
debug: [motorized_fader_control] [FaderController] Calibrating...
info: [motorized_fader_control] [FaderController] FaderController started successfully
info: [motorized_fader_control] [MAIN] Plugin started successfully!
```

**What this means:**
- ✅ Plugin initialized
- ✅ FaderController ready
- ✅ MIDI device detected
- ✅ Initial calibration moves executed (0→100→0)
- ✅ Volumio connection established
- ✅ Event listeners active

## Playback Testing (Next Phase)

### Test 1: Start Playback and Monitor Faders
```bash
# In terminal, watch for fader movements
journalctl -u volumio -f | grep -i "fader\|move"
```

Then in Volumio UI:
1. Start a song
2. Move physical faders
3. Check if Volumio volume responds
4. Watch terminal for fader debug messages

### Test 2: Verify Two-Way Sync
- Move fader → Volumio volume changes
- Use Volumio UI to change volume → Faders move to match

### Test 3: Test Different Fader Behaviors
Each fader can control different aspects:
- **Fader 0**: Volume control (default)
- **Fader 1**: Track navigation (optional)

### Test 4: Check Edge Cases
- Rapid fader movements
- Extreme positions (all the way up/down)
- Multiple faders moving simultaneously
- Playback state changes (play/pause/stop)

### Expected Log Output During Playback
```
debug: [motorized_fader_control] [FaderController] Move: {"indexes":[0],"targets":[90]...
debug: [motorized_fader_control] [FaderController] Fader 0 speedFactor: 1.00
debug: [motorized_fader_control] [EVENTBUS] Event triggered: playback/playing
```

### Advanced Deployment

### Manual Installation
```bash
# Copy plugin files
sudo cp -r . /volumio/app/plugins/system_hardware/motorized_fader_control/

# Install dependencies
cd /volumio/app/plugins/system_hardware/motorized_fader_control/
npm install

# Restart Volumio
sudo systemctl restart volumio
```

### Watch Logs in Real-time
```bash
# All Volumio logs
journalctl -u volumio -f

# Filter for plugin only
journalctl -u volumio -f | grep "fader\|MIDI"

# Show last N lines then follow
journalctl -u volumio -n 50 -f
```

### Reset to Factory Defaults
```bash
# Option 1: Using script
./deploy_plugin.sh --reset-config

# Option 2: Manual reset
cd /volumio/app/plugins/system_hardware/motorized_fader_control/
rm -f cache/* config.dat
sudo systemctl restart volumio
```

## Configuration Files

### config.json
Default hardware and behavior settings:
- `FADER_CONTROLLER_FADER_COUNT`: Number of physical faders
- `SERIAL_PORT`: USB device path
- `BAUD_RATE`: Serial communication speed
- `FADER_BEHAVIOR`: Control mapping for each fader

### UIConfig.json
Web UI form definitions:
- General settings (serial port, baud rate)
- Fader behavior configuration
- Hardware calibration controls

### package.json
NPM dependencies (updated for Volumio4):
- serialport@11.0.1 (Node 20 compatible)
- socket.io-client@4.8.3 (modern WebSocket)
- kew, v-conf, fs-extra, winston

## Performance Optimization

### Fader Responsiveness
If faders feel sluggish:
1. Increase BAUD_RATE in config.json
2. Reduce FADER_AGGREGATION_WINDOW (in index.js, line ~1080)
3. Check Volumio system load: `top`

### CPU Usage
If plugin uses high CPU:
1. Check for serial port errors: `journalctl -u volumio | grep "Error"`
2. Reduce polling frequency in FaderController
3. Enable aggregation mode (batches multiple fader events)

### Log Size
If logs grow too large:
```bash
# Rotate Volumio logs
journalctl --vacuum-size=100M

# Check plugin log level
# In UIConfig.json: Log Level (Debug/Info/Warn/Error)
```

## Updating Plugin

### From V3 to V4 Migration
This plugin has been migrated from Volumio 3 to Volumio 4:

```bash
# Verify migration status
./test_plugin.sh

# Deploy V4 version
./deploy_plugin.sh
```

### Version Information
- **Current Version**: 2.0.0
- **Volumio Target**: 4.0+
- **Node.js**: 20.5+
- **Last Updated**: 2025-02-07

## Support & Documentation

### Related Files
- [MIGRATION_PLAN.md](MIGRATION_PLAN.md) - Technical migration details
- [ARCHITECTURE_COMPARISON.md](ARCHITECTURE_COMPARISON.md) - System architecture
- [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) - Executive summary
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Quick reference guide

### Key Components
- **index.js** (1,237 lines) - Main plugin implementation
- **lib/FaderController.js** - Hardware control
- **lib/EventBus.js** - Event system
- **lib/StateCache.js** - State management
- **lib/services/** - Volume, Track, Album services

## Common Commands

```bash
# Test plugin locally
./test_plugin.sh

# Deploy with log monitoring
./deploy_plugin.sh

# Reset configuration and redeploy
./deploy_plugin.sh --reset-config

# Watch logs without restarting
./deploy_plugin.sh --watch-only

# Manual log watching
journalctl -u volumio -f

# Check plugin status
systemctl status volumio

# Restart plugin (via Volumio)
sudo systemctl restart volumio

# Reinstall npm dependencies
npm ci  # (or npm install)

# Check serial ports
ls -la /dev/ttyUSB*

# Test serial connection
cat /dev/ttyUSB0  # (Ctrl-C to exit)
```

## Next Steps

1. **Validate**: Run `./test_plugin.sh` to verify all components
2. **Deploy**: Run `./deploy_plugin.sh` to install to Volumio
3. **Configure**: Access Volumio UI to set serial port and fader mapping
4. **Test**: Move physical faders and verify Volumio responds
5. **Calibrate**: Run calibration procedure in Hardware Settings

---

**Last Updated**: February 7, 2025  
**Version**: 2.0.0 (Volumio 4)  
**Status**: ✅ Ready for Deployment
