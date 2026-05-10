// R1.3 - amplia il report PDF con sezioni manutenzione e riepiloghi piu completi senza introdurre nuove dipendenze.
import type { Maintenance } from '../types/maintenance'
import type { Refuel } from '../types/refuel'
import type { Trip } from '../types/trip'
import type { Vehicle } from '../types/vehicle'
import { averageConsumption } from './fuelCalculator'
import { formatDate, formatEuro, formatKm, formatKmL, formatPricePerLiter } from './formatters'
import { MAINTENANCE_LABELS } from '../types/maintenance'
import { daysUntilDue, getStatus, kmUntilDue } from './maintenanceChecker'
import { buildPerformanceSummary } from './performanceBonus'

export interface ReportExportPayload {
  vehicle: Vehicle
  refuels: Refuel[]
  trips: Trip[]
  maintenance: Maintenance[]
}

export function buildReportHtml(payload: ReportExportPayload): string {
  const { vehicle, refuels, trips, maintenance } = payload
  const now = new Date()
  const currentKm = refuels[0]?.odometer_km ?? vehicle.odometer_start_km
  const averageKmL = averageConsumption(refuels)
  const totalSpent = refuels.reduce((sum, refuel) => sum + refuel.amount_eur, 0)
  const totalLiters = refuels.reduce((sum, refuel) => sum + refuel.liters, 0)
  const totalTripKm = trips.reduce((sum, trip) => sum + trip.distance_km, 0)
  const totalTripMinutes = trips.reduce((sum, trip) => sum + trip.duration_minutes, 0)
  const performance = buildPerformanceSummary(refuels, trips)
  const reportPeriod = buildReportPeriod(refuels, trips, maintenance)
  const urgentMaintenance = maintenance.filter((item) => getStatus(item, currentKm, now) !== 'ok')

  const latestRefuels = [...refuels].slice(0, 8)
  const latestTrips = [...trips].slice(0, 8)
  const latestMaintenance = [...maintenance].slice(0, 8)

  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <title>GarageMoto Report</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 24px;
        color: #111827;
      }
      h1, h2, h3 { margin: 0 0 12px; }
      p { margin: 0 0 8px; line-height: 1.45; }
      .muted { color: #6b7280; }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin: 16px 0 24px;
      }
      .card {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 12px 14px;
      }
      .value {
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
      }
      th, td {
        text-align: left;
        padding: 8px;
        border-bottom: 1px solid #e5e7eb;
        font-size: 12px;
      }
      ul { padding-left: 18px; }
      .badge {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: #fff7ed;
        color: #c04e0e;
        font-size: 12px;
        margin-bottom: 16px;
      }
      .cover {
        padding-bottom: 18px;
        border-bottom: 2px solid #e5e7eb;
        margin-bottom: 24px;
      }
      .section {
        margin-top: 24px;
      }
      .footer {
        margin-top: 32px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
        font-size: 11px;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <div class="cover">
      <h1>GarageMoto Report</h1>
      <p class="muted">Generato il ${escapeHtml(now.toLocaleString('it-IT'))}</p>
      <p class="badge">Release 1.3 - uso personale</p>
      <h2>${escapeHtml(vehicle.nickname ?? `${vehicle.brand} ${vehicle.model}`)}</h2>
      <p class="muted">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)} · ${vehicle.year} · ${vehicle.tank_capacity_l.toFixed(1)} L</p>
      <p class="muted">Periodo report: ${escapeHtml(reportPeriod)}</p>
    </div>

    <div class="section">
    <h2>Sezione 1 — Riepilogo</h2>
    <div class="grid">
      <div class="card">
        <div class="value">${escapeHtml(formatKm(currentKm))}</div>
        <p class="muted">Odometro attuale</p>
      </div>
      <div class="card">
        <div class="value">${escapeHtml(formatKmL(averageKmL))}</div>
        <p class="muted">Media consumi</p>
      </div>
      <div class="card">
        <div class="value">${escapeHtml(formatEuro(totalSpent))}</div>
        <p class="muted">Spesa totale registrata</p>
      </div>
      <div class="card">
        <div class="value">${escapeHtml(formatKm(totalTripKm))}</div>
        <p class="muted">Km viaggi registrati</p>
      </div>
    </div>
    </div>

    <div class="section">
    <h2>Sezione 2 — Performance bonus</h2>
    <p class="muted">Suggerimenti sperimentali a partire dai dati salvati nell'app.</p>
    <div class="grid">
      <div class="card">
        <div class="value">${performance.bestKmL != null ? escapeHtml(formatKmL(performance.bestKmL)) : '--'}</div>
        <p class="muted">Miglior consumo</p>
      </div>
      <div class="card">
        <div class="value">${performance.lowestPricePerLiter != null ? escapeHtml(formatPricePerLiter(performance.lowestPricePerLiter)) : '--'}</div>
        <p class="muted">Prezzo piu basso</p>
      </div>
      <div class="card">
        <div class="value">${performance.bestTripKm != null ? escapeHtml(formatKm(performance.bestTripKm)) : '--'}</div>
        <p class="muted">Viaggio piu lungo</p>
      </div>
      <div class="card">
        <div class="value">${totalLiters.toFixed(1)} L</div>
        <p class="muted">Litri complessivi registrati</p>
      </div>
    </div>
    <ul>
      ${performance.insights.length > 0
        ? performance.insights.map((insight) => `<li>${escapeHtml(insight)}</li>`).join('')
        : '<li>Nessun insight disponibile: servono piu dati.</li>'}
    </ul>
    </div>

    <div class="section">
    <h2>Sezione 3 — Rifornimenti</h2>
    ${latestRefuels.length > 0 ? renderRefuelsTable(latestRefuels) : '<p class="muted">Nessun rifornimento salvato.</p>'}
    </div>

    <div class="section">
    <h2>Sezione 4 — Viaggi</h2>
    <p class="muted">Totale viaggi: ${trips.length} · Durata complessiva: ${totalTripMinutes} min</p>
    ${latestTrips.length > 0 ? renderTripsTable(latestTrips) : '<p class="muted">Nessun viaggio salvato.</p>'}
    </div>

    <div class="section">
    <h2>Sezione 5 — Manutenzione</h2>
    <p class="muted">Interventi registrati: ${maintenance.length} · Scadenze da monitorare: ${urgentMaintenance.length}</p>
    ${latestMaintenance.length > 0 ? renderMaintenanceTable(latestMaintenance, currentKm, now) : '<p class="muted">Nessun intervento di manutenzione salvato.</p>'}
    </div>

    <div class="footer">Generato da GarageMoto · ${escapeHtml(now.toLocaleDateString('it-IT'))}</div>
  </body>
