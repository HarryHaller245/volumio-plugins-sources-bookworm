#!/bin/bash

# Diagnostic Script for motorized_fader_control
# Checks current state of plugin, faders, and configuration

PLUGIN_HOME="/home/volumio/volumio-plugins-sources-bookworm/motorized_fader_control"
CONFIG_FILE="$PLUGIN_HOME/config.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}motorized_fader_control Diagnostics${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# === 1. Plugin Status
echo -e "${BLUE}1. PLUGIN STATUS${NC}"
echo -e "${YELLOW}---${NC}"
status=$(systemctl is-active volumio 2>/dev/null)
if [ "$status" = "active" ]; then
    echo -e "${GREEN}✓ Volumio service is running${NC}"
else
    echo -e "${RED}✗ Volumio service is NOT running${NC}"
fi
echo ""

# === 2. Configuration
echo -e "${BLUE}2. CONFIGURATION${NC}"
echo -e "${YELLOW}---${NC}"
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${GREEN}✓ config.json exists${NC}"
    echo ""
    echo "Fader Configuration:"
    cat "$CONFIG_FILE" | jq '.FADERS_IDXS // "Not configured"' 2>/dev/null || echo "  [Unable to parse]"
    echo ""
    echo "Speed Settings:"
    cat "$CONFIG_FILE" | jq '.FADER_CONTROLLER_SPEED_HIGH, .FADER_CONTROLLER_SPEED_MEDIUM, .FADER_CONTROLLER_SPEED_LOW' 2>/dev/null || cat "$CONFIG_FILE" | grep -i "speed"
    echo ""
    echo "Log Level:"
    cat "$CONFIG_FILE" | jq '.LOG_LEVEL // "default"' 2>/dev/null || cat "$CONFIG_FILE" | grep -i "log_level"
else
    echo -e "${RED}✗ config.json NOT found${NC}"
fi
echo ""

# === 3. Recent Logs (Last 50 lines with key terms)
echo -e "${BLUE}3. RECENT CALIBRATION LOGS${NC}"
echo -e "${YELLOW}---${NC}"
echo "Last 20 calibration-related log entries:"
journalctl -u volumio -n 100 --no-pager | grep -i "calibration\|optimal\|speedfactor" | tail -20
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}(No recent calibration logs found)${NC}"
fi
echo ""

# === 4. Recent Playback Events
echo -e "${BLUE}4. RECENT PLAYBACK EVENTS${NC}"
echo -e "${YELLOW}---${NC}"
echo "Last 20 playback-related log entries:"
journalctl -u volumio -n 100 --no-pager | grep -i "playback\|track\|album" | tail -20
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}(No recent playback logs found)${NC}"
fi
echo ""

# === 5. Errors in Recent Logs
echo -e "${BLUE}5. RECENT ERRORS${NC}"
echo -e "${YELLOW}---${NC}"
error_count=$(journalctl -u volumio -n 500 --no-pager | grep -i "error\|failed\|exception" | wc -l)
if [ "$error_count" -gt 0 ]; then
    echo -e "${RED}Found $error_count error(s) in recent logs:${NC}"
    journalctl -u volumio -n 500 --no-pager | grep -i "error\|failed\|exception" | tail -10
else
    echo -e "${GREEN}✓ No recent errors found${NC}"
fi
echo ""

# === 6. Module Status Check
echo -e "${BLUE}6. MODULE LOAD CHECK${NC}"
echo -e "${YELLOW}---${NC}"
if node -e "const modules = require('$PLUGIN_HOME/lib'); console.log('✓ All modules loaded successfully');" 2>/dev/null; then
    echo -e "${GREEN}✓ Core modules load without errors${NC}"
else
    echo -e "${RED}✗ Module loading error - see details above${NC}"
fi
echo ""

# === 7. Quick Reference
echo -e "${BLUE}7. QUICK REFERENCE${NC}"
echo -e "${YELLOW}---${NC}"
echo "Monitor calibration: ./monitor_logs.sh calibration"
echo "Monitor playback:    ./monitor_logs.sh playback"
echo "Monitor volume:      ./monitor_logs.sh volume"
echo "Monitor all logs:    ./monitor_logs.sh full"
echo ""
echo "View all config:     cat config.json | jq"
echo "Tail logs:           journalctl -u volumio -f"
echo ""

echo -e "${CYAN}======================================${NC}"
echo "Diagnostics complete"
echo -e "${CYAN}======================================${NC}"
