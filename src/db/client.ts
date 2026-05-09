import * as SQLite from 'expo-sqlite'
import {
  CREATE_MAINTENANCE,
  CREATE_REFUELS,
  CREATE_TRIPS,
  CREATE_VEHICLES,
} from './schema'

type SqlValue = string | number | null

export interface AppDatabase {
  execAsync: (sql: string) => Promise<void>
  runAsync: (sql: string, params?: SqlValue[]) => Promise<void>
  getAllAsync: <T>(sql: string, params?: SqlValue[]) => Promise<T[]>
}

type TableName = 'vehicles' | 'refuels' | 'maintenance' | 'trips'
type DbMode = 'sqlite' | 'memory'
type MemoryTables = Record<TableName, Record<string, SqlValue>[]>

let _db: AppDatabase | null = null
let _dbMode: DbMode = 'sqlite'

export function getDb(): AppDatabase {
  if (!_db) throw new Error('Database non inizializzato. Chiama initDb() prima.')
  return _db
}

export async function ensureDb(): Promise<AppDatabase> {
  if (!_db) {
    await initDb()
  }

  return getDb()
}

export function getDbMode(): DbMode {
  return _dbMode
}

export function isUsingMemoryDb(): boolean {
  return _dbMode === 'memory'
}

export async function initDb(): Promise<void> {
  try {
    const sqlite = await SQLite.openDatabaseAsync('garagemoto.db')
    const adapter = createSqliteAdapter(sqlite)

    await adapter.execAsync('PRAGMA journal_mode = WAL;')
    await adapter.execAsync('PRAGMA foreign_keys = ON;')
    await adapter.execAsync(CREATE_VEHICLES)
    await adapter.execAsync(CREATE_REFUELS)
    await adapter.execAsync(CREATE_MAINTENANCE)
    await adapter.execAsync(CREATE_TRIPS)
    await ensureTripsPerformanceColumns(adapter)

    _db = adapter
    _dbMode = 'sqlite'
  } catch (error) {
    console.error('[db] sqlite unavailable, fallback to memory:', error)
    const memory = createMemoryAdapter()

    await memory.execAsync(CREATE_VEHICLES)
    await memory.execAsync(CREATE_REFUELS)
    await memory.execAsync(CREATE_MAINTENANCE)
    await memory.execAsync(CREATE_TRIPS)

    _db = memory
    _dbMode = 'memory'
  }
}

async function ensureTripsPerformanceColumns(db: AppDatabase): Promise<void> {
  const migrations = [
    'ALTER TABLE trips ADD COLUMN max_lean_angle_deg REAL',
    'ALTER TABLE trips ADD COLUMN max_lean_left_deg REAL',
    'ALTER TABLE trips ADD COLUMN max_lean_right_deg REAL',
    'ALTER TABLE trips ADD COLUMN max_braking_g REAL',
  ]

  for (const sql of migrations) {
    try {
      await db.execAsync(sql)
    } catch {
      // Colonna gia presente: migration idempotente.
    }
  }
}

function createSqliteAdapter(db: SQLite.SQLiteDatabase): AppDatabase {
  return {
    execAsync: async (sql) => {
      await db.execAsync(sql)
    },
    runAsync: async (sql, params = []) => {
      await db.runAsync(sql, params as unknown as SQLite.SQLiteBindParams)
    },
    getAllAsync: async <T>(sql: string, params: SqlValue[] = []) => {
      return db.getAllAsync<T>(sql, params as unknown as SQLite.SQLiteBindParams)
    },
  }
}