</html>`
}

export async function sharePdfReport(payload: ReportExportPayload): Promise<void> {
  const Print = await import('expo-print')
  const Sharing = await import('expo-sharing')
  const canShare = await Sharing.isAvailableAsync()
  if (!canShare) {
    throw new Error('Condivisione non disponibile su questo dispositivo')
  }

  const html = buildReportHtml(payload)
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  })

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Esporta report PDF',
    UTI: 'com.adobe.pdf',
  })
}

function renderRefuelsTable(refuels: Refuel[]): string {
  const rows = refuels
    .map((refuel) => `
      <tr>
        <td>${escapeHtml(formatDate(refuel.date))}</td>
        <td>${escapeHtml(formatKm(refuel.odometer_km))}</td>
        <td>${refuel.liters.toFixed(2)} L</td>
        <td>${escapeHtml(formatEuro(refuel.amount_eur))}</td>
        <td>${refuel.km_per_liter != null ? escapeHtml(formatKmL(refuel.km_per_liter)) : '--'}</td>
        <td>${escapeHtml(formatPricePerLiter(refuel.amount_eur / refuel.liters))}</td>
      </tr>`)
    .join('')

  return `<table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Odometro</th>
        <th>Litri</th>
        <th>Importo</th>
        <th>Consumo</th>
        <th>Prezzo/L</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

function renderTripsTable(trips: Trip[]): string {
  const rows = trips
    .map((trip) => `
      <tr>
        <td>${escapeHtml(formatDate(trip.start_time.slice(0, 10)))}</td>
        <td>${escapeHtml(formatKm(trip.distance_km))}</td>
        <td>${trip.duration_minutes} min</td>
        <td>${trip.avg_speed_kmh.toFixed(1)} km/h</td>
        <td>${trip.max_speed_kmh.toFixed(1)} km/h</td>
      </tr>`)
    .join('')

  return `<table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Distanza</th>
        <th>Durata</th>
        <th>Media</th>
        <th>Max</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

function renderMaintenanceTable(maintenance: Maintenance[], currentKm: number, today: Date): string {
  const rows = maintenance
    .map((item) => {
      const label = item.label ?? MAINTENANCE_LABELS[item.type]
      const status = getStatus(item, currentKm, today)
      const remainingKm = kmUntilDue(item, currentKm)
      const remainingDays = daysUntilDue(item, today)

      return `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td>${item.last_date ? escapeHtml(formatDate(item.last_date)) : '--'}</td>
        <td>${item.last_km != null ? escapeHtml(formatKm(item.last_km)) : '--'}</td>
        <td>${remainingKm != null ? `${remainingKm} km` : '--'}</td>
        <td>${remainingDays != null ? `${remainingDays} gg` : '--'}</td>
        <td>${escapeHtml(formatMaintenanceStatus(status))}</td>
      </tr>`
    })
    .join('')

  return `<table>
    <thead>
      <tr>
        <th>Intervento</th>
        <th>Ultima data</th>
        <th>Ultimo km</th>
        <th>Km residui</th>
        <th>Giorni residui</th>
        <th>Stato</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

function buildReportPeriod(refuels: Refuel[], trips: Trip[], maintenance: Maintenance[]): string {
  const dates = [
    ...refuels.map((item) => item.date),
    ...trips.map((item) => item.start_time.slice(0, 10)),
    ...maintenance.map((item) => item.last_date).filter((value): value is string => Boolean(value)),
  ].sort()

  if (dates.length === 0) {
    return 'Nessun dato registrato'
  }

  const from = formatDate(dates[0])
  const to = formatDate(dates[dates.length - 1])
  return from === to ? from : `${from} - ${to}`
}

function formatMaintenanceStatus(status: 'ok' | 'warning' | 'overdue'): string {
  if (status === 'overdue') {
    return 'Scaduta'
  }
  if (status === 'warning') {
    return 'In scadenza'
  }
  return 'OK'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
