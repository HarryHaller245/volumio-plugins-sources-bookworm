# Playback Testing Guide - motorized_fader_control

## Quick Start: Test in 5 Minutes

### Prerequisites
✅ Plugin deployed and running (`./deploy_plugin.sh`)
✅ Faders performing calibration moves
✅ Volumio UI accessible at `http://<rpi-ip>/`

### Test 1: Basic Volume Control (2 minutes)

#### Terminal 1: Watch Logs
```bash
cd /home/volumio/volumio-plugins-sources-bookworm/motorized_fader_control

# Watch all fader-related activity
journalctl -u volumio -f | grep -i "fader\|move\|volume"
```

#### Terminal 2: Test Volume Through UI
```bash
# No command needed - just use Volumio UI
```

#### Steps:
1. Open Volumio web UI: `http://<rpi-ip>/`
2. Add a song to queue (Browse Music → Select any song)
3. **PRESS PLAY**
4. In Volumio UI, use the Volume slider:
   - Move slider UP → **Watch Terminal 1 for fader move commands**
   - Move slider DOWN → **Watch Terminal 1 for fader move commands**

#### Expected Output in Terminal 1:
```
debug: [motorized_fader_control] [FaderController] Move: {"indexes":[0],"targets":[80]...
debug: [motorized_fader_control] [FaderController] Fader 0 speedFactor: 1.00, effectiveSpeed: 100.00
debug: [motorized_fader_control] [FaderController] Generated {...} positions
info: [motorized_fader_control] [EVENTBUS] Event triggered: playback/playing
```

**Success Criteria:**
- ✅ Terminal shows fader move commands
- ✅ Physical fader moves when you move UI slider
- ✅ No errors in logs

---

### Test 2: Physical Fader Control (2 minutes)

#### Terminal: Watch Incoming Fader Events
```bash
journalctl -u volumio -f | grep -i "playback\|volume"
```

#### Steps:
1. Keep music playing in Volumio
2. **PHYSICALLY MOVE A FADER**
3. **Watch Volumio UI Volume slider - it should move!**
4. Try different speeds:
   - Slow move (watch smooth progression)
   - Fast move (watch responsive jumps)
   - All the way down (0%)
   - All the way up (100%)

#### Expected Behavior:
- Volumio volume slider moves with physical fader
- UI shows updated volume percentage
- Changes apply immediately

**Success Criteria:**
- ✅ Physical fader movement → UI volume changes
- ✅ Two-way synchronization working
- ✅ Smooth response, no lag

---

### Test 3: Different Playback States (1 minute)

#### Steps:
1. **PLAY** a song
   - Move faders → volume should change
   
2. **PAUSE** the song
   - Move faders → volume should still respond
   
3. **STOP** the song
   - Move faders → volume should still respond

#### Expected Behavior:
- Faders work in all playback states
- No errors in logs during state changes

**Success Criteria:**
- ✅ Faders responsive regardless of playback state
- ✅ No error messages in logs
- ✅ Smooth transitions

---

## Detailed Testing

### Test 4: Performance & Edge Cases (5 minutes)

```bash
# Terminal: Enhanced logging
journalctl -u volumio -f | grep -i "fader\|move\|error"
```

#### Test Edge Cases:
1. **Rapid Fader Movements**
   - Quickly move fader back and forth
   - Watch for jerky behavior or lag
   - All moves should be smooth

2. **Extreme Positions**
   - Move fader to minimum (bottom) - should be 0% volume
   - Move fader to maximum (top) - should be 100% volume
   - Verify calibration limits work

3. **Both Faders**
   - If using 2nd fader (Track control):
   - Move fader 1 while moving fader 0
   - Each should respond independently

#### Success Criteria:
- ✅ No lag or stuttering
- ✅ Smooth response curves
- ✅ Both faders work independently
- ✅ No dropped commands

---

### Test 5: Log Analysis (5 minutes)

```bash
# After testing, analyze logs
journalctl -u volumio --since "5 minutes ago" -n 200 --no-pager | grep motorized_fader_control
```

#### What to Look For:
✅ **Good signs:**
```
info: [motorized_fader_control] [FaderController] FaderController started successfully
debug: [motorized_fader_control] [FaderController] Move: {...}
debug: [motorized_fader_control] [EVENTBUS] Event triggered: playback/playing
```

