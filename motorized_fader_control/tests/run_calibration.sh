#!/bin/bash

# Quick Calibration Tester
# Runs UI calibration with real hardware

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

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     MOTORIZED FADER CONTROL - HARDWARE CALIBRATION        ║"
echo "║     Real Fader Movements with Live Feedback               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "About to start calibration test with REAL FADERS"
echo ""
echo "IMPORTANT: The serial port must not be in use."
echo ""
echo "The script will stop Volumio automatically before testing."
echo ""
echo "Make sure:"
echo "  ✓ Hardware is connected to ${PLUGIN_DIR#*/plugins/}"
echo "  ✓ Serial port is configured in config.json"
echo "  ✓ Faders have room to move freely"
echo ""
echo "Press ENTER to start calibration, or Ctrl+C to cancel..."
read -r

ensure_volumio_stopped
start_log_tail

cd "$PLUGIN_DIR"
node test_ui_calibration_hw.js
