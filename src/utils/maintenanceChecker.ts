import type { Maintenance, MaintenanceStatus } from '../types/maintenance'

const WARNING_KM = 500     // warning se mancano meno di 500km
const WARNING_DAYS = 30    // warning se mancano meno di 30 giorni

export function getStatus(
  item: Maintenance,
  currentKm: number,
  today: Date = new Date(),
): MaintenanceStatus {
  const kmStatus = _kmStatus(item, currentKm)
  const dateStatus = _dateStatus(item, today)

  // Prende lo stato peggiore tra km e data
  if (kmStatus === 'overdue' || dateStatus === 'overdue') return 'overdue'
  if (kmStatus === 'warning' || dateStatus === 'warning') return 'warning'
  return 'ok'
}

/** Km rimanenti al prossimo intervento. null se nessun dato km. */
export function kmUntilDue(item: Maintenance, currentKm: number): number | null {
  if (item.last_km == null || item.interval_km == null) return null
  return (item.last_km + item.interval_km) - currentKm
}

/** Giorni rimanenti alla prossima scadenza. null se nessuna data. */
export function daysUntilDue(item: Maintenance, today: Date = new Date()): number | null {
  if (!item.last_date || item.interval_months == null) return null
  const due = new Date(item.last_date)
  due.setMonth(due.getMonth() + item.interval_months)
  const diffMs = due.getTime() - today.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function _kmStatus(item: Maintenance, currentKm: number): MaintenanceStatus {
  const remaining = kmUntilDue(item, currentKm)
  if (remaining == null) return 'ok'
  if (remaining < 0) return 'overdue'
  if (remaining <= WARNING_KM) return 'warning'
  return 'ok'
}

function _dateStatus(item: Maintenance, today: Date): MaintenanceStatus {
  const days = daysUntilDue(item, today)
  if (days == null) return 'ok'
  if (days < 0) return 'overdue'
  if (days <= WARNING_DAYS) return 'warning'
  return 'ok'
}
