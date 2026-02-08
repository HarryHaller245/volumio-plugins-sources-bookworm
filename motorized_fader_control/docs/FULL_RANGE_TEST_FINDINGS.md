# Full Range Test Findings (Feb 8, 2026)

## Executive Summary

✅ **Fader 0**: Works correctly - reaches 99.9% and returns to 0.09% with proper hardware feedback (1308ms and 1411ms actual move times)

❌ **Fader 1**: **CRITICAL ISSUE** - Does not receive hardware feedback during 0→100 move, completes in 1ms using software fallback tracking

## Test Results Breakdown

### Fader 0: 0→100→0 at Speed 100
```
Reset (0):        Duration:   6ms  (Software - Interrupt, Feedback Disabled)
Move 0→100:       Duration: 1308ms (Hardware - 80+ MIDI feedback messages)
                  Final Pos:  16367/16383 (99.9%)
                  Feedback:   ✓ Continuous updates received
Move 100→0:       Duration: 1411ms (Hardware - 80+ MIDI feedback messages) 
                  Final Pos:  16/16383 (0.09%)
                  Feedback:   ✓ Continuous updates received
```

### Fader 1: 0→100→0 at Speed 100
```
Reset (0):        Duration:   1ms  (Software - Interrupt, Feedback Disabled)
                  Feedback:   ✓ Simulated (expected for reset)
Move 0→100:       Duration:   1ms  (Software - NO hardware feedback)
                  Final Pos:  Unknown (no feedback messages)
                  Feedback:   ❌ MISSING - 0 handleFeedbackMessage calls
                  MIDI Sent:  ✓ [225, 127, 127] (0xE1 Pitch Bend channel 1)
Move 100→0:       Duration:   2ms  (Software - NO hardware feedback)
                  Final Pos:  Unknown (no feedback messages)
                  Feedback:   ❌ MISSING - 0 handleFeedbackMessage calls
                  MIDI Sent:  ✓ [225, 0, 0] (0xE1 Pitch Bend channel 1)
```

## Critical Finding: Hardware Feedback Loss for Fader 1

### Evidence Pattern

1. **MIDI Commands Sent Successfully**
   - Both Fader 0 and Fader 1 receive `internal:midi/sent` events
   - MIDI messages formatted correctly: `[224, 127, 127]` for Fader 0, `[225, 127, 127]` for Fader 1
   - Queue processing shows no errors

2. **Feedback Tracking Initiated**
   - Both faders call `trackFeedbackStart()` before move
   - Both enter `feedbackTracking` map status: `[[1, {"targetPosition": 16383}]]`
   - Feedback tracking state shows both faders registered

3. **Feedback Received for Fader 0 Only**
   ```
   Fader 0: handleFeedbackMessage called: fader=0, position=48 ✓
            handleFeedbackMessage called: fader=0, position=96 ✓
            ... (80+ messages)
            handleFeedbackMessage called: fader=0, position=16383 ✓
   
   Fader 1: [ZERO handleFeedbackMessage calls] ❌
   ```

4. **Move Completes with Invalid Timing**
   - Fader 0 completes after 1308ms (real hardware move time) - CORRECT
   - Fader 1 completes after 1ms (JavaScript execution time) - WRONG
   - Test reports "Did Fader 1 reach FULL deflection (100%)?" with NO position data

### Root Cause Analysis

Three possible root causes:

**Hypothesis A: Hardware Not Responding to Fader 1 Channel**
- Fader 1 (MIDI channel 1) doesn't send feedback during 0→100 move
- But it DID send feedback during reset phase
- Suggests hardware may have state/buffer issue with continuous moves

**Hypothesis B: MIDI Feedback Routing Break After First Move**
- Fader 0's large feedback volume (80+ messages at ~380ms) might overflow MIDI buffer
- Fader 1's feedback queued behind Fader 0, never reaches parser
- Parser receives 162 feedback messages for Fader 0 but none for Fader 1

**Hypothesis C: Channel-Specific Hardware Malfunction**
- Fader 1 motor/encoder is faulty and not sending feedback
- Or serial line for channel 1 is intermittently disconnected
- Test sequence: Reset works → 0→100 fails → 100→0 fails (consistent failure)

## How Software Feedback Tracking Masks the Problem

