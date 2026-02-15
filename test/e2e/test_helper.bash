#!/usr/bin/env bash
# test_helper.bash — Common test helper loaded by all E2E test files
#
# Usage in .bats files:
#   setup() {
#     load test_helper
#   }
#
# This file loads bats-support, bats-assert, and all project helpers.

# Resolve paths
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BATS_SUPPORT_DIR="${REPO_ROOT}/node_modules/bats-support"
BATS_ASSERT_DIR="${REPO_ROOT}/node_modules/bats-assert"
HELPERS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/helpers" && pwd)"

# Load bats-support (must come before bats-assert)
load "${BATS_SUPPORT_DIR}/load.bash"

# Load bats-assert
load "${BATS_ASSERT_DIR}/load.bash"

# Load project helpers
# shellcheck source=helpers/fixtures.bash
source "${HELPERS_DIR}/fixtures.bash"
# shellcheck source=helpers/daemon.bash
source "${HELPERS_DIR}/daemon.bash"
# shellcheck source=helpers/assertions.bash
source "${HELPERS_DIR}/assertions.bash"
