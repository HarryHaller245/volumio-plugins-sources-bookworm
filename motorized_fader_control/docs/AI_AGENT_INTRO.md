# 🤖 AI Agent Introduction - motorized_fader_control

**Purpose**: Quick context setup for new AI agents joining this project.  
**Read Time**: 3-5 minutes  
**Last Updated**: February 7, 2026

---

## 📌 What Is This Project?

**motorized_fader_control** is a **Volumio4 plugin** that enables motorized fader hardware to control music playback parameters (volume, track seeking) on a Linux-based music server.

### Key Facts:
- **Type**: System Hardware Plugin for Volumio 4
- **Language**: Node.js (v20.5.1+)
- **Status**: ✅ Production-Ready (v2.0.0)
- **Architecture**: Modular V3 design (22 files in lib/faderController/)
- **Main Plugin Size**: 1,238 lines (index.js)
- **Hardware Interface**: MIDI via USB serial port
- **Target Device**: Raspberry Pi (bookworm OS)

---

## 🏗️ Project Structure at a Glance

```
motorized_fader_control/
├── index.js                  # Main plugin (1,238 lines) - plugin lifecycle & UI handling
├── config.json              # Hardware configuration (Serial port, baud rate, fader settings)
├── UIConfig.json            # Web UI form definitions (424 lines)
├── package.json             # Dependencies (7 packages)
├── docs/                    # Documentation (this folder)
│   ├── AI_AGENT_INTRO.md   # This file
│   ├── PROJECT_OVERVIEW.md # Detailed overview
│   ├── STATUS.md           # Current status & achievements
│   ├── DEPLOYMENT.md       # How to deploy
│   ├── ARCHITECTURE_UPGRADE.md # V2→V3 migration details
│   └── [4 more docs]
├── lib/                     # Core business logic
│   ├── faderController/     # Main controller (22 files)
│   │   ├── core/           # Fader instances & movement logic
│   │   ├── midi/           # MIDI parsing, queue, feedback
│   │   ├── calibration/    # Hardware calibration engine
│   │   ├── events/         # Event system
│   │   └── errors.js       # Error definitions
│   ├── services/           # Business logic (Album, Track, Volume services)
│   ├── EventBus.js         # Centralized event system
│   ├── StateCache.js       # State management
│   └── CustomLogger.js     # Logging utility
├── i18n/                    # Translations (112 keys)
│   ├── strings_en.json     # UI strings
│   └── logs_en.json        # Log messages
├── test_plugin.sh          # Validates before deployment
├── deploy_plugin.sh        # Deploys to Volumio
└── [other config files]
```

---

## 🎯 How It Works (Simple Version)

```
Physical Fader Hardware
         ↓ (USB Serial)
    MIDI Messages
         ↓
   MIDIParser.js (Parse MIDI bytes)
         ↓
   MIDIQueue.js (Buffer & prioritize)
         ↓
   FaderController.js (Execute commands)
         ↓
   Services (VolumeService, TrackService)
         ↓
   Volumio Core API (Change volume/seek)
         ↓
   UI Updates → User sees changes
         ↓
   MIDIFeedbackTracker.js (Optional: move physical fader to match state)
```

**Key Concept**: It's a 2-way sync - software commands move faders, user moves faders update software.

---

## 🔧 Core Technologies & Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `serialport` | Hardware communication | 11.0.0 |
| `socket.io-client` | Real-time updates | 4.8.3 |
| `v-conf` | Configuration management | 1.4.0 |
| `kew` | Promise library | 0.7.0 |
| `winston` | Logging | 3.13.0 |
| `fs-extra` | File operations | 0.28.0 |
| `async-mutex` | Thread-safe operations | 0.5.0 |

---

## 📊 Current Work Status

### ✅ Completed (Stable)
- Volumio4 migration complete
- Modular architecture implemented
- Hardware communication working
- UI controls functional
- Comprehensive documentation

### 🔧 In-Progress / To-Do
- **Hardware Feedback Config**: Make MIDI feedback configurable in UI
- **Test Functions**: Implement proper unit/integration tests
- **Bug Fixes**: Address known issues in logging
- **Optimization**: Performance improvements

---

## 🚀 Quick Start (For Agents)

### See What's Happening
```bash
cd /home/volumio/volumio-plugins-sources-bookworm/motorized_fader_control

# Check current state
cat STATUS.md

# Deploy & test
./test_plugin.sh      # Validate syntax & modules
./deploy_plugin.sh    # Deploy to Volumio
```

