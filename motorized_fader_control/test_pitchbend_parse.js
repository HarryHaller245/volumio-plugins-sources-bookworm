const MIDIParser = require('./lib/faderController/midi/MIDIParser');

// Test Pitch Bend parsing
const parser = new MIDIParser();

parser.on('data', (buffer) => {
    console.log('Parser output buffer:', Array.from(buffer));
    console.log('  buffer[0] (type):', '0x' + buffer[0].toString(16));
    console.log('  buffer[1] (channel):', buffer[1]);
    console.log('  buffer[2] (data1/LSB):', buffer[2]);
    console.log('  buffer[3] (data2/MSB):', buffer[3]);
    console.log('  Translated type:', parser.translateStatusByte(buffer[0]));
    console.log('  14-bit value:', (buffer[3] << 7) | buffer[2]);
});

// Simulate Pitch Bend on channel 4 (0xE4) with value 8192 (center)
// LSB = 0, MSB = 64
console.log('Test 1: Pitch Bend channel 4, value 8192 (0x2000)');
console.log('Input bytes: [0xE4, 0x00, 0x40]');
parser.write(Buffer.from([0xE4, 0x00, 0x40]));

console.log('\nTest 2: Pitch Bend channel 5, value 16383 (0x3FFF) - max');
console.log('Input bytes: [0xE5, 0x7F, 0x7F]');
parser.write(Buffer.from([0xE5, 0x7F, 0x7F]));

console.log('\nTest 3: Pitch Bend channel 0, value 0 - min');
console.log('Input bytes: [0xE0, 0x00, 0x00]');
parser.write(Buffer.from([0xE0, 0x00, 0x00]));
