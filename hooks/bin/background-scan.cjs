#!/usr/bin/env node
"use strict";

/**
 * IDE afterFileEdit hook (cross-platform). Referenced from .cursor/hooks.json / .kiro/hooks.json.
 */

const { runHook } = require("../lib/run-codefence-hook.cjs");
runHook("background-scan", process.argv.slice(2));
