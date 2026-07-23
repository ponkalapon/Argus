/** Metro configuration to exclude Electron-specific files from the Expo bundler */
module.exports = {
  resolver: {
    blockList: /electron\/.*$/,
  },
};
