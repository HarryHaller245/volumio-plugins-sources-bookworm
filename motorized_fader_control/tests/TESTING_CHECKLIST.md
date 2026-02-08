# Testing Checklist - motorized_fader_control

**Status**: 🔵 TESTING PHASE 1 - CALIBRATION  
**Date Started**: February 7, 2026  
**Test Sequence**: 1. Calibration → 2. Playback (Track/Album) → 3. Volume Control

---

## 📋 PHASE 1: CALIBRATION TESTING

### Setup
- [ ] Plugin deployed and running: `./deploy_plugin.sh`
- [ ] Terminal 1 open: Monitoring logs in real-time
- [ ] Terminal 2 open: Ready for calibration trigger
- [ ] Volumio UI accessible at `http://<rpi-ip>/`
 - [ ] Optional: run hardware flow test: `./run_hardware_tests.sh`

### Terminal 1: Monitor Calibration Logs
```bash
cd /home/volumio/volumio-plugins-sources-bookworm/motorized_fader_control
journalctl -u volumio -f | grep -i "calibration\|cal_\|optimal"
```

### Terminal 2: Alternative - Full Plugin Logs
```bash
cd /home/volumio/volumio-plugins-sources-bookworm/motorized_fader_control
journalctl -u volumio -f --all
```

### Test 1.1: UI Calibration Button
**Procedure:**
1. Volumio UI → Settings → System Hardware → motorized_fader_control
2. Click "CALIBRATE" button
3. **Watch Terminal 1** for calibration progress:
   - Should see: `=== STARTING CALIBRATION ===`
   - Should see: Fader indexes being tested
   - Should see: Test speeds and resolutions
   - Should see: Optimal settings calculated

**Expected Log Output:**
```
info: [motorized_fader_control] [CalibrationEngine] === STARTING CALIBRATION ===
info: [motorized_fader_control] [CalibrationEngine] Faders: 0, 1
info: [motorized_fader_control] [CalibrationEngine] Testing speeds: 20, 60, 100
info: [motorized_fader_control] [CalibrationEngine] Testing resolutions: 1024, 2048
...
info: [motorized_fader_control] [CalibrationEngine] Fader 0 calibration complete:
info: [motorized_fader_control] [CalibrationEngine] - Optimal resolution: 2048
info: [motorized_fader_control] [CalibrationEngine] - Speed factor: 1.25
```

**Success Criteria:**
- [ ] No errors during calibration
- [ ] Optimal resolution identified
- [ ] Speed factor calculated
- [ ] Faders perform test moves (0→100→0)
- [ ] Calibration completes without hanging

**Issues to Watch For:**
- ❌ TIMEOUT: Calibration takes >5 minutes
- ❌ MOVE ERRORS: Fader move commands failing
- ❌ PERFORMANCE: Extreme speed factors (>2.0 or <0.5)
- ❌ FEEDBACK: MIDI feedback not reconciling

---

### Test 1.2: Calibration Results Verification
**Procedure:**
1. After calibration completes
2. Check saved config: `cat config.json | grep -i speed\|resolution`
3. Look for stored calibration results

**Expected Output:**
```json
{
  "FADER_SPEED_SETTINGS": {
    "speedFactors": [1.25, 1.15],
    "optimalResolutions": [2048, 2048]
  }
}
```

**Success Criteria:**
- [ ] Speed factors saved (0.8 to 2.0 range normal)
- [ ] Optimal resolutions persisted
- [ ] Values reasonable (not extreme)

**Issues to Watch For:**
- ❌ Missing speed factors
- ❌ Zero or negative values
- ❌ Inconsistent resolutions

---

### Test 1.3: Physical Fader Feedback During Calibration
**Observation Points:**
1. **Before Calibration**: Faders should move once (initialize to 0)
2. **During Calibration**: 
   - Watch faders move back/forth at test speeds
   - Should see multiple passes per resolution
   - Movement should be smooth, responsive
3. **After Calibration**: 
   - Faders should return to home position
   - Should be ready for use

**Success Criteria:**
- [ ] Smooth movements at all test speeds
- [ ] No stuttering or jerky motion
- [ ] Faders reach endpoints (0 and max)
- [ ] MIDI feedback synchronized with actual position

**Issues to Watch For:**
- ❌ JERKY MOVEMENT: Stuttering, jumping steps
- ❌ INCOMPLETE MOVES: Fader stops before endpoint
- ❌ FEEDBACK MISMATCH: Fader position ≠ reported position
- ❌ MISSED COMMANDS: Fader doesn't respond to all moves

---

## 📋 PHASE 2: PLAYBACK TESTING (TRACK & ALBUM)

