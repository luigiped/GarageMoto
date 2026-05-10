import { create } from 'zustand'

const AUTO_TRIP_UNAVAILABLE_MESSAGE =
  'Tracking automatico non disponibile in questa build. Usa la development build sul telefono.'

type AutoTripService = typeof import('../services/autoTrip')

let autoTripServicePromise: Promise<AutoTripService | null> | null = null

async function loadAutoTripService(): Promise<AutoTripService | null> {
  if (!autoTripServicePromise) {
    autoTripServicePromise = import('../services/autoTrip')
      .then((service) => service)
      .catch((error) => {
        console.error('[autoTripStore] service unavailable:', error)
        return null
      })
  }

  return autoTripServicePromise
}

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
    const service = await loadAutoTripService()
    if (!service) {
      set({
        enabled: false,
        isRecording: false,
        isTaskActive: false,
        isReady: true,
        error: AUTO_TRIP_UNAVAILABLE_MESSAGE,
      })
      return
    }

    const [enabled, session, isTaskActive] = await Promise.all([
      service.loadAutoTripEnabled(),
      service.getAutoTripSession(),
      service.getIsAutoTripTaskActive(),
    ])

    set({
      enabled,
      isRecording: Boolean(session),
      isTaskActive,
      isReady: true,
      error: null,
    })
  },

  refreshStatus: async () => {
    const service = await loadAutoTripService()
    if (!service) {
      set({
        enabled: false,
        isRecording: false,
        isTaskActive: false,
        error: AUTO_TRIP_UNAVAILABLE_MESSAGE,
      })
      return
    }

    const [session, isTaskActive] = await Promise.all([
      service.getAutoTripSession(),
      service.getIsAutoTripTaskActive(),
    ])

    set({
      isRecording: Boolean(session),
      isTaskActive,
      error: null,
    })
  },

  setContext: async (userId, vehicleId) => {
    set({ userId, vehicleId })
    const service = await loadAutoTripService()
    if (!service) {
      set({ error: AUTO_TRIP_UNAVAILABLE_MESSAGE })
      return
    }

    await service.syncAutoTripContext(userId && vehicleId ? { userId, vehicleId } : null)
    await get().refreshStatus()
  },

  setEnabled: async (enabled) => {
    set({ isBusy: true, error: null })
    try {
      const service = await loadAutoTripService()
      if (!service) {
        set({
          isBusy: false,
          error: AUTO_TRIP_UNAVAILABLE_MESSAGE,
        })
        return false
      }

      const { userId, vehicleId } = get()
      const context = userId && vehicleId ? { userId, vehicleId } : null

      if (enabled) {
        const granted = await service.requestAutoTripPermissions()
        if (!granted) {
          set({
            isBusy: false,
            error: 'Permesso GPS in background non concesso.',
          })
          return false
        }
      }

      await service.setAutoTripEnabled(enabled, context)
      const [session, isTaskActive] = await Promise.all([
        service.getAutoTripSession(),
        service.getIsAutoTripTaskActive(),
      ])

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
      const service = await loadAutoTripService()
      if (!service) {
        set({
          isBusy: false,
          error: AUTO_TRIP_UNAVAILABLE_MESSAGE,
        })
        return
      }

      await service.finalizeCurrentSession()
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
