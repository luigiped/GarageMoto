import Constants from 'expo-constants'
import { Platform } from 'react-native'

type NotificationsModule = typeof import('expo-notifications')

let hasConfiguredHandler = false
let hasConfiguredChannel = false

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  try {
    const Notifications = await import('expo-notifications')

    if (!hasConfiguredHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      })
      hasConfiguredHandler = true
    }

    return Notifications
  } catch (error) {
    console.error('[notifications] unavailable:', error)
    return null
  }
}

export async function requestPermissions(): Promise<boolean> {
  const Notifications = await getNotificationsModule()
  if (!Notifications) {
    return false
  }

  if (Platform.OS === 'android' && !hasConfiguredChannel) {
    await Notifications.setNotificationChannelAsync('maintenance-alerts', {
      name: 'Promemoria manutenzione',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
    hasConfiguredChannel = true
  }

  // In Expo Go alcune capability native restano limitate: non blocchiamo l'app.
  if (Constants.executionEnvironment === 'storeClient') {
    console.warn('[notifications] Expo Go attivo: provo solo funzionalita locali')
  }

  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function scheduleMaintenanceWarning(
  id: string,
  title: string,
  body: string,
): Promise<void> {
  const granted = await requestPermissions()
  if (!granted) {
    console.warn('[notifications] permesso non concesso, alert locale non schedulato')
    return
  }

  const Notifications = await getNotificationsModule()
  if (!Notifications) {
    return
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)

  await Notifications.cancelScheduledNotificationAsync(id).catch(() => null)

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, data: {} },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tomorrow,
    },
  })
}

export async function scheduleDebugNotification(): Promise<boolean> {
  const granted = await requestPermissions()
  if (!granted) {
    return false
  }

  const Notifications = await getNotificationsModule()
  if (!Notifications) {
    return false
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'GarageMoto',
      body: 'Notifica locale di test ricevuta correttamente.',
      data: { type: 'debug-notification' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
    },
  })

  return true
}

export async function cancelNotification(id: string): Promise<void> {
  const Notifications = await getNotificationsModule()
  if (!Notifications) {
    return
  }

  await Notifications.cancelScheduledNotificationAsync(id).catch(() => null)
}

export async function cancelAllNotifications(): Promise<void> {
  const Notifications = await getNotificationsModule()
  if (!Notifications) {
    return
  }

  await Notifications.cancelAllScheduledNotificationsAsync()
}
