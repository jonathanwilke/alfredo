const { getDefaultConfig } = require("expo/metro-config");

// Expo SDK 52+ configures pnpm monorepos when this preset is used:
// it sets the workspace root and watchFolders from pnpm-workspace.yaml.
// Do not set watchFolders, nodeModulesPaths, or disable package exports.
// Better Auth resolves through package.json exports, and the repo must
// keep pnpm's default linker (shamefullyHoist only; no nodeLinker: hoisted).
const config = getDefaultConfig(__dirname);

module.exports = config;
