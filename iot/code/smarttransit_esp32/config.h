/**
 * SmartTransit IoT Firmware — Configuration
 *
 * Edit this file to match YOUR hardware, broker and bus.
 * Everything the firmware needs is defined here.
 */
#ifndef SMARTRANSIT_CONFIG_H
#define SMARTRANSIT_CONFIG_H

// ═══════════════════════════════════════════════════════════════════
// DEVICE IDENTITY — change per device!
// ═══════════════════════════════════════════════════════════════════
#define DEVICE_ID          "BUS_MH001"   // must match the Bus.deviceId in MongoDB
#define FIRMWARE_VERSION   "2.0.0"

// ═══════════════════════════════════════════════════════════════════
// MQTT BROKER (EMQX from backend/docker-compose.yml)
// ═══════════════════════════════════════════════════════════════════
#define MQTT_BROKER        "192.168.1.100"   // IP/hostname reachable from the LTE network
#define MQTT_PORT          1883
#define MQTT_USER          "smarttransit"
#define MQTT_PASS          "smarttransit_secret"
#define MQTT_TOPIC_LOCATION "bus/location/"
#define MQTT_TOPIC_STATUS   "bus/status/"
#define MQTT_TOPIC_TELEMETRY "bus/telemetry/"
#define MQTT_TOPIC_ALERT    "bus/alert/"
#define MQTT_TOPIC_COMMAND  "bus/command/"

// ═══════════════════════════════════════════════════════════════════
// GPS — NEO-M8N on UART2
// ═══════════════════════════════════════════════════════════════════
#define GPS_BAUD           9600
#define GPS_RX_PIN         16    // ESP32 UART2 RX ← GPS TX
#define GPS_TX_PIN         17    // ESP32 UART2 TX → GPS RX
#define GPS_CHECK_INTERVAL_MS 1000

// ═══════════════════════════════════════════════════════════════════
// LTE — A7670C on UART1 (remapped away from flash pins 9/10)
// ═══════════════════════════════════════════════════════════════════
#define LTE_BAUD           115200
#define LTE_RX_PIN         18    // ESP32 UART1 RX ← A7670C TX
#define LTE_TX_PIN         19    // ESP32 UART1 TX → A7670C RX
#define LTE_PWRKEY_PIN     4
#define LTE_RESET_PIN      5

// ═══════════════════════════════════════════════════════════════════
// SENSORS
// ═══════════════════════════════════════════════════════════════════
// MPU6050 (I²C — uses default SDA=21 / SCL=22 on ESP32 DevKit)
#define MPU6050_I2C_ADDR   0x68

// DS18B20 engine temperature (1-Wire) — 4.7 kΩ pull-up to 3.3 V required
#define DS18B20_PIN        13

// ACS712-30A current sensor on ADC1 (input-only pin)
#define ACS712_PIN         34
#define ACS712_SENSITIVITY 0.066f   // V/A — 30A variant. 20A→0.100, 5A→0.185

// Battery voltage divider on ADC1 (input-only pin)
//   24 V bus: 100 kΩ + 10 kΩ → ratio = 11.0
//   12 V bus:  33 kΩ + 10 kΩ → ratio =  4.3
#define VOLTAGE_PIN        35
#define VOLTAGE_DIVIDER_RATIO 11.0f
#define BATTERY_EMPTY_V    22.0f    // 0% battery (24 V system)
#define BATTERY_FULL_V     27.6f    // 100% battery (24 V system)

// ═══════════════════════════════════════════════════════════════════
// BUTTONS / INDICATORS
// ═══════════════════════════════════════════════════════════════════
#define SOS_BUTTON_PIN     15    // INPUT_PULLUP → GND when pressed
#define STATUS_LED_PIN     2     // onboard LED heartbeat
#define GPS_FIX_LED_PIN    27    // on = GPS lock (NOT GPIO12 — strapping pin!)
#define BUZZER_PIN         14    // active buzzer

// ═══════════════════════════════════════════════════════════════════
// TIMING
// ═══════════════════════════════════════════════════════════════════
#define SERIAL_BAUD         115200
#define LOCATION_INTERVAL_MS  5000
#define TELEMETRY_INTERVAL_MS 10000
#define STATUS_INTERVAL_MS    60000
#define SOS_HOLD_MS           3000      // hold button this long to toggle SOS
#define IMPACT_COOLDOWN_MS    60000     // min time between automatic impact alerts
#define RECONNECT_DELAY_MS    5000
#define WATCHDOG_TIMEOUT_MS   60000

// ═══════════════════════════════════════════════════════════════════
// DETECTION THRESHOLDS — keep in sync with backend services
// ═══════════════════════════════════════════════════════════════════
#define IMPACT_THRESHOLD_MS2 30.0f   // accident: resultant accel ≥ 3 g (backend: 30)
#define ROLLOVER_AZ          28.0f   // rollover: |az| ≥ 28  (backend: 28)
#define ROLLOVER_AX          12.0f   // rollover: |ax| ≥ 12  (backend: 12)

// ═══════════════════════════════════════════════════════════════════
// OFFLINE QUEUE
// ═══════════════════════════════════════════════════════════════════
#define MAX_OFFLINE_QUEUE   500

// ═══════════════════════════════════════════════════════════════════
// FEATURES
// ═══════════════════════════════════════════════════════════════════
#define CALIBRATE_MPU6050               true   // 5 s gyro offset calibration at boot
#define ENABLE_DEVICE_SIDE_IMPACT_ALERT true   // on-board impact → alert + buzzer

#endif // SMARTRANSIT_CONFIG_H
