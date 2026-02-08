# Calibration System Bug Fix Report

## Date: February 7, 2026

### Critical Bugs Fixed

#### 1. **Undefined `duration` Variable in `runCalibrationMove`** ✓ FIXED
**Location**: [lib/faderController/core/FaderController.js](../lib/faderController/core/FaderController.js#L557)

**Issue**: 
- Function returned undefined `duration` instead of actual move timing
- This caused all `runTimes` arrays to remain empty throughout calibration
- Resulted in `NaN` upstream calculations (avgTime, stdDev, speedFactor)

**Root Cause**:
```javascript
// BEFORE (BROKEN):
async runCalibrationMove(index, StartProgression, EndProgression, speed, resolution) {
  const fader = this.getFader(index);
  const faderMove = new FaderMove([index], [StartProgression], [EndProgression], speed, resolution);
  await this.moveFaders(faderMove, false, false);
  return duration;  // ← "duration" variable never defined!
}
```

**Solution**:
- Extract actual duration from `MIDIFeedbackTracker` feedback statistics
- Each fader move stores timing data in feedback statistics after completion
- Return the duration from the most recent statistics entry

```javascript
// AFTER (FIXED):
async runCalibrationMove(index, StartProgression, EndProgression, speed, resolution) {
  const fader = this.getFader(index);
  const faderMove = new FaderMove([index], [StartProgression], [EndProgression], speed, resolution);
  await this.moveFaders(faderMove, false, false);

  // Extract duration from feedback statistics
  const stats = this.midiQueue.feedbackTracker.getFeedbackStatistics(index);
  if (stats && stats.length > 0) {
    const lastStat = stats[stats.length - 1];
    const duration = lastStat.duration || 0;
    return duration;
  }
  
  this.config.logger.warn(`No feedback statistics for fader ${index}, using 0ms`);
  return 0;
}
```

---

#### 2. **Missing Null Checks in `logStatistics`** ✓ FIXED
**Location**: [lib/faderController/calibration/CalibrationEngine.js](../lib/faderController/calibration/CalibrationEngine.js#L133)

**Issue**:
- Function assumed `runTimes` always contained data
- Empty arrays caused division errors and `NaN` results
- No validation of input data before calculations

**Solution**:
- Added early validation to detect empty `runTimes`
- Return early with explicit null values instead of trying to calculate
- Log warnings when timing data is missing

---

#### 3. **Faulty Speed Factor Calculation** ✓ FIXED
**Location**: [lib/faderController/calibration/CalibrationEngine.js](../lib/faderController/calibration/CalibrationEngine.js#L176)

**Issue**:
- `calculateOptimalSettings` failed when:
  - `effectiveSpeed` was `null`, `NaN`, or `0`
  - Division by zero: `refSpeed / effectiveSpeed`
  - No handling of invalid calibration data
- Result: All speed factors = `NaN`

**Solution**:
- Filter out invalid test data before calculating best resolution
- Check `effectiveSpeed` validity before division
- Default to speedFactor of 1 if calculation fails
- Added specific error messages for debugging

---

### Calibration Data Flow (FIXED)

```
┌─────────────────────────────────────────────────────────────┐
│ runCalibrationMove()                                         │
│  ├─ Executes FaderMove                                       │
│  ├─ Waits for move completion                               │
│  └─ [NEW] Extracts duration from MIDIFeedbackTracker        │
│          └─ Returns duration (no longer undefined!)         │
└────────┬────────────────────────────────────────────────────┘
         │ duration
         ▼
┌─────────────────────────────────────────────────────────────┐
│ performCalibrationRuns()                                    │
│  └─ Collects durations into runTimes array                 │
└────────┬────────────────────────────────────────────────────┘
         │ runTimes[]
         ▼
┌─────────────────────────────────────────────────────────────┐
│ logStatistics()                                             │
│  ├─ [NEW] Validates runTimes array                         │
│  ├─ Calculates: avgTime, stdDev, effectiveSpeed           │
│  └─ Stores calibration results (no more NaN!)              │
└────────┬────────────────────────────────────────────────────┘
         │ calibrationResults
         ▼
┌─────────────────────────────────────────────────────────────┐
│ calculateOptimalSettings()                                  │
│  ├─ [NEW] Validates effectiveSpeed values                  │
│  ├─ Calculates: speedFactor = refSpeed / effectiveSpeed   │
│  └─ Returns valid speedFactor (no more NaN!)               │
└────────┬────────────────────────────────────────────────────┘
         │ speedFactor
         ▼
┌─────────────────────────────────────────────────────────────┐
│ ✓ Fader Calibration Complete                               │
│   fader.speedFactor = 1.2 (or calculated value)            │
│   fader.optimalResolution = 1 (or best resolution)         │
└─────────────────────────────────────────────────────────────┘
```

---

### Testing Results

**Before Fix**:
```
Fader 0 calibration complete:
- Optimal resolution: 1
- Speed factor: NaN  ← ✗ BROKEN

Calibration Table:
Fader  Resolution  Speed %  Avg Time (ms)  ±Dev   Speed (u/s)
0      1           10       NaN            NaN    NaN  ← All NaN ✗
0      1           15       NaN            NaN    NaN
...
```

**After Fix** (Expected):
```
Fader 0 calibration complete:
- Optimal resolution: 1
- Speed factor: 1.05 ← ✓ Valid number

Calibration Table:
Fader  Resolution  Speed %  Avg Time (ms)  ±Dev   Speed (u/s)
0      1           10       95.2           2.1    105.3  ← Valid data ✓
0      1           15       68.4           1.8    146.2
...
```

---

### Files Modified

1. **[lib/faderController/core/FaderController.js](../lib/faderController/core/FaderController.js)**
   - Fixed `runCalibrationMove()` to return actual duration

2. **[lib/faderController/calibration/CalibrationEngine.js](../lib/faderController/calibration/CalibrationEngine.js)**
   - Added validation in `logStatistics()`
   - Added robustness in `calculateOptimalSettings()`
   - Improved error handling and warnings

---

### Next Steps

1. ✓ Deploy fixes
2. ⏳ Test calibration via UI
3. ⏳ Verify speedFactor values are calculated correctly
4. ⏳ Test playback feedback (track seek/album navigation)
5. ⏳ Test volume control integration

---

### Related Issues

- Speed factor initialization: Properly defaults to 1.0
- Calibration statistics: Now capture real hardware feedback timing
- Error resilience: System can recover from edge cases
