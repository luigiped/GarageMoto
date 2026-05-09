// R1.3 - calcolo angolo di piega da accelerometro con calibrazione utente.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Accelerometer, type AccelerometerMeasurement } from 'expo-sensors'

const LEAN_CALIBRATION_KEY = 'garagemoto:lean-angle-calibration'
const SAMPLE_INTERVAL_MS = 20

export interface LeanCalibration {
  offsetDeg: number
  calibratedAt: string
}

export interface LeanAngleSample {
  rawAngleDeg: number
  correctedAngleDeg: number
  tone: 'default' | 'warning' | 'danger'
}

export interface LeanAngleSummary {
  maxLeanAngleDeg: number
  maxLeanLeftDeg: number
  maxLeanRightDeg: number
}

let _subscription: { remove: () => void } | null = null

export async function isLeanAngleAvailable(): Promise<boolean> {
  try {
    const sensor = Accelerometer as typeof Accelerometer & {
      isAvailableAsync?: () => Promise<boolean>
    }

    if (typeof sensor.isAvailableAsync === 'function') {
      return await sensor.isAvailableAsync()
    }

    return true
  } catch (error) {
    console.error('[leanAngle] availability:', error)
    return false
  }
}

export async function hasLeanAngleCalibration(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(LEAN_CALIBRATION_KEY)
  return Boolean(raw)
}

export async function getLeanAngleCalibration(): Promise<LeanCalibration | null> {
  const raw = await AsyncStorage.getItem(LEAN_CALIBRATION_KEY)
  return raw ? JSON.parse(raw) as LeanCalibration : null
}

export async function calibrateLeanAngle(durationMs = 1200): Promise<LeanCalibration> {
  const available = await isLeanAngleAvailable()
  if (!available) {
    throw new Error('Sensore accelerometro non disponibile in questa build')
  }

  const samples = await collectAccelerometerSamples(durationMs)
  const offsetDeg = average(samples.map((sample) => calculateRawLeanAngleDeg(sample.y, sample.z)))
  const calibration: LeanCalibration = {
    offsetDeg: round1(offsetDeg),
    calibratedAt: new Date().toISOString(),
  }
  await AsyncStorage.setItem(LEAN_CALIBRATION_KEY, JSON.stringify(calibration))
  return calibration
}

export async function resetLeanAngleCalibration(): Promise<void> {
  await AsyncStorage.removeItem(LEAN_CALIBRATION_KEY)
}

export async function startLeanAngleTracking(
  onSample: (sample: LeanAngleSample) => void,
): Promise<void> {
  if (_subscription) {
    return
  }

  const calibration = await getLeanAngleCalibration()
  if (!calibration) {
    throw new Error('Lean angle non calibrato')
  }

  const available = await isLeanAngleAvailable()
  if (!available) {
    throw new Error('Sensore accelerometro non disponibile in questa build')
  }

  Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS)
  _subscription = Accelerometer.addListener((measurement) => {
    const rawAngleDeg = calculateRawLeanAngleDeg(measurement.y, measurement.z)
    const correctedAngleDeg = applyLeanCalibration(rawAngleDeg, calibration.offsetDeg)
    onSample({
      rawAngleDeg: round1(rawAngleDeg),
      correctedAngleDeg: round1(correctedAngleDeg),
      tone: getLeanAngleTone(correctedAngleDeg),
    })
  })
}

export function stopLeanAngleTracking(): void {
  _subscription?.remove()
  _subscription = null
}

export function createLeanAngleSummary(): LeanAngleSummary {
  return {
    maxLeanAngleDeg: 0,
    maxLeanLeftDeg: 0,
    maxLeanRightDeg: 0,
  }
}

export function updateLeanAngleSummary(
  summary: LeanAngleSummary,
  correctedAngleDeg: number,
): LeanAngleSummary {
  const absAngle = Math.abs(correctedAngleDeg)
  return {
    maxLeanAngleDeg: Math.max(summary.maxLeanAngleDeg, absAngle),
    maxLeanLeftDeg: correctedAngleDeg < 0 ? Math.max(summary.maxLeanLeftDeg, absAngle) : summary.maxLeanLeftDeg,
    maxLeanRightDeg: correctedAngleDeg > 0 ? Math.max(summary.maxLeanRightDeg, absAngle) : summary.maxLeanRightDeg,
  }
}

export function calculateRawLeanAngleDeg(ay: number, az: number): number {
  return Math.atan2(ay, az) * (180 / Math.PI)
}

export function applyLeanCalibration(rawAngleDeg: number, offsetDeg: number): number {
  return normalizeAngle(rawAngleDeg - offsetDeg)
}

export function getLeanAngleTone(correctedAngleDeg: number): 'default' | 'warning' | 'danger' {
  const absAngle = Math.abs(correctedAngleDeg)
  if (absAngle >= 35) {
    return 'danger'
  }
  if (absAngle >= 20) {
    return 'warning'
  }
  return 'default'
}

async function collectAccelerometerSamples(durationMs: number): Promise<AccelerometerMeasurement[]> {
  return new Promise((resolve, reject) => {
    const measurements: AccelerometerMeasurement[] = []
    let subscription: { remove: () => void } | null = null

    try {
      Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS)
      subscription = Accelerometer.addListener((measurement) => {
        measurements.push(measurement)
      })
    } catch (error) {
      reject(error)
      return
    }

    setTimeout(() => {
      subscription?.remove()
      if (measurements.length === 0) {
        reject(new Error('Nessun campione accelerometro raccolto'))
        return
      }
      resolve(measurements)
    }, durationMs)
  })
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function normalizeAngle(value: number): number {
  if (value > 180) {
    return value - 360
  }
  if (value < -180) {
    return value + 360
  }
  return value
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
