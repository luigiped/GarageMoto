// R1.1 - aggiunti tab Viaggi e Statistiche
import { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../src/theme'
import { useAuthStore } from '../../src/store/authStore'
import { useVehicleStore } from '../../src/store/vehicleStore'
import { useAutoTripStore } from '../../src/store/autoTripStore'

type IconName = React.ComponentProps<typeof Ionicons>['name']

function icon(name: IconName, focused: boolean) {
  return (
    <Ionicons
      name={focused ? name : `${name}-outline` as IconName}
      size={24}
      color={focused ? colors.primary : colors.textMuted}
    />
  )
}

export default function TabsLayout() {
  const { user } = useAuthStore()
  const { activeVehicle, loadVehicles } = useVehicleStore()
  const { bootstrap, setContext, isReady } = useAutoTripStore()

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
      <Tabs.Screen name="index"       options={{ title: 'Home',         tabBarIcon: ({ focused }) => icon('home', focused) }} />
      <Tabs.Screen name="garage"      options={{ title: 'Garage',       tabBarIcon: ({ focused }) => icon('car-sport', focused) }} />
      <Tabs.Screen name="refuels"     options={{ title: 'Carburante',   tabBarIcon: ({ focused }) => icon('water', focused) }} />
      <Tabs.Screen name="trips"       options={{ title: 'Viaggi',       tabBarIcon: ({ focused }) => icon('map', focused) }} />
      <Tabs.Screen name="maintenance" options={{ title: 'Manutenzione', tabBarIcon: ({ focused }) => icon('construct', focused) }} />
      <Tabs.Screen name="settings"    options={{ title: 'Impostazioni', tabBarIcon: ({ focused }) => icon('settings', focused) }} />
    </Tabs>
  )
}
