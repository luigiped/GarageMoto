import { create } from 'zustand'
import { getDb } from '../db/client'
import { supabase } from '../services/supabase'
import { scheduleMaintenanceWarning, cancelNotification } from '../services/notifications'
import { getStatus } from '../utils/maintenanceChecker'
import { MAINTENANCE_LABELS } from '../types/maintenance'
import type { Maintenance, NewMaintenance } from '../types/maintenance'
import { createId } from '../utils/id'

interface MaintenanceStore {
  items: Maintenance[]
  isLoading: boolean
  error: string | null
  loadMaintenance: (vehicleId: string) => Promise<void>
  addMaintenance: (data: NewMaintenance, currentKm: number) => Promise<void>
  deleteMaintenance: (id: string) => Promise<void>
}

export const useMaintenanceStore = create<MaintenanceStore>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  loadMaintenance: async (vehicleId) => {
    set({ isLoading: true, error: null })
    try {
      const db = getDb()
      const rows = await db.getAllAsync<Maintenance>(
        'SELECT * FROM maintenance WHERE vehicle_id=? ORDER BY created_at DESC',
        [vehicleId],
      )
      set({ items: rows, isLoading: false })
      _syncMaintenance(vehicleId)
    } catch (e) {
      console.error('[maintenanceStore] load:', e)
      set({ isLoading: false, error: 'Errore caricamento manutenzione' })
    }
  },

  addMaintenance: async (data, currentKm) => {
    set({ error: null })
    const now = new Date().toISOString()
    const item: Maintenance = { ...data, id: createId(), created_at: now, updated_at: now }

    try {
      const db = getDb()
      await db.runAsync(
        `INSERT INTO maintenance
         (id,user_id,vehicle_id,type,label,last_date,last_km,
          interval_km,interval_months,notes,created_at,updated_at,sync_pending)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          item.id, item.user_id, item.vehicle_id, item.type,
          item.label ?? null, item.last_date ?? null, item.last_km ?? null,
          item.interval_km ?? null, item.interval_months ?? null,
          item.notes ?? null, item.created_at, item.updated_at,
        ],
      )
      set({ items: [item, ...get().items] })

      // Notifica se già in warning
      const status = getStatus(item, currentKm)
      if (status === 'warning') {
        const label = item.label ?? MAINTENANCE_LABELS[item.type]
        await scheduleMaintenanceWarning(
          item.id,
          'Manutenzione in scadenza',
          `${label} richiede attenzione.`,
        )
      }

      _pushMaintenance(item)
    } catch (e) {
      console.error('[maintenanceStore] add:', e)
      set({ error: 'Errore salvataggio manutenzione' })
    }
  },

  deleteMaintenance: async (id) => {
    try {
      const db = getDb()
      await db.runAsync('DELETE FROM maintenance WHERE id=?', [id])
      await cancelNotification(id)
      set({ items: get().items.filter(i => i.id !== id) })
      if (supabase) {
        supabase.from('maintenance').delete().eq('id', id).then(({ error }) => {
          if (error) console.error('[maintenanceStore] delete sync:', error)
        })
      }
    } catch (e) {
      console.error('[maintenanceStore] delete:', e)
      set({ error: 'Errore eliminazione manutenzione' })
    }
  },
}))

async function _pushMaintenance(item: Maintenance) {
  if (!supabase) return

  const { error } = await supabase.from('maintenance').upsert(item)
  if (error) {
    console.error('[maintenanceStore] sync push:', error)
  } else {
    getDb().runAsync('UPDATE maintenance SET sync_pending=0 WHERE id=?', [item.id])
      .catch(console.error)
  }
}

async function _syncMaintenance(vehicleId: string) {
  if (!supabase) return

  const { data, error } = await supabase
    .from('maintenance')
    .select('*')
    .eq('vehicle_id', vehicleId)
  if (error || !data) return

  const db = getDb()
  for (const m of data) {
    await db.runAsync(
      `INSERT OR REPLACE INTO maintenance
       (id,user_id,vehicle_id,type,label,last_date,last_km,
        interval_km,interval_months,notes,created_at,updated_at,sync_pending)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      [
        m.id, m.user_id, m.vehicle_id, m.type, m.label ?? null,
        m.last_date ?? null, m.last_km ?? null, m.interval_km ?? null,
        m.interval_months ?? null, m.notes ?? null, m.created_at, m.updated_at,
      ],
    ).catch(console.error)
  }
}
