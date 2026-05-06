import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../src/theme'

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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surfaceDk, borderTopColor: colors.border, borderTopWidth: 1 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index"       options={{ title: 'Home',         tabBarIcon: ({ focused }) => icon('home', focused) }} />
      <Tabs.Screen name="garage"      options={{ title: 'Garage',       tabBarIcon: ({ focused }) => icon('car-sport', focused) }} />
      <Tabs.Screen name="refuels"     options={{ title: 'Carburante',   tabBarIcon: ({ focused }) => icon('water', focused) }} />
      <Tabs.Screen name="maintenance" options={{ title: 'Manutenzione', tabBarIcon: ({ focused }) => icon('construct', focused) }} />
      <Tabs.Screen name="settings"    options={{ title: 'Impostazioni', tabBarIcon: ({ focused }) => icon('settings', focused) }} />
    </Tabs>
  )
}