### Test 2.1: Single Track Playback
**Procedure:**
1. Navigate to Browse Music in Volumio UI
2. Search for and queue a song
3. Press PLAY
4. Move physical faders while track is playing
5. Monitor logs for playback events

**Terminal 1: Monitor Playback**
```bash
journalctl -u volumio -f | grep -i "playback\|track\|seek"
```

**Expected Behavior:**
- [ ] Track starts playing
- [ ] Track info appears in logs
- [ ] Moving faders affects playback position
- [ ] No errors during playback

**Success Criteria:**
- [ ] Track plays without interruption
- [ ] Seek works (fader moves forward/backward)
- [ ] Volume changes apply immediately

---

### Test 2.2: Album Playback
**Procedure:**
1. Navigate to Browse Music → Select Album
2. Press PLAY (starts from first track)
3. Keep track playing through several songs
4. Move faders during track transitions
5. Monitor logs for album-specific events

**Terminal 1: Monitor Album**
```bash
journalctl -u volumio -f | grep -i "album\|track.*next\|transition"
```

**Expected Behavior:**
- [ ] Album plays through automatically
- [ ] Track transitions smooth
- [ ] Fader position resets with new track (if enabled)
- [ ] No errors during transitions

**Success Criteria:**
- [ ] Album queues multiple tracks correctly
- [ ] Track transitions don't break fader control
- [ ] Fader seek works on each track

---

### Test 2.3: Playback State Transitions
**Procedure:**
1. Play a track
2. **PAUSE** → Move faders → Resume
3. **STOP** → Move faders → Play again
4. Monitor logs for state change events

**Expected Behavior:**
- [ ] Faders work in all states (playing, paused, stopped)
- [ ] No errors during state changes
- [ ] State transition logged correctly

**Success Criteria:**
- [ ] Smooth transitions between all states
- [ ] Fader control consistent across states

---

## 📋 PHASE 3: VOLUME CONTROL TESTING

### Test 3.1: UI Volume Control
**Procedure:**
1. Play a track
2. Use Volumio UI volume slider
3. Move slider up/down
4. Watch physical faders respond
5. Monitor logs for volume events

**Terminal 1: Monitor Volume**
```bash
journalctl -u volumio -f | grep -i "volume\|setvolume"
```

**Expected Behavior:**
- [ ] UI slider moves → Fader moves
- [ ] Movement is smooth, responsive
- [ ] Volume level updates in UI
- [ ] No errors in logs

**Success Criteria:**
- [ ] 1:1 synchronization: UI ↔ Fader
- [ ] Volume range 0-100 full span

---

### Test 3.2: Physical Fader Volume Control
**Procedure:**
1. Play a track
2. Physically move a fader
3. Watch Volumio UI volume slider respond
4. Try full range (0 to 100)

**Expected Behavior:**
- [ ] Fader moves → UI slider follows
- [ ] Responsive, no lag
- [ ] Full 0-100 range works

**Success Criteria:**
- [ ] Fader position accurately reflects volume
- [ ] No lag or delay

---

### Test 3.3: Multiple Fader Volume Control (if applicable)
**Procedure:**
1. If multiple faders: one fader = volume, others = seek
2. Move volume fader
3. Verify only volume changes (not seek position)
4. Move seek fader
5. Verify only seek changes (not volume)

**Expected Behavior:**
- [ ] Each fader controls its intended function
- [ ] No cross-talk between faders
- [ ] Independent operation

---

## 🐛 Issues Found & Resolutions

### Issue 1: [ISSUE_TITLE]
**Status**: 🔴 OPEN / 🟡 IN_PROGRESS / 🟢 RESOLVED  
**Severity**: Critical / High / Medium / Low  
**Description**: 
```
[Describe issue]
```
**How to Reproduce**:
```
[Steps]
```
**Expected vs Actual**:
```
Expected: [what should happen]
Actual: [what actually happens]
```
**Logs**:
```
[Relevant log entries]
```
**Resolution**: [Once fixed, document here]

---

## 📊 Test Summary

| Phase | Test | Status | Notes |
|-------|------|--------|-------|
| 1 | Calibration UI | 🔵 | [To start] |
| 1 | Calibration Results | ⚪ | [Pending] |
| 1 | Physical Feedback | ⚪ | [Pending] |
| 2 | Track Playback | ⚪ | [Pending] |
| 2 | Album Playback | ⚪ | [Pending] |
| 2 | State Transitions | ⚪ | [Pending] |
| 3 | UI Volume | ⚪ | [Pending] |
| 3 | Fader Volume | ⚪ | [Pending] |
| 3 | Multi-Fader | ⚪ | [Pending] |

---

## 🎯 Next Steps

After completing Phase 1 (Calibration):
1. Document any issues found
2. Review logs for patterns
3. Compare against expected output
4. Move to Phase 2 testing
5. Build resolution document for any bugs

