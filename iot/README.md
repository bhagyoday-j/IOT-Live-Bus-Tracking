# SmartTransit IoT — Device Subsystem

Complete documentation for the **in-bus IoT device** that powers SmartTransit's live
bus tracking, driver safety, accident detection and predictive maintenance.

This folder contains everything needed to build the hardware, wire it, flash it,
and connect it to the backend:

| Folder / File            | What it contains                                                        |
| ------------------------ | ----------------------------------------------------------------------- |
| `components/`            | Bill of materials — every component, spec, quantity and approximate cost |
| `wiring/`                | Step-by-step connection guide (pin tables + diagrams) + power design    |
| `protocol/`              | MQTT topics, JSON payload schemas and device commands (matches backend) |
| `code/`                  | Firmware + per-component test sketches + a no-hardware device simulator |

---

## 1. What the device does

The device is installed in each bus and performs five jobs:

1. **Live GPS tracking** — NEO-M8N GPS reads position, speed, heading, altitude
   every 5 s and publishes it to the broker (`bus/location/{deviceId}`).
2. **Cellular backhaul** — A7670C 4G LTE module (with SIM + data plan) connects to
   the EMQX MQTT broker over the cellular data network. No WiFi/hotspot needed.
3. **Sensor telemetry** — MPU6050 (acceleration/rotation/vibration), DS18B20
   (engine temperature), ACS712 (current draw) and a voltage divider (battery
   voltage) are sampled and published (`bus/telemetry/{deviceId}`).
4. **Safety & emergencies** — a driver SOS button (3 s hold) and automatic
   impact detection (≥ 30 m/s², ~3 g) publish alerts (`bus/alert/{deviceId}`).
5. **Remote control** — the backend can send commands (`bus/command/{deviceId}`):
   `ping`, `reboot`, `sos_reset`, `set_interval`, `buzzer_on/off`.

The backend consumes all of this over MQTT — see `../backend/src/mqtt/consumer.js`,
`../backend/src/config/mqtt.js` and the protocol doc in this folder.

---

## 2. Data flow

```
┌─────────────────────────────── BUS ───────────────────────────────┐
│                                                                   │
│   NEO-M8N GPS ──┐                                                │
│   MPU6050 IMU ──┤                                                │
│   DS18B20 temp ─┼──► ESP32  ──►  A7670C LTE  ──► 4G network      │
│   ACS712 current┘    (firmware)   (MQTT over AT)     │            │
│   Voltage divider                  ▲                │            │
│   SOS button / buzzer / LEDs ──────┘                ▼            │
└───────────────────────────────────────────────►  EMQX MQTT broker │
                                                    │   │   │   │
                      ┌─────────────────────────────┘   │   │   └──► bus/command/{id} (to device)
                      ▼                                ▼             
              bus/location/{id}                 bus/telemetry/{id}
              bus/status/{id}                   bus/alert/{id}
                      │                                │
                      ▼                                ▼
              ┌────────────────── SmartTransit backend ──────────────────┐
              │  MQTT consumer → BusLocation / Telemetry / SOSAlert      │
              │  → health monitoring, driver safety, accident detection, │
              │    predictive maintenance → Redis + Socket.IO → frontend │
              └──────────────────────────────────────────────────────────┘
```

---

## 3. Quick start (5 steps)

1. **Read the bill of materials** → `components/bill-of-materials.md`
   and buy/procure the parts (~₹3,200 / ~$38 per device, plus SIM).
2. **Wire everything** following `wiring/connection-guide.md`.
3. **Install the Arduino toolchain** per `code/README.md`
   (ESP32 board package + libraries).
4. **Flash each component test sketch first** (`code/sensor_tests/`), then flash
   the full firmware (`code/smarttransit_esp32/`).
5. **Start the backend** (`cd backend && docker compose up`) and verify the
   device appears live. No hardware yet? Run the simulator
   (`code/simulator/`) to test the full pipeline.

---

## 4. Pin map (summary)

| Module          | ESP32 pin | Function            |
| --------------- | --------- | ------------------- |
| NEO-M8N GPS TX  | GPIO16    | UART2 RX            |
| NEO-M8N GPS RX  | GPIO17    | UART2 TX            |
| A7670C LTE TX   | GPIO18    | UART1 RX            |
| A7670C LTE RX   | GPIO19    | UART1 TX            |
| A7670C PWRKEY   | GPIO4     | power-on pulse      |
| A7670C RESET    | GPIO5     | reset (high = run)  |
| MPU6050 SDA     | GPIO21    | I2C data            |
| MPU6050 SCL     | GPIO22    | I2C clock           |
| DS18B20 DATA    | GPIO13    | 1-Wire (+4.7 kΩ)    |
| ACS712 OUT      | GPIO34    | ADC1_CH6 (input-only) |
| Battery divider | GPIO35    | ADC1_CH7 (input-only) |
| SOS button      | GPIO15    | INPUT_PULLUP → GND  |
| Status LED      | GPIO2     | heartbeat (onboard) |
| GPS fix LED     | GPIO27    | on = GPS lock       |
| Buzzer          | GPIO14    | alert sound         |

> **⚠️ ADC warning:** GPIO34/35 are **input-only** (no pull-ups) and are on
> **ADC1** — the only ADC usable while WiFi is active. Never put sensors on
> ADC2 pins (GPIO12, 13, 14, 25, 26, 27) when WiFi is on. GPIO12 is also a
> strapping pin (MTDI) — avoid driving it high at boot.

---

## 5. MQTT at a glance

| Topic pattern                    | Direction       | Payload            |
| -------------------------------- | --------------- | ------------------ |
| `bus/location/{deviceId}`        | device → broker | location JSON      |
| `bus/status/{deviceId}`          | device → broker | status JSON        |
| `bus/telemetry/{deviceId}`       | device → broker | sensor JSON        |
| `bus/alert/{deviceId}`           | device → broker | alert JSON         |
| `bus/command/{deviceId}`         | broker → device | `{"command": "…"}` |

Full schemas, example payloads and the command list: `protocol/mqtt-protocol.md`.

---

## 6. Firmware structure

```
code/
├── README.md                 # Toolchain, libraries, flashing, testing
├── smarttransit_esp32/       # ★ Full production firmware
│   ├── config.h              #   All configuration in one place
│   └── smarttransit_esp32.ino
├── sensor_tests/             # One standalone test sketch per component
│   ├── gps_test/             #   NEO-M8N: NMEA parsing + fix + coordinates
│   ├── mpu6050_test/         #   MPU6050: accel/gyro/temp values + magnitude
│   ├── ds18b20_test/         #   DS18B20: engine temperature probe
│   ├── acs712_test/          #   ACS712: current measurement + calibration
│   ├── voltage_test/         #   Voltage divider: battery voltage
│   ├── sos_button_test/      #   SOS button + LED + buzzer
│   └── a7670c_test/          #   LTE: AT, SIM, network attach, MQTT pub/sub
└── simulator/                # Node.js device simulator (no hardware)
    ├── package.json
    └── device-simulator.js
```

> The firmware in `iot/code/smarttransit_esp32/` is the superset of
> `../firmware/smarttransit_esp32/` — it adds the MPU6050, DS18B20, ACS712,
> voltage sensing, buzzer and telemetry publishing on top of the A7670C
> MQTT/AT-command core. Keep the two in sync when you change one.
