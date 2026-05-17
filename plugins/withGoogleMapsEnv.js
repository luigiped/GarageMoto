const { AndroidConfig, createRunOncePlugin } = require('expo/config-plugins')

function withGoogleMapsEnv(config) {
  const googleMapsAndroidApiKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY

  if (!googleMapsAndroidApiKey) {
    return config
  }

  config.android = config.android || {}
  config.android.config = {
    ...(config.android.config || {}),
    googleMaps: {
      apiKey: googleMapsAndroidApiKey,
    },
  }

  return AndroidConfig.GoogleMapsApiKey.withGoogleMapsApiKey(config)
}

module.exports = createRunOncePlugin(
  withGoogleMapsEnv,
  'garagemoto-with-google-maps-env',
  '1.0.0',
)
