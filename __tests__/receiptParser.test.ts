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
    expect(parsed.warnings).toHaveLength(0)
  })

  it('restituisce warning quando non trova i valori', () => {
    const parsed = parseReceiptText('documento illeggibile')
    expect(parsed.date).toBeUndefined()
    expect(parsed.liters).toBeUndefined()
    expect(parsed.amountEur).toBeUndefined()
    expect(parsed.warnings.length).toBeGreaterThan(0)
  })
})
