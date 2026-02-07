#!/bin/bash

################################################################################
#
# motorized_fader_control - Plugin Deployment Script
# Volumio4 Edition
#
# Quickly updates and restarts the plugin while inspecting logs
#
# Usage:
#   ./deploy_plugin.sh                 # Normal deployment
#   ./deploy_plugin.sh --reset-config  # Reset config.json before restart
#   ./deploy_plugin.sh --watch-only    # Just watch logs (no restart)
#
################################################################################

set -e  # Exit on error

PLUGIN_NAME="motorized_fader_control"
PLUGIN_PATH="/home/volumio/volumio-plugins-sources-bookworm/${PLUGIN_NAME}"
CONFIG_PATH="/data/configuration/system_hardware/${PLUGIN_NAME}"
RESET_CONFIG=false
WATCH_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --reset-config)
            RESET_CONFIG=true
            shift
            ;;
        --watch-only)
            WATCH_ONLY=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--reset-config] [--watch-only]"
            exit 1
            ;;
    esac
done

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  motorized_fader_control - Volumio4 Deployment Script          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Function to print phase headers
print_phase() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "→ $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Phase 1: Reset config if requested
if [ "$RESET_CONFIG" = true ]; then
    print_phase "Phase 1: Resetting Plugin Configuration"
    
    if [ -d "$CONFIG_PATH" ]; then
        echo "ℹ️  Configuration directory found: $CONFIG_PATH"
        if [ -f "$CONFIG_PATH/config.json" ]; then
            echo "🔄 Removing old config.json..."
            rm -f "$CONFIG_PATH/config.json"
            echo "✅ config.json removed"
        else
            echo "ℹ️  config.json not found (will use defaults)"
        fi
    else
        echo "⚠️  Configuration directory not found (will be created on first run)"
    fi
else
    echo "ℹ️  Skipping config reset (use --reset-config to reset)"
fi

# Phase 2: Navigate to plugin and refresh
if [ "$WATCH_ONLY" = false ]; then
    print_phase "Phase 2: Refreshing Plugin"
    
    if [ ! -d "$PLUGIN_PATH" ]; then
        echo "❌ Error: Plugin path not found: $PLUGIN_PATH"
        exit 1
    fi
    
    cd "$PLUGIN_PATH"
    echo "📁 Working directory: $(pwd)"
    
    echo "🔄 Running 'volumio plugin refresh'..."
    volumio plugin refresh
    echo "✅ Plugin refresh complete"
fi

# Phase 3: Restart volumio
if [ "$WATCH_ONLY" = false ]; then
    print_phase "Phase 3: Restarting Volumio"
    
    echo "⏳ Waiting 3 seconds before restart..."
    sleep 3
    
    echo "🔄 Restarting Volumio service..."
    volumio vrestart
    
    echo "⏳ Waiting 5 seconds for service to start..."
    sleep 5
fi

# Phase 4: Watch logs
print_phase "Phase 4: Watching Plugin Logs"

echo "📋 Log entries for: $PLUGIN_NAME"
echo "ℹ️  Press Ctrl+C to stop watching logs"
echo ""

# Watch journalctl with color
journalctl -u volumio -f \
    --grep="motorized_fader_control|FaderController|EventBus|StateCache" \
    --no-pager \
    2>/dev/null || \
    journalctl -u volumio -f \
    --no-pager | \
    grep -E "motorized_fader_control|FaderController|EventBus|StateCache|Error|error" || true

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Deployment Complete                                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