### Make Changes
1. **Edit code** in `lib/` or `index.js`
2. **Update translations** in `i18n/strings_en.json`
3. **Add UI elements** in `UIConfig.json`
4. **Run tests**: `./test_plugin.sh`
5. **Deploy**: `./deploy_plugin.sh`

### Understand the Code Flow
1. Start at [index.js line 25](../index.js#L25) - `motorizedFaderControl` function
2. See initialization in `onStart()` method [line 100+](../index.js#L100)
3. FaderController setup in [lib/faderController/index.js](../lib/faderController/index.js)
4. Event handling in [lib/EventBus.js](../lib/EventBus.js)

---

## 📚 Documentation Map

| Document | When to Read | Time |
|----------|-------------|------|
| **PROJECT_OVERVIEW.md** | Want detailed system design | 10 min |
| **STATUS.md** | Need current project status | 5 min |
| **DEPLOYMENT.md** | Deploying plugin to hardware | 10 min |
| **ARCHITECTURE_UPGRADE.md** | Understanding V2→V3 changes | 15 min |
| **PLAYBACK_TESTING.md** | Testing plugin functionality | 15 min |
| **QUICK_REFERENCE.md** | Quick lookup checklist | 2 min |

---

## 💡 Key Concepts for Developers

### 1. **Plugin Lifecycle**
```
onStart() → Initialize FaderController → Connect Services → Listen for Events → Ready
  ↓
onExternalApiCall() → Handle UI triggers
  ↓
onStop() → Cleanup, close faders, disconnect
```

### 2. **MIDI Communication**
- Hardware sends MIDI messages on USB serial port
- Parser converts bytes to meaningful commands
- Queue buffers commands to prevent overflow
- Controller executes commands sequentially

### 3. **Event Flow**
```
MIDI Input → FaderEventEmitter → EventBus → Services → Volumio API
```

### 4. **State Management**
- `StateCache` stores current playback/volume state
- Services read/write state
- UI updates reflect state changes
- Fader positions synchronized with state

### 5. **Error Handling**
- File: `lib/faderController/errors.js`
- Custom error classes for different failure modes
- Graceful degradation (faders fail, plugin continues)

---

## 🐛 Known Issues (TODOs)

Currently identified in code:
1. **Line 63-65**: i18n logging not fully implemented
   - Logs should use translations from `logs_en.json`
   - Add logging to Services and EventBus
   - Clean up redundant logging

2. **UI Configuration Gap**:
   - MIDI feedback options not exposed in UI
   - Some advanced settings hard-coded

3. **Testing Gap**:
   - No unit tests yet
   - Manual playback testing documented

---

## 🎓 Code Reading Sequence

For best understanding, read in this order:

1. **lib/EventBus.js** (50 lines) - Event system foundation
2. **lib/StateCache.js** (60 lines) - State management
3. **lib/faderController/core/FaderController.js** (100 lines) - Main logic
4. **lib/faderController/midi/MIDIParser.js** (80 lines) - MIDI byte parsing
5. **lib/faderController/midi/MIDIQueue.js** (100 lines) - Command queueing
6. **lib/services/VolumeService.js** (80 lines) - Volume control
7. **index.js** (1,238 lines) - Integration & UI handling

---

## 💬 Common Questions

**Q: How do I add a UI control?**  
A: Edit `UIConfig.json`, then handle in `index.js` with a save method like `saveGeneralSettingsRestart`.

**Q: How do I test a change?**  
A: Run `./test_plugin.sh` for validation, then `./deploy_plugin.sh` for live testing.

**Q: Where are the logs?**  
A: `journalctl -u volumio -f | grep motorized_fader_control`

**Q: How do I modify MIDI behavior?**  
A: Edit `lib/faderController/midi/MIDIHandler.js` and `MIDIParser.js`.

**Q: How do I add new translations?**  
A: Edit `i18n/strings_en.json` and reference the key in UIConfig.json.

---

## 🚦 Next Steps for Your Task

**Your assigned work** (see ACTION_PLAN.md):
1. **Cleanup**: Move docs to folder ✓ (in progress)
2. **Bugfix**: Fix logging TODOs (Lines 63-65)
3. **Test**: Implement test functions
4. **Config**: Add MIDI feedback UI controls
5. **Optimize**: Performance improvements

---

## 📞 Reference Info

- **Plugin Name**: motorized_fader_control
- **Version**: 2.0.0
- **License**: ISC
- **Volumio Version**: ≥4.84.0
- **Node Version**: 20.5.1+
- **Architecture**: amd64, armhf
- **OS**: bookworm (Debian 12)

---

**Last Updated**: February 7, 2026  
**Status**: ✅ Ready for Development
