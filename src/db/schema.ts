// R1.0
export const CREATE_VEHICLES = `
  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    displacement_cc INTEGER,
    tank_capacity_l REAL NOT NULL,
    odometer_start_km INTEGER NOT NULL DEFAULT 0,
    fuel_type TEXT NOT NULL DEFAULT 'benzina',
    nickname TEXT,
    color_hex TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_pending INTEGER NOT NULL DEFAULT 0
  )
`

export const CREATE_REFUELS = `
  CREATE TABLE IF NOT EXISTS refuels (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    date TEXT NOT NULL,
    odometer_km INTEGER NOT NULL,
    liters REAL NOT NULL,
    amount_eur REAL NOT NULL,
    is_full_tank INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    km_driven INTEGER,
    km_per_liter REAL,
    cost_per_km REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_pending INTEGER NOT NULL DEFAULT 0
  )
`

export const CREATE_MAINTENANCE = `
  CREATE TABLE IF NOT EXISTS maintenance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    type TEXT NOT NULL,
    label TEXT,
    last_date TEXT,
    last_km INTEGER,
    interval_km INTEGER,
    interval_months INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_pending INTEGER NOT NULL DEFAULT 0
  )
`

// R1.1 - aggiunta tabella viaggi GPS
export const CREATE_TRIPS = `
  CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    distance_km REAL NOT NULL,
    duration_minutes INTEGER NOT NULL,
    avg_speed_kmh REAL NOT NULL,
    max_speed_kmh REAL NOT NULL,
    max_lean_angle_deg REAL,
    max_lean_left_deg REAL,
    max_lean_right_deg REAL,
    max_braking_g REAL,
    route_json TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_pending INTEGER NOT NULL DEFAULT 0
  )
`
