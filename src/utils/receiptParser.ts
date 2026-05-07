export interface ParsedReceiptData {
  date?: string
  liters?: number
  amountEur?: number
  warnings: string[]
  normalizedText: string
}

const LITER_KEYWORDS = ['litri', 'litro', 'liters', 'liter', 'lt', 'l']
const AMOUNT_KEYWORDS = ['totale', 'tot', 'importo', 'pagato', 'euro', 'eur', 'corrispettivo']

export function parseReceiptText(rawText: string): ParsedReceiptData {
  const normalizedText = normalizeReceiptText(rawText)
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const date = extractDate(normalizedText)
  const liters = extractLiters(lines)
  const amountEur = extractAmount(lines)

  const warnings: string[] = []
  if (!date) {
    warnings.push('Data non riconosciuta automaticamente.')
  }
  if (liters == null) {
    warnings.push('Litri non riconosciuti automaticamente.')
  }
  if (amountEur == null) {
    warnings.push('Importo non riconosciuto automaticamente.')
  }

  return {
    date: date ?? undefined,
    liters: liters ?? undefined,
    amountEur: amountEur ?? undefined,
    warnings,
    normalizedText,
  }
}

function normalizeReceiptText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim()
}

function extractDate(text: string): string | null {
  const patterns = [
    /(\d{2})[\/.-](\d{2})[\/.-](\d{4})/,
    /(\d{4})[\/.-](\d{2})[\/.-](\d{2})/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) {
      continue
    }

    if (match[1].length === 4) {
      const [, year, month, day] = match
      return `${year}-${month}-${day}`
    }

    const [, day, month, year] = match
    return `${year}-${month}-${day}`
  }

  return null
}

function extractLiters(lines: string[]): number | null {
  const keywordMatch = findNumberByKeyword(lines, LITER_KEYWORDS)
  if (keywordMatch != null) {
    return keywordMatch
  }

  const fallback = findAllNumbers(lines)
    .filter((value) => value > 2 && value < 40)
    .sort((a, b) => a - b)[0]

  return fallback ?? null
}

function extractAmount(lines: string[]): number | null {
  const keywordMatch = findNumberByKeyword(lines, AMOUNT_KEYWORDS)
  if (keywordMatch != null) {
    return keywordMatch
  }

  const fallback = findAllNumbers(lines)
    .filter((value) => value >= 5 && value < 500)
    .sort((a, b) => b - a)[0]

  return fallback ?? null
}

function findNumberByKeyword(lines: string[], keywords: string[]): number | null {
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (!keywords.some((keyword) => lower.includes(keyword))) {
      continue
    }

    const numbers = extractNumbersFromLine(line)
    if (numbers.length > 0) {
      return numbers[numbers.length - 1]
    }
  }

  return null
}

function findAllNumbers(lines: string[]): number[] {
  return lines.flatMap((line) => extractNumbersFromLine(line))
}

function extractNumbersFromLine(line: string): number[] {
  const matches = line.match(/\d+[.,]\d{1,3}|\d+/g) ?? []
  return matches
    .map((value) => Number.parseFloat(value.replace(',', '.')))
    .filter((value) => Number.isFinite(value))
}
