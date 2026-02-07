# 🎯 Action Plan - motorized_fader_control

**Project Work Roadmap**  
**Priority**: High  
**Start Date**: February 7, 2026  
**Target Completion**: February 14, 2026 (1 week sprint)

---

## 📋 Work Phases Overview

```
PHASE 0: CLEANUP          (2 hours)  ✓ In Progress
  └─ Move docs to subfolder
  └─ Organize repository structure

PHASE 1: BUGFIX           (4 hours)  [ ] Not Started
  └─ Fix logging TODOs
  └─ Add logging to services/eventbus

PHASE 2: TEST FUNCTION    (6 hours)  [ ] Not Started
  └─ Create unit test suite (Jest)
  └─ Integration tests

PHASE 3: CONFIG UI       (8 hours)  [ ] Not Started
  └─ Add MIDI feedback settings
  └─ Advanced options in UI
  └─ Update handlers in index.js

PHASE 4: OPTIMIZE        (6 hours)  [ ] Not Started
  └─ Performance tuning
  └─ Code cleanup & review
```

**Total Estimated**: 26 hours = ~3 working days

---

## 🧹 PHASE 0: CLEANUP (2 hours) - IN PROGRESS

### Objective
Organize repository documentation and move all agent-related docs to centralized docs folder for easy discovery and management.

### 0.1 Move Documentation Files to docs/

**Files to Move**:
- ✅ `STATUS.md` → `docs/STATUS.md`
- ✅ `DEPLOYMENT.md` → `docs/DEPLOYMENT.md`
- ✅ `ARCHITECTURE_UPGRADE.md` → `docs/ARCHITECTURE_UPGRADE.md`
- ✅ `MIGRATION_PLAN.md` → `docs/MIGRATION_PLAN.md`
- ✅ `MIGRATION_SUMMARY.md` → `docs/MIGRATION_SUMMARY.md`
- ✅ `QUICK_REFERENCE.md` → `docs/QUICK_REFERENCE.md`
- ✅ `PLAYBACK_TESTING.md` → `docs/PLAYBACK_TESTING.md`
- ✅ `README.md` → `docs/README.md`
- ✅ `ACTION_PLAN.md` → `docs/ACTION_PLAN.md` (this file)
- ✅ `AI_AGENT_INTRO.md` → `docs/AI_AGENT_INTRO.md` (NEW, already created)
- ✅ `PROJECT_OVERVIEW.md` → `docs/PROJECT_OVERVIEW.md` (NEW, already created)

**Status**: 
- [x] Created `docs/` folder
- [x] Created `AI_AGENT_INTRO.md` in docs/
- [x] Created `PROJECT_OVERVIEW.md` in docs/
- [ ] Copy remaining .md files to docs/
- [ ] Update `docs/README.md` (reference/index)
- [ ] Keep root `README.md` as entry point (link to docs/)
- [ ] Delete originals from root (after copying)

### 0.2 Create Root README.md (Entry Point)

**Action**: Create minimal root README.md that points to docs/:

```markdown
# motorized_fader_control - Volumio4 Plugin

> Motorized fader control for Volumio music server

## 📚 Documentation

👉 **New to this project?**  
Start here: [docs/AI_AGENT_INTRO.md](docs/AI_AGENT_INTRO.md) (5 min read)

**Full documentation**: [docs/](docs/)

## 🚀 Quick Start

```bash
./test_plugin.sh      # Validate
./deploy_plugin.sh    # Deploy
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for details.

## 📊 Project Status

✅ **Status**: Production Ready (v2.0.0)  
✅ **Architecture**: Modular V3 (22 files)  
✅ **Volumio**: Volumio4 compatible  

