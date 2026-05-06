import * as SQLite from 'expo-sqlite'
import { CREATE_MAINTENANCE, CREATE_REFUELS, CREATE_VEHICLES } from './schema'

type Row = Record<string, unknown>

export interface AppDatabase {
  runAsync(source: string, params?: unknown[]): Promise<unknown>
  getAllAsync<T>(source: string, params?: unknown[]): Promise<T[]>
}

let _db: AppDatabase | null = null
let _isFallbackDb = false

export function getDb(): AppDatabase {
  if (!_db) throw new Error('Database non inizializzato. Chiama initDb() prima.')
  return _db
}

export function isFallbackDb(): boolean {
  return _isFallbackDb
}

export async function initDb(): Promise<void> {
  if (_db) {
    return
  }

  try {
    const db = await SQLite.openDatabaseAsync('garagemoto.db')

    // Expo Go Android puo fallire in prepareAsync su alcuni device: se succede,
    // scendiamo al fallback in memoria invece di bloccare tutto il bootstrap.
    await db.runAsync('PRAGMA foreign_keys = ON')
    await db.runAsync(CREATE_VEHICLES)
    await db.runAsync(CREATE_REFUELS)
    await db.runAsync(CREATE_MAINTENANCE)
    await db.runAsync('PRAGMA journal_mode = WAL').catch((error) => {
      console.warn('[db] WAL non disponibile, continuo senza WAL:', error)
    })

    _db = db as AppDatabase
    _isFallbackDb = false
  } catch (error) {
    console.error('[db] SQLite non disponibile, passo al fallback in memoria:', error)
    _db = new MemoryDatabase()
    _isFallbackDb = true
  }
}

class MemoryDatabase implements AppDatabase {
  private tables: Record<'vehicles' | 'refuels' | 'maintenance', Row[]> = {
    vehicles: [],
    refuels: [],
    maintenance: [],
  }

  async runAsync(source: string, params: unknown[] = []): Promise<unknown> {
    const sql = normalizeSql(source)

    if (sql.startsWith('pragma ') || sql.startsWith('create table if not exists')) {
      return
    }

    if (sql.startsWith('insert into vehicles')) {
      this.insert('vehicles', vehicleRowFromInsert(params))
      return
    }

    if (sql.startsWith('insert or replace into vehicles')) {
      this.upsert('vehicles', vehicleRowFromSync(params))
      return
    }

    if (sql.startsWith('update vehicles set brand=')) {
      const id = String(params[10])
      this.updateById('vehicles', id, {
        brand: params[0],
        model: params[1],
        year: params[2],
        displacement_cc: params[3],
        tank_capacity_l: params[4],
        odometer_start_km: params[5],
        fuel_type: params[6],
        nickname: params[7],
        color_hex: params[8],
        updated_at: params[9],
        sync_pending: 1,
      })
      return
    }

    if (sql.startsWith('update vehicles set sync_pending=0 where id=?')) {
      this.updateById('vehicles', String(params[0]), { sync_pending: 0 })
      return
    }

    if (sql.startsWith('delete from vehicles where id=?')) {
      this.deleteWhere('vehicles', row => row.id === params[0])
      return
    }

    if (sql.startsWith('insert into refuels')) {
      this.insert('refuels', refuelRowFromInsert(params))
      return
    }

    if (sql.startsWith('insert or replace into refuels')) {
      this.upsert('refuels', refuelRowFromSync(params))
      return
    }

    if (sql.startsWith('update refuels set sync_pending=0 where id=?')) {
      this.updateById('refuels', String(params[0]), { sync_pending: 0 })
      return
    }

    if (sql.startsWith('delete from refuels where id=?')) {
      this.deleteWhere('refuels', row => row.id === params[0])
      return
    }

    if (sql.startsWith('delete from refuels where vehicle_id=?')) {
      this.deleteWhere('refuels', row => row.vehicle_id === params[0])
      return
    }

    if (sql.startsWith('insert into maintenance')) {
      this.insert('maintenance', maintenanceRowFromInsert(params))
      return
    }

    if (sql.startsWith('insert or replace into maintenance')) {
      this.upsert('maintenance', maintenanceRowFromSync(params))
      return
    }

    if (sql.startsWith('update maintenance set sync_pending=0 where id=?')) {
      this.updateById('maintenance', String(params[0]), { sync_pending: 0 })
      return
    }

    if (sql.startsWith('delete from maintenance where id=?')) {
      this.deleteWhere('maintenance', row => row.id === params[0])
      return
    }

    if (sql.startsWith('delete from maintenance where vehicle_id=?')) {
      this.deleteWhere('maintenance', row => row.vehicle_id === params[0])
      return
    }

    console.warn('[db-memory] query non gestita:', source)
  }

