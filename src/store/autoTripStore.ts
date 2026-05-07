import { create } from 'zustand'
import {
  finalizeCurrentSession,
  getAutoTripSession,
  getIsAutoTripTaskActive,
  loadAutoTripEnabled,
  requestAutoTripPermissions,
  setAutoTripEnabled,
  syncAutoTripContext,
} from '../services/autoTrip'

interface AutoTripStore {
  enabled: boolean
  isReady: boolean
  isRecording: boolean
  isTaskActive: boolean
  isBusy: boolean
  error: string | null
  userId: string | null
  vehicleId: string | null
  bootstrap: () => Promise<void>
  refreshStatus: () => Promise<void>
  setContext: (userId: string | null, vehicleId: string | null) => Promise<void>
  setEnabled: (enabled: boolean) => Promise<boolean>
  stopCurrentTrip: () => Promise<void>
}

export const useAutoTripStore = create<AutoTripStore>((set, get) => ({
  enabled: false,
  isReady: false,
  isRecording: false,
  isTaskActive: false,
  isBusy: false,
  error: null,
  userId: null,
  vehicleId: null,

  bootstrap: async () => {
    const enabled = await loadAutoTripEnabled()
    const session = await getAutoTripSession()
    const isTaskActive = await getIsAutoTripTaskActive()
    set({
      enabled,
      isRecording: Boolean(session),
      isTaskActive,
      isReady: true,
    })
  },

  refreshStatus: async () => {
    const session = await getAutoTripSession()
    const isTaskActive = await getIsAutoTripTaskActive()
    set({
      isRecording: Boolean(session),
      isTaskActive,
    })
  },

  setContext: async (userId, vehicleId) => {
    set({ userId, vehicleId })
    await syncAutoTripContext(userId && vehicleId ? { userId, vehicleId } : null)
    await get().refreshStatus()
  },

  setEnabled: async (enabled) => {
    set({ isBusy: true, error: null })
    try {
      const { userId, vehicleId } = get()
      const context = userId && vehicleId ? { userId, vehicleId } : null

      if (enabled) {
        const granted = await requestAutoTripPermissions()
        if (!granted) {
          set({
            isBusy: false,
            error: 'Permesso GPS in background non concesso.',
          })
          return false
        }
      }

      await setAutoTripEnabled(enabled, context)
      const session = await getAutoTripSession()
      const isTaskActive = await getIsAutoTripTaskActive()
      set({
        enabled,
        isRecording: Boolean(session),
        isTaskActive,
        isBusy: false,
      })
      return true
    } catch (error) {
      console.error('[autoTripStore] setEnabled:', error)
      set({
        isBusy: false,
        error: 'Impossibile aggiornare il rilevamento automatico.',
      })
      return false
    }
  },

  stopCurrentTrip: async () => {
    set({ isBusy: true, error: null })
    try {
      await finalizeCurrentSession()
      await get().refreshStatus()
      set({ isBusy: false })
    } catch (error) {
      console.error('[autoTripStore] stopCurrentTrip:', error)
      set({
        isBusy: false,
        error: 'Impossibile fermare il viaggio automatico.',
      })
    }
  },
}))
