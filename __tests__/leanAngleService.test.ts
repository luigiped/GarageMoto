jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

jest.mock('expo-sensors', () => ({
  Accelerometer: {
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}))

import {
  applyLeanCalibration,
  calculateRawLeanAngleDeg,
  createLeanAngleSummary,
  getLeanAngleTone,
  updateLeanAngleSummary,
} from '../src/services/leanAngleService'

describe('leanAngleService', () => {
  it('restituisce angolo 0 con accelerometro verticale', () => {
    expect(calculateRawLeanAngleDeg(0, 1)).toBeCloseTo(0, 5)
  })

  it('applica correttamente l offset di calibrazione', () => {
    expect(applyLeanCalibration(18, 3)).toBeCloseTo(15, 5)
  })

  it('aggiorna correttamente i massimi sinistra/destra', () => {
    let summary = createLeanAngleSummary()
    summary = updateLeanAngleSummary(summary, -27)
    summary = updateLeanAngleSummary(summary, 31)
    expect(summary.maxLeanAngleDeg).toBe(31)
    expect(summary.maxLeanLeftDeg).toBe(27)
    expect(summary.maxLeanRightDeg).toBe(31)
  })

  it('mappa le soglie colore come da release', () => {
    expect(getLeanAngleTone(10)).toBe('default')
    expect(getLeanAngleTone(28)).toBe('warning')
    expect(getLeanAngleTone(-40)).toBe('danger')
  })
})
