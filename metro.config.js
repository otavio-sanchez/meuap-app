const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Garante que Metro resolve 'firebase/auth' usando o bundle React Native,
// que inclui getReactNativePersistence (removido do bundle browser/node).
config.resolver.unstable_conditionNames = [
  'react-native',
  'require',
  'default',
];

module.exports = config;
