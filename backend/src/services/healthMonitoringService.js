const logger = require('../utils/logger');
const Notification = require('../models/Notification');
const { getIO } = require('../sockets');

/**
 * Health thresholds for the in-bus sensor suite.
 *
 *  - Engine temperature (DS18B20): normal 75–95 °C
 *  - Battery voltage: nominal ~13.8 V while charging, ~12.6 V rested
 *  - Current draw (ACS712): typical load 10–40 A
 *  - Vibration (MPU6050 RMS): normal < 1.5 m/s²
 */
const HEALTH_THRESHOLDS = {
  engineTemperature: { warn: 100, critical: 110 },
  batteryVoltage: { warnLow: 12.0, criticalLow: 11.2, warnHigh: 15.0, criticalHigh: 15.8 },
  currentDraw: { warnHigh: 60, criticalHigh: 90 },
  vibration: { warn: 2.5, critical: 4.0 },
};

const SEVERITY_RANK = { healthy: 0, unknown: 0, warning: 1, critical: 2 };

class HealthMonitoringService {
  constructor() {
    // deviceId -> { status, at } of the last raised notification
    this.lastNotified = new Map();
    this.CRITICAL_REPEAT_MS = 30 * 60 * 1000; // re-alert persistent critical every 30 min
  }

  /**
   * Evaluate a telemetry reading against the health thresholds and return
   * the derived health status plus any issues.
   */
  evaluate(reading) {
    const issues = [];

    const temp = reading.engineTemperature;
    if (temp != null) {
      if (temp >= HEALTH_THRESHOLDS.engineTemperature.critical) {
        issues.push({ sensor: 'engineTemperature', severity: 'critical', message: `Engine temperature critical at ${temp.toFixed(1)}°C` });
      } else if (temp >= HEALTH_THRESHOLDS.engineTemperature.warn) {
        issues.push({ sensor: 'engineTemperature', severity: 'warning', message: `Engine running hot at ${temp.toFixed(1)}°C` });
      }
    }

    const voltage = reading.batteryVoltage;
    if (voltage != null) {
      if (voltage <= HEALTH_THRESHOLDS.batteryVoltage.criticalLow || voltage >= HEALTH_THRESHOLDS.batteryVoltage.criticalHigh) {
        issues.push({ sensor: 'batteryVoltage', severity: 'critical', message: `Battery voltage ${voltage.toFixed(1)}V outside safe range` });
      } else if (voltage <= HEALTH_THRESHOLDS.batteryVoltage.warnLow || voltage >= HEALTH_THRESHOLDS.batteryVoltage.warnHigh) {
        issues.push({ sensor: 'batteryVoltage', severity: 'warning', message: `Battery voltage ${voltage.toFixed(1)}V is weakening` });
      }
    }

    const current = reading.currentDraw;
    if (current != null) {
      if (current >= HEALTH_THRESHOLDS.currentDraw.criticalHigh) {
        issues.push({ sensor: 'currentDraw', severity: 'critical', message: `Electrical load critically high at ${current.toFixed(0)}A` });
      } else if (current >= HEALTH_THRESHOLDS.currentDraw.warnHigh) {
        issues.push({ sensor: 'currentDraw', severity: 'warning', message: `High electrical load at ${current.toFixed(0)}A` });
      }
    }

    const vibration = reading.vibration || 0;
    if (vibration >= HEALTH_THRESHOLDS.vibration.critical) {
      issues.push({ sensor: 'vibration', severity: 'critical', message: `Excessive vibration at ${vibration.toFixed(1)} m/s²` });
    } else if (vibration >= HEALTH_THRESHOLDS.vibration.warn) {
      issues.push({ sensor: 'vibration', severity: 'warning', message: `Elevated vibration at ${vibration.toFixed(1)} m/s²` });
    }

    const hasCritical = issues.some((i) => i.severity === 'critical');
    const hasWarning = issues.some((i) => i.severity === 'warning');
    const status = hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy';

    return { status, issues };
  }

  /**
   * Apply a reading to a bus: persist the health snapshot on the Bus doc
   * and raise notifications + socket events on status transitions.
   *
   * Notifications use hysteresis: they fire on escalation (healthy→warning,
   * warning→critical), on recovery from critical, and as a slow re-alert for
   * persistent critical status — but NOT on healthy↔warning churn, which
   * would spam ops teams when a reading sits near a threshold.
   */
  async applyToBus(bus, reading) {
    const { status, issues } = this.evaluate(reading);
    const deviceKey = bus.deviceId || bus._id.toString();

    const previous = bus.health?.status || 'unknown';
    const transitioned = previous !== status;
    const worsening = SEVERITY_RANK[status] > SEVERITY_RANK[previous];
    const recoveringFromCritical = previous === 'critical' && status !== 'critical';

    const last = this.lastNotified.get(deviceKey);
    const criticalRepeat = status === 'critical'
      && (!last || last.status !== 'critical' || Date.now() - last.at > this.CRITICAL_REPEAT_MS);

    // Persist snapshot
    await bus.updateOne({
      $set: {
        'health.status': status,
        'health.engineTemperature': reading.engineTemperature ?? null,
        'health.batteryVoltage': reading.batteryVoltage ?? null,
        'health.currentDraw': reading.currentDraw ?? null,
        'health.vibration': reading.vibration || 0,
        'health.lastEvent': issues[0]?.message ?? null,
        'health.updatedAt': reading.timestamp || new Date(),
      },
    });

    // Raise notifications on escalation, critical recovery, or critical repeats
    if ((transitioned && (worsening || recoveringFromCritical)) || criticalRepeat) {
      await this.notifyHealthIssue(bus, status, issues);
      this.lastNotified.set(deviceKey, { status, at: Date.now() });
    }

    if (transitioned) {
      const io = getIO();
      if (io) {
        io.emit('busHealthChanged', {
          busId: bus._id,
          busNumber: bus.number,
          status,
          issues,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { status, issues, transitioned };
  }

  async notifyHealthIssue(bus, status, issues) {
    try {
      const critical = issues.filter((i) => i.severity === 'critical');
      const warning = issues.filter((i) => i.severity === 'warning');
      const sensorNames = {
        engineTemperature: 'Engine temperature',
        batteryVoltage: 'Battery',
        currentDraw: 'Electrical load',
        vibration: 'Vibration',
      };

      const summary = (list) => list.map((i) => `${sensorNames[i.sensor] || i.sensor}: ${i.message}`).join('; ');

      await Notification.create({
        type: 'health',
        title: status === 'critical' ? `⚠️ Bus ${bus.number} needs immediate attention` : `Bus ${bus.number} health warning`,
        message: status === 'critical'
          ? `Critical health issue detected on bus ${bus.number}. ${summary(critical) || summary(warning)}`
          : `Health warning on bus ${bus.number}: ${summary(warning)}`,
        severity: status === 'critical' ? 'critical' : 'warning',
        busId: bus._id,
        routeId: bus.routeId || undefined,
        driverId: bus.driverId || undefined,
        data: { healthStatus: status, issues },
        audience: ['admins', 'depot_managers'],
      });
    } catch (error) {
      logger.error('Error creating health notification:', error.message);
    }
  }

  static get THRESHOLDS() {
    return HEALTH_THRESHOLDS;
  }
}

module.exports = new HealthMonitoringService();
