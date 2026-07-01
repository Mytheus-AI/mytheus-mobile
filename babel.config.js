module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo wires the worklets plugin for reanimated 4 itself.
    presets: ['babel-preset-expo'],
  };
};
