#!/bin/sh
#
# MIDI Feedback Routing Diagnostic
# Tests feedback routing for both faders with detailed MIDI logging
# Compares Fader 0 vs Fader 1 to identify routing issues
#

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEST_FILE="$PROJECT_DIR/tests/test_midi_feedback_routing.js"
CONFIG_FILE="$PROJECT_DIR/config.json"

echo "=========================================="
echo "MIDI Feedback Routing Diagnostic"
echo "=========================================="
echo ""
echo "This test examines MIDI feedback message routing"
echo "for both faders to identify parsing or routing issues."
echo ""
echo "Press ENTER to continue, or Ctrl+C to cancel..."
read -r _

# Stop Volumio
echo ""
echo "Stopping Volumio..."
sudo systemctl stop volumio
sleep 3

echo "=========================================="
echo "TEST 1: Fader 1 with BOTH faders enabled"
echo "=========================================="
echo "Expected: ~80+ MIDI feedback messages"
echo ""
echo "Press ENTER to run TEST 1 (Fader 1, count=2)..."
read -r _

node "$TEST_FILE" 1 --agent --timeout=20

echo ""
echo "=========================================="
echo "TEST 2: Fader 0 with BOTH faders enabled"
echo "=========================================="
echo "Expected: ~80+ MIDI feedback messages"
echo ""
echo "Press ENTER to run TEST 2 (Fader 0, count=2)..."
read -r _

node "$TEST_FILE" 0 --agent --timeout=20

echo ""
echo "=========================================="
echo "TEST 3: Fader 0 with ONLY Fader 0 enabled"
echo "=========================================="
echo "This test reinitializes the plugin with only Fader 0"
echo "to eliminate channel interference."
echo "Expected: ~80+ MIDI feedback messages"
echo ""
echo "Press ENTER to run TEST 3 (Fader 0, count=1)..."
read -r _

node "$TEST_FILE" 0 --config-override=FADER_CONTROLLER_FADER_COUNT=1 --agent --timeout=20

echo ""
echo "=========================================="
echo "TEST 4: Fader 1 with ONLY Fader 1 enabled"
echo "=========================================="
echo "This test reinitializes the plugin with only Fader 1"
echo "to confirm if it's a firmware/hardware issue."
echo "Expected: ~80+ MIDI feedback messages (if working)"
echo ""
echo "Press ENTER to run TEST 4 (Fader 1, count=1)..."
read -r _

node "$TEST_FILE" 1 --config-override=FADER_CONTROLLER_FADER_COUNT=1 --agent --timeout=20

echo ""
echo "Starting Volumio..."
sudo systemctl start volumio
sleep 2

echo ""
echo "=========================================="
echo "✅ MIDI Feedback Routing Diagnostic Complete"
echo "=========================================="
echo ""
echo "Summary:"
echo "--------"
echo "Compare the results above to identify:"
echo "1. If Fader 1 ever receives feedback (parsing check)"
echo "2. If feedback is misrouted between faders"
echo "3. If it's channel-specific (firmware issue)"
echo ""
echo "Check journalctl logs for detailed SYSEX message parsing:"
echo "  sudo journalctl -u volumio -n 500 | grep -E 'MIDI|feedback|SYSEX'"
echo ""
