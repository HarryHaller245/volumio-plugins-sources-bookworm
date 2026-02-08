#!/bin/bash

################################################################################
#
# Quick Test Script for motorized_fader_control Plugin
# 
# Runs tests and validates plugin configuration
#
# Usage: ./test_plugin.sh
#
################################################################################

set -e

PLUGIN_PATH="/home/volumio/volumio-plugins-sources-bookworm/motorized_fader_control"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  motorized_fader_control - Plugin Test Script                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cd "$PLUGIN_PATH"

# Test 1: Syntax Validation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: JavaScript Syntax Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if node -c index.js 2>&1; then
    echo "✅ index.js syntax: PASS"
else
    echo "❌ index.js syntax: FAIL"
    exit 1
fi

# Test 2: Module Loading
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Module Loading"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if node -e "const m = require('./index.js'); console.log('✅ Module loads correctly')" 2>&1; then
    echo "✅ Module loading: PASS"
else
    echo "❌ Module loading: FAIL"
    exit 1
fi

# Test 3: Dependencies Check
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: NPM Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

REQUIRED_DEPS=("serialport" "socket.io-client" "kew" "v-conf" "fs-extra" "async-mutex" "winston")

all_deps_ok=true
for dep in "${REQUIRED_DEPS[@]}"; do
    if npm list "$dep" > /dev/null 2>&1; then
        version=$(npm list "$dep" 2>/dev/null | grep "$dep@" | head -1 | sed "s/.*$dep@//" | cut -d' ' -f1)
        echo "✅ $dep@$version"
    else
        echo "❌ $dep: NOT FOUND"
        all_deps_ok=false
    fi
done

if [ "$all_deps_ok" = false ]; then
    echo "⚠️  Some dependencies missing. Run: npm install"
    exit 1
fi

# Test 4: Configuration Files
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Configuration Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

files_ok=true

if [ -f "config.json" ]; then
    size=$(wc -c < config.json)
    echo "✅ config.json ($size bytes)"
else
    echo "❌ config.json: NOT FOUND"
    files_ok=false
fi

if [ -f "UIConfig.json" ]; then
    size=$(wc -c < UIConfig.json)
    echo "✅ UIConfig.json ($size bytes)"
else
    echo "❌ UIConfig.json: NOT FOUND"
    files_ok=false
fi

if [ -f "package.json" ]; then
    size=$(wc -c < package.json)
    echo "✅ package.json ($size bytes)"
else
    echo "❌ package.json: NOT FOUND"
    files_ok=false
fi

if [ -d "lib" ] && [ "$(ls -1 lib/*.js 2>/dev/null | wc -l)" -gt 0 ]; then
    count=$(ls -1 lib/*.js | wc -l)
    echo "✅ lib/ directory ($count files)"
else
    echo "❌ lib/: NOT FOUND or EMPTY"
    files_ok=false
fi

if [ -d "i18n" ] && [ -f "i18n/strings_en.json" ]; then
    echo "✅ i18n/strings_en.json"
else
    echo "❌ i18n/strings_en.json: NOT FOUND"
    files_ok=false
fi

if [ "$files_ok" = false ]; then
    exit 1
fi

# Test 5: Library Modules
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: Library Modules"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

modules_ok=true
if node -e "const lib = require('./lib'); console.log('EventBus:', typeof lib.EventBus); console.log('StateCache:', typeof lib.StateCache); console.log('FaderController:', typeof lib.FaderController);" 2>&1 | grep -q "function"; then
    echo "✅ Core modules load correctly"
else
    echo "❌ Core modules: FAILED"
    modules_ok=false
fi

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"

if [ "$files_ok" = true ] && [ "$modules_ok" = true ]; then
    echo "║  All Tests: PASSED ✅                                        ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Plugin is ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "  1. Run: ./deploy_plugin.sh"
    echo "  2. Check logs: journalctl -u volumio -f"
    echo "  3. Access UI: http://<volumio-ip>/plugin-manager"
    exit 0
else
    echo "║  Some Tests: FAILED ❌                                       ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    exit 1
fi
