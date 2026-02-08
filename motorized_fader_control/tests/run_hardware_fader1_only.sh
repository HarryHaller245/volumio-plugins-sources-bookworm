#!/bin/sh
#
# Fader 1 Isolation Test Runner
# Stops Volumio, runs Fader 1-only test, restarts Volumio
#

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEST_FILE="$PROJECT_DIR/tests/test_hardware_fader1_only.js"

echo "Fader 1 Isolation Test (Channel 1 Only)"
echo "========================================"
echo "This will stop Volumio before testing and restart it afterward."
echo ""
echo "Press ENTER to continue, or Ctrl+C to cancel..."
read -r _

# Stop Volumio
echo ""
echo "Stopping Volumio..."
sudo systemctl stop volumio

# Wait for port to release and for clean shutdown
sleep 3

echo "USB port released, Volumio stopped."
echo ""

# Run the test (requires Volumio to be stopped for USB access)
node "$TEST_FILE" "$@"
TEST_EXIT=$?

echo ""
echo "Test completed. Starting Volumio..."
sudo systemctl start volumio
sleep 2

echo "✅ Fader 1 isolation test completed. Volumio restarted."
exit $TEST_EXIT
