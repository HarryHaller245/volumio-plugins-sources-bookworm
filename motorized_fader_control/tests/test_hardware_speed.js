#!/usr/bin/env node

/*
 * Hardware Speed Test
 * Tests individual speeds (10, 50, 100) with user visual confirmation
 * Requires Volumio service to be stopped to avoid USB lock.
 */

const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const readline = require('readline');
const { execSync } = require('child_process');

const FaderMove = require('../lib/faderController/core/FaderMove');

const configPath = path.join(__dirname, '..', 'config.json');
const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const configValues = {};

Object.keys(rawConfig).forEach(key => {
  configValues[key] = rawConfig[key].value;
});

const args = process.argv.slice(2);
const agentMode = args.includes('--agent');
const timeoutArg = args.find(arg => arg.startsWith('--timeout='));
const inputTimeoutMs = timeoutArg
  ? Math.max(0, Number(timeoutArg.split('=')[1]) * 1000)
  : 15000;

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

function createContext() {
  const CONTEXT = new EventEmitter();

  const mockLogger = {
    transports: [],
    info: (msg) => console.log(`[INFO] ${msg}`),
    debug: (msg) => console.log(`[DEBUG] ${msg}`),
    warn: (msg) => console.log(`[WARN] ${msg}`),
    error: (msg) => console.log(`[ERROR] ${msg}`)
  };

  CONTEXT.logger = mockLogger;

  CONTEXT.config = {
    get: (key, defaultValue) => {
      if (key === 'logging') {
        return { transports: [] };
      }

      if (key === 'FADER_CONTROLLER_CALIBRATION_ON_START') {
        return false;
      }

      if (configValues[key] !== undefined) {
        return configValues[key];
      }

      return defaultValue !== undefined ? defaultValue : {};
    }
  };

  CONTEXT.coreCommand = {
    pushToastNotification: (notification) => {
      console.log(`[TOAST] ${notification.title}: ${notification.message}`);
    },
    pushNotification: (notification) => {
      console.log(`[NOTIFICATION] ${notification.title}`);
    },
    pushToastMessage: (type, title, message) => {
      console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    },
    pluginManager: {
      getConfigurationFile: (context, filename) => {
        return path.join(__dirname, '..', filename);
      }
    }
  };

  CONTEXT.socket = {
    emit: () => {}
  };

  CONTEXT.configManager = {
    setUIConfig: () => {},
    setUiConfig: () => {}
  };

  return CONTEXT;
}

function promptContinue(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    let timeoutId = null;

    // Wait for debug output to complete before showing prompt
    setTimeout(() => {
      // Add visual separator to make prompt stand out
      console.log('\n' + '='.repeat(70));
      console.log('>>> USER INPUT REQUIRED <<<');
      console.log('='.repeat(70));

      if (agentMode && inputTimeoutMs > 0) {
        timeoutId = setTimeout(() => {
          rl.close();
          console.log('No input received. Auto-continuing in agent mode.');
          resolve();
        }, inputTimeoutMs);
      }

      rl.question(question, () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        rl.close();
        resolve();
      });
    }, 1000); // 1 second delay to let debug output complete
  });
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSpeed(faderController, faderIndex, speed, label, disableFeedback, feedbackMode) {
  console.log(`\n🎯 Testing FADER ${faderIndex} at SPEED ${speed} (${label})`);
  console.log(`📡 Feedback Mode: ${feedbackMode}`);
  console.log('Prepare to observe the fader movement...');
  
  await wait(1500); // Let logs settle before prompt
  await promptContinue(`Press ENTER to START the move (0 → 100) [${feedbackMode}]...`);
  
  const startTime = Date.now();
  await faderController.moveFaders(
    new FaderMove([faderIndex], [100], [speed], 1),
    false,
    disableFeedback
  );
  const duration = Date.now() - startTime;
  
  console.log(`Duration: ${duration}ms`);
  console.log(`Did the fader move smoothly from 0 to 100? [${feedbackMode}]`);
  
  await wait(1500); // Let logs settle before prompt
  await promptContinue(`Press ENTER to RETURN to zero [${feedbackMode}]...`);
  
  const returnStart = Date.now();
  await faderController.moveFaders(
    new FaderMove([faderIndex], [0], [speed], 1),
    false,
    disableFeedback
  );
  const returnDuration = Date.now() - returnStart;
  
  console.log(`Return duration: ${returnDuration}ms`);
  await wait(1000); // Settle before next speed test
}

