export function toLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function monthKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function firstDayOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function firstDayOfLastNMonths(monthCount: number, reference = new Date()): Date {
  return new Date(reference.getFullYear(), reference.getMonth() - (monthCount - 1), 1)
}

export function firstDayOfLastNMonthsISO(monthCount: number, reference = new Date()): string {
  return toLocalISODate(firstDayOfLastNMonths(monthCount, reference))
}

export function lastNMonthKeys(monthCount: number, reference = new Date()): string[] {
  const result: string[] = []
  for (let index = monthCount - 1; index >= 0; index--) {
    result.push(monthKey(new Date(reference.getFullYear(), reference.getMonth() - index, 1)))
  }
  return result
}
