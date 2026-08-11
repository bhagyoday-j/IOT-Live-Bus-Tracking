# IoT Code — Toolchain, Libraries & Flashing

This folder contains:

```
smarttransit_esp32/   ★ Full production firmware (all components integrated)
sensor_tests/         One standalone test sketch per component (flash first!)
simulator/            Node.js device simulator — test the backend with no hardware
```

---

## 1. Install the Arduino toolchain

1. Install **Arduino IDE 2.x** (or Arduino CLI) — https://www.arduino.cc/en/software
2. Add the ESP32 board package:
   - File → Preferences → *Additional boards manager URLs*:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Tools → Board → Boards Manager → search **esp32** → install
     **esp32 by Espressif Systems** (2.0.x or newer; 3.x also works for this code).
3. **Board selection:** `ESP32 Dev Module` (Tools → Board → ESP32 Arduino → ESP32 Dev Module).
4. **USB driver:** Windows usually auto-installs CP210x/CH340 driver; if the
   board isn't detected, install the CP210x or CH340 driver manually.

### Required libraries (Library Manager)

| Library | Version | Used by |
| ------- | ------- | ------- |
| `TinyGPSPlus` (Mikal Hart) | latest | GPS parsing |
| `MPU6050_tockn` | latest | MPU6050 accelerometer/gyro |
| `OneWire` (Paul Stoffregen) | latest | DS18B20 bus |
| `DallasTemperature` (Miles Burton) | latest | DS18B20 sensor |
| `Wire` (built-in) | — | I²C for MPU6050 |

> No MQTT library is needed on the device — the **A7670C module has MQTT
> built in** and the firmware drives it with AT commands.

---

## 2. Flash order (recommended)

Never jump straight to the full firmware — isolate faults first:

| Step | Sketch | What it proves |
| ---- | ------ | -------------- |
| 1 | `sensor_tests/gps_test` | GPS module alive, NMEA parsed, fix + coordinates |
| 2 | `sensor_tests/a7670c_test` | LTE module boots, SIM + network + MQTT publish OK |
| 3 | `sensor_tests/mpu6050_test` | IMU values sane (z ≈ 9.8 m/s² at rest) |
| 4 | `sensor_tests/ds18b20_test` | Engine temperature reading |
| 5 | `sensor_tests/acs712_test` | Current offset + live current |
| 6 | `sensor_tests/voltage_test` | Battery voltage through the divider |
| 7 | `sensor_tests/sos_button_test` | Button → LED + buzzer |
| 8 | `smarttransit_esp32` | Everything together + MQTT telemetry |

Each test sketch prints to the **Serial Monitor (115200 baud)** and has its own
short "how to verify" comment header.

### Flashing the full firmware

1. Open `smarttransit_esp32/smarttransit_esp32.ino`.
2. Edit `config.h`:
   - `DEVICE_ID` → the bus device ID **registered in the backend**
     (e.g. `BUS_MH001`). Must match the Bus document's `deviceId`.
   - `MQTT_BROKER`, `MQTT_USER`, `MQTT_PASS` → your EMQX credentials.
   - `VOLTAGE_DIVIDER_RATIO` → `11.0` for a 24 V bus with 100 kΩ/10 kΩ,
     `4.3` for a 12 V bus with 33 kΩ/10 kΩ (match your resistors!).
3. Connect the ESP32 via USB, select the COM port.
4. Upload. Open Serial Monitor at 115200 and watch the boot banner,
   `LTE (A7670C): detected` and `MQTT: Connected`.

---

## 3. Configuration reference (`config.h`)

| Setting | Default | Notes |
| ------- | ------- | ----- |
| `DEVICE_ID` | `BUS_MH001` | must match a registered Bus `deviceId` |
| `MQTT_BROKER` | `192.168.1.100` | EMQX host/IP reachable from the LTE data network |
| `MQTT_TOPIC_*` | `bus/...` | keep aligned with `MQTT_TOPIC_PREFIX` in backend |
| `LOCATION_INTERVAL_MS` | 5000 | location publish cadence (min 2000 via `set_interval`) |
| `TELEMETRY_INTERVAL_MS` | 10000 | sensor publish cadence |
| `STATUS_INTERVAL_MS` | 60000 | status publish cadence |
| `SOS_HOLD_MS` | 3000 | button hold time to trigger SOS |
| `IMPACT_THRESHOLD_MS2` | 30.0 | automatic accident threshold (matches backend) |
| `VOLTAGE_DIVIDER_RATIO` | 11.0 | `(R1+R2)/R2` of your divider |
| `ACS712_SENSITIVITY` | 0.066 | V/A (30 A variant); 20 A → 0.100, 5 A → 0.185 |
| `BATTERY_EMPTY_V` / `BATTERY_FULL_V` | 22.0 / 27.6 | used for the `batteryLevel` % estimate |
| `MAX_OFFLINE_QUEUE` | 500 | messages buffered while offline (ring buffer) |
| `CALIBRATE_MPU6050` | true | 5 s gyro offset calibration at boot |
| `ENABLE_DEVICE_SIDE_IMPACT_ALERT` | true | publish alert + buzzer on impact ≥ 3 g |

---

## 4. No hardware? Use the simulator

```bash
cd iot/code/simulator
npm install
node device-simulator.js BUS_MH001          # starts publishing location + telemetry
node device-simulator.js BUS_MH001 --sos     # also triggers one SOS alert
```

The simulator connects to `mqtt://localhost:1883` (EMQX from the backend
`docker-compose.yml`), walks a route around Mumbai, publishes location every
5 s and telemetry every 10 s, and answers `ping` / `sos_reset` commands.

---

## 5. Debugging tips

- **Serial Monitor** shows every subsystem state — read the banner and the
  periodic `── System Status ──` block.
- **EMQX dashboard** (`http://localhost:18083`, admin/public) → Clients shows
  the device connected; Topics shows the messages flowing.
- Backend logs (`docker compose -f backend/docker-compose.yml logs -f backend`)
  show `MQTT received: bus/location/BUS_MH001` for every valid packet and
  `Unknown device` if `deviceId` isn't registered.
- GPS cold start can take 3–5 min indoors; test near a window or outdoors.
