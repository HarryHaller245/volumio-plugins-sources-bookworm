#!/usr/bin/env node

/*
 * Hardware Fader Flow Test
 * Phases: movement, basic calibration, manual calibration
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

function promptYesNo(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
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
    rl.question(question, () => {
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

  console.log('Hardware fader flow test starting...');

  const PluginClass = require('../index.js');
  const CONTEXT = createContext();

  const plugin = new PluginClass(CONTEXT);

  await plugin.onVolumioStart();
  await plugin.onStart();
  await wait(2000);

  const indexes = JSON.parse(CONTEXT.config.get('FADERS_IDXS', '[]'));
  const speedHigh = Number(CONTEXT.config.get('FADER_CONTROLLER_SPEED_HIGH', 100));
  const speedLow = Number(CONTEXT.config.get('FADER_CONTROLLER_SPEED_LOW', 10));
  const resolution = 1;

  await promptContinue('Press ENTER to start Phase 1: movement test (min -> max -> min)...');
  await plugin.faderController.reset(indexes);
  await plugin.faderController.moveFaders(
    new FaderMove(indexes, indexes.map(() => 100), indexes.map(() => speedHigh), resolution),
    false,
    false
  );
  await plugin.faderController.moveFaders(
    new FaderMove(indexes, indexes.map(() => 0), indexes.map(() => speedLow), resolution),
    false,
    false
  );

  const moveOk = await promptYesNo('Did both faders move to max and return to min? (y/n): ');
  if (!moveOk) {
    throw new Error('Movement validation failed.');
  }

  await promptContinue('Press ENTER to start Phase 2: basic calibration...');
  await plugin.faderController.calibrate(indexes);

  const basicOk = await promptYesNo('Did the basic calibration move as expected? (y/n): ');
  if (!basicOk) {
    throw new Error('Basic calibration validation failed.');
  }

  await promptContinue('Press ENTER to start Phase 3: manual (advanced) calibration...');
  await plugin.RunManualCalibration();

  const manualOk = await promptYesNo('Did the manual calibration run correctly? (y/n): ');
  if (!manualOk) {
    throw new Error('Manual calibration validation failed.');
  }

  if (typeof plugin.onStop === 'function') {
    await plugin.onStop();
  }

  console.log('Hardware fader flow test completed successfully.');
}

run().catch(async err => {
  console.error(`Test failed: ${err.message}`);
  process.exit(1);
});
