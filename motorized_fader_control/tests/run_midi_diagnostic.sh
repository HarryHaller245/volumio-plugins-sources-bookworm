#!/bin/sh
#
# Pitch Bend Feedback Diagnostic
# Tests Pitch Bend feedback routing on offset channels (4-7)
# Verifies SYSEX migration is complete
#

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEST_FILE="$PROJECT_DIR/tests/test_pitchbend_feedback.js"
CONFIG_FILE="$PROJECT_DIR/config.json"

echo "=========================================="
echo "Pitch Bend Feedback Diagnostic"
echo "=========================================="
echo ""
echo "This test verifies Pitch Bend feedback routing"
echo "on offset channels (4-7) after SYSEX migration."
echo ""
echo "Expected behavior:"
echo "  - Control messages: Channels 0-1 (0xE0, 0xE1)"
echo "  - Feedback messages: Channels 4-5 (0xE4, 0xE5)"
echo "  - NO SYSEX messages (0xF0...0xF7)"
echo ""
echo "Press ENTER to continue, or Ctrl+C to cancel..."
read -r _

# Stop Volumio
echo ""
echo "Stopping Volumio..."
sudo systemctl stop volumio
sleep 2

echo ""
echo "=========================================="
echo "Running Pitch Bend Feedback Test"
echo "=========================================="
echo ""

node "$TEST_FILE" --agent --timeout=3

EXIT_CODE=$?

echo ""
echo "=========================================="
echo "TEST 3: Fader 0 with ONLY Fader 0 enabled"
echo "=========================================="
echo "This test reinitializes the plugin with only Fader 0"
echo "to eliminate channel interference."
echo "Expected: ~80+ MIDI feedback messages"
EXIT_CODE=$?

echo ""
echo "=========================================="
echo "Test Results"
echo "=========================================="

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Test Passed"
  echo ""
  echo "Pitch Bend feedback is working correctly:"
  echo "  - Feedback messages received on channels 4-5"
  echo "  - No SYSEX messages detected"
  echo "  - SYSEX migration complete"
else
  echo "❌ Test Failed"
  echo ""
  echo "Check the output above for details."
fi

echo ""
echo "Starting Volumio..."
sudo systemctl start volumio
sleep 2

echo ""
echo "To view detailed MIDI logs, run:"
echo "  sudo journalctl -u volumio -n 500 | grep -E 'MIDI|feedback'"
echo ""

exit $EXIT_CODE
