#!/usr/bin/env node
/**
 * Raw Serial Port Capture
 * Captures unprocessed bytes from the MIDI device to analyze communication
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const SerialPort = require('serialport');

async function captureBytes() {
  try {
    const status = execSync('systemctl is-active volumio', {
      stdio: ['ignore', 'pipe', 'pipe']
    }).toString().trim();

    if (status === 'active') {
      console.error('[ERROR] Volumio must be stopped');
      process.exit(1);
    }
  } catch (err) {
    // Skip check
  }

  console.log('========================================');
  console.log('Raw Serial Port Capture');
  console.log('========================================');
  console.log('Capturing unfiltered bytes from MIDI device');
  console.log('');

  const serialPorts = await SerialPort.SerialPort.list();
  const usbPort = serialPorts.find(p => p.path.includes('ttyUSB') || p.path.includes('COM'));

  if (!usbPort) {
    console.error('[ERROR] No USB serial device found');
    process.exit(1);
  }

  console.log(`[DEVICE] ${usbPort.path}`);
  console.log('');

  try {
    const port = new SerialPort.SerialPort({ 
      path: usbPort.path, 
      baudRate: 1000000,
      autoOpen: false
    });

    let byteCount = 0;
    let buffer = [];
    let sysexMessages = [];

    port.on('open', () => {
      console.log('[PORT] Connected. Capture starting.');
      console.log('[ACTION] Move Fader 1 slowly 0→100→0\n');
    });

    port.on('data', (chunk) => {
      for (let byte of chunk) {
        byteCount++;
        buffer.push(byte);

        // Look for SYSEX markers
        if (byte === 0xF0) {
          if (buffer.length > 1) {
            // Start of new SysEx, print previous buffer
            if (buffer.some(b => b !== 0xF0)) {
              const hex = buffer.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
              if (buffer.length > 1) console.log('[BYTES] ' + hex);
            }
          }
          buffer = [0xF0];
        } else if (byte === 0xF7 && buffer[0] === 0xF0) {
          // End of SysEx
          buffer.push(byte);
          const hex = buffer.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
          console.log('[SYSEX] ' + hex);
          sysexMessages.push(Buffer.from(buffer));
          buffer = [];
        } else if (buffer[0] === 0xF0) {
          buffer.push(byte);
        }
      }
    });

    port.on('error', (err) => {
      console.error('[ERROR] ' + err.message);
      process.exit(1);
    });

    port.open((err) => {
      if (err) {
        console.error('[ERROR] ' + err.message);
        process.exit(1);
      }

      setTimeout(() => {
        console.log('\n[CAPTURE] Stopping...\n');
        console.log('========================================');
        console.log('Capture Summary');
        console.log('========================================');
        console.log(`Total bytes: ${byteCount}`);
        console.log(`SYSEX messages: ${sysexMessages.length}`);

        if (sysexMessages.length === 0) {
          console.log('\n⚠️  NO SYSEX MESSAGES RECEIVED');
          console.log('\nThis means:');
          console.log('1. Controller is NOT sending feedback');
          console.log('2. OR Serial connection is broken');
          console.log('3. OR SYSEX messages are being lost somewhere');
        } else {
          console.log(`\n✓ Received ${sysexMessages.length} SYSEX messages`);
          // Analyze channels
          const channels = new Set();
          sysexMessages.forEach(msg => {
            if (msg.length >= 3) {
              const channel = msg[2] & 0x0F;
              channels.add(channel);
            }
          });
          console.log(`Channels used: ${Array.from(channels).sort().join(', ')}`);
        }

        port.close();
      }, 45000); // 45 second capture
    });

  } catch (error) {
    console.error('[ERROR] ' + error.message);
    process.exit(1);
  }
}

captureBytes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