❌ **Bad signs:**
```
error: [motorized_fader_control] ...
TypeError: ...
SerialPort error: ...
```

---

## Full Test Sequence

```bash
#!/bin/bash
# Save this as test_playback.sh

echo "🎵 PLAYBACK TESTING SEQUENCE"
echo ""
echo "Terminal 1: Run this command in another terminal:"
echo "  journalctl -u volumio -f | grep -i 'fader\\|move\\|volume\\|playback'"
echo ""
echo "Terminal 2: Then run these steps:"
echo ""

echo "Step 1: Start Volumio"
echo "  URL: http://<rpi-ip>/"
echo ""

echo "Step 2: Add song to queue"
echo "  Browse Music → Select any song"
echo ""

echo "Step 3: Press PLAY"
echo "  Watch logs in Terminal 1"
echo ""

echo "Step 4: Adjust volume in UI"
echo "  Move slider up/down"
echo "  Physical fader should move"
echo ""

echo "Step 5: Move physical fader"
echo "  UI slider should follow"
echo ""

echo "Step 6: Pause playback"
echo "  Faders should still work"
echo ""

echo "Step 7: Resume playback"
echo "  Everything should sync"
echo ""

echo "✅ ALL TESTS COMPLETE"
```

---

## Troubleshooting Test Failures

### Issue: Faders move but volume doesn't change

```bash
# Check if FaderController is receiving commands
journalctl -u volumio | grep "FaderController.*Move"

# Check if volume service is active
journalctl -u volumio | grep "VolumeService\|playback"
```

**Possible causes:**
- Volume control service not initialized
- MIDI note numbers incorrect
- Fader behavior configuration wrong

**Fix:**
```bash
# Check configuration
cat config.json | grep -A 5 "FADER_BEHAVIOR"

# Redeploy with config reset
./deploy_plugin.sh --reset-config
```

---

### Issue: UI slider moves but fader doesn't

```bash
# Check if commands are being sent to serial port
journalctl -u volumio | grep "serial\|MIDI\|FaderController"
```

**Possible causes:**
- Serial port not connected
- USB adapter not powered
- Device permissions issue

**Fix:**
```bash
# Check serial port
ls -la /dev/ttyUSB*

# Fix permissions
sudo chmod 666 /dev/ttyUSB0

# Check serial communication
cat /dev/ttyUSB0  # (Should show MIDI data when fader moves)
```

---

### Issue: Logs show errors

**Error: "FaderController/error"**
```bash
# View full error context
journalctl -u volumio -n 50 --no-pager | grep -B 3 -A 3 "error"
```

**Error: "SerialPort"**
- Check USB adapter connection
- Check serial port permissions: `sudo chmod 666 /dev/ttyUSB0`
- Restart plugin: `./deploy_plugin.sh`

---

## Performance Benchmarks

### Expected Response Times
- UI slider → Fader movement: **<200ms**
- Physical fader → UI update: **<300ms**
- Volume change → Audible response: **<100ms**

### Network Events
```bash
# Check for network-related delays
journalctl -u volumio -f | grep "socket\|websocket\|connected"
```

---

## Next Steps After Successful Testing

Once all tests pass:

1. **Document Results**
   - Note any timing variations
   - Record any edge cases discovered
   
2. **Performance Optimization**
   - Adjust fader speed settings if needed
   - Fine-tune calibration limits
   
3. **User Acceptance Testing**
   - Let users control plugin
   - Gather feedback on responsiveness
   - Document training steps

---

## Logging Commands for Testing

```bash
# Watch all plugin activity
journalctl -u volumio -f | grep motorized_fader_control

# Filter for errors only
journalctl -u volumio -f | grep motorized_fader_control | grep -i error

# Watch MIDI events
journalctl -u volumio -f | grep -i "midi\|move"

# Watch playback state changes
journalctl -u volumio -f | grep -i "playback\|playing\|paused"

# Combined: faders + volume
journalctl -u volumio -f | grep -i "fader\|volume\|move"

# Show last 100 lines of plugin activity
journalctl -u volumio -n 100 | grep motorized_fader_control
```

---

**Status**: Ready for testing
**Estimated Time**: 5-15 minutes
**Required**: Running plugin + Volumio UI access + music file