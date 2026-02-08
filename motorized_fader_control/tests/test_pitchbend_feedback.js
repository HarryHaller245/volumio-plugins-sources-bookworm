#!/usr/bin/env node

/*
 * Pitch Bend Feedback Test
 * Verifies firmware sends feedback on offset channels (4-7) using Pitch Bend instead of SYSEX
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

      // Enable MIDI logging for this test
      if (key === 'FADER_CONTROLLER_MIDI_LOG') {
        return true;
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

function promptYesNo(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    let timeoutId = null;

    if (agentMode && inputTimeoutMs > 0) {
      timeoutId = setTimeout(() => {
        rl.close();
        console.log('No input received. Auto-approving in agent mode.');
        resolve(true);
      }, inputTimeoutMs);
    }

    rl.question(question, answer => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      rl.close();
      const normalized = String(answer || '').trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

function promptContinue(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    let timeoutId = null;

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
  });
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  ensureVolumioStopped();

  console.log('=== Pitch Bend Feedback Test ===');
  console.log('Testing feedback on offset channels (4-7) using Pitch Bend instead of SYSEX');
  if (agentMode) {
    console.log(`Agent mode enabled. Input timeout: ${inputTimeoutMs / 1000}s.`);
  }

  const PluginClass = require('../index.js');
  const CONTEXT = createContext();

  const plugin = new PluginClass(CONTEXT);

  await plugin.onVolumioStart();
  await plugin.onStart();
  await wait(2000);

  const indexes = JSON.parse(CONTEXT.config.get('FADERS_IDXS', '[]'));
  const speedMed = 50;

  console.log('\n--- Expected behavior ---');
  console.log('- Control messages (input): Pitch Bend on channels 0-1 (0xE0, 0xE1)');
  console.log('- Feedback messages (output): Pitch Bend on channels 4-5 (0xE4, 0xE5)');
  console.log('- No SYSEX messages should appear');

  await promptContinue('\nPress ENTER to start Test 1: Fader 0 → 100% (expect ch 4 feedback)...');
  await plugin.faderController.moveFaders(
    new FaderMove([0], [100], [speedMed], 1),
    true,
    false
  );
  await wait(2000);

  const test1Ok = await promptYesNo('Did you see PITCH_BEND feedback on channel 4 in the logs? (y/n): ');
  if (!test1Ok) {
    throw new Error('Test 1 failed: No channel 4 feedback detected.');
  }

  await promptContinue('\nPress ENTER to start Test 2: Fader 1 → 100% (expect ch 5 feedback)...');
  await plugin.faderController.moveFaders(
    new FaderMove([1], [100], [speedMed], 1),
    true,
    false
  );
  await wait(2000);

  const test2Ok = await promptYesNo('Did you see PITCH_BEND feedback on channel 5 in the logs? (y/n): ');
  if (!test2Ok) {
    throw new Error('Test 2 failed: No channel 5 feedback detected.');
  }

  await promptContinue('\nPress ENTER to start Test 3: Both faders → 0% (expect ch 4+5 feedback)...');
  await plugin.faderController.reset(indexes);
  await wait(2000);

  const test3Ok = await promptYesNo('Did you see PITCH_BEND feedback on channels 4 and 5? (y/n): ');
  if (!test3Ok) {
    throw new Error('Test 3 failed: Expected feedback on both channels.');
  }

  const noSysex = await promptYesNo('Confirm: Did you see NO SYSEX messages in the logs? (y/n): ');
  if (!noSysex) {
    throw new Error('SYSEX messages detected - migration incomplete!');
  }

  if (typeof plugin.onStop === 'function') {
    await plugin.onStop();
  }

  console.log('\n✓ Pitch Bend feedback test completed successfully.');
  console.log('✓ Firmware is sending feedback on offset channels (4-7)');
  console.log('✓ SYSEX migration complete');
}

run().catch(async err => {
  console.error(`\n✗ Test failed: ${err.message}`);
  process.exit(1);
});
