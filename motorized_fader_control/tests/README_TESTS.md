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
