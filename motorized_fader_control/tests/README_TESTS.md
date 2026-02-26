# Test Suite

## Active Tests

### Pitch Bend Feedback Test
**File:** `test_pitchbend_feedback.js`  
**Script:** `run_midi_diagnostic.sh`  
**Purpose:** Verifies Pitch Bend feedback routing on offset channels (4-7) after SYSEX migration  
**Usage:** `./run_midi_diagnostic.sh` or `node test_pitchbend_feedback.js --agent --timeout=2`

### Hardware Flow Test
**File:** `test_hardware_fader_flow.js`  
**Purpose:** Complete flow test - movement, basic calibration, manual calibration  
**Usage:** `node test_hardware_fader_flow.js --agent --timeout=2`

### Hardware Speed Test
**File:** `test_hardware_speed.js`  
**Script:** `run_hardware_speed.sh`  
**Purpose:** Tests individual speeds (10, 50, 100) with visual confirmation  
**Usage:** `./run_hardware_speed.sh` or `node test_hardware_speed.js --agent`

### Hardware Full Range Test
**File:** `test_hardware_full_range.js`  
**Script:** `run_hardware_full_range.sh`  
**Purpose:** Tests full range movement for both faders  
**Usage:** `./run_hardware_full_range.sh`

### Fader 1 Only Test
**File:** `test_hardware_fader1_only.js`  
**Script:** `run_hardware_fader1_only.sh`  
**Purpose:** Isolated test for fader 1 troubleshooting  
**Usage:** `./run_hardware_fader1_only.sh`

### UI Calibration Hardware Test
**File:** `test_ui_calibration_hw.js`  
**Script:** `run_calibration.sh`  
**Purpose:** Runs UI calibration with real hardware  
**Usage:** `./run_calibration.sh`

## Test Scripts

- `diagnose.sh` - General diagnostic script
- `monitor_logs.sh` - Monitors Volumio logs for MIDI/fader activity
- `test_plugin.sh` - Plugin testing script

## Removed Tests (Post SYSEX Migration)

The following tests were removed after migrating from SYSEX to Pitch Bend:
- `test_sysex_capture.js` - SYSEX message capture (obsolete)
- `test_midi_feedback_routing.js` - SYSEX routing diagnostic (replaced by test_pitchbend_feedback.js)
- `test_raw_serial_bytes.js` - Raw byte capture for SYSEX debugging (obsolete)

## Test Conventions

- All tests support `--agent` mode for automated execution with timeouts
- Most tests support `--timeout=N` to override default input timeout (in seconds)
- Tests automatically stop Volumio service to release USB port
- Use Ctrl+C to cancel any running test

---

## Test Results

### Hardware Speed Test (Feb 8, 2026)
**Test:** `test_hardware_speed.js`  
**Environment:** Arduino Nano, dual motorized faders @ 1 Mbps UART  
**Config:** `feedback_midi: true`, `feedback_channel_offset: 4`

#### Fader 0 - Individual Speed Testing
| Speed | Positions Sent | Processing Time | Visual Quality | Notes |
|-------|---------------|-----------------|----------------|-------|
| 10 (SLOW) | 89 | 29ms | ✅ Smooth | Still fairly fast |
| 50 (MEDIUM) | 49 | 35ms | ✅ Smooth | Good balance |
| 100 (FAST) | 1 | 2ms | ✅ Smooth | Instant jump |

#### Both Faders - Synchronized Movement (Speed 50)
| Test | Positions | Processing Time | Synchronization | Notes |
|------|-----------|-----------------|-----------------|-------|
| Both → 100 | 98 | 18ms | ✅ Perfect | No lag between faders |
| Both → 0 | 98 | - | ✅ Perfect | Synchronized return |

#### Key Findings
1. **Speed Perception**: Speed 10 is still quite fast; difference between 50-100 not very noticeable
2. **Next Test Required**: Need to compare software vs hardware feedback to see speed impact
3. **Movement Quality**: All movements smooth, no jitter or stuttering at any speed
4. **Synchronization**: Both faders tracked perfectly together
5. **Feedback Simulation**: Software feedback active during calibration-style resets (saw `[CALIB]` logs)

#### Technical Notes
- Position resolution varies by speed: slower = more positions (89 @ speed 10 vs 1 @ speed 100)
- MIDI Queue processing very fast (2-35ms for full range moves)
- Software feedback simulation triggered during `disableFeedback` mode
- Hardware feedback on channels 4-5 (offset channels) working correctly
