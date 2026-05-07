// R1.1
import type { Refuel } from '../types/refuel'
import type { Trip } from '../types/trip'

function escape(value: string | undefined | null): string {
  if (value == null) return ''
  // Escape virgolette e wrappa in quotes se contiene virgola/newline
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportRefuels(refuels: Refuel[]): string {
  const header = 'Data,Odometro(km),Litri,Importo(€),Prezzo/L,km/L,Pieno,Note'
  const rows = refuels.map(r => {
    const ppl = r.liters > 0 ? (r.amount_eur / r.liters).toFixed(3) : ''
    return [
      r.date,
      r.odometer_km,
      r.liters.toFixed(3),
      r.amount_eur.toFixed(2),
      ppl,
      r.km_per_liter != null ? r.km_per_liter.toFixed(2) : '',
      r.is_full_tank ? 'Sì' : 'No',
      escape(r.notes),
    ].join(',')
  })
  return [header, ...rows].join('\n')
}

export function exportTrips(trips: Trip[]): string {
  const header = 'Data inizio,Data fine,Distanza(km),Durata(min),Vel.media(km/h),Vel.max(km/h)'
  const rows = trips.map(t => [
    t.start_time.slice(0, 19).replace('T', ' '),
    t.end_time.slice(0, 19).replace('T', ' '),
    t.distance_km.toFixed(2),
    t.duration_minutes,
    t.avg_speed_kmh.toFixed(1),
    t.max_speed_kmh.toFixed(1),
  ].join(','))
  return [header, ...rows].join('\n')
}

export async function shareCsv(csv: string, filename: string): Promise<void> {
  const FileSystem = await import('expo-file-system/legacy')
  const Sharing = await import('expo-sharing')
  const path = `${FileSystem.cacheDirectory}${filename}`
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  })
  const canShare = await Sharing.isAvailableAsync()
  if (!canShare) throw new Error('Condivisione non disponibile su questo dispositivo')
  await Sharing.shareAsync(path, {
    mimeType: 'text/csv',
    dialogTitle: `Esporta ${filename}`,
    UTI: 'public.comma-separated-values-text',
  })
}
