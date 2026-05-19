import { useEffect } from 'react'
import { Redirect, Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { isSupabaseConfigured } from '../../src/services/supabase'
import { useAuthStore } from '../../src/store/authStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { useAutoTripStore } from '../../src/store/autoTripStore'
import { useTheme } from '../../src/useTheme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

function icon(name: IconName, focused: boolean, colors: ReturnType<typeof useTheme>['colors']) {
  return (
    <Ionicons
      name={focused ? name : `${name}-outline` as IconName}
      size={24}
      color={focused ? colors.primary : colors.textMuted}
    />
  )
}

export default function TabsLayout() {
  const { session, user } = useAuthStore()
  const { activeVehicle, loadVehicles } = useVehicleStore()
  const { bootstrap, setContext, isReady } = useAutoTripStore()
  const { colors } = useTheme()

  useEffect(() => {
    if (user?.id) {
      loadVehicles(user.id)
    }
  }, [loadVehicles, user?.id])

  useEffect(() => {
    if (!isReady) {
      bootstrap().catch((error) => {
        console.error('[tabs] autoTrip bootstrap:', error)
      })
    }
  }, [bootstrap, isReady])

  useEffect(() => {
    setContext(user?.id ?? null, activeVehicle?.id ?? null).catch((error) => {
      console.error('[tabs] autoTrip context:', error)
    })
  }, [activeVehicle?.id, setContext, user?.id])

  if (isSupabaseConfigured && !session) {
    return <Redirect href="/login" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 84,
          paddingTop: 10,
          paddingBottom: 12,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarItemStyle: { borderRadius: 18, marginHorizontal: 2 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ focused }) => icon('home', focused, colors) }} />
      <Tabs.Screen name="garage" options={{ title: 'Garage', tabBarIcon: ({ focused }) => icon('car-sport', focused, colors) }} />
      <Tabs.Screen name="refuels" options={{ title: 'Carburante', tabBarIcon: ({ focused }) => icon('water', focused, colors) }} />
      <Tabs.Screen name="trips" options={{ title: 'Viaggi', tabBarIcon: ({ focused }) => icon('map', focused, colors) }} />
      <Tabs.Screen name="maintenance" options={{ title: 'Manutenzione', tabBarIcon: ({ focused }) => icon('construct', focused, colors) }} />
      <Tabs.Screen name="settings" options={{ title: 'Impostazioni', tabBarIcon: ({ focused }) => icon('settings', focused, colors) }} />
    </Tabs>
  )
}
