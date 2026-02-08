#!/usr/bin/env node
/**
 * Fader 1 Isolation Test
 * Tests ONLY Fader 1 (index 1) to isolate hardware vs dual-fader buffer issues
 * 
 * Usage: sh tests/run_hardware_fader1_only.sh [--agent] [--timeout=SECONDS]
 * 
 * Purpose: Determine if Fader 1 feedback loss is due to:
 *   A) Hardware issue with Fader 1 specifically
 *   B) MIDI buffer overflow when both faders move together
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { EventEmitter } = require('events');
const { execSync } = require('child_process');

const rootPath = path.join(__dirname, '..');
const FaderMove = require(path.join(rootPath, 'lib', 'faderController', 'core', 'FaderMove'));

// Parse command-line arguments
const args = process.argv.slice(2);
const agentMode = args.includes('--agent');
const timeoutArg = args.find(arg => arg.startsWith('--timeout='));
const inputTimeoutMs = timeoutArg ? parseInt(timeoutArg.split('=')[1]) * 1000 : 20000;

// Load config
const configPath = path.join(rootPath, 'config.json');
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
      console.error('[ERROR] Volumio service is active. Stop it before running this test.');
      console.error('[ERROR] Run: sudo systemctl stop volumio');
      process.exit(1);
    }
  } catch (err) {
    // If systemctl is unavailable, skip the check
  }
}

function createContext() {
  const CONTEXT = new EventEmitter();

  const mockLogger = {
    transports: [],
    info: (msg) => console.log(`[INFO] ${msg}`),
    debug: () => {}, // Silence debug for cleaner output
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
        return path.join(rootPath, filename);
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

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  ensureVolumioStopped();

  console.log('========================================');
  console.log('Fader 1 Isolation Test (Channel 1 Only)');
  console.log('========================================');
  console.log('This test moves ONLY Fader 1 at MAX SPEED');
  console.log('to isolate hardware vs dual-fader issues.');
  console.log('');

  let plugin = null;
  try {
    console.log('[SETUP] Loading plugin...');
    const PluginClass = require(path.join(rootPath, 'index.js'));
    const context = createContext();
    plugin = new PluginClass(context);
    
    console.log('[SETUP] Waiting for plugin initialization...');
    await plugin.onVolumioStart();
    await plugin.onStart();
    await wait(2000);
    console.log('[SETUP] Plugin ready!');
  } catch (error) {
    console.error('[ERROR] Failed to initialize plugin:', error.message);
    console.error('[ERROR] Stack:', error.stack);
    process.exit(1);
  }

  try {
    // Wait a bit for hardware to respond
    console.log('[SETUP] Waiting for hardware readiness...');
    await wait(2000);

    const maxSpeed = Number(createContext().config.get('FADER_CONTROLLER_SPEED_HIGH', 100));
    console.log('');
    console.log(`🚀 Using MAX SPEED: ${maxSpeed}`);
    console.log('');

    // Reset Fader 1 to 0
    console.log('STEP 1: Resetting Fader 1 to HOME (0%)...');
    const resetStart = Date.now();
    await plugin.faderController.reset([1]);
    const resetDuration = Date.now() - resetStart;
    console.log(`✓ Reset duration: ${resetDuration}ms`);
    console.log('');

    // Wait before moving to full range
    await wait(2000);

    // Test Fader 1: 0→100
    console.log('STEP 2: Moving Fader 1 from HOME (0%) to FULL (100%)...');
    await promptContinue('Press ENTER to start Fader 1 0→100 move...');
    
    const start0to100 = Date.now();
    await plugin.faderController.moveFaders(
      new FaderMove([1], [100], [maxSpeed], 1),
      false,  // interrupt
      false   // disableFeedback (enable hardware feedback)
    );
    const duration0to100 = Date.now() - start0to100;
    console.log(`✓ Move duration (JS timing): ${duration0to100}ms`);
    console.log('📋 OBSERVATION POINT: Check logs for handleFeedbackMessage calls');
    console.log('   Expected: ~80+ feedback messages from hardware');
    console.log('   If 0 messages: Hardware feedback issue');
    
    // Pause at full deflection for observation
    console.log('');
    console.log('⏸️  Pausing 2 seconds at FULL deflection for manual observation...');
    await wait(2000);
    console.log('');
    
    await promptContinue('Press ENTER to continue to return move...');

    // Test Fader 1: 100→0
    console.log('STEP 3: Moving Fader 1 from FULL (100%) back to HOME (0%)...');
    const startReturn = Date.now();
    await plugin.faderController.moveFaders(
      new FaderMove([1], [0], [maxSpeed], 1),
      false,  // interrupt
      false   // disableFeedback
    );
    const durationReturn = Date.now() - startReturn;
    console.log(`✓ Return duration (JS timing): ${durationReturn}ms`);
    console.log('📋 OBSERVATION POINT: Check logs for handleFeedbackMessage calls');
    console.log('   Expected: ~80+ feedback messages from hardware');
    
    await wait(2000);

    // Summary
    console.log('');
    console.log('📊 Fader 1 Isolation Test Summary');
    console.log('==================================');
    console.log(`Reset:        ${resetDuration}ms (software - expected)`);
    console.log(`0→100:        ${duration0to100}ms`);
    console.log(`100→0:        ${durationReturn}ms`);
    console.log('');
    console.log('🔍 Analysis:');
    console.log('  IF durations ~1000-1500ms with feedback messages:');
    console.log('    ✓ Fader 1 hardware working - issue was dual-fader buffer');
    console.log('  IF durations ~1-3ms without feedback messages:');
    console.log('    ✗ Fader 1 has hardware issue - no feedback at all');
    console.log('');
    console.log('Check journalctl logs for [CALIB] handleFeedbackMessage lines');
    console.log('for Fader 1 (fader=1) to confirm feedback reception.');
    console.log('');

  } catch (error) {
    console.error('[ERROR] Test error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (plugin && plugin.faderController) {
      await plugin.faderController.stop();
    }
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