See [docs/STATUS.md](docs/STATUS.md) for full details.
```

### 0.3 Tasks

- [ ] **Task 0.1**: Copy status.md to docs/
- [ ] **Task 0.2**: Copy DEPLOYMENT.md to docs/
- [ ] **Task 0.3**: Copy all other .md files to docs/
- [ ] **Task 0.4**: Update root README.md with entry point
- [ ] **Task 0.5**: Create docs/INDEX.md (documentation reference)
- [ ] **Task 0.6**: Delete original .md files from root
- [ ] **Task 0.7**: Verify all links work in docs/

---

## 🐛 PHASE 1: BUGFIX (4 hours) - NOT STARTED

### Objective
Fix identified bugs and complete code cleanup, particularly around logging and i18n integration.

### 1.1 Fix Logging TODOs (Lines 63-65 in index.js)

**Current Issue** (lines 63-65):
```javascript
//TODO: Implement and Use i18n logs_en.json: EXAMPLE: self.logger.info(`${self.logs.LOGS.START.HEADER}
//TODO: Add Logging to services and eventbus
//TODO: Remove additional LOGS. in logs_en.js and logs
```

**What This Means**:
- Logging is using hardcoded strings instead of i18n keys
- Services (VolumeService, TrackService) don't have logging
- EventBus logging is inconsistent

**Fix Approach**:
1. Load `logs_en.json` into `self.logs` at startup
2. Replace hardcoded log messages with `self.logs.KEY` references
3. Add logging to Services (constructor + subscribe/execute)
4. Add logging to EventBus (emit/on/off events)
5. Update `logs_en.json` with complete key set

**Files to Modify**:
- [index.js](../index.js) - Remove TODOs, implement i18n
- [lib/services/VolumeService.js](../lib/services/VolumeService.js) - Add logger param
- [lib/services/TrackService.js](../lib/services/TrackService.js) - Add logger param
- [lib/services/AlbumService.js](../lib/services/AlbumService.js) - Add logger param
- [lib/EventBus.js](../lib/EventBus.js) - Add logging to emit/on
- [i18n/logs_en.json](../i18n/logs_en.json) - Add missing log keys

### 1.2 Add Missing Log Keys to i18n

**Current Gap**:
- `logs_en.json` has generic keys like `LOGS.START.HEADER`
- Need specific keys for Services and EventBus

**New Keys Needed**:
```json
{
  "LOGS": {
    "VOLUME_SERVICE": {
      "INITIALIZED": "VolumeService initialized",
      "POSITION_UPDATE": "Volume position update",
      "ERROR": "Volume service error"
    },
    "TRACK_SERVICE": {
      "INITIALIZED": "TrackService initialized",
      "SEEK_UPDATE": "Track seek update",
      "ERROR": "Track service error"
    },
    "EVENTBUS": {
      "EMIT": "EventBus emit",
      "SUBSCRIBE": "EventBus subscribe",
      "UNSUBSCRIBE": "EventBus unsubscribe"
    }
  }
}
```

### 1.3 Tasks

- [ ] **Task 1.1**: Load logs_en.json into index.js startup
- [ ] **Task 1.2**: Replace hardcoded strings with i18n keys in index.js
- [ ] **Task 1.3**: Add logger to VolumeService constructor
- [ ] **Task 1.4**: Add logger to TrackService constructor
- [ ] **Task 1.5**: Add logger to AlbumService constructor
- [ ] **Task 1.6**: Add logging to Services' subscribe/execute methods
- [ ] **Task 1.7**: Add logging to EventBus emit/on/off
- [ ] **Task 1.8**: Update logs_en.json with new keys
- [ ] **Task 1.9**: Test deployment with updated logging
- [ ] **Task 1.10**: Verify logs in journalctl output

---

## ✅ PHASE 2: TEST FUNCTION (6 hours) - NOT STARTED

### Objective
Create comprehensive test suite for plugin components. Currently, package.json has placeholder test.

### 2.1 Setup Jest Testing Framework

**Action**: Install Jest and set up test infrastructure

```bash
npm install --save-dev jest
npm install --save-dev @babel/preset-env @babel/preset-modules
```

**Files to Create**:
- `jest.config.js` - Test configuration
- `.babelrc` - Babel config for jest
- `test/` directory - Test files

### 2.2 Unit Tests for Services

**File**: `test/services/VolumeService.test.js`

```javascript
describe('VolumeService', () => {
  describe('subscribe()', () => {
    test('should subscribe to fader:position events')
    test('should unsubscribe on unsubscribe()')
  })
  
  describe('execute()', () => {
    test('should calculate volume from fader value')
    test('should call Volumio API with correct volume')
    test('should handle edge cases (0, 100)')
  })
})
```

**Scope**:
- VolumeService (100% coverage)
- TrackService (100% coverage)
- AlbumService (50% coverage)

### 2.3 Integration Tests for FaderController

**File**: `test/faderController/FaderController.integration.test.js`

```javascript
describe('FaderController Integration', () => {
  describe('MIDI parsing and command execution', () => {
    test('should parse MIDI bytes correctly')
    test('should queue commands in order')
    test('should emit events via EventBus')
    test('should handle calibration flow')
  })
})
```

**Scope**:
- MIDI parsing
- Command queuing
- Event emission
- Calibration sequence

### 2.4 Update package.json

**Change**:
```json
"scripts": {
  "test": "jest --coverage",
  "test:watch": "jest --watch",
  "test:unit": "jest test/services/",
  "test:integration": "jest test/faderController/"
}
```

### 2.5 CI/CD Integration (Optional)

**Add**: GitHub Actions workflow (if using GitHub)
- Auto-run tests on push
- Report coverage
- Fail if coverage drops

### 2.6 Tasks

- [ ] **Task 2.1**: Install Jest and Babel
- [ ] **Task 2.2**: Create jest.config.js
- [ ] **Task 2.3**: Create test/services/VolumeService.test.js
- [ ] **Task 2.4**: Create test/services/TrackService.test.js
- [ ] **Task 2.5**: Create test/services/AlbumService.test.js
- [ ] **Task 2.6**: Create test/faderController/integration.test.js
- [ ] **Task 2.7**: Update package.json scripts
- [ ] **Task 2.8**: Run tests, achieve 80%+ coverage
- [ ] **Task 2.9**: Fix failing tests
- [ ] **Task 2.10**: Document testing in docs/

---

## 🎛️ PHASE 3: HARDWARE FEEDBACK CONFIG (8 hours) - NOT STARTED

### Objective
Make MIDI hardware feedback behavior configurable in the web UI. Currently, feedback is partial/hardcoded.

### 3.1 Analysis: What Is Hardware Feedback?

**Current Behavior**:
- When software (Volumio) changes volume, fader physical position doesn't update
- Only internal tracking happens in MIDIFeedbackTracker
- User expects: "If I change volume in Volumio, the fader should move too"

**Benefits if Enabled**:
- Visual sync between UI and physical fader
- User knows "what the system thinks the volume is"
- Better for multi-client scenarios

### 3.2 Add UI Configuration Options

**New Section in UIConfig.json**: "Hardware Feedback"

```json
{
  "id": "section_hardware_feedback",
  "element": "section",
  "label": "TRANSLATE.SECTION.HARDWARE_FEEDBACK",
  "content": [
    {
      "id": "FEEDBACK_ENABLED",
      "type": "switch",
      "label": "Enable Hardware Feedback",
      "value": false
    },
    {
      "id": "FEEDBACK_DELAY_MS",
      "type": "number",
      "label": "Feedback Delay (ms)",
      "value": 100,
      "doc": "Delay before moving faders in response to software changes"
    },
    {
      "id": "FEEDBACK_SMOOTH_MOVEMENT",
      "type": "switch",
      "label": "Smooth Movement",
      "value": true,
      "doc": "Use smooth speed calculation or jump to position"
    },
    {
      "id": "FEEDBACK_SPEED",
      "type": "select",
      "label": "Feedback Movement Speed",
      "options": [
        {"label": "Slow", "value": "LOW"},
        {"label": "Normal", "value": "MEDIUM"},
        {"label": "Fast", "value": "HIGH"}
      ],
      "value": "MEDIUM"
    }
  ]
}
```

### 3.3 Add Translation Keys

**Update i18n/strings_en.json**:
```json
{
  "TRANSLATE": {
    "SECTION": {
      "HARDWARE_FEEDBACK": "Hardware Feedback Settings",
      "HARDWARE_FEEDBACK_DESCRIPTION": "Configure how physical faders respond to software changes"
    },
    "HARDWARE_FEEDBACK": {
      "LABEL_FEEDBACK_ENABLED": "Enable Hardware Feedback",
      "DOC_FEEDBACK_ENABLED": "When enabled, physical faders move when volume/seek changes in Volumio",
      "LABEL_DELAY": "Feedback Delay (ms)",
      "DOC_DELAY": "Milliseconds to wait before moving faders",
      "LABEL_SMOOTH": "Smooth Movement",
      "DOC_SMOOTH": "Smooth acceleration vs instant jump",
      "LABEL_SPEED": "Feedback Speed"
    }
  }
}
```

### 3.4 Implement Configuration Handler

**Add to index.js**:

```javascript
onExternalApiCall(method, data) {
  // Handle saveHardwareFeedback
  if (method === 'saveHardwareFeedback') {
    // Parse incoming data
    let settings = {
      enabled: data.FEEDBACK_ENABLED,
      delayMs: data.FEEDBACK_DELAY_MS,
      smooth: data.FEEDBACK_SMOOTH_MOVEMENT,
      speed: data.FEEDBACK_SPEED
    }
    
    // Save to config
    self.config.set('FEEDBACK_SETTINGS', settings)
    
    // Update FaderController if needed
    if (self.faderController) {
      self.faderController.setFeedbackConfig(settings)
    }
    
    return {success: true}
  }
}
```

### 3.5 Update FaderController

**Modify lib/faderController/core/FaderController.js**:

```javascript
setFeedbackConfig(config) {
  this.feedbackConfig = config
  
  if (config.enabled) {
    this.subscribeToVolumeChanges()
  } else {
    this.unsubscribeFromVolumeChanges()
  }
}

