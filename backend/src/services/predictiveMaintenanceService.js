const logger = require('../utils/logger');
const MaintenanceAlert = require('../models/MaintenanceAlert');
const Telemetry = require('../models/Telemetry');
const { getIO } = require('../sockets');

/**
 * Predictive maintenance.
 *
 * Analyzes temperature / battery / current / vibration trends to predict
 * failures BEFORE they happen, e.g.:
 *   "Bus #12 may require maintenance within the next 5 days."
 *
 * A per-bus sliding window of recent readings is kept in memory; a scheduled
 * job re-evaluates every bus against its stored telemetry history as a
 * safety net for restart scenarios.
 */
class PredictiveMaintenanceService {
  constructor() {
    this.windows = new Map(); // busId -> [reading, ...] (capped)
    this.MAX_SAMPLES = 120;
    this.MIN_SAMPLES_FOR_TREND = 8;
    this.lastAnalysisAt = new Map(); // busId -> timestamp (throttle)
    this.ANALYZE_THROTTLE_MS = 60 * 1000;
  }

  /**
   * Record a reading into the bus's sliding window and run a throttled check.
   */
  async recordReading(bus, reading) {
    try {
      const busKey = bus._id.toString();
      const window = this.windows.get(busKey) || [];

      window.push({
        ts: (reading.timestamp || new Date()).getTime(),
        engineTemperature: reading.engineTemperature ?? null,
        batteryVoltage: reading.batteryVoltage ?? null,
        currentDraw: reading.currentDraw ?? null,
        vibration: reading.vibration ?? 0,
      });

      if (window.length > this.MAX_SAMPLES) window.shift();
      this.windows.set(busKey, window);

      const last = this.lastAnalysisAt.get(busKey) || 0;
      if (Date.now() - last >= this.ANALYZE_THROTTLE_MS) {
        this.lastAnalysisAt.set(busKey, Date.now());
        await this.analyzeBus(bus, window);
      }
    } catch (error) {
      logger.error(`Predictive maintenance record error for bus ${bus._id}:`, error.message);
    }
  }

