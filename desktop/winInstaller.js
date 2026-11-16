"use strict";

// Builds the Windows NSIS installer. When the Azure Artifact Signing
// secrets are present, electron-builder signs the app exe and the installer
// with the Public Trust profile. A fork pull request has no secrets, so
// that build stays unsigned and still succeeds.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const AZURE_SIGN = {
  endpoint: "https://eus.codesigning.azure.net/",
  codeSigningAccountName: "ue5toolsigning",
  certificateProfileName: "ue5tools-public",
  TimestampRfc3161: "http://timestamp.acs.microsoft.com",
  TimestampDigest: "SHA256",
  FileDigest: "SHA256",
};

function signingEnabled(env = process.env) {
  return ["AZURE_CLIENT_ID", "AZURE_TENANT_ID", "AZURE_CLIENT_SECRET"].every((name) => String(env[name] || "").trim());
}

function windowsBuildConfig(base, env = process.env) {
  const config = JSON.parse(JSON.stringify(base || {}));
  if (!signingEnabled(env)) return { config, signing: false };
  config.win = {
    ...(config.win || {}),
    signAndEditExecutable: true,
    azureSignOptions: { ...AZURE_SIGN },
  };
  return { config, signing: true };
}

function main() {
  const root = path.join(__dirname, "..");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const { config, signing } = windowsBuildConfig(pkg.build);
  if (signing) {
    console.log("Signing the Windows app and installer with Azure Artifact Signing (account ue5toolsigning, profile ue5tools-public).");
  } else {
    console.warn("::warning::Azure Artifact Signing secrets are missing (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET). Building an unsigned Windows installer.");
  }
  const configPath = path.join(os.tmpdir(), "ue5-win-builder.json");
  fs.writeFileSync(configPath, JSON.stringify(config));
  const cli = path.join(root, "node_modules", "electron-builder", "cli.js");
  const result = spawnSync(process.execPath, [cli, "--config", configPath, "--win", "nsis", "--publish", "never"], {
    cwd: root,
    stdio: "inherit",
  });
  const code = result.status == null ? 1 : result.status;
  process.exit(code);
}

if (require.main === module) main();

module.exports = { AZURE_SIGN, signingEnabled, windowsBuildConfig };