subscribeToVolumeChanges() {
  // Listen to Volumio volume change events
  // When volume changes, move corresponding fader to new position
}
```

### 3.6 Add Feedback Logic

**Where to Add**:
- VolumeService receives Volumio volume change
- Emits event with new volume
- FaderController listens (if feedback enabled)
- Calculates target position
- Executes smooth move with configured speed
- Fader arrives at position matching Volumio state

### 3.7 Tasks

- [ ] **Task 3.1**: Add hardware feedback section to UIConfig.json
- [ ] **Task 3.2**: Add translation keys to strings_en.json
- [ ] **Task 3.3**: Add saveHardwareFeedback method to index.js
- [ ] **Task 3.4**: Update onExternalApiCall to handle new method
- [ ] **Task 3.5**: Add feedback configuration to config.json defaults
- [ ] **Task 3.6**: Add setFeedbackConfig to FaderController
- [ ] **Task 3.7**: Implement subscribeToVolumeChanges in FaderController
- [ ] **Task 3.8**: Implement feedback movement execution
- [ ] **Task 3.9**: Test UI configuration save/load
- [ ] **Task 3.10**: Test hardware feedback movement behavior
- [ ] **Task 3.11**: Document new feature in PLAYBACK_TESTING.md

---

## ⚡ PHASE 4: OPTIMIZE & ENHANCE (6 hours) - NOT STARTED

### Objective
Performance improvements, code cleanup, and quality enhancements.

### 4.1 Performance Tuning

**Analysis Areas**:
- MIDI parsing efficiency
- Event emission overhead
- StateCache lookup speed
- Memory leak detection

**Specific Optimizations**:
1. **Cache compiled regex** in MIDIParser
   - Currently regex compiled on each message
   - Pre-compile once at startup

2. **Batch event emissions**
   - Multiple rapid events could be combined
   - Reduces EventBus processing

3. **Remove dead code**
   - Unused variables/functions
   - Commented-out code blocks

### 4.2 Code Review & Cleanup

**Review Checklist**:
- [ ] All console.log() replaced with logger
- [ ] No hardcoded values (everything in config)
- [ ] Consistent naming conventions
- [ ] Comments for complex logic
- [ ] Error handling complete
- [ ] No leftover debugging code

### 4.3 Add JSDoc Comments

**Add to**:
- FaderController methods
- Service methods
- MIDI handler functions

**Example**:
```javascript
/**
 * Move faders to target positions with configurable speed
 * @param {Object} moves - Movement descriptor
 * @param {Array<number>} moves.indexes - Fader indexes to move
 * @param {Array<number>} moves.targets - Target positions (0-100)
 * @param {string} moves.speed - 'LOW'|'MEDIUM'|'HIGH'
 * @returns {Promise} Resolves when movement completes
 */
