require('dotenv').config();

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...(config.android ?? {}),
    package: 'com.filcareclinic.clinicapp',
  },
  ios: {
    ...(config.ios ?? {}),
    bundleIdentifier: 'com.filcareclinic.clinicapp',
  },
  extra: {
    ...(config.extra ?? {}),
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  },
});
