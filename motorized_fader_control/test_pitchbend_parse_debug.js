const MIDIParser = require('./lib/faderController/midi/MIDIParser');

const parser = new MIDIParser();

let dataEmitted = false;

parser.on('data', (buffer) => {
    dataEmitted = true;
    console.log('✓ Parser emitted data:', Array.from(buffer));
});

// Write bytes and wait
parser.write(Buffer.from([0xE4, 0x00, 0x40]));

setTimeout(() => {
    if (!dataEmitted) {
        console.log('✗ Parser DID NOT emit any data!');
        console.log('Parser state:', {
            expecting: parser.expecting,
            type: '0x' + parser.type.toString(16),
            channel: parser.channel,
            data1: parser.data1,
            data2: parser.data2,
            buffer: parser.buffer
        });
    }
}, 100);