  async getAllAsync<T>(source: string, params: unknown[] = []): Promise<T[]> {
    const sql = normalizeSql(source)

    if (sql.startsWith('select * from vehicles where user_id = ? and is_active = 1')) {
      const userId = String(params[0])
      return this.tables.vehicles
        .filter(row => row.user_id === userId && Number(row.is_active) === 1)
        .sort(descByCreatedAt)
        .map(row => ({ ...row })) as T[]
    }

    if (sql.startsWith('select * from refuels where vehicle_id=?')) {
      const vehicleId = String(params[0])
      return this.tables.refuels
        .filter(row => row.vehicle_id === vehicleId)
        .sort((a, b) => Number(b.odometer_km) - Number(a.odometer_km))
        .map(row => ({ ...row })) as T[]
    }

    if (sql.startsWith('select * from maintenance where vehicle_id=?')) {
      const vehicleId = String(params[0])
      return this.tables.maintenance
        .filter(row => row.vehicle_id === vehicleId)
        .sort(descByCreatedAt)
        .map(row => ({ ...row })) as T[]
    }

    console.warn('[db-memory] select non gestita:', source)
    return []
  }

  private insert(table: keyof MemoryDatabase['tables'], row: Row) {
    this.tables[table].unshift(row)
  }

  private upsert(table: keyof MemoryDatabase['tables'], row: Row) {
    const index = this.tables[table].findIndex(item => item.id === row.id)
    if (index >= 0) {
      this.tables[table][index] = row
    } else {
      this.tables[table].unshift(row)
    }
  }

  private updateById(table: keyof MemoryDatabase['tables'], id: string, patch: Row) {
    const index = this.tables[table].findIndex(item => item.id === id)
    if (index >= 0) {
      this.tables[table][index] = {
        ...this.tables[table][index],
        ...patch,
      }
    }
  }

  private deleteWhere(table: keyof MemoryDatabase['tables'], predicate: (row: Row) => boolean) {
    this.tables[table] = this.tables[table].filter(row => !predicate(row))
  }
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase()
}

function descByCreatedAt(a: Row, b: Row): number {
  return String(b.created_at).localeCompare(String(a.created_at))
}

function vehicleRowFromInsert(params: unknown[]): Row {
  return {
    id: params[0],
    user_id: params[1],
    brand: params[2],
    model: params[3],
    year: params[4],
    displacement_cc: params[5],
    tank_capacity_l: params[6],
    odometer_start_km: params[7],
    fuel_type: params[8],
    nickname: params[9],
    color_hex: params[10],
    is_active: params[11],
    created_at: params[12],
    updated_at: params[13],
    sync_pending: 1,
  }
}

function vehicleRowFromSync(params: unknown[]): Row {
  return {
    id: params[0],
    user_id: params[1],
    brand: params[2],
    model: params[3],
    year: params[4],
    displacement_cc: params[5],
    tank_capacity_l: params[6],
    odometer_start_km: params[7],
    fuel_type: params[8],
    nickname: params[9],
    color_hex: params[10],
    is_active: params[11],
    created_at: params[12],
    updated_at: params[13],
    sync_pending: 0,
  }
}

function refuelRowFromInsert(params: unknown[]): Row {
  return {
    id: params[0],
    user_id: params[1],
    vehicle_id: params[2],
    date: params[3],
    odometer_km: params[4],
    liters: params[5],
    amount_eur: params[6],
    is_full_tank: params[7],
    notes: params[8],
    km_driven: params[9],
    km_per_liter: params[10],
    cost_per_km: params[11],
    created_at: params[12],
    updated_at: params[13],
    sync_pending: 1,
  }
}

function refuelRowFromSync(params: unknown[]): Row {
  return {
    id: params[0],
    user_id: params[1],
    vehicle_id: params[2],
    date: params[3],
    odometer_km: params[4],
    liters: params[5],
    amount_eur: params[6],
    is_full_tank: params[7],
    notes: params[8],
    km_driven: params[9],
    km_per_liter: params[10],
    cost_per_km: params[11],
    created_at: params[12],
    updated_at: params[13],
    sync_pending: 0,
  }
}

function maintenanceRowFromInsert(params: unknown[]): Row {
  return {
    id: params[0],
    user_id: params[1],
    vehicle_id: params[2],
    type: params[3],
    label: params[4],
    last_date: params[5],
    last_km: params[6],
    interval_km: params[7],
    interval_months: params[8],
    notes: params[9],
    created_at: params[10],
    updated_at: params[11],
    sync_pending: 1,
  }
}

function maintenanceRowFromSync(params: unknown[]): Row {
  return {
    id: params[0],
    user_id: params[1],
    vehicle_id: params[2],
    type: params[3],
    label: params[4],
    last_date: params[5],
    last_km: params[6],
    interval_km: params[7],
    interval_months: params[8],
    notes: params[9],
    created_at: params[10],
    updated_at: params[11],
    sync_pending: 0,
  }
}