When hardware feedback is missing, the system automatically falls back to **software feedback**:

```
// In lib/faderController/core/FaderController.js
if (!this.config.feedback_midi || disableFeedback) {
    this.midiQueue.feedbackTracker.enableSoftwareFeedback();
}
```

This causes:
- `markMovementComplete()` to fire immediately when MIDI command is sent (not when hardware actually completes)
- Duration recorded as JavaScript execution time (~1-3ms) instead of actual move time (~1300ms)
- No position feedback to verify actual fader reached target
- Calibration timing data becomes **meaningless** for Fader 1

## Impact on Calibration & Systems Beyond Testing

This explains the **Phase 3 failure** from earlier sessions:
- Manual calibration relies on accurate hardware feedback
- Without Fader 1 feedback, half the calibration data is incorrect
- Speed factors calculated from invalid timing data
- Dual-fader synchronized moves fail because one fader completes instantly

## Recommendations

### Immediate (Isolate Root Cause)
1. **Test Fader 1 Alone**
   - Create new test: Only move Fader 1, no Fader 0
   - Run at same speed (100) for same duration (0→100→0)
   - If Fader 1 gets feedback when alone → **Hypothesis B (buffer overflow)**
   - If Fader 1 still fails → **Hypothesis A or C (hardware issue)**

2. **Check Hardware MIDI Monitor**
   - Use external MIDI monitor on serial port `/dev/ttyUSB0`
   - Verify if hardware is sending feedback bytes for channel 1
   - Confirm bytes appear in same time window as Fader 0 test

3. **Verify Serial Buffer**
   - Check `queueOverflow: 10000000` config setting (currently very high)
   - Monitor MIDI queue size during Fader 0+1 moves
   - Check if buffer fills up and drops packets

### Secondary (If Hardware is OK)
1. **Implement Ring Buffer for MIDI Feedback**
   - Current parser may have buffer management issues
   - Switch to circular ring buffer with overflow detection
   - Add queue depth metrics to logs

2. **Add Channel-Specific Diagnostics**
   - Log every MIDI message received, grouped by channel
   - Add counters: "Messages sent channel 0", "Feedback received channel 0"
   - Display mismatch in diagnostics

3. **Test with Different Move Patterns**
   - Sequential moves (Fader 0 complete, then Fader 1)
   - Slower speed (test at speed=10 instead of 100)
   - Different target positions (25%, 50%, 75% instead of 100%)

### Tertiary (If Tests Confirm Hardware Issue)
1. **Fader 1 Replacement/Repair**
   - If motor moves but encoder doesn't feedback → encoder failure
   - If motor doesn't move → motor failure
   - Contact hardware vendor

2. **Workaround Configuration**
   - Disable Fader 1 in config if replacement unavailable
   - Or enable software-only mode permanently
   - Document as "Fader 1 Hardware Failure - Software Mode Only"

## Files & Logs for Reference

- Test script: [tests/run_hardware_full_range.sh](tests/run_hardware_full_range.sh)
- Test code: [tests/test_hardware_full_range.js](tests/test_hardware_full_range.js)
- MIDI feedback handler: [lib/faderController/core/FaderController.js#L338](lib/faderController/core/FaderController.js#L338)
- Feedback tracker: [lib/faderController/midi/MIDIFeedbackTracker.js](lib/faderController/midi/MIDIFeedbackTracker.js)
- Test logs: Review journalctl output with pattern `[CALIB]` for feedback messages

## Test Timing Data (as Recorded)

| Metric | Fader 0 0→100 | Fader 0 100→0 | Fader 1 0→100 | Fader 1 100→0 |
|--------|--------|----------|---------|----------|
| **Reported Duration** | 2ms | 3ms | 3ms | 2ms |
| **Actual Duration** | 1308ms | 1411ms | 1ms* | 2ms* |
| **Feedback Messages** | 80+ | 80+ | 0 | 0 |
| **Tracking Type** | Hardware | Hardware | Software | Software |
| **Final Position** | 16367/16383 (99.9%) | 16/16383 (0.09%) | Unknown | Unknown |

*Software timing = not actual hardware move time

---

**Next Action**: Run Fader 1-only isolation test to determine if this is a dual-fader buffer issue or single-fader hardware failure. 