async function run() {
  ensureVolumioStopped();

  console.log('Hardware Speed Test');
  console.log('==================');
  console.log('This test evaluates individual speeds with your visual feedback.\n');

  if (agentMode) {
    console.log(`Agent mode enabled. Input timeout: ${inputTimeoutMs / 1000}s.`);
  }

  const PluginClass = require('../index.js');
  const CONTEXT = createContext();

  const plugin = new PluginClass(CONTEXT);

  await plugin.onVolumioStart();
  await plugin.onStart();
  await wait(2000);

  const faderIndex = 0; // Test on fader 0
  const speeds = [10, 50, 100];

  // Test each speed in BOTH feedback modes
  for (const speed of speeds) {
    let label = '';
    if (speed === 10) label = 'SLOW';
    else if (speed === 50) label = 'MEDIUM';
    else if (speed === 100) label = 'FAST';

    console.log('\n' + '='.repeat(70));
    console.log(`SPEED ${speed} (${label}) - COMPARISON TEST`);
    console.log('='.repeat(70));

    // First: Software Feedback (simulated)
    console.log('\n--- MODE 1: SOFTWARE FEEDBACK (Simulated) ---');
    await testSpeed(plugin.faderController, faderIndex, speed, label, true, 'SOFTWARE');
    
    await wait(2000); // Pause between modes
    
    // Second: Hardware Feedback (real MIDI from Arduino)
    console.log('\n--- MODE 2: HARDWARE FEEDBACK (Arduino MIDI) ---');
    await testSpeed(plugin.faderController, faderIndex, speed, label, false, 'HARDWARE');
    
    await wait(2000); // Pause before next speed
  }

  // Test both faders at same speed with both feedback modes
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 DUAL FADER TEST at SPEED 50 (MEDIUM)');
  console.log('='.repeat(70));

  // Software feedback mode
  console.log('\n--- MODE 1: SOFTWARE FEEDBACK (Simulated) ---');
  await plugin.faderController.reset([0, 1]);
  
  await wait(1500);
  await promptContinue('Press ENTER to move BOTH faders to 100 [SOFTWARE]...');
  const softStart = Date.now();
  await plugin.faderController.moveFaders(
    new FaderMove([0, 1], [100, 100], [50, 50], 1),
    false,
    true // disableFeedback = true
  );
  const softDuration = Date.now() - softStart;
  console.log(`Both faders duration [SOFTWARE]: ${softDuration}ms`);

  await wait(1500);
  await promptContinue('Press ENTER to return BOTH to zero [SOFTWARE]...');
  await plugin.faderController.moveFaders(
    new FaderMove([0, 1], [0, 0], [50, 50], 1),
    false,
    true // disableFeedback = true
  );

  await wait(2000);

  // Hardware feedback mode
  console.log('\n--- MODE 2: HARDWARE FEEDBACK (Arduino MIDI) ---');
  await plugin.faderController.reset([0, 1]);
  
  await wait(1500);
  await promptContinue('Press ENTER to move BOTH faders to 100 [HARDWARE]...');
  const hwStart = Date.now();
  await plugin.faderController.moveFaders(
    new FaderMove([0, 1], [100, 100], [50, 50], 1),
    false,
    false // disableFeedback = false
  );
  const hwDuration = Date.now() - hwStart;
  console.log(`Both faders duration [HARDWARE]: ${hwDuration}ms`);

  await wait(1500);
  await promptContinue('Press ENTER to return BOTH to zero [HARDWARE]...');
  await plugin.faderController.moveFaders(
    new FaderMove([0, 1], [0, 0], [50, 50], 1),
    false,
    false // disableFeedback = false
  );

  if (typeof plugin.onStop === 'function') {
    await plugin.onStop();
  }

  await wait(1000); // Final settle
  console.log('\n✅ Speed test completed.');
}

run().catch(async err => {
  console.error(`Test failed: ${err.message}`);
  process.exit(1);
});
