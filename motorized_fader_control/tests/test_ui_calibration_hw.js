#!/usr/bin/env node

/**
 * UI Calibration Test - REAL HARDWARE
 * Simulates clicking CALIBRATE_BUTTON from UI with actual fader movements
 * 
 * This script:
 * 1. Loads the actual plugin with real hardware context
 * 2. Initializes FaderController with serial port and MIDI
 * 3. Calls RunManualCalibration() as if user clicked the button
 * 4. Monitors calibration progress with real fader feedback
 * 5. Displays final calibration results
 */

const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const { execSync } = require('child_process');

// Load config
const configPath = path.join(__dirname, '..', 'config.json');
const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const config = {};
Object.keys(rawConfig).forEach(key => {
  config[key] = rawConfig[key].value;
});

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║     UI CALIBRATION TEST - REAL HARDWARE                  ║');
console.log('║     Simulating: User clicks CALIBRATE_BUTTON            ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('⚙️  Configuration:');
console.log(`  • Serial Port: ${config.SERIAL_PORT}`);
console.log(`  • Baud Rate: ${config.BAUD_RATE}`);
console.log(`  • Fader Count: ${config.FADER_CONTROLLER_FADER_COUNT}`);
console.log(`  • Calibration Time Goal: ${config.CALIBRATION_TIME_GOAL}ms`);
console.log(`  • Speed Range: ${config.FADER_CONTROLLER_SPEED_LOW}-${config.FADER_CONTROLLER_SPEED_HIGH}`);
console.log(`  • Test Speeds: 20 speeds from ${config.CALIBRATION_START_SPEED} to ${config.CALIBRATION_END_SPEED}`);
console.log(`  • Resolutions: ${config.CALIBRATION_RESOLUTIONS}\n`);

console.log('📋 What will happen:');
console.log('  1. Plugin initializes with real serial port');
console.log('  2. FaderController connects to hardware');
console.log('  3. Calibration begins (faders will move multiple times)');
console.log('  4. Duration data collected from real fader feedback');
console.log('  5. Optimal speed factors calculated');
console.log('  6. Results displayed\n');

const startTime = Date.now();
let calibrationComplete = false;
let calibrationResults = null;

function ensureVolumioStopped() {
  try {
    const status = execSync('systemctl is-active volumio', {
      stdio: ['ignore', 'pipe', 'pipe']
    }).toString().trim();

    if (status === 'active') {
      console.error('Volumio service is active. Stop it before running this test.');
      console.error('Run: sudo systemctl stop volumio');
      process.exit(1);
    }
  } catch (err) {
    // If systemctl is unavailable, skip the check.
  }
}

(async () => {
  try {
    ensureVolumioStopped();

    // Load the actual plugin
    console.log('📦 Loading plugin module...');
    const PluginClass = require('../index.js');
    console.log('✅ Plugin module loaded\n');

    // Create mock Volumio context
    console.log('🔧 Creating Volumio context...');
    const CONTEXT = new EventEmitter();
    
    // Mock logger to satisfy CustomLogger requirements
    const mockLogger = {
      transports: [],
      info: (msg) => console.log(`[INFO] ${msg}`),
      debug: (msg) => console.log(`[DEBUG] ${msg}`),
      warn: (msg) => console.log(`⚠️  [WARN] ${msg}`),
      error: (msg) => console.log(`❌ [ERROR] ${msg}`)
    };
    
    CONTEXT.logger = mockLogger;
    
    // Load real plugin configuration files
    let pluginConfig = {};
    let uiConfig = {};
    
    try {
      const configPath = path.join(process.cwd(), 'config.json');
      const uiConfigPath = path.join(process.cwd(), 'UIConfig.json');
      
      if (fs.existsSync(configPath)) {
        pluginConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log(`  ✅ Loaded config from ${configPath}`);
        console.log(`  📊 FADER_BEHAVIOR value:`, pluginConfig.FADER_BEHAVIOR?.value);
      }
      if (fs.existsSync(uiConfigPath)) {
        uiConfig = JSON.parse(fs.readFileSync(uiConfigPath, 'utf8'));
      }
    } catch (err) {
      console.log(`⚠️  Warning: Could not load config files: ${err.message}`);
    }
    
    // Mock config with logging setup and real configuration
    CONTEXT.config = {
      get: (key, defaultValue) => {
        if (key === 'logging') {
          return {
            transports: []
          };
        }
        // Return the 'value' field from the config if it exists, otherwise return default
        if (pluginConfig[key] && pluginConfig[key].value !== undefined) {
          const val = pluginConfig[key].value;
          // Log debugging for fader-related configs
          if (key.includes('FADER')) {
            console.log(`  🔧 config.get('${key}') =>`, val);
          }
          return val;
        }
        // Return default value if provided, otherwise return empty object
        return defaultValue !== undefined ? defaultValue : {};
      }
    };

    // Add coreCommand with all required methods
    CONTEXT.coreCommand = {
      pushToastNotification: (notification) => {
        console.log(`  📢 [TOAST] ${notification.title}: ${notification.message}`);
      },
      pushNotification: (notification) => {
        console.log(`  📢 [NOTIFICATION] ${notification.title}`);
      },
      pushToastMessage: (type, title, message) => {
        console.log(`  📢 [${type.toUpperCase()}] ${title}: ${message}`);
      },
      // Add pluginManager for config file loading
      pluginManager: {
        getConfigurationFile: (context, filename) => {
          return path.join(__dirname, '..', filename);
        }
      }
    };

    CONTEXT.socket = {
      emit: (event, data) => {
        if (event.includes('calibration')) {
          console.log(`  📡 [EVENT] ${event}`);
        }
      }
    };
    
    CONTEXT.configManager = {
      setUIConfig: () => {},
      setUiConfig: () => {}
    };
    
    console.log('✅ Context created with logging support\n');
    
    // Test config retrieval
    console.log('🧪 Testing config retrieval:');
    const testFadersIdxs = CONTEXT.config.get('FADERS_IDXS', '[]');
    console.log(`  FADERS_IDXS = ${testFadersIdxs}`);
    console.log(`  Parsed = ${JSON.stringify(JSON.parse(testFadersIdxs))}`);
    console.log();

    // Create plugin instance
    console.log('🚀 Initializing plugin...');
    const plugin = new PluginClass(CONTEXT);
    console.log('✅ Plugin instance created\n');

    // Load plugin configuration (must be called before onStart)
    console.log('📁 Loading plugin configuration...');
    await plugin.onVolumioStart();
    console.log('✅ Plugin config loaded\n');

    // Start the plugin
    console.log('⏳ Starting plugin (connecting to hardware)...');
    await plugin.onStart();
    console.log('✅ Plugin started\n');

    // Wait for FaderController to stabilize
    console.log('⏳ Waiting for FaderController to initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ FaderController ready\n');

    // Set up event listeners
    plugin.faderController.on('calibration', (results) => {
      calibrationComplete = true;
      calibrationResults = results;
      displayCalibrationResults(results);
    });

    plugin.faderController.on('error', (error) => {
      console.error('\n❌ CALIBRATION ERROR:', error.message);
      if (error.code) {
        console.error('   Error Code:', error.code);
      }
      cleanup();
    });

    // Print calibration start banner
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     🎯 STARTING CALIBRATION                               ║');
    console.log('║     Watch the faders move through all test speeds...      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Call the plugin's calibration method (as if user clicked button)
    console.log('🔘 Calling RunManualCalibration() [Button Click Simulated]...\n');
    await plugin.RunManualCalibration();

    // Wait for calibration to complete
    const maxWait = 120000; // 120 seconds
    const pollInterval = 1000;
    let waited = 0;

    while (!calibrationComplete && waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      waited += pollInterval;
      process.stdout.write('.');
    }

    if (!calibrationComplete) {
      console.log('\n⏱️  Calibration timeout after 120 seconds');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    cleanup();

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    cleanup();
  }
})();

function displayCalibrationResults(results) {
  const elapsed = Date.now() - startTime;

  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     ✅ CALIBRATION COMPLETE                                ║');
  console.log(`║     Total Time: ${(elapsed / 1000).toFixed(1)}s                                    ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📊 Calibration Results:\n');

  Object.entries(results).forEach(([faderIdx, faderData]) => {
    console.log(`   Fader ${faderIdx}:`);

    // Find best data
    let bestResolution = null;
    let bestStdDev = Infinity;
    let bestRefSpeed = null;

    Object.entries(faderData).forEach(([resolution, speedData]) => {
      const validTests = Object.values(speedData).filter(t => t.avgTime !== null);
      if (validTests.length > 0) {
        const avgStdDev = validTests.reduce((sum, t) => sum + (t.stdDev || 0), 0) / validTests.length;
        if (avgStdDev < bestStdDev) {
          bestStdDev = avgStdDev;
          bestResolution = Number(resolution);
          
          // Find best speed data (closest to time goal)
          const refSpeedData = speedData[100];
          if (refSpeedData && refSpeedData.avgTime) {
            bestRefSpeed = refSpeedData;
          }
        }
      }
    });

    if (bestResolution && bestRefSpeed) {
      console.log(`     • Optimal Resolution: ${bestResolution}`);
      console.log(`     • Consistency (Std Dev): ${bestStdDev.toFixed(1)}ms`);
      console.log(`     • Avg Time @ Speed 100: ${bestRefSpeed.avgTime.toFixed(0)}ms`);
      if (bestRefSpeed.effectiveSpeed) {
        console.log(`     • Effective Speed: ${bestRefSpeed.effectiveSpeed.toFixed(1)} units/sec`);
      }

      // Get fader speedFactor
      const fader = require('../lib/faderController/core/Fader.js');
      const faderInstance = require('../lib/faderController/core/FaderController.js').prototype.getFader?.call({}, faderIdx);
      if (faderInstance) {
        console.log(`     • Speed Factor: ${faderInstance.speedFactor.toFixed(3)}`);
      }
    } else {
      console.log(`     ⚠️  No valid calibration data collected`);
    }
    console.log('');
  });

  console.log('✅ Calibration data saved to config\n');
}

function cleanup() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     📋 TEST COMPLETE                                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  process.exit(0);
}
