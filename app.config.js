const baseConfig = require('./app.json')

const googleMapsAndroidApiKey =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY

module.exports = () => {
  const expo = {
    ...baseConfig.expo,
    android: {
      ...baseConfig.expo.android,
      config: {
        ...baseConfig.expo.android?.config,
        ...(googleMapsAndroidApiKey
          ? {
              googleMaps: {
                apiKey: googleMapsAndroidApiKey,
              },
            }
          : {}),
      },
    },
  }

  return { expo }
}
