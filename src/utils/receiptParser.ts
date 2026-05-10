export interface ParsedReceiptData {
  date?: string
  liters?: number
  amountEur?: number
  pricePerLiter?: number
  confidence: number
  isReliable: boolean
  warnings: string[]
  normalizedText: string
}

const LITER_KEYWORDS = ['litri', 'litro', 'liters', 'liter', 'lt', 'l']
const AMOUNT_KEYWORDS = ['totale', 'tot', 'importo', 'pagato', 'euro', 'eur', 'corrispettivo']

export function parseReceiptText(rawText: string): ParsedReceiptData {
  // R1.3 - estende il parsing OCR assistito con confidenza e prezzo/litro senza cambiare il flusso esistente.
  const normalizedText = normalizeReceiptText(rawText)
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const date = extractDate(normalizedText)
  const liters = extractLiters(lines)
  const amountEur = extractAmount(lines)
  const pricePerLiter = extractPricePerLiter(lines, liters, amountEur)
  const confidence = calculateConfidence({ date, liters, amountEur, pricePerLiter })

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
  if (confidence < 0.8) {
    warnings.push('Riconoscimento parziale: verifica con attenzione i valori compilati.')
  }

  return {
    date: date ?? undefined,
    liters: liters ?? undefined,
    amountEur: amountEur ?? undefined,
    pricePerLiter: pricePerLiter ?? undefined,
    confidence,
    isReliable: confidence >= 0.8,
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

function extractPricePerLiter(
  lines: string[],
  liters: number | null,
  amountEur: number | null,
): number | null {
  const keywordMatch = findNumberByKeyword(lines, ['€/l', 'eur/l', 'euro/l', 'prezzo/l', 'prezzo litro'])
  if (keywordMatch != null) {
    return keywordMatch
  }

  if (liters != null && amountEur != null && liters > 0) {
    return Number.parseFloat((amountEur / liters).toFixed(3))
  }

  return null
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

function calculateConfidence({
  date,
  liters,
  amountEur,
  pricePerLiter,
}: {
  date: string | null
  liters: number | null
  amountEur: number | null
  pricePerLiter: number | null
}): number {
  const matchedFields = [date, liters, amountEur, pricePerLiter].filter((value) => value != null).length
  return matchedFields / 4
}