  /**
   * Analyze a bus window and raise maintenance alerts.
   */
  async analyzeBus(bus, window = null) {
    try {
      if (!window) window = this.windows.get(bus._id.toString()) || [];
      if (window.length < this.MIN_SAMPLES_FOR_TREND) return [];

      const alerts = [];

      // ── Engine temperature trend ─────────────────────────────────
      const tempReadings = window.filter((r) => r.engineTemperature != null);
      if (tempReadings.length >= this.MIN_SAMPLES_FOR_TREND) {
        const { slope, latest, baseline } = this.linearRegression(tempReadings, 'engineTemperature');
        const slopePerHour = slope * 60; // slope is per-minute
        const overheating = latest >= 97 || (slopePerHour >= 2 && latest >= 95);

        if (overheating) {
          const predictedDays = slopePerHour > 0.5
            ? Math.max(1, Math.ceil((110 - latest) / slopePerHour))
            : 5;
          alerts.push({
            alertType: 'overheating',
            severity: latest >= 105 ? 'critical' : 'warning',
            message: `Bus ${bus.number} may require cooling system maintenance within the next ${predictedDays} day(s). Engine temperature trending ${latest.toFixed(1)}°C${slopePerHour >= 1 ? ` (+${slopePerHour.toFixed(1)}°C/hr)` : ''}.`,
            predictedDaysUntilFailure: predictedDays,
            evidence: { latestReading: latest, baselineReading: baseline, trendSlope: slopePerHour, samples: tempReadings.length },
          });
        }
      }

      // ── Battery voltage trend ────────────────────────────────────
      const voltReadings = window.filter((r) => r.batteryVoltage != null);
      if (voltReadings.length >= this.MIN_SAMPLES_FOR_TREND) {
        const { slope, latest, baseline } = this.linearRegression(voltReadings, 'batteryVoltage');
        const slopePerHour = slope * 60;

        if (latest <= 11.8 || (slopePerHour <= -0.5 && latest <= 12.4)) {
          const predictedDays = slopePerHour < 0
            ? Math.max(1, Math.ceil((latest - 11.0) / Math.abs(slopePerHour)))
            : 7;
          alerts.push({
            alertType: 'battery',
            severity: latest <= 11.4 ? 'critical' : 'warning',
            message: `Bus ${numberPlaceholder(bus)} battery may require replacement within the next ${predictedDays} day(s). Voltage ${latest.toFixed(1)}V${slopePerHour <= -0.5 ? ` declining (${slopePerHour.toFixed(2)}V/hr)` : ''}.`,
            predictedDaysUntilFailure: predictedDays,
            evidence: { latestReading: latest, baselineReading: baseline, trendSlope: slopePerHour, samples: voltReadings.length },
          });
        }
      }

      // ── Electrical load ──────────────────────────────────────────
      const currentReadings = window.filter((r) => r.currentDraw != null);
      if (currentReadings.length >= this.MIN_SAMPLES_FOR_TREND) {
        const avg = currentReadings.reduce((s, r) => s + r.currentDraw, 0) / currentReadings.length;
        if (avg >= 70) {
          alerts.push({
            alertType: 'electrical',
            severity: avg >= 90 ? 'critical' : 'warning',
            message: `Bus ${numberPlaceholder(bus)} shows sustained high electrical load (${avg.toFixed(0)}A avg). Wiring/alternator check advised within 3 days.`,
            predictedDaysUntilFailure: 3,
            evidence: { latestReading: currentReadings[currentReadings.length - 1].currentDraw, baselineReading: avg, trendSlope: 0, samples: currentReadings.length },
          });
        }
      }

      // ── Vibration ────────────────────────────────────────────────
      const vibReadings = window.filter((r) => r.vibration != null);
      if (vibReadings.length >= this.MIN_SAMPLES_FOR_TREND) {
        const avg = vibReadings.reduce((s, r) => s + r.vibration, 0) / vibReadings.length;
        if (avg >= 3.0) {
          alerts.push({
            alertType: 'vibration',
            severity: avg >= 4.5 ? 'critical' : 'warning',
            message: `Bus ${numberPlaceholder(bus)} shows persistent vibration (${avg.toFixed(1)} m/s² avg). Suspension/mounting inspection advised within 4 days.`,
            predictedDaysUntilFailure: 4,
            evidence: { latestReading: vibReadings[vibReadings.length - 1].vibration, baselineReading: avg, trendSlope: 0, samples: vibReadings.length },
          });
        }
      }

      // Persist new alerts (skip if an open alert of same type exists)
      for (const alert of alerts) {
        const existing = await MaintenanceAlert.findOne({
          busId: bus._id,
          alertType: alert.alertType,
          status: { $in: ['open', 'scheduled'] },
        });
        if (existing) continue;

        const doc = await MaintenanceAlert.create({
          busId: bus._id,
          busNumber: bus.number,
          ...alert,
          detectedAt: new Date(),
        });

        const io = getIO();
        if (io) {
          io.emit('maintenanceAlertCreated', {
            alertId: doc._id,
            busId: bus._id,
            busNumber: bus.number,
            alertType: doc.alertType,
            severity: doc.severity,
            message: doc.message,
            predictedDaysUntilFailure: doc.predictedDaysUntilFailure,
            timestamp: doc.detectedAt,
          });
        }

        logger.warn(`[Maintenance] ${doc.alertType.toUpperCase()} predicted for bus ${bus.number}: ${doc.message}`);
      }

      return alerts;
    } catch (error) {
      logger.error(`Predictive maintenance analysis error for bus ${bus._id}:`, error.message);
      return [];
    }
  }

  /**
   * Run trend analysis for every bus from stored telemetry history.
   * Used by the scheduled job as a safety net.
   */
  async analyzeAllBuses() {
    try {
      const Bus = require('../models/Bus');
      const buses = await Bus.find({
        isActive: true,
        'health.updatedAt': { $exists: true },
      });

      for (const bus of buses) {
        const recent = await Telemetry.find({ busId: bus._id })
          .sort({ timestamp: -1 })
          .limit(this.MAX_SAMPLES)
          .lean();

        if (recent.length >= this.MIN_SAMPLES_FOR_TREND) {
          const window = recent
            .map((r) => ({
              ts: new Date(r.timestamp).getTime(),
              engineTemperature: r.engineTemperature,
              batteryVoltage: r.batteryVoltage,
              currentDraw: r.currentDraw,
              vibration: r.vibration || 0,
            }))
            .reverse();
          this.windows.set(bus._id.toString(), window);
          await this.analyzeBus(bus, window);
        }
      }

      logger.info('Predictive maintenance: analyzed all buses');
    } catch (error) {
      logger.error('Predictive maintenance analysis (all buses) error:', error.message);
    }
  }

  /**
   * Least-squares linear regression over a series of readings.
   * Slope is expressed per minute (x = minutes since first sample).
   */
  linearRegression(readings, field) {
    const n = readings.length;
    const t0 = readings[0].ts;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (const r of readings) {
      const x = (r.ts - t0) / 60000; // minutes
      const y = r[field] ?? 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const latest = readings[n - 1][field];
    const baseline = readings[0][field];

    return { slope, latest, baseline };
  }
}

// Keeps the alert messages readable when the bus object shape varies
function numberPlaceholder(bus) {
  return bus.number || 'the bus';
}

module.exports = new PredictiveMaintenanceService();
