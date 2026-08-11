const cron = require('node-cron');
const Bus = require('../models/Bus');
const telemetryService = require('../services/telemetryService');
const predictiveMaintenanceService = require('../services/predictiveMaintenanceService');
const logger = require('../utils/logger');

const SIM_INTERVAL_MS = 20000;

let simTimer = null;
let tick = 0;
let troubleBusId = null;
let troubleTemp = 86;
const speedState = new Map(); // busId -> simulated speed (km/h)

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate a realistic telemetry reading for a bus.
 *
 * One bus in the fleet is designated the "trouble bus": its engine
 * temperature climbs steadily so the health monitoring + predictive
 * maintenance pipelines produce live alerts during a demo.
 */
function buildReading(bus) {
  const isTrouble = troubleBusId && bus._id.toString() === troubleBusId;
  const busKey = bus._id.toString();
  const prevSpeed = speedState.get(busKey) ?? (bus.currentLocation?.speed ?? 30);

  // ── Simulated speed (random walk + occasional aggressive deltas) ─
  const harshEvent = Math.random() < 0.03;
  const surgeEvent = Math.random() < 0.02 && prevSpeed > 15;

  let speed = prevSpeed + randomBetween(-6, 6);
  if (harshEvent) speed -= randomBetween(18, 28);     // hard brake
  if (surgeEvent) speed += randomBetween(12, 20);     // sudden acceleration
  speed = Math.round(clamp(speed, 6, 68));
  speedState.set(busKey, speed);

  // Engine temperature (°C)
  let temperature;
  if (isTrouble) {
    troubleTemp = Math.min(108, troubleTemp + 0.35);
    temperature = troubleTemp + randomBetween(-0.5, 0.5);
  } else {
    temperature = randomBetween(82, 94);
  }

  // Battery / electrical — trouble bus sits stably in the warning band
  const voltage = isTrouble
    ? randomBetween(11.6, 11.9)
    : randomBetween(13.4, 14.2);
  const current = randomBetween(14, 34);

  // IMU (m/s²) + vibration (high-pass RMS)
  const turnEvent = Math.random() < 0.02 && speed > 25;
  const shakeEvent = Math.random() < 0.03;

  const ax = turnEvent ? (Math.random() < 0.5 ? -1 : 1) * randomBetween(3.2, 4.8) : randomBetween(-0.4, 0.4);
  const ay = randomBetween(-0.3, 0.3);
  const az = harshEvent ? randomBetween(-6.5, -4.5) : randomBetween(9.2, 9.9);
  const gz = turnEvent ? (Math.random() < 0.5 ? -1 : 1) * randomBetween(50, 75) : randomBetween(-8, 8);

  const vibration = shakeEvent
    ? randomBetween(2.8, 4.2)
    : harshEvent
      ? randomBetween(2.0, 3.0)
      : randomBetween(0.3, 0.9);

  return {
    engineTemperature: Math.round(temperature * 10) / 10,
    batteryVoltage: Math.round(voltage * 100) / 100,
    currentDraw: Math.round(current * 10) / 10,
    accelerometer: {
      x: Math.round(ax * 100) / 100,
      y: Math.round(ay * 100) / 100,
      z: Math.round(az * 100) / 100,
    },
    gyroscope: {
      x: 0,
      y: 0,
      z: Math.round(gz * 100) / 100,
    },
    vibration: Math.round(vibration * 100) / 100,
    speed,
    lat: bus.currentLocation?.lat,
    lng: bus.currentLocation?.lng,
  };
}

/**
 * Simulate one telemetry tick for every active bus.
 */
async function simulateTick() {
  try {
    tick += 1;

    const buses = await Bus.find({
      status: { $in: ['on-route', 'delayed'] },
      isActive: true,
      deviceId: { $ne: null },
    });

    if (buses.length === 0) return;

    // Pick a trouble bus once
    if (!troubleBusId) {
      troubleBusId = buses[0]._id.toString();
      logger.info(`[SIM] Designated ${buses[0].number} as telemetry trouble bus`);
    }

    for (const bus of buses) {
      try {
        const reading = buildReading(bus);
        await telemetryService.processTelemetry(bus.deviceId, reading);
      } catch (err) {
        logger.debug(`[SIM] Bus ${bus.number} tick error: ${err.message}`);
      }
    }

    if (tick % 3 === 0) {
      logger.info(`[SIM] Telemetry tick ${tick} – ${buses.length} bus(es) simulated`);
    }
  } catch (error) {
    logger.error('[SIM] Telemetry simulation error:', error.message);
  }
}

/**
 * Start telemetry simulation + predictive maintenance jobs.
 */
function startTelemetryJobs() {
  logger.info('Starting telemetry simulation + predictive maintenance jobs...');

  // ── Telemetry simulator: every 20 seconds ───────────────────────
  if (simTimer) clearInterval(simTimer);
  simTimer = setInterval(simulateTick, SIM_INTERVAL_MS);
  simulateTick().catch(() => {});

  // ── Predictive maintenance analysis: every 5 minutes ────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      await predictiveMaintenanceService.analyzeAllBuses();
    } catch (error) {
      logger.error('Predictive maintenance cron error:', error.message);
    }
  });

  logger.info('Telemetry simulation + predictive maintenance jobs started');
}

function stopTelemetryJobs() {
  if (simTimer) {
    clearInterval(simTimer);
    simTimer = null;
  }
}

module.exports = { startTelemetryJobs, stopTelemetryJobs, simulateTick };
