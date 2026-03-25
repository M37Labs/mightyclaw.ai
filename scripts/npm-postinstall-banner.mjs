#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// Skip local source installs in the repo checkout; this banner is for npm users.
if (fs.existsSync(path.join(repoRoot, ".git"))) {
  process.exit(0);
}

const isCi =
  process.env.CI === "1" || process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

if (isCi) {
  process.exit(0);
}

const isGlobalInstall = process.env.npm_config_global === "true";
const launchCommand = isGlobalInstall ? "mightyclaw" : "npx mightyclaw";

const reset = "\x1b[0m";
const bold = "\x1b[1m";
const orange = "\x1b[38;5;208m";
const green = "\x1b[38;5;78m";
const red = "\x1b[38;5;203m";
const dim = "\x1b[2m";

const lines = [
  "",
  `${bold}${orange}MightyClaw installed${reset}`,
  `${dim}M37Labs - mightyclaw.ai${reset}`,
  "",
  `${green}Next steps${reset}`,
  `  ${bold}${launchCommand} onboard --install-daemon${reset}`,
  `  ${bold}${launchCommand} dashboard --no-open${reset}`,
  `  ${bold}${launchCommand} --help${reset}`,
  "",
  `${green}Security checks${reset}`,
  `  ${bold}${launchCommand} security audit --deep${reset}`,
  `  ${bold}${launchCommand} security audit --fix${reset}`,
  `  ${dim}Running these matters more than memorizing the output. Look for critical issues first.${reset}`,
  "",
  `${red}Need a quick start?${reset} Read ${bold}README.md${reset} or open ${bold}https://mightyclaw.ai${reset}`,
  "",
];

process.stdout.write(`${lines.join("\n")}\n`);
