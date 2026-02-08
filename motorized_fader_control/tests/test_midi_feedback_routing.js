#!/usr/bin/env node
/**
 * MIDI Feedback Routing Test
 * Tests which fader receives feedback messages during movement
 * Includes detailed MIDI message logging
 * 
 * Usage: node tests/test_midi_feedback_routing.js [fader-index] [--config-override=KEY=VALUE]
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');
const { EventEmitter } = require('events');
const { execSync } = require('child_process');

const rootPath = path.join(__dirname, '..');
const FaderMove = require(path.join(rootPath, 'lib', 'faderController', 'core', 'FaderMove'));

// Parse command-line arguments
const args = process.argv.slice(2);
const targetFader = args.length > 0 && !args[0].startsWith('--') ? parseInt(args[0]) : 1;
const agentMode = args.includes('--agent');
const timeoutArg = args.find(arg => arg.startsWith('--timeout='));
const configOverrides = args.filter(arg => arg.startsWith('--config-override='));
const inputTimeoutMs = timeoutArg ? parseInt(timeoutArg.split('=')[1]) * 1000 : 20000;

// Load config
const configPath = path.join(rootPath, 'config.json');
const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const tempConfig = JSON.parse(JSON.stringify(rawConfig));
const configValues = {};
let tempConfigPath = null;

Object.keys(rawConfig).forEach(key => {
  configValues[key] = rawConfig[key].value;
});

// Apply config overrides (supports multiple)
if (configOverrides.length > 0) {
  configOverrides.forEach((overrideArg) => {
    const overrideValue = overrideArg.replace('--config-override=', '');
    const splitIndex = overrideValue.indexOf('=');
    if (splitIndex === -1) {
      console.log(`[WARN] Ignoring invalid override: ${overrideArg}`);
      return;
    }

    const configKey = overrideValue.slice(0, splitIndex);
    const rawValue = overrideValue.slice(splitIndex + 1);
    const trimmedValue = rawValue.trim();
    const isJsonLike = trimmedValue.startsWith('[') || trimmedValue.startsWith('{');
    let parsedValue = rawValue;

    if (!isJsonLike) {
      if (rawValue === 'true' || rawValue === 'false') {
        parsedValue = rawValue === 'true';
      } else if (!Number.isNaN(Number(rawValue)) && rawValue.trim() !== '') {
        parsedValue = Number(rawValue);
      }
    }

    console.log(`[SETUP] Override: ${configKey} = ${rawValue}`);
    configValues[configKey] = parsedValue;

    if (tempConfig[configKey]) {
      tempConfig[configKey].value = parsedValue;
    }
  });

  const tempFileName = `mfc-config-${Date.now()}.json`;
  tempConfigPath = path.join(os.tmpdir(), tempFileName);
  fs.writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2));
  console.log(`[SETUP] Using temp config: ${tempConfigPath}`);
}

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
    info: (msg) => {
      // Filter and colorize MIDI-related messages
      if (msg.includes('[CALIB]') || msg.includes('MIDI') || msg.includes('feedback')) {
        console.log(`[MIDI] ${msg}`);
      } else if (!msg.includes('[DEBUG]')) {
        console.log(`[INFO] ${msg}`);
      }
    },
    debug: (msg) => {
      // Show debug messages related to MIDI and feedback
      if ((msg && msg.includes('MIDI')) || (msg && msg.includes('feedback')) || (msg && msg.includes('Fader'))) {
        console.log(`[DEBUG] ${msg}`);
      }
    },
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
        if (tempConfigPath && filename === 'config.json') {
          return tempConfigPath;
        }
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
        console.log('[PROMPT] No input received. Auto-continuing in agent mode.');
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

async function main() {
  ensureVolumioStopped();

  console.log('========================================');
  console.log('MIDI Feedback Routing Test');
  console.log('========================================');
  console.log(`Target: Fader ${targetFader} (0-100-0 movement)`);
  console.log(`Fader Count: ${configValues['FADER_CONTROLLER_FADER_COUNT']}`);
  console.log(`MIDI Log: ${configValues['FADER_CONTROLLER_MIDI_LOG']} (enabled for this test)`);
  console.log('');
  console.log('Watch for MIDI feedback messages during movement.');
  console.log('');

  let plugin = null;
  let feedbackMessageCount = 0;
  const feedbackByFader = {};

  try {
    console.log('[SETUP] Loading plugin...');
    const PluginClass = require(path.join(rootPath, 'index.js'));
    const context = createContext();
    
    // Intercept feedback messages to count them
    const originalLogger = context.logger.info;
    context.logger.info = function(msg) {
      if (msg && msg.includes('handleFeedbackMessage')) {
        feedbackMessageCount++;
        // Extract fader index from message
        const match = msg.match(/fader[_=](\d+)/i) || msg.match(/fader\s+(\d+)/i);
        if (match) {
          const faderIdx = parseInt(match[1]);
          feedbackByFader[faderIdx] = (feedbackByFader[faderIdx] || 0) + 1;
          console.log(`[FEEDBACK] Message #${feedbackMessageCount} for Fader ${faderIdx}`);
        }
      }
      originalLogger.apply(this, arguments);
    };
    
    plugin = new PluginClass(context);
    
    console.log('[SETUP] Waiting for plugin initialization...');
    await plugin.onVolumioStart();
    await plugin.onStart();
    await wait(2000);
    console.log('[SETUP] Plugin ready!');
  } catch (error) {
    console.error('[ERROR] Failed to initialize plugin:', error.message);
    process.exit(1);
  }

  try {
    console.log('[SETUP] Waiting for hardware readiness...');
    await wait(2000);

    const maxSpeed = 100;
    console.log('');
    console.log(`🚀 Using MAX SPEED: ${maxSpeed}`);
    console.log('');

    // Reset target fader
    console.log(`STEP 1: Resetting Fader ${targetFader} to HOME (0%)...`);
    const resetStart = Date.now();
    await plugin.faderController.reset([targetFader]);
    const resetDuration = Date.now() - resetStart;
    console.log(`✓ Reset duration: ${resetDuration}ms`);
    console.log('');

    // Wait before moving
    await wait(1500);

    // Move 0→100
    console.log(`STEP 2: Moving Fader ${targetFader} from 0% to 100%...`);
    await promptContinue('Press ENTER to start movement...');
    
    feedbackMessageCount = 0;
    for (const key in feedbackByFader) delete feedbackByFader[key];
    
    const start0to100 = Date.now();
    await plugin.faderController.moveFaders(
      new FaderMove([targetFader], [100], [maxSpeed], 1),
      false,
      false
    );
    const duration0to100 = Date.now() - start0to100;
    
    const msgCount0to100 = feedbackMessageCount;
    const feedback0to100 = Object.assign({}, feedbackByFader);
    
    console.log('');
    console.log(`✓ Movement completed in ${duration0to100}ms`);
    console.log(`✓ Total feedback messages: ${msgCount0to100}`);
    console.log(`✓ Feedback by fader: ${JSON.stringify(feedback0to100)}`);
    
    // Pause at full
    await wait(1500);

    // Move 100→0
    console.log(`STEP 3: Moving Fader ${targetFader} from 100% to 0%...`);
    await promptContinue('Press ENTER to continue...');
    
    feedbackMessageCount = 0;
    for (const key in feedbackByFader) delete feedbackByFader[key];
    
    const start100to0 = Date.now();
    await plugin.faderController.moveFaders(
      new FaderMove([targetFader], [0], [maxSpeed], 1),
      false,
      false
    );
    const duration100to0 = Date.now() - start100to0;
    
    const msgCount100to0 = feedbackMessageCount;
    const feedback100to0 = Object.assign({}, feedbackByFader);
    
    console.log('');
    console.log(`✓ Movement completed in ${duration100to0}ms`);
    console.log(`✓ Total feedback messages: ${msgCount100to0}`);
    console.log(`✓ Feedback by fader: ${JSON.stringify(feedback100to0)}`);

    // Summary
    console.log('');
    console.log('========================================');
    console.log('MIDI Feedback Routing Summary');
    console.log('========================================');
    console.log(`Target Fader: ${targetFader}`);
    console.log(`Fader Count: ${configValues['FADER_CONTROLLER_FADER_COUNT']}`);
    console.log('');
    console.log('0→100 Movement:');
    console.log(`  Duration: ${duration0to100}ms`);
    console.log(`  Messages: ${msgCount0to100}`);
    console.log(`  By Fader: ${JSON.stringify(feedback0to100)}`);
    console.log('');
    console.log('100→0 Movement:');
    console.log(`  Duration: ${duration100to0}ms`);
    console.log(`  Messages: ${msgCount100to0}`);
    console.log(`  By Fader: ${JSON.stringify(feedback100to0)}`);
    console.log('');
    console.log('🔍 Analysis:');
    if (msgCount0to100 > 50 && msgCount100to0 > 50) {
      console.log('  ✓ Strong feedback received');
      if (feedback0to100[targetFader] > 40 && feedback100to0[targetFader] > 40) {
        console.log(`  ✓ Feedback correctly routed to Fader ${targetFader}`);
      } else {
        console.log('  ⚠️ Feedback may be misrouted to different fader?');
        console.log(`  ⚠️ Check other faders: ${Object.keys(feedback0to100).join(', ')}`);
      }
    } else {
      console.log(`  ✗ Minimal feedback (expected 80+, got ${Math.max(msgCount0to100, msgCount100to0)})`);
      console.log('  ✗ Check MIDI logs above for error details');
    }
    console.log('');

  } catch (error) {
    console.error('[ERROR] Test error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (plugin && plugin.faderController) {
      await plugin.faderController.stop();
    }
    if (tempConfigPath) {
      try {
        fs.unlinkSync(tempConfigPath);
      } catch (err) {
        // Best-effort cleanup
      }
    }
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
