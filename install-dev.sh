#!/usr/bin/env bash
set -euo pipefail

MARKETPLACE_NAME="browser-cli-marketplace"
PLUGIN_NAME="browser-cli"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Reinstalling ${PLUGIN_NAME} plugin from ${SCRIPT_DIR} ..."

claude plugin uninstall "${PLUGIN_NAME}@${MARKETPLACE_NAME}" 2>/dev/null || true
claude plugin marketplace remove "${MARKETPLACE_NAME}" 2>/dev/null || true
claude plugin marketplace add "${SCRIPT_DIR}"
claude plugin install "${PLUGIN_NAME}@${MARKETPLACE_NAME}"

echo ""
echo "Done. Plugin '${PLUGIN_NAME}' installed from local source."
echo "Run 'claude plugin list' to verify."
