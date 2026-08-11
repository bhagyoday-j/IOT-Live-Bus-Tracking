#!/usr/bin/env node
/**
 * SmartTransit Device Simulator
 *
 * Emulates the in-bus IoT device over MQTT so the whole backend pipeline can
 * be tested WITHOUT hardware. Produces the exact payloads the ESP32 firmware
 * sends (see ../../protocol/mqtt-protocol.md).
 *
 * Requirements: EMQX + backend running (`cd backend && docker compose up -d`),
 * and a Bus registered with the deviceId you pass.
 *
 * Usage:
 *   npm install
 *   node device-simulator.js BUS_MH001
 *   node device-simulator.js BUS_MH001 --sos        # trigger one SOS alert
 *   node device-simulator.js BUS_MH001 --impact     # trigger one accident-level impact
 *   node device-simulator.js BUS_MH001 --quiet      # less console noise
 *
 * The bus drives a loop around South Mumbai at ~30 km/h, publishing:
 *   bus/location/{id}    every 5 s
 *   bus/telemetry/{id}   every 10 s
 *   bus/status/{id}      on connect + every 60 s
 * It also answers backend commands (ping, sos_reset, set_interval, reboot).
 */

const mqtt = require('mqtt');

// ── Config (match backend/docker-compose.yml / .env) ─────────────────
const BROKER = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const USER = process.env.MQTT_USERNAME || 'smarttransit';
const PASS = process.env.MQTT_PASSWORD || 'smarttransit_secret';
const PREFIX = 'bus';

const DEVICE_ID = process.argv[2] || 'BUS_MH001';
const FLAGS = new Set(process.argv.slice(3));
const QUIET = FLAGS.has('--quiet');

const LOCATION_MS = 5000;
const TELEMETRY_MS = 10000;
const STATUS_MS = 60000;

// ── Route: loop around South Mumbai (lat, lng) ───────────────────────
const WAYPOINTS = [
  [19.076090, 72.877426], // Chhatrapati Shivaji Terminus
  [19.075200, 72.878500],
  [19.074100, 72.880300],
  [19.073200, 72.882100],
  [19.072900, 72.884200],
  [19.073800, 72.885800],
  [19.075400, 72.886500],
  [19.077100, 72.886100],
  [19.078100, 72.884300],
  [19.077900, 72.882100],
  [19.077200, 72.880000],
  [19.076800, 72.878400],
];
const LOOP_MS = WAYPOINTS.length * LOCATION_MS; // one full loop

// ── Device state ─────────────────────────────────────────────────────
const state = {
  sos: false,
  engineTemp: 86,
  batteryVoltage: 25.4,
  currentDraw: 9,
  vibration: 0.3,
  impactPending: FLAGS.has('--impact'),
  sosPending: FLAGS.has('--sos'),
  locationMs: LOCATION_MS,
  uptime: 0,
  sent: 0,
};

function log(...args) {
  if (!QUIET) console.log(...args);
}

// ── Helpers ──────────────────────────────────────────────────────────
function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Position along the waypoint loop at a given elapsed time. */
function positionAt(elapsedMs) {
  const t = (elapsedMs % LOOP_MS) / LOOP_MS;
  const idx = Math.floor(t * WAYPOINTS.length);
  const frac = t * WAYPOINTS.length - idx;
  const a = WAYPOINTS[idx % WAYPOINTS.length];
  const b = WAYPOINTS[(idx + 1) % WAYPOINTS.length];
  return {
    lat: round(a[0] + (b[0] - a[0]) * frac, 6),
    lng: round(a[1] + (b[1] - a[1]) * frac, 6),
    heading: round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI, 1),
    speed: round(30 + Math.sin(t * Math.PI * 4) * 5, 1), // 25–35 km/h
  };
}

// ── Connect ──────────────────────────────────────────────────────────
const client = mqtt.connect(BROKER, {
  username: USER,
  password: PASS,
  clientId: `sim-${DEVICE_ID}-${Math.floor(Math.random() * 1e6)}`,
  reconnectPeriod: 5000,
  clean: true,
});

const startedAt = Date.now();

client.on('connect', () => {
  log(`[${DEVICE_ID}] connected to ${BROKER} as ${USER}`);
  const cmdTopic = `${PREFIX}/command/${DEVICE_ID}`;
  client.subscribe(cmdTopic, { qos: 1 }, (err) => {
    if (err) console.error('subscribe failed:', err.message);
    else log(`[${DEVICE_ID}] subscribed to ${cmdTopic}`);
  });
  publishStatus('online');
});

client.on('message', (topic, payload) => {
  let msg;
  try { msg = JSON.parse(payload.toString()); } catch { return; }
  const command = msg.command;
  log(`[${DEVICE_ID}] 📩 command: ${command}`, msg);
  switch (command) {
    case 'ping':
      publishStatus('online');
      break;
    case 'sos_reset':
      state.sos = false;
      publishStatus('online');
      break;
    case 'set_interval':
      if (Number.isFinite(msg.intervalMs) && msg.intervalMs >= 2000 && msg.intervalMs <= 60000) {
        state.locationMs = msg.intervalMs;
        log(`[${DEVICE_ID}] location interval -> ${msg.intervalMs} ms`);
      }
      break;
    case 'reboot':
      log(`[${DEVICE_ID}] 🔄 rebooting (reconnect)`);
      client.end(true, () => process.exit(0));
      break;
    default:
      log(`[${DEVICE_ID}] unknown command: ${command}`);
  }
});

