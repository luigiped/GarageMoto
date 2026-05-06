/** Formatta km/l con 1 decimale. es: "16.4 km/l" */
export function formatKmL(value: number | null | undefined): string {
  if (value == null) return '--'
  return `${value.toFixed(1)} km/l`
}

/** Formatta euro con 2 decimali. es: "29.75 €" */
export function formatEuro(value: number): string {
  return `${value.toFixed(2)} €`
}

/** Formatta litri con 2 decimali. es: "14.50 L" */
export function formatLiters(value: number): string {
  return `${value.toFixed(2)} L`
}

/** Formatta km interi. es: "12.450 km" */
export function formatKm(value: number): string {
  return `${value.toLocaleString('it-IT')} km`
}

/** Formatta prezzo/litro con 3 decimali. es: "1.879 €/L" */
export function formatPricePerLiter(value: number): string {
  return `${value.toFixed(3)} €/L`
}

/** Formatta data ISO (YYYY-MM-DD) in italiano. es: "3 mag 2026" */
export function formatDate(isoDate: string): string {
  const months = [
    'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
    'lug', 'ago', 'set', 'ott', 'nov', 'dic',
  ]
  const [year, month, day] = isoDate.split('-').map(Number)
  return `${day} ${months[month - 1]} ${year}`
}

/** Oggi come stringa ISO YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
