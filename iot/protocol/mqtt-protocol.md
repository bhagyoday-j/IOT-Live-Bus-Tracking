# MQTT Protocol — SmartTransit IoT ↔ Backend

The wire contract between the in-bus device and the SmartTransit backend.
This is implemented by `backend/src/config/mqtt.js`, consumed by
`backend/src/mqtt/consumer.js`, and produced by `iot/code/smarttransit_esp32/`
(firmware) and `iot/code/simulator/` (simulator).

---

## 1. Broker connection

| Setting        | Value (default)                     |
| -------------- | ----------------------------------- |
| Broker         | EMQX 5.x (`docker-compose.yml`)     |
| URL            | `mqtt://<host>:1883`                |
| Username       | `smarttransit`                      |
| Password       | `smarttransit_secret`               |
| QoS            | location/status/telemetry = 1, alert = 2 |
| Keepalive      | 60 s                               |

> EMQX credentials are created by the `emqx-setup` service in
> `backend/docker-compose.yml`. Change them in both places (backend `.env` +
> firmware `config.h`) — never ship default credentials.

---

## 2. Topic map

All topics use the configurable prefix `bus` (`MQTT_TOPIC_PREFIX`).

| Topic pattern              | Direction    | Payload | Purpose |
| -------------------------- | ------------ | ------- | ------- |
| `bus/location/{deviceId}`  | device → broker | location | GPS fix, every 5 s |
| `bus/status/{deviceId}`    | device → broker | status   | online/offline/sos, every 60 s |
| `bus/telemetry/{deviceId}` | device → broker | telemetry| sensor readings, every 10 s |
| `bus/alert/{deviceId}`     | device → broker | alert    | SOS / impact / rollover |
| `bus/command/{deviceId}`   | broker → device | command  | backend → device control |

`{deviceId}` is the bus device ID, e.g. `BUS_MH001`. It must match the
`deviceId` field of a registered **Bus** in MongoDB or the backend logs the
message as `Unknown device` and drops it.

---

## 3. Payload schemas

All payloads are **UTF-8 JSON**. Field names/types must match exactly —
the backend validates them (`validateDevicePayload`, `validateTelemetryPayload`).

### 3.1 Location — `bus/location/{deviceId}`

```json
{
  "deviceId": "BUS_MH001",
  "lat": 19.076090,
  "lng": 72.877426,
  "speed": 32.5,
  "heading": 120.0,
  "altitude": 14.0,
  "satellites": 9,
  "hdop": 1.2,
  "sos": false,
  "signal": 12,
  "batteryLevel": 78,
  "firmware": "1.0.0",
  "timestamp": 1723456789012
}
```

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `deviceId` | string | ✅ | must match a registered Bus |
| `lat` | number | ✅ | −90…90 |
| `lng` | number | ✅ | −180…180 |
| `speed` | number | – | km/h, 0…200 |
| `heading` | number | – | degrees, 0…360 |
| `altitude` | number | – | metres |
| `satellites` | int | – | GPS satellites in use |
| `hdop` | number | – | horizontal dilution of precision |
| `sos` | bool | – | SOS active flag (also triggers `handleSOSAlert`) |
| `signal` | int | – | LTE `AT+CSQ` value (0–31, 99 = none) |
| `batteryLevel` | number | – | 0–100 % (estimated from voltage) |
| `firmware` | string | – | firmware version |
| `timestamp` | number | – | **epoch ms** (device uses GPS UTC time; fallback 0 → backend uses now) |

### 3.2 Status — `bus/status/{deviceId}`

```json
{
  "deviceId": "BUS_MH001",
  "status": "online",
  "gpsFix": true,
  "satellites": 9,
  "signal": 12,
  "sos": false,
  "queue": 0,
  "uptime": 3600,
  "sent": 720,
  "failed": 2,
  "firmware": "1.0.0",
  "timestamp": 1723456789012
}
```

`status` values recognised by the backend: `online` / `connected`,
`offline` / `disconnected`, `sos_active`. Backend emits a
`busStatusChanged` Socket.IO event with `deviceStatus`.

### 3.3 Telemetry — `bus/telemetry/{deviceId}`

```json
{
  "deviceId": "BUS_MH001",
  "engineTemperature": 87.5,
  "batteryVoltage": 25.8,
  "currentDraw": 12.4,
  "accelerometer": { "x": 0.1, "y": 0.2, "z": 9.8 },
  "gyroscope":     { "x": 0.0, "y": 0.1, "z": 0.5 },
  "vibration": 0.35,
  "speed": 32.5,
  "lat": 19.076090,
  "lng": 72.877426,
  "timestamp": 1723456789012
}
```