client.on('error', (err) => console.error('MQTT error:', err.message));

// ── Publishers ───────────────────────────────────────────────────────
function publishLocation() {
  const pos = positionAt(Date.now() - startedAt);
  const payload = {
    deviceId: DEVICE_ID,
    lat: pos.lat,
    lng: pos.lng,
    speed: pos.speed,
    heading: pos.heading,
    altitude: round(8 + Math.sin((Date.now() - startedAt) / 5000) * 2, 1),
    satellites: 9,
    hdop: 1.1,
    sos: state.sos,
    signal: 14,
    batteryLevel: round(((state.batteryVoltage - 22) / 5.6) * 100),
    firmware: '2.0.0',
    timestamp: Date.now(),
  };
  client.publish(`${PREFIX}/location/${DEVICE_ID}`, JSON.stringify(payload), { qos: 1 });
  state.sent++;
  log(`📍 ${payload.lat}, ${payload.lng} | ${payload.speed} km/h | sos=${state.sos}`);
}

function publishTelemetry() {
  const pos = positionAt(Date.now() - startedAt);

  // Simulate sensor drift
  state.engineTemp = clamp(state.engineTemp + (Math.random() - 0.5) * 1.2, 82, 95);
  state.batteryVoltage = clamp(state.batteryVoltage + (Math.random() - 0.5) * 0.15, 24.4, 26.4);
  state.currentDraw = clamp(state.currentDraw + (Math.random() - 0.5) * 2, 4, 18);

  // Acceleration: gravity on z + jitter + occasional vibration spike
  let ax = round((Math.random() - 0.5) * 0.6, 2);
  let ay = round((Math.random() - 0.5) * 0.6, 2);
  let az = round(9.8 + (Math.random() - 0.5) * 0.8, 2);
  let vibration = state.vibration;

  if (Math.random() < 0.04) { // rough road patch
    ax += (Math.random() - 0.5) * 3;
    ay += (Math.random() - 0.5) * 3;
    vibration = round(2.8 + Math.random() * 1.2, 2);
  } else {
    state.vibration = round(0.2 + Math.random() * 0.4, 2);
  }

  let type = '';
  if (state.impactPending) {   // one accident-level impact
    state.impactPending = false;
    ax = round(25 + Math.random() * 8, 2);
    ay = round(8 + Math.random() * 6, 2);
    az = round(18 + Math.random() * 6, 2);
    vibration = round(30, 2);
    type = '🚨 IMPACT';
  }

  const payload = {
    deviceId: DEVICE_ID,
    engineTemperature: round(state.engineTemp, 1),
    batteryVoltage: round(state.batteryVoltage, 2),
    currentDraw: round(state.currentDraw, 2),
    accelerometer: { x: ax, y: ay, z: az },
    gyroscope: {
      x: round((Math.random() - 0.5) * 2, 2),
      y: round((Math.random() - 0.5) * 2, 2),
      z: round((Math.random() - 0.5) * 5, 2),
    },
    vibration,
    speed: pos.speed,
    lat: pos.lat,
    lng: pos.lng,
    timestamp: Date.now(),
  };
  client.publish(`${PREFIX}/telemetry/${DEVICE_ID}`, JSON.stringify(payload), { qos: 1 });
  log(`🌡 ${payload.engineTemperature} °C | ${payload.batteryVoltage} V | ${payload.currentDraw} A | vib ${vibration} ${type}`);
}

function publishStatus(status) {
  const payload = {
    deviceId: DEVICE_ID,
    status,
    gpsFix: true,
    satellites: 9,
    signal: 14,
    sos: state.sos,
    queue: 0,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    sent: state.sent,
    failed: 0,
    firmware: '2.0.0',
    timestamp: Date.now(),
  };
  client.publish(`${PREFIX}/status/${DEVICE_ID}`, JSON.stringify(payload), { qos: 1 });
  log(`🟢 status: ${status}`);
}

function triggerSOS() {
  state.sos = true;
  const alert = {
    deviceId: DEVICE_ID,
    type: 'sos',
    lat: positionAt(Date.now() - startedAt).lat,
    lng: positionAt(Date.now() - startedAt).lng,
    speed: positionAt(Date.now() - startedAt).speed,
    heading: positionAt(Date.now() - startedAt).heading,
    message: 'Emergency SOS triggered by driver (simulator)',
    timestamp: Date.now(),
  };
  client.publish(`${PREFIX}/alert/${DEVICE_ID}`, JSON.stringify(alert), { qos: 2 });
  publishStatus('sos_active');
  log('🚨 SOS alert published');
}

// ── Timers ───────────────────────────────────────────────────────────
// Recursive timers so the remote "set_interval" command takes effect.
(function loopLocation() {
  publishLocation();
  setTimeout(loopLocation, state.locationMs);
})();
setInterval(publishTelemetry, TELEMETRY_MS);
setInterval(() => publishStatus('online'), STATUS_MS);
if (state.sosPending) setTimeout(triggerSOS, 2000);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

console.log(`SmartTransit simulator started — device ${DEVICE_ID}`);
console.log(`Publishing to ${BROKER} as ${USER} (prefix '${PREFIX}'). Ctrl+C to stop.`);
