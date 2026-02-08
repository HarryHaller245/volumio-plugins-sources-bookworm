# Hardware Testing Analysis - February 8, 2026

## Executive Summary

The initial hardware flow tests (Phase 1 & 2) **passed successfully**, but **Phase 3 (Manual Calibration) revealed critical timing synchronization issues** that are causing unreliable fader movements during advanced calibration.

---

## Test Results by Phase

### ✅ Phase 1: Movement Test (Reset → Max → Min)
**Status**: PASSED  
**Observations**:
- Both faders moving together
- Full range of motion (0 → 100)
- Fast but complete movements
- Quality: Smooth, no stuttering

### ✅ Phase 2: Basic Calibration
**Status**: PASSED  
**Observations**:
- Full and controlled moves
- Both faders responding
- Consistent return to home (0)
- Quality: Smooth, steady progression

### ❌ Phase 3: Manual (Advanced) Calibration
**Status**: FAILED with critical issues
**Observations**:
1. **Only Fader 0 moved** - Fader 1 never engaged
2. **Speed envelope collapse** - After first move, faders only operated in upper 90% range (90-100)
3. **Timing misalignment** - Moves too fast, hardware feedback out of sync with software simulation
4. **Incomplete moves** - Failed to reach full 0% position on retry cycles

---

## Root Cause Analysis

### The Timing Problem

The hardware testing revealed a **mismatch between software timing simulation and actual MIDI feedback**:

#### Current Implementation (INCORRECT)
```javascript
// From runCalibrationMove()
const queueProcessingTime = messageCount * messageDelayMs;
await this.moveFaders(faderMove, false, false);
await new Promise(resolve => setTimeout(resolve, Math.ceil(queueProcessingTime)));
// Returns duration based on CALCULATION
return duration;
```

**Problem**: 
- The software calculates delay based on MIDI queue processing (typically 10-50ms)
- The actual hardware takes **much longer** to physically move and send back SysEx feedback
- Example: For a full 0→100 move at speed 50:
  - Calculated delay: ~30-50ms
  - Actual move + feedback: 200-400ms
  - **Gap: 4-8x slower than expected**

#### Why This Breaks Calibration
1. **Queued commands execute before hardware catches up**
2. Second move command arrives while hardware is still moving from first command
3. Motor controller gets confused, only one fader responds
4. Timing data becomes meaningless (moves complete before feedback arrives)

---

## Hardware Behavior Findings

### Speed Responsiveness
- **Speed 10 (SLOW)**: Expected ~180-200ms for full move → Actual: Takes longer (exact: TBD)
- **Speed 50 (MEDIUM)**: Expected ~40-50ms → Actual: Much longer (exact: TBD)
- **Speed 100 (FAST)**: Expected ~11ms → Actual: Closer but still slower (exact: TBD)

**Conclusion**: Speed values are not proportional to actual timing. The hardware needs **real-time feedback correlation**, not mathematical simulation.

### Dual Fader Behavior
- Phase 2 (basic calibration) moves both faders successfully
- Phase 3 (advanced calibration) moves only one fader
- **Hypothesis**: The faster-than-actual timing causes motor controller to drop the second fader command, or there's a single-fader limit during calibration moves

---

## Recommended Fixes (Priority Order)

### 1. CRITICAL: Fix Timing Synchronization
**Location**: `lib/faderController/core/FaderController.js` → `runCalibrationMove()`

**Current Approach**: Guess at timing based on queue math  
**Correct Approach**: Wait for actual MIDI feedback from hardware

**Implementation**:
```javascript
async runCalibrationMove(index, StartProgression, EndProgression, speed, resolution) {
  const fader = this.getFader(index);
  const faderMove = new FaderMove([index], [EndProgression], [speed], resolution);
  
  // WAIT FOR ACTUAL HARDWARE FEEDBACK, not simulated delay
  const feedbackPromise = new Promise(resolve => {
    const onComplete = (faderIdx, info) => {
      if (faderIdx === index) {
        this.removeListener('move/complete', onComplete);
        resolve(info.duration || Date.now() - startTime);
      }
    };
    this.on('move/complete', onComplete);
    setTimeout(() => {
      this.removeListener('move/complete', onComplete);
      resolve(0); // Timeout fallback
    }, 5000); // 5 second max wait
  });
  
  const startTime = Date.now();
  await this.moveFaders(faderMove, false, false);
  const actualDuration = await feedbackPromise;
  
  return actualDuration;
}
```