async moveFaders(moves) {
  // ...
}
```

### 4.4 Enhance Error Messages

**Current**: Generic errors  
**Target**: Specific, actionable errors

**Example**:
```javascript
// Before
throw new Error("Serial port error")

// After
throw new SerialPortError(
  `Failed to open serial port ${port} at ${baudRate} baud. ` +
  `Check device connection with: ls /dev/tty*`
)
```

### 4.5 Add Monitoring Helpers

**Create**: `lib/Monitoring.js`

```javascript
class Monitoring {
  // Track plugin health metrics
  // Uptime, error count, latency, throughput
  
  getMetrics() {
    return {
      uptime: ms,
      errors: count,
      avgLatency: ms,
      midiMessagesProcessed: count
    }
  }
}
```

### 4.6 Tasks

- [ ] **Task 4.1**: Profile code to find bottlenecks
- [ ] **Task 4.2**: Cache compiled regex in MIDIParser
- [ ] **Task 4.3**: Implement event batching in EventBus
- [ ] **Task 4.4**: Remove dead code and comments
- [ ] **Task 4.5**: Add JSDoc to function signatures
- [ ] **Task 4.6**: Enhance error messages with context
- [ ] **Task 4.7**: Create Monitoring.js utility
- [ ] **Task 4.8**: Performance benchmark before/after
- [ ] **Task 4.9**: Measure memory usage improvements
- [ ] **Task 4.10**: Documentation update

---

## 📈 Progress Tracking

### Phase Completion

```
Phase 0 (Cleanup):           ████░░░░░░ 40% (2h/5h done)
Phase 1 (Bugfix):            ░░░░░░░░░░  0% (0h/4h)
Phase 2 (Tests):             ░░░░░░░░░░  0% (0h/6h)
Phase 3 (Hardware Config):   ░░░░░░░░░░  0% (0h/8h)
Phase 4 (Optimize):          ░░░░░░░░░░  0% (0h/6h)
                             ─────────────────────
