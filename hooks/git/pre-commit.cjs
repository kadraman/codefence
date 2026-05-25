#!/usr/bin/env node
"use strict";

/**
 * Git pre-commit hook (cross-platform). Installed to .git/hooks/pre-commit by codefence install-hooks.
 * Bypass: git commit --no-verify
 */

const { runHook } = require("../lib/run-codefence-hook.cjs");
runHook("pre-commit", process.argv.slice(2));