| Field | Type | Notes |
| ----- | ---- | ----- |
| `deviceId` | string | required |
| `engineTemperature` | number | °C (DS18B20) |
| `batteryVoltage` | number | V (voltage divider) |
| `currentDraw` | number | A (ACS712) |
| `accelerometer` | object {x,y,z} | **m/s²** (MPU6050; gravity ≈ 9.8 on z at rest) |
| `gyroscope` | object {x,y,z} | **°/s** (MPU6050) |
| `vibration` | number | RMS in m/s² excluding gravity: `√(x² + y² + max(0,|z|−9.81)²)` |
| `speed` | number | km/h (from GPS) |
| `lat`, `lng` | number | current position (backend falls back to bus state) |
| `timestamp` | number | epoch ms |

> **Units matter.** The backend's accident detection fires when the
> accelerometer resultant magnitude ≥ **30 m/s²** (~3 g) and rollover when
> `|az| ≥ 28 && |ax| ≥ 12`. Driver-safety events (harsh braking, sharp turns,
> excessive vibration) are also derived from these fields — see
> `backend/src/services/driverSafetyService.js` thresholds.

### 3.4 Alert — `bus/alert/{deviceId}`

```json
{
  "deviceId": "BUS_MH001",
  "type": "sos",
  "lat": 19.076090,
  "lng": 72.877426,
  "speed": 12.0,
  "heading": 90.0,
  "message": "Emergency SOS triggered by driver",
  "timestamp": 1723456789012
}
```

Alert types produced by the device firmware:

| Type | Trigger |
| ---- | ------- |
| `sos` / `sos_clear` | driver holds SOS button 3 s (toggle) |
| `impact` | accelerometer resultant ≥ 30 m/s² (device-side immediate alert) |
| `rollover` | `|az| ≥ 28 && |ax| ≥ 12` sustained |

The backend maps `sos`/`panic` to `handleSOSAlert`, creates a **Notification**
(`severity: critical`) and emits `busAlert`/`busSOS` over Socket.IO.

> ⚠ **`impact` / `rollover` / `sos_clear` alerts only create backend
> *Notifications*** — only `sos`/`panic` route to `handleSOSAlert`. The
> automatic accident flow runs from **telemetry** (the accelerometer reading
> reaching `accidentDetectionService`), so the device-side impact alert is a
> fast local alarm + notification, not the authoritative accident record.

---

## 4. Commands — `bus/command/{deviceId}` (backend → device)

Payload: `{ "command": "<name>", ...args, "timestamp": 1723456789012 }`

| Command | Payload fields | Device behaviour |
| ------- | -------------- | ---------------- |
| `ping` | – | replies with a fresh `bus/status/{id}` `online` |
| `reboot` | – | `ESP.restart()` after 1 s |
| `sos_reset` | – | clears SOS flag, publishes status `online` |
| `set_interval` | `{ "intervalMs": 5000 }` | changes location publish interval (min 2000) |
| `buzzer_on` / `buzzer_off` | – | toggles the alarm buzzer |

Commands are sent by the backend via `MQTTConsumer.publishCommand()`
(e.g. from an admin resolving an SOS). Devices receive them as unsolicited
`+MQTTSUBRECV:` messages and parse the `"command":"..."` field.

---

## 5. Example end-to-end flows

**Normal tracking**
1. Device boots → LTE attach → `AT+MQTTCONN` → publishes status `online`.
2. Every 5 s → `bus/location/BUS_MH001` with the current GPS fix.
3. Every 10 s → `bus/telemetry/BUS_MH001` with sensor readings.
4. Backend consumer validates → saves `BusLocation` + `Telemetry` → Redis cache
   → Socket.IO `busLocationUpdated` / `busTelemetryUpdated` → frontend map moves.

**SOS**
1. Driver holds button 3 s → device publishes `bus/alert/BUS_MH001`
   (`type: "sos"`) + location with `sos: true`.
2. Backend creates `SOSAlert`, marks the bus `sosActive`, notifies admins/
   depot managers, emits `busSOS`.
3. Admin resolves → backend publishes `bus/command/BUS_MH001`
   `{"command":"sos_reset"}` → device clears the flag and reports `online`.

**Automatic accident**
1. MPU6050 impact ≥ 30 m/s² → telemetry carries the accelerometer reading.
2. Backend `accidentDetectionService` detects it (dedup 60 s) → `SOSAlert`
   with `trigger: "automatic"` + `DriverEvent` `impact` + notifications.
3. Device-side, the firmware also fires an immediate `bus/alert` + buzzer so the
   driver hears the alarm even before the backend round-trip.

---

## 6. Testing the protocol without hardware

```bash
# Backend stack (EMQX + backend + redis)
cd backend && docker compose up -d emqx redis backend

# Register a bus with the matching deviceId (via API or seeder), then:
cd iot/code/simulator && npm install && node device-simulator.js BUS_MH001

# Watch it live:
docker compose -f backend/docker-compose.yml logs -f backend
```

You can also subscribe manually with any MQTT client:

```bash
mosquitto_sub -h localhost -p 1883 -u smarttransit -P smarttransit_secret \
  -t 'bus/#' -v
```
