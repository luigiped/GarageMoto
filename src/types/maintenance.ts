export type MaintenanceType =
  | 'oil_change'
  | 'general_service'
  | 'chain_clean'
  | 'chain_lube'
  | 'tire_check'
  | 'revision'
  | 'insurance'
  | 'tax'
  | 'brake_check'
  | 'custom'

export const MAINTENANCE_LABELS: Record<MaintenanceType, string> = {
  oil_change:      'Cambio olio',
  general_service: 'Tagliando generale',
  chain_clean:     'Pulizia catena',
  chain_lube:      'Lubrificazione catena',
  tire_check:      'Controllo pneumatici',
  revision:        'Revisione',
  insurance:       'Assicurazione',
  tax:             'Bollo',
  brake_check:     'Controllo freni',
  custom:          'Personalizzato',
}

export const MAINTENANCE_ICONS: Record<MaintenanceType, string> = {
  oil_change:      '🛢️',
  general_service: '🔧',
  chain_clean:     '⛓️',
  chain_lube:      '🔩',
  tire_check:      '🛞',
  revision:        '📋',
  insurance:       '📄',
  tax:             '🏛️',
  brake_check:     '🛑',
  custom:          '⚙️',
}

export type MaintenanceStatus = 'ok' | 'warning' | 'overdue'

export interface Maintenance {
  id: string
  user_id: string
  vehicle_id: string
  type: MaintenanceType
  label?: string
  last_date?: string     // ISO date: YYYY-MM-DD
  last_km?: number
  interval_km?: number
  interval_months?: number
  notes?: string
  created_at: string
  updated_at: string
}

export type NewMaintenance = Omit<Maintenance, 'id' | 'created_at' | 'updated_at'>
