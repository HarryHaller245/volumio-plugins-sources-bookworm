#!/bin/bash

# Log Monitoring Script for motorized_fader_control Testing
# Usage: ./monitor_logs.sh [calibration|playback|volume|full]

PLUGIN_HOME="/home/volumio/volumio-plugins-sources-bookworm/motorized_fader_control"
MONITOR_TYPE="${1:-calibration}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=====================================${NC}"
echo -e "${CYAN}Motorized Fader Control - Log Monitor${NC}"
echo -e "${CYAN}=====================================${NC}"
echo ""

case "$MONITOR_TYPE" in
  calibration)
    echo -e "${BLUE}MODE: CALIBRATION${NC}"
    echo -e "${YELLOW}Filters: calibration, optimal, speedfactor${NC}"
    echo -e "${YELLOW}Command to start calibration from UI:${NC}"
    echo -e "${GREEN}  Settings → System Hardware → motorized_fader_control → CALIBRATE${NC}"
    echo ""
    echo -e "${CYAN}Live logs:${NC}"
    journalctl -u volumio -f | grep -E -i "calibration|optimal|speedfactor|testing|cal_|starting calibration"
    ;;

  playback)
    echo -e "${BLUE}MODE: PLAYBACK${NC}"
    echo -e "${YELLOW}Filters: playback, track, album, seek${NC}"
    echo ""
    echo -e "${CYAN}Live logs:${NC}"
    journalctl -u volumio -f | grep -E -i "playback|track|album|seek|content-type|artist|title"
    ;;

  volume)
    echo -e "${BLUE}MODE: VOLUME${NC}"
    echo -e "${YELLOW}Filters: volume, setvolume, move${NC}"
    echo ""
    echo -e "${CYAN}Live logs:${NC}"
    journalctl -u volumio -f | grep -E -i "volume|setvolume|move|fader.*target"
    ;;

  full)
    echo -e "${BLUE}MODE: FULL PLUGIN LOGS${NC}"
    echo -e "${YELLOW}Showing all motorized_fader_control activity${NC}"
    echo ""
    echo -e "${CYAN}Live logs:${NC}"
    journalctl -u volumio -f | grep -i "motorized_fader_control"
    ;;

  *)
    echo -e "${RED}Unknown mode: $MONITOR_TYPE${NC}"
    echo ""
    echo "Usage: $0 [calibration|playback|volume|full]"
    echo ""
    echo "Modes:"
    echo "  calibration  - Monitor calibration sequence and optimal settings"
    echo "  playback     - Monitor track/album playback and seek events"
    echo "  volume       - Monitor volume changes and fader moves"
    echo "  full         - Show all plugin logs"
    exit 1
    ;;
esac
