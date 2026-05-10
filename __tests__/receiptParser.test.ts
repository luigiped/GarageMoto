import { parseReceiptText } from '../src/utils/receiptParser'

describe('parseReceiptText', () => {
  it('estrae data, litri e importo da testo OCR comune', () => {
    const parsed = parseReceiptText(`
      STAZIONE TEST
      06/05/2026 14:32
      Benzina 16,42 L
      Totale EUR 31,90
    `)

    expect(parsed.date).toBe('2026-05-06')
    expect(parsed.liters).toBeCloseTo(16.42)
    expect(parsed.amountEur).toBeCloseTo(31.9)
    expect(parsed.pricePerLiter).toBeCloseTo(1.943, 3)
    expect(parsed.isReliable).toBe(true)
    expect(parsed.warnings).toHaveLength(0)
  })

  it('gestisce i decimali con punto e calcola una confidenza bassa su testo parziale', () => {
    const parsed = parseReceiptText(`
      SELF SERVICE
      Litri 14.5 L
      Pagato 29.75 euro
    `)

    expect(parsed.liters).toBeCloseTo(14.5)
    expect(parsed.amountEur).toBeCloseTo(29.75)
    expect(parsed.confidence).toBeLessThan(0.8)
    expect(parsed.isReliable).toBe(false)
    expect(parsed.warnings).toContain('Data non riconosciuta automaticamente.')
  })

  it('restituisce warning quando non trova i valori', () => {
    const parsed = parseReceiptText('documento illeggibile')
    expect(parsed.date).toBeUndefined()
    expect(parsed.liters).toBeUndefined()
    expect(parsed.amountEur).toBeUndefined()
    expect(parsed.isReliable).toBe(false)
    expect(parsed.warnings.length).toBeGreaterThan(0)
  })
})
