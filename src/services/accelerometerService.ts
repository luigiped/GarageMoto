import { Accelerometer, type AccelerometerMeasurement } from 'expo-sensors'

const SAMPLE_INTERVAL_MS = 10
const CALIBRATION_MS = 1200
const TRIGGER_ACCELERATION_G = 0.3
const IDLE_FINISH_G = 0.05
const IDLE_FINISH_MS = 500
const MAX_TEST_MS = 30_000
const CHART_SAMPLE_MS = 200
const STANDARD_GRAVITY = 9.80665

export type ZeroToHundredStatus = 'arming' | 'waiting_trigger' | 'running' | 'finished' | 'cancelled'
export type ZeroToHundredFinishReason = 'target' | 'idle' | 'timeout' | 'cancelled'

export type ZeroToHundredSample = {
  elapsedMs: number
  speedKmh: number
}

export type ZeroToHundredUpdate = {
  status: ZeroToHundredStatus
  estimatedSpeedKmh: number
  maxAccelerationG: number
  elapsedMs: number
  samples: ZeroToHundredSample[]
}

export type ZeroToHundredResult = ZeroToHundredUpdate & {
  reachedTarget: boolean
  timeToHundredSec: number | null
  finishReason: ZeroToHundredFinishReason
}

type ZeroToHundredHandlers = {
  onUpdate: (update: ZeroToHundredUpdate) => void
  onComplete: (result: ZeroToHundredResult) => void
  onError: (error: Error) => void
}

let subscription: { remove: () => void } | null = null

export async function isAccelerationTestAvailable(): Promise<boolean> {
  try {
    const sensor = Accelerometer as typeof Accelerometer & {
      isAvailableAsync?: () => Promise<boolean>
    }

    if (typeof sensor.isAvailableAsync === 'function') {
      return await sensor.isAvailableAsync()
    }

    return true
  } catch (error) {
    console.error('[accelerometer] availability:', error)
    return false
  }
}

export function stopZeroToHundredTest(): void {
  subscription?.remove()
  subscription = null
}

export async function startZeroToHundredTest(handlers: ZeroToHundredHandlers): Promise<void> {
  stopZeroToHundredTest()

  const available = await isAccelerationTestAvailable()
  if (!available) {
    throw new Error('Accelerometro non disponibile in questa build')
  }

  handlers.onUpdate({
    status: 'arming',
    estimatedSpeedKmh: 0,
    maxAccelerationG: 0,
    elapsedMs: 0,
    samples: [],
  })

  const baseline = await collectCalibrationBaseline()
  let status: ZeroToHundredStatus = 'waiting_trigger'
  let startTs = 0
  let lastTs = 0
  let lastMotionTs = 0
  let chartSampleTs = 0
  let estimatedSpeedMs = 0
  let maxAccelerationG = 0
  const samples: ZeroToHundredSample[] = []

  const emitUpdate = (now: number) => {
    handlers.onUpdate({
      status,
      estimatedSpeedKmh: round1(estimatedSpeedMs * 3.6),
      maxAccelerationG: round2(maxAccelerationG),
      elapsedMs: status === 'running' || status === 'finished' ? Math.max(0, now - startTs) : 0,
      samples: [...samples],
    })
  }

  const finish = (now: number, finishReason: ZeroToHundredFinishReason) => {
    stopZeroToHundredTest()
    status = finishReason === 'cancelled' ? 'cancelled' : 'finished'
    const elapsedMs = startTs > 0 ? Math.max(0, now - startTs) : 0
    const speedKmh = round1(estimatedSpeedMs * 3.6)
    handlers.onComplete({
      status,
      estimatedSpeedKmh: speedKmh,
      maxAccelerationG: round2(maxAccelerationG),
      elapsedMs,
      samples: [...samples],
      reachedTarget: finishReason === 'target',
      timeToHundredSec: finishReason === 'target' ? round1(elapsedMs / 1000) : null,
      finishReason,
    })
  }

  try {
    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS)
    subscription = Accelerometer.addListener((measurement) => {
      const now = Date.now()
      const netAccelerationG = calculateNetAccelerationG(measurement, baseline)

      if (status === 'waiting_trigger') {
        if (netAccelerationG >= TRIGGER_ACCELERATION_G) {
          status = 'running'
          startTs = now
          lastTs = now
          lastMotionTs = now
          chartSampleTs = now
          samples.push({ elapsedMs: 0, speedKmh: 0 })
        }
        emitUpdate(now)
        return
      }

      if (status !== 'running') {
        return
      }

      const deltaSeconds = Math.max(0, (now - lastTs) / 1000)
      lastTs = now

      if (netAccelerationG >= IDLE_FINISH_G) {
        lastMotionTs = now
      }

      estimatedSpeedMs += netAccelerationG * STANDARD_GRAVITY * deltaSeconds
      maxAccelerationG = Math.max(maxAccelerationG, netAccelerationG)

      const elapsedMs = now - startTs
      const speedKmh = round1(estimatedSpeedMs * 3.6)

      if (now - chartSampleTs >= CHART_SAMPLE_MS) {
        samples.push({ elapsedMs, speedKmh })
        chartSampleTs = now
      }

      emitUpdate(now)

      if (speedKmh >= 100) {
        finish(now, 'target')
        return
      }

      if (elapsedMs >= MAX_TEST_MS) {
        finish(now, 'timeout')
        return
      }

      if (now - lastMotionTs >= IDLE_FINISH_MS && elapsedMs > 1500) {
        finish(now, 'idle')
      }
    })
  } catch (error) {
    stopZeroToHundredTest()
    handlers.onError(error instanceof Error ? error : new Error('Impossibile avviare il test accelerometro'))
  }
}

async function collectCalibrationBaseline(): Promise<AccelerometerMeasurement> {
  const samples = await collectAccelerometerSamples(CALIBRATION_MS)
  return {
    x: average(samples.map((sample) => sample.x)),
    y: average(samples.map((sample) => sample.y)),
    z: average(samples.map((sample) => sample.z)),
    timestamp: Date.now(),
  }
}

async function collectAccelerometerSamples(durationMs: number): Promise<AccelerometerMeasurement[]> {
  return new Promise((resolve, reject) => {
    const measurements: AccelerometerMeasurement[] = []
    let localSubscription: { remove: () => void } | null = null

    try {
      Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS)
      localSubscription = Accelerometer.addListener((measurement) => {
        measurements.push(measurement)
      })
    } catch (error) {
      reject(error)
      return
    }

    setTimeout(() => {
      localSubscription?.remove()
      if (measurements.length === 0) {
        reject(new Error('Nessun campione accelerometro raccolto'))
        return
      }
      resolve(measurements)
    }, durationMs)
  })
}

function calculateNetAccelerationG(
  measurement: AccelerometerMeasurement,
  baseline: AccelerometerMeasurement,
): number {
  const dx = measurement.x - baseline.x
  const dy = measurement.y - baseline.y
  const dz = measurement.z - baseline.z
  const magnitude = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2)
  return round3(Math.max(0, magnitude))
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}
