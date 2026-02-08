#!/bin/bash

# Hardware fader test runner
# Ensures Volumio is stopped, tails logs, then runs the flow test.

set -e

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOLUMIO_SERVICE="volumio"
LOG_TAIL_PID=""
VOLUMIO_WAS_ACTIVE=false

cleanup() {
  if [ -n "$LOG_TAIL_PID" ]; then
    kill "$LOG_TAIL_PID" >/dev/null 2>&1 || true
  fi

  if [ "$VOLUMIO_WAS_ACTIVE" = true ]; then
    echo "Restarting Volumio service..."
    sudo systemctl start "$VOLUMIO_SERVICE"
  fi
}

trap cleanup EXIT

ensure_volumio_stopped() {
  if systemctl is-active --quiet "$VOLUMIO_SERVICE"; then
    VOLUMIO_WAS_ACTIVE=true
    echo "Stopping Volumio service to release the USB port..."
    sudo systemctl stop "$VOLUMIO_SERVICE"

    for _ in {1..10}; do
      if ! systemctl is-active --quiet "$VOLUMIO_SERVICE"; then
        return
      fi
      sleep 1
    done

    echo "Volumio service did not stop in time. Aborting."
    exit 1
  fi
}

start_log_tail() {
  echo "Starting log tail in background (journalctl -u volumio)..."
  journalctl -u "$VOLUMIO_SERVICE" -f --no-pager | grep -E -i "motorized_fader_control|fader|calibration" &
  LOG_TAIL_PID=$!
}

echo "Hardware fader flow test"
echo "This will stop Volumio before testing and restart it afterward."
echo ""
echo "Press ENTER to continue, or Ctrl+C to cancel..."
read -r

ensure_volumio_stopped
start_log_tail

cd "$PLUGIN_DIR"
node test_hardware_fader_flow.js
