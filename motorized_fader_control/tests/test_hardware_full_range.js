#!/usr/bin/env node

/*
 * Hardware Full Range Test
 * Tests max speed to verify faders reach full 0-100 range and return
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
  : 20000;

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

  console.log('Hardware Full Range Test at Max Speed');
  console.log('=====================================');
  console.log('This test verifies faders reach full 0-100 range at max speed.\n');

  if (agentMode) {
    console.log(`Agent mode enabled. Input timeout: ${inputTimeoutMs / 1000}s.`);
  }

  const PluginClass = require('../index.js');
  const CONTEXT = createContext();

  const plugin = new PluginClass(CONTEXT);

  await plugin.onVolumioStart();
  await plugin.onStart();
  await wait(2000);

  const maxSpeed = Number(CONTEXT.config.get('FADER_CONTROLLER_SPEED_HIGH', 100));
  console.log(`\n🚀 Using MAX SPEED: ${maxSpeed}\n`);

  // Test Fader 0
  console.log('Testing FADER 0: 0 → 100 → 0 at MAX SPEED');
  await plugin.faderController.reset([0]);
  
  await wait(1500);
  await promptContinue('Press ENTER to start Fader 0 test (moves both directions automatically)...');
  
  const start0to100 = Date.now();
  await plugin.faderController.moveFaders(
    new FaderMove([0], [100], [maxSpeed], 1),
    false,
    false
  );
  const duration0to100 = Date.now() - start0to100;
  console.log(`\n✓ Duration 0→100: ${duration0to100}ms`);
  console.log('QUESTION: Did Fader 0 reach FULL deflection (100%)?');
  
  await wait(2000); // Pause at full deflection
  
  const startReturn0 = Date.now();
  await plugin.faderController.moveFaders(
    new FaderMove([0], [0], [maxSpeed], 1),
    false,
    false
  );
  const durationReturn0 = Date.now() - startReturn0;
  console.log(`✓ Duration 100→0: ${durationReturn0}ms`);
  console.log('QUESTION: Did Fader 0 reach HOME (0%)?');
  
  await wait(1500);
  await promptContinue('Press ENTER to continue to Fader 1 test...');
  
  // Test Fader 1
  console.log('\nTesting FADER 1: 0 → 100 → 0 at MAX SPEED');
  await plugin.faderController.reset([1]);
  
  await wait(1500);
  await promptContinue('Press ENTER to start Fader 1 test (moves both directions automatically)...');
  
  const start1to100 = Date.now();
  await plugin.faderController.moveFaders(
    new FaderMove([1], [100], [maxSpeed], 1),
    false,
    false
  );
  const duration1to100 = Date.now() - start1to100;
  console.log(`\n✓ Duration 0→100: ${duration1to100}ms`);
  console.log('QUESTION: Did Fader 1 reach FULL deflection (100%)?');
  
  await wait(2000); // Pause at full deflection
  
  const startReturn1 = Date.now();
  await plugin.faderController.moveFaders(
    new FaderMove([1], [0], [maxSpeed], 1),
    false,
    false
  );
  const durationReturn1 = Date.now() - startReturn1;
  console.log(`✓ Duration 100→0: ${durationReturn1}ms`);
  console.log('QUESTION: Did Fader 1 reach HOME (0%)?');

  // Summary
  console.log('\n\n📊 Full Range Test Summary');
  console.log('==========================');
  console.log(`Fader 0: 0→100 ${duration0to100}ms | 100→0 ${durationReturn0}ms`);
  console.log(`Fader 1: 0→100 ${duration1to100}ms | 100→0 ${durationReturn1}ms`);
  console.log(`Speed Setting: ${maxSpeed}`);

  if (typeof plugin.onStop === 'function') {
    await plugin.onStop();
  }

  await wait(1000);
  console.log('\n✅ Full range test completed.');
}

run().catch(async err => {
  console.error(`Test failed: ${err.message}`);
  process.exit(1);
});