Overall:                     ████░░░░░░  8% (2h/26h)
```

### Key Milestones

| Milestone | Deadline | Status |
|-----------|----------|--------|
| Cleanup phase complete | Feb 7, 2026 | 🟡 In Progress |
| Bugfix phase complete | Feb 8, 2026 | ⭕ Not Started |
| Tests written | Feb 9, 2026 | ⭕ Not Started |
| Hardware feedback working | Feb 10, 2026 | ⭕ Not Started |
| Optimization complete | Feb 11, 2026 | ⭕ Not Started |
| Final testing & validation | Feb 12-13, 2026 | ⭕ Not Started |
| Release v2.1.0 | Feb 14, 2026 | ⭕ Not Started |

---

## 🎯 Success Criteria

**Phase 0**: 
- ✅ All .md files in docs/ folder
- ✅ Root README.md points to docs/
- ✅ All internal links updated

**Phase 1**:
- ✅ All logging uses i18n keys
- ✅ Services have logging
- ✅ Zero hardcoded log strings

**Phase 2**:
- ✅ Jest configured and running
- ✅ 80%+ code coverage
- ✅ All tests passing

**Phase 3**:
- ✅ Hardware feedback toggleable in UI
- ✅ Settings save/load correctly
- ✅ Faders respond to software volume changes

**Phase 4**:
- ✅ Code review completed
- ✅ Performance improvements measured
- ✅ 20%+ faster MIDI parsing

---

## 🔗 Related Documents

- [AI_AGENT_INTRO.md](AI_AGENT_INTRO.md) - Quick start for new agents
- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - Detailed technical documentation
- [STATUS.md](STATUS.md) - Current release status
- [DEPLOYMENT.md](DEPLOYMENT.md) - How to deploy

---

**Action Plan Version**: 1.0  
**Created**: February 7, 2026  
**Next Review**: After Phase 1 completion  
**Maintained By**: Development Team