function createMemoryAdapter(): AppDatabase {
  const tables: MemoryTables = {
    vehicles: [],
    refuels: [],
    maintenance: [],
    trips: [],
  }

  return {
    execAsync: async (_sql) => {
      return
    },

    runAsync: async (sql, params = []) => {
      const normalized = normalizeSql(sql)

      if (normalized.startsWith('insert into') || normalized.startsWith('insert or replace into')) {
        insertRow(tables, normalized, params)
        return
      }

      if (normalized.startsWith('update')) {
        updateRows(tables, normalized, params)
        return
      }

      if (normalized.startsWith('delete from')) {
        deleteRows(tables, normalized, params)
      }
    },

    getAllAsync: async <T>(sql: string, params: SqlValue[] = []) => {
      return selectRows<T>(tables, normalizeSql(sql), params)
    },
  }
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase()
}

function getTableName(sql: string): TableName {
  const match =
    sql.match(/(?:insert(?: or replace)? into|update|delete from|from)\s+(vehicles|refuels|maintenance|trips)/i)

  if (!match) {
    throw new Error(`SQL non supportato dal fallback in memoria: ${sql}`)
  }

  return match[1] as TableName
}

function insertRow(tables: MemoryTables, sql: string, params: SqlValue[]): void {
  const table = getTableName(sql)
  const columnsMatch = sql.match(/\(([^)]+)\)\s+values/i)

  if (!columnsMatch) {
    throw new Error(`INSERT non supportato dal fallback in memoria: ${sql}`)
  }

  const columns = columnsMatch[1].split(',').map((column) => column.trim())
  const row: Record<string, SqlValue> = {}

  columns.forEach((column, index) => {
    row[column] = params[index] ?? null
  })

  const existingIndex = tables[table].findIndex((item) => item.id === row.id)
  if (existingIndex >= 0) {
    tables[table][existingIndex] = row
  } else {
    tables[table].push(row)
  }
}

function updateRows(tables: MemoryTables, sql: string, params: SqlValue[]): void {
  const table = getTableName(sql)
  const updateMatch = sql.match(/set\s+(.+)\s+where\s+(\w+)=\?/i)

  if (!updateMatch) {
    throw new Error(`UPDATE non supportato dal fallback in memoria: ${sql}`)
  }

  const assignments = updateMatch[1].split(',').map((part) => part.trim())
  const whereField = updateMatch[2]
  const whereValue = params[assignments.length]

  const nextValues = Object.fromEntries(
    assignments.map((assignment, index) => [assignment.split('=')[0].trim(), params[index] ?? null]),
  )

  tables[table] = tables[table].map((row) =>
    row[whereField] === whereValue
      ? { ...row, ...nextValues }
      : row,
  )
}

function deleteRows(tables: MemoryTables, sql: string, params: SqlValue[]): void {
  const table = getTableName(sql)
  const deleteMatch = sql.match(/where\s+(\w+)=\?/i)

  if (!deleteMatch) {
    throw new Error(`DELETE non supportato dal fallback in memoria: ${sql}`)
  }

  const whereField = deleteMatch[1]
  const whereValue = params[0]

  tables[table] = tables[table].filter((row) => row[whereField] !== whereValue)
}

function selectRows<T>(tables: MemoryTables, sql: string, params: SqlValue[]): T[] {
  const table = getTableName(sql)
  const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i)
  const orderMatch = sql.match(/order by\s+(\w+)\s+(asc|desc)/i)

  let rows = [...tables[table]]

  if (whereMatch) {
    const whereField = whereMatch[1]
    rows = rows.filter((row) => row[whereField] === params[0])
  }

  if (sql.includes('is_active = 1')) {
    rows = rows.filter((row) => row.is_active === 1)
  }

  if (orderMatch) {
    const orderField = orderMatch[1]
    const direction = orderMatch[2]

    rows.sort((a, b) => compareValues(a[orderField], b[orderField], direction))
  }

  return rows as T[]
}

function compareValues(a: SqlValue, b: SqlValue, direction: string): number {
  if (a == null && b == null) return 0
  if (a == null) return direction === 'desc' ? 1 : -1
  if (b == null) return direction === 'desc' ? -1 : 1

  if (a > b) return direction === 'desc' ? -1 : 1
  if (a < b) return direction === 'desc' ? 1 : -1
  return 0
}
