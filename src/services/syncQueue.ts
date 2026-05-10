import { getDb } from '../db/client'
import { supabase } from './supabase'
import { createId } from '../utils/id'

type SyncEntityType = 'vehicles' | 'refuels' | 'maintenance' | 'trips'

type SyncQueueRow = {
  id: string
  entity_type: SyncEntityType
  entity_id: string
  created_at: string
}

export async function enqueueDelete(
  entityType: SyncEntityType,
  entityId: string,
): Promise<void> {
  const db = getDb()
  const item: SyncQueueRow = {
    id: createId(),
    entity_type: entityType,
    entity_id: entityId,
    created_at: new Date().toISOString(),
  }

  await db.runAsync(
    `INSERT INTO sync_queue (id,entity_type,entity_id,created_at)
     VALUES (?,?,?,?)`,
    [item.id, item.entity_type, item.entity_id, item.created_at],
  )
}

export async function flushSyncQueue(): Promise<void> {
  if (!supabase) {
    return
  }

  const db = getDb()
  const rows = await db.getAllAsync<SyncQueueRow>(
    'SELECT * FROM sync_queue ORDER BY created_at ASC',
  )

  for (const row of rows) {
    const { error } = await supabase.from(row.entity_type).delete().eq('id', row.entity_id)
    if (error) {
      console.error('[syncQueue] delete sync:', row.entity_type, row.entity_id, error)
      continue
    }

    await db.runAsync('DELETE FROM sync_queue WHERE id=?', [row.id])
  }
}

export async function countPendingDeletes(): Promise<number> {
  const db = getDb()
  const rows = await db.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue',
  )
  return rows[0]?.count ?? 0
}
