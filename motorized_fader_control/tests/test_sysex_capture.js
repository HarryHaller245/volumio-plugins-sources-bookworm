#!/usr/bin/env node
/**
 * Raw MIDI/SYSEX Capture Test
 * Captures and displays all raw MIDI messages to analyze channel mapping
 * 
 * Usage: node tests/test_sysex_capture.js [fader-index]
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { EventEmitter } = require('events');
const { execSync } = require('child_process');
const SerialPort = require('serialport');

// Parse command-line arguments
const args = process.argv.slice(2);
const targetFader = args.length > 0 && !args[0].startsWith('--') ? parseInt(args[0]) : 1;
const agentMode = args.includes('--agent');

// Load config
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
      console.error('[ERROR] Volumio service is active. Stop it before running this test.');
      console.error('[ERROR] Run: sudo systemctl stop volumio');
      process.exit(1);
    }
  } catch (err) {
    // Skip check if systemctl unavailable
  }
}

function formatHex(buffer) {
  return Array.from(buffer)
    .map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

function analyzeSysex(buffer) {
  if (!buffer || buffer.length < 6) {
    return { valid: false, message: 'Too short' };
  }

  if (buffer[0] !== 0xF0 || buffer[buffer.length - 1] !== 0xF7) {
    return { valid: false, message: 'Invalid SysEx markers' };
  }

  const payload = buffer.slice(1, -1);
  return {
    valid: true,
    manufacturerId: payload[0],
    channel: payload[1] & 0x0F,
    value: ((payload[3] & 0x7F) << 7) | (payload[2] & 0x7F),
    raw: formatHex(buffer),
    payload: formatHex(payload)
  };
}

async function captureRawMIDI() {
  ensureVolumioStopped();

  console.log('========================================');
  console.log('Raw MIDI/SYSEX Capture Test');
  console.log('========================================');
  console.log(`Target: Fader ${targetFader}`);
  console.log('');
  console.log('Capturing all MIDI messages from device...');
  console.log('');

  // Find USB MIDI device
  let port = null;
  const serialPorts = await SerialPort.SerialPort.list();
  const usbPort = serialPorts.find(p => p.path.includes('ttyUSB') || p.path.includes('COM'));

  if (!usbPort) {
    console.error('[ERROR] No USB serial device found at /dev/ttyUSB*');
    console.error('[ERROR] Check that the MIDI controller is connected');
    process.exit(1);
  }

  console.log(`[DEVICE] Found: ${usbPort.path}`);
  console.log(`[DEVICE] Manufacturer: ${usbPort.manufacturer || 'Unknown'}`);
  console.log('');

  try {
    port = new SerialPort.SerialPort({ 
      path: usbPort.path, 
      baudRate: 1000000,
      autoOpen: false
    });

    let messageCount = 0;
    let sysexCount = 0;
    let lastSysex = null;
    let captureActive = false;

    port.on('open', () => {
      console.log('[PORT] Connected to MIDI device');
      console.log(`[PORT] Ready to capture messages`);
      console.log('');
      captureActive = true;
    });

    port.on('data', (buffer) => {
      messageCount++;
      
      // Check if this looks like SYSEX
      if (buffer[0] === 0xF0) {
        sysexCount++;
        const analysis = analyzeSysex(buffer);
        lastSysex = analysis;

        if (analysis.valid) {
          console.log(`[SYSEX #${sysexCount}] Channel: ${analysis.channel} | Value: ${analysis.value.toString().padStart(4, ' ')} | Raw: ${analysis.raw}`);
        } else {
          console.log(`[SYSEX #${sysexCount}] INVALID: ${analysis.message} | ${formatHex(buffer)}`);
        }
      }
    });

    port.on('error', (err) => {
      console.error('[ERROR] Serial port error:', err.message);
      process.exit(1);
    });

    port.on('close', () => {
      console.log('[PORT] Serial port closed');
      process.exit(0);
    });

    // Open port
    port.open((err) => {
      if (err) {
        console.error('[ERROR] Failed to open port:', err.message);
        process.exit(1);
      }

      // Wait for capture duration
      const captureDuration = 30000; // 30 seconds
      console.log(`[CAPTURE] Recording for ${captureDuration / 1000} seconds...`);
      console.log('[CAPTURE] Please move Fader ' + targetFader + ' 0→100→0 slowly and repeatedly\n');

      setTimeout(() => {
        console.log('\n[CAPTURE] Stopping capture...');
        console.log('');
        console.log('========================================');
        console.log('Capture Summary');
        console.log('========================================');
        console.log(`Total messages: ${messageCount}`);
        console.log(`SYSEX messages: ${sysexCount}`);
        
        if (lastSysex && lastSysex.valid) {
          console.log(`Last SYSEX channel: ${lastSysex.channel}`);
          console.log(`Last SYSEX value: ${lastSysex.value}`);
        }
        
        console.log('');
        console.log('Analysis:');
        console.log('--------');
        console.log('If you see multiple different channel numbers:');
        console.log('  → Controller is sending on multiple MIDI channels');
        console.log('');
        console.log('If you only see channel 0 or channel 1:');
        console.log('  → Controller uses that channel for position feedback');
        console.log('');
        console.log('If you see no SYSEX messages:');
        console.log('  → Device not sending feedback (hardware/firmware issue)');
        console.log('');

        port.close();
      }, captureDuration);
    });

  } catch (error) {
    console.error('[ERROR] Test error:', error.message);
    if (port && port.isOpen) {
      port.close();
    }
    process.exit(1);
  }
}

captureRawMIDI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
