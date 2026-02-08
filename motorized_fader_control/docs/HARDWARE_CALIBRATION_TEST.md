# Hardware Calibration Testing Guide

## Overview
These scripts test the calibration system with **real hardware** - actual fader movements and MIDI feedback.

## Quick Start

### Option 1: Interactive (Recommended)
```bash
./run_calibration.sh
```
This prompts you before starting and displays real-time progress.

### Option 2: Direct
```bash
node test_ui_calibration_hw.js
```
Starts calibration immediately.

---

## What Happens During Calibration

### Phase 1: Setup (5 seconds)
1. Plugin initializes with real Volumio context
2. FaderController connects to serial port
3. Hardware is detected and ready

### Phase 2: Calibration Loop (2-3 minutes)
**For each fader (0, 1):**
- **For each resolution** (1, 0.8, 0.5, 0.2):
  - **For each speed** (10 speeds from 10 to 100):
    - Fader moves from 0→100 at that speed
    - Duration is captured via MIDI feedback
    - Data stored for analysis

**Total movements**: 2 faders × 4 resolutions × 20 speeds = **160 moves**

### Phase 3: Results (Instant)
- Calculates optimal speed factor for each fader
- Displays results with statistics
- Updates config.json with calibrated values

---

## Expected Output

```
╔════════════════════════════════════════════════════════════╗
║     UI CALIBRATION TEST - REAL HARDWARE                  ║
║     Simulating: User clicks CALIBRATE_BUTTON            ║
╚════════════════════════════════════════════════════════════╝

⚙️  Configuration:
  • Serial Port: /dev/ttyUSB0
  • Baud Rate: 1000000
  • Fader Count: 2
  • Calibration Time Goal: 100ms
  • Speed Range: 10-100
  ...

📋 What will happen:
  1. Plugin initializes with real serial port
  2. FaderController connects to hardware
  3. Calibration begins (faders will move multiple times)
  4. Duration data collected from real fader feedback
  5. Optimal speed factors calculated
  6. Results displayed

...

╔════════════════════════════════════════════════════════════╗
║     🎯 STARTING CALIBRATION                               ║
║     Watch the faders move through all test speeds...      ║
╚════════════════════════════════════════════════════════════╝

🔘 Calling RunManualCalibration() [Button Click Simulated]...

..................................................


╔════════════════════════════════════════════════════════════╗
║     ✅ CALIBRATION COMPLETE                                ║
║     Total Time: 145.3s                                    ║
╚════════════════════════════════════════════════════════════╝

📊 Calibration Results:

   Fader 0:
     • Optimal Resolution: 1
     • Consistency (Std Dev): 1.2ms
     • Avg Time @ Speed 100: 98.5ms
     • Effective Speed: 101.5 units/sec
     • Speed Factor: 0.986

   Fader 1:
     • Optimal Resolution: 1
     • Consistency (Std Dev): 1.5ms
     • Avg Time @ Speed 100: 99.2ms
     • Effective Speed: 100.8 units/sec
     • Speed Factor: 0.992

✅ Calibration data saved to config

╔════════════════════════════════════════════════════════════╗
║     📋 TEST COMPLETE                                       ║
╚════════════════════════════════════════════════════════════╝
```

---

## Real Data Collected

Each calibration captures:

| Data Point | Example | Purpose |
|-----------|---------|---------|
| **Motion Duration** | 98.5ms | How long fader took to move |
| **Standard Deviation** | 1.2ms | Consistency of movement |
| **Effective Speed** | 101.5 u/s | Actual speed achieved |
| **Speed Factor** | 0.986 | Adjustment needed |

### Speed Factor Calculation
```
speedFactor = requestedSpeed / effectiveSpeed
            = 100 / 101.5
            = 0.986
```

This factor is then applied to future movements:
```
actualSpeed = requestedSpeed × speedFactor
            = 50 × 0.986
            = 49.3 (closer to requested 50)
```

---

## Troubleshooting

### Issue: "Cannot lock port"
**Cause**: Another process is using the serial port
```bash
# Check what's using it
lsof /dev/ttyUSB0

# Kill the process
kill -9 <PID>

# Or restart the plugin
systemctl restart volumio
```

### Issue: "No statistics available"
**Cause**: Hardware not responding with feedback
- Check serial cable connections
- Verify MIDI device is powered on
- Check baud rate in config.json matches device

### Issue: Calibration takes >5 minutes
**Cause**: Very slow hardware or USB issues
- Consider reducing resolution count in config
- Check USB cable (prefer direct connection)
- Review baud rate setting

---

## Files Used

| File | Purpose |
|------|---------|
| `test_ui_calibration_hw.js` | Main calibration test with real hardware |
| `run_calibration.sh` | Interactive runner script |
| `config.json` | Hardware and calibration parameters |
| `lib/faderController/calibration/CalibrationEngine.js` | Calculates optimal settings |
| `lib/faderController/core/FaderController.js` | Manages fader movements |

---

## Next Steps After Calibration

1. **Verify Speed Factors**: Check console output for speedFactor values
2. **Test Playback**: Run `test_playback.sh` to test seek/volume
3. **Monitor Logs**: Check `/var/log/volumio.log` for any errors
4. **Fine-tune**: Adjust speed ranges in UI if needed

---

## Advanced Usage

### Monitor Live Logs
```bash
journalctl -u volumio -f
```

### Deploy Changes After Calibration
```bash
./deploy_plugin.sh
```

### Check Stored Calibration Data
```bash
cat config.json | jq '.FADER_SPEED_FACTOR'
```