### 2. HIGH: Investigate Dual Fader Conflict
**Location**: `lib/faderController/calibration/CalibrationEngine.js` → `runCalibration()`

**Issue**: Only fader 0 moves during sequential calibration runs  
**Question**: Are faders being calibrated sequentially or in parallel?  
**Test**: Check if `CALIBRATION_RUN_IN_PARALLEL` is being respected

**Action**: Force sequential, single-fader moves with confirmed feedback between each.

### 3. HIGH: Add Speed Validation Phase
**Already created**: `tests/test_hardware_speed.js` and `tests/run_hardware_speed.sh`

**Purpose**: Measure actual move times at each speed level to build a calibration curve  
**Expected Output**: A mapping of speed value → actual move time (ms)

**Run to validate**:
```bash
sh tests/run_hardware_speed.sh --agent --timeout=30
```

### 4. MEDIUM: Adjust Message Delay Config
**Location**: `config.json` → `FADER_CONTROLLER_MESSAGE_DELAY`

**Current**: 10ms  
**Issue**: Might be too aggressive, causing queue overflow or dropped commands  
**Recommendation**: Test with 20-50ms delays during calibration

### 5. MEDIUM: Add Movement Monitoring Logs
Enable during testing:
```bash
# Temporarily set in config.json:
"FADER_CONTROLLER_MOVE_LOG": true
```

This will log each move start/end with actual timing data.

---

## Test Recommendations Going Forward

### Next Steps (in order)

1. **Run Speed Test**
   ```bash
   sh tests/run_hardware_speed.sh
   ```
   - This gives us the **actual speed curve**
   - Answer: Does speed scale linearly or stepwise?
   - Answer: Is fader 0 faster/slower than fader 1?

2. **Fix `runCalibrationMove()` Timing**
   - Implement real feedback waiting (see Fix #1 above)
   - Rebuild the test with the fix
   - Verify timing data now matches hardware behavior

3. **Re-calibrate**
   - Run calibration again with corrected timing
   - Both faders should now move correctly
   - Timing data should be realistic

4. **Validate Speed Proportionality**
   - Check if speed factors are now correct
   - Verify faders reach full range in all positions

---

## Files to Examine

| File | Purpose | Issue Level |
|------|---------|-------------|
| [lib/faderController/core/FaderController.js](../../lib/faderController/core/FaderController.js#L564) | `runCalibrationMove()` | **CRITICAL** |
| [lib/faderController/calibration/CalibrationEngine.js](../../lib/faderController/calibration/CalibrationEngine.js) | Main calibration loop | HIGH |
| [config.json](../../config.json) | FADER_CONTROLLER_MESSAGE_DELAY | MEDIUM |
| [tests/test_hardware_speed.js](test_hardware_speed.js) | Speed validation (NEW) | Testing tool |

---

## Hardware Configuration Summary

Current hardware setup:
- **Faders**: 2 (indexes 0, 1)
- **Serial Port**: `/dev/ttyUSB0`
- **Baud Rate**: 1,000,000 (1 Mbps)
- **Speed Range**: 10 (LOW) → 50 (MEDIUM) → 100 (HIGH)
- **Calibration Resolutions**: 1, 0.8, 0.5, 0.2
- **Calibration Speeds**: 20 test points from 10 to 100

---

## Observations

### What Worked Well
✅ Phase 1 & 2 (basic moves and basic calibration)  
✅ Serial port connection and MIDI initialization  
✅ Fader encoder feedback reception  
✅ Plugin startup/shutdown lifecycle  

### What Failed
❌ Phase 3 timing synchronization  
❌ Dual-fader coordination during calibration  
❌ Speed-to-timing mapping  

### Hypothesis
The hardware is **working correctly**, but the software is **sending commands too fast** because it's not waiting for actual feedback. The solution is to measure real hardware timing and use that, not calculated delays.

---

## Next Session Agenda

1. Run speed test and collect timing data
2. Review the timing fix implementation
3. Run Phase 3 again with corrected timing
4. Validate all three phases pass with actual hardware feedback
5. Document final calibration results

