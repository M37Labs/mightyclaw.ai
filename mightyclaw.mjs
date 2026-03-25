#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { access } from "node:fs/promises";
import module from "node:module";
import { fileURLToPath } from "node:url";

const CLI_NAME = "mightyclaw";
const RELEASE_PACKAGE_NAME = "@m37labs/mightyclaw";
const RELEASE_REPOSITORY = "github:M37Labs/mightyclaw.ai";
const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 12;
const MIN_NODE_VERSION = `${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}`;

const parseNodeVersion = (rawVersion) => {
  const [majorRaw = "0", minorRaw = "0"] = rawVersion.split(".");
  return {
    major: Number(majorRaw),
    minor: Number(minorRaw),
  };
};

const isSupportedNodeVersion = (version) =>
  version.major > MIN_NODE_MAJOR ||
  (version.major === MIN_NODE_MAJOR && version.minor >= MIN_NODE_MINOR);

const ensureSupportedNodeVersion = () => {
  if (isSupportedNodeVersion(parseNodeVersion(process.versions.node))) {
    return;
  }

  process.stderr.write(
    `${CLI_NAME}: Node.js v${MIN_NODE_VERSION}+ is required (current: v${process.versions.node}).\n` +
      "If you use nvm, run:\n" +
      `  nvm install ${MIN_NODE_MAJOR}\n` +
      `  nvm use ${MIN_NODE_MAJOR}\n` +
      `  nvm alias default ${MIN_NODE_MAJOR}\n`,
  );
  process.exit(1);
};

ensureSupportedNodeVersion();

if (module.enableCompileCache && !process.env.NODE_DISABLE_COMPILE_CACHE) {
  try {
    module.enableCompileCache();
  } catch {
    // Ignore errors
  }
}

const isModuleNotFoundError = (err) =>
  err && typeof err === "object" && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";

const isDirectModuleNotFoundError = (err, specifier) => {
  if (!isModuleNotFoundError(err)) {
    return false;
  }

  const expectedUrl = new URL(specifier, import.meta.url);
  if ("url" in err && err.url === expectedUrl.href) {
    return true;
  }

  const message = "message" in err && typeof err.message === "string" ? err.message : "";
  const expectedPath = fileURLToPath(expectedUrl);
  return (
    message.includes(`Cannot find module '${expectedPath}'`) ||
    message.includes(`Cannot find module "${expectedPath}"`)
  );
};

const installProcessWarningFilter = async () => {
  for (const specifier of ["./dist/warning-filter.js", "./dist/warning-filter.mjs"]) {
    try {
      const mod = await import(specifier);
      if (typeof mod.installProcessWarningFilter === "function") {
        mod.installProcessWarningFilter();
        return;
      }
    } catch (err) {
      if (isDirectModuleNotFoundError(err, specifier)) {
        continue;
      }
      throw err;
    }
  }
};

const tryImport = async (specifier) => {
  try {
    await import(specifier);
    return true;
  } catch (err) {
    if (isDirectModuleNotFoundError(err, specifier)) {
      return false;
    }
    throw err;
  }
};

const exists = async (specifier) => {
  try {
    await access(new URL(specifier, import.meta.url));
    return true;
  } catch {
    return false;
  }
};

const buildMissingEntryErrorMessage = async () => {
  const lines = [`${CLI_NAME}: missing dist/entry.(m)js (build output).`];
  if (!(await exists("./src/entry.ts"))) {
    return lines.join("\n");
  }

  lines.push("This install looks like an unbuilt source tree or GitHub source archive.");
  lines.push(
    "Build locally with `pnpm install && pnpm build`, or install the published MightyClaw package instead.",
  );
  lines.push(
    `For pinned GitHub installs, use \`npm install -g ${RELEASE_REPOSITORY}#<ref>\` instead of a raw \`/archive/<ref>.tar.gz\` URL.`,
  );
  lines.push(`For releases, use \`npm install -g ${RELEASE_PACKAGE_NAME}@latest\`.`);
  return lines.join("\n");
};

const isBareRootHelpInvocation = (argv) =>
  argv.length === 3 && (argv[2] === "--help" || argv[2] === "-h");
const isBareRootVersionInvocation = (argv) =>
  argv.length === 3 && (argv[2] === "--version" || argv[2] === "-V");

const loadPrecomputedRootHelpText = () => {
  try {
    const raw = readFileSync(new URL("./dist/cli-startup-metadata.json", import.meta.url), "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed?.rootHelpText !== "string" || parsed.rootHelpText.length === 0) {
      return null;
    }
    return parsed.rootHelpText.replace(/\bopenclaw\b/g, CLI_NAME);
  } catch {
    return null;
  }
};

const tryOutputBareRootHelp = async () => {
  if (!isBareRootHelpInvocation(process.argv)) {
    return false;
  }
  const precomputed = loadPrecomputedRootHelpText();
  if (precomputed) {
    process.stdout.write(precomputed);
    return true;
  }
  for (const specifier of ["./dist/cli/program/root-help.js", "./dist/cli/program/root-help.mjs"]) {
    try {
      const mod = await import(specifier);
      if (typeof mod.outputRootHelp === "function") {
        const originalArgv1 = process.argv[1];
        process.argv[1] = CLI_NAME;
        try {
          mod.outputRootHelp();
        } finally {
          process.argv[1] = originalArgv1;
        }
        return true;
      }
    } catch (err) {
      if (isDirectModuleNotFoundError(err, specifier)) {
        continue;
      }
      throw err;
    }
  }
  return false;
};

const tryOutputBareRootVersion = async () => {
  if (!isBareRootVersionInvocation(process.argv)) {
    return false;
  }
  const pkgRaw = readFileSync(new URL("./package.json", import.meta.url), "utf8");
  const pkg = JSON.parse(pkgRaw);
  const version =
    typeof pkg?.version === "string" && pkg.version.trim() ? pkg.version.trim() : null;
  if (!version) {
    return false;
  }
  try {
    const gitModule = await import("./dist/infra/git-commit.js").catch(
      () => import("./dist/infra/git-commit.mjs"),
    );
    const commit =
      typeof gitModule?.resolveCommitHash === "function"
        ? gitModule.resolveCommitHash({ moduleUrl: import.meta.url })
        : null;
    process.stdout.write(
      commit ? `MightyClaw ${version} (${commit})\n` : `MightyClaw ${version}\n`,
    );
    return true;
  } catch {
    process.stdout.write(`MightyClaw ${version}\n`);
    return true;
  }
};

if ((await tryOutputBareRootHelp()) || (await tryOutputBareRootVersion())) {
  // OK
} else {
  await installProcessWarningFilter();
  if (await tryImport("./dist/entry.js")) {
    // OK
  } else if (await tryImport("./dist/entry.mjs")) {
    // OK
  } else {
    throw new Error(await buildMissingEntryErrorMessage());
  }
}
