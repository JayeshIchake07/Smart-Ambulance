const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../shared');
const navigationTemplateRoot = path.resolve(sharedRoot, 'navigation-template');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders || []), sharedRoot];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'rapidaid-navigation-template': navigationTemplateRoot,
};

module.exports = config;