/**
 * ═══════════════════════════════════════════════════════════════════
 *  SmartTransit IoT Firmware — Full Integration v2.0.0
 *  ESP32 + NEO-M8N GPS + A7670C LTE + MPU6050 + DS18B20 + ACS712 + Vbat
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Publishes:
 *    - bus/location/{id}   GPS fix every 5 s (QoS 1)
 *    - bus/status/{id}     online/sos every 60 s (QoS 1)
 *    - bus/telemetry/{id}  MPU6050 + DS18B20 + ACS712 + voltage (QoS 1)
 *    - bus/alert/{id}      SOS button / impact / rollover (QoS 2)
 *
 *  Receives (bus/command/{id}): ping, reboot, sos_reset, set_interval,
 *  buzzer_on, buzzer_off.
 *
 *  Uses the A7670C's built-in MQTT client over AT commands — no WiFi and
 *  no MQTT library needed. Includes an offline ring-buffer queue so data
 *  is replayed when the network returns.
 *
 *  Hardware wiring: see ../../wiring/connection-guide.md
 *  Protocol contract: see ../../protocol/mqtt-protocol.md
 *  Configuration: edit config.h FIRST (deviceId, broker, divider ratio).
 *
 *  Libraries: TinyGPSPlus, MPU6050_tockn, OneWire, DallasTemperature
 *  Board:     ESP32 Dev Module, 115200 baud Serial Monitor
 */

#include "config.h"
#include <Arduino.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <Wire.h>
#include <MPU6050_tockn.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ═══════════════════════════════════════════════════════════════════
// GLOBAL OBJECTS
// ═══════════════════════════════════════════════════════════════════
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);          // UART2 → NEO-M8N
HardwareSerial lteSerial(1);          // UART1 → A7670C (remapped RX=18, TX=19)
MPU6050 mpu6050(Wire);                // default: ±8 g accel, ±2000 °/s gyro
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);

// ═══════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════
struct GPSData {
  double lat = 0.0;
  double lng = 0.0;
  float speed = 0.0;
  float heading = 0.0;
  float altitude = 0.0;
  int satellites = 0;
  float hdop = 99.9;
  bool hasFix = false;
};

struct OfflineRecord {
  String topic;
  String payload;
};

GPSData currentGPS;
GPSData lastPublishedGPS;

OfflineRecord offlineQueue[MAX_OFFLINE_QUEUE];
int queueHead = 0;
int queueTail = 0;
int queueCount = 0;

// Sensor state
float accX = 0.0f, accY = 0.0f, accZ = 0.0f;   // m/s²
float gyroX = 0.0f, gyroY = 0.0f, gyroZ = 0.0f; // °/s
float engineTempC = -127.0f;
float batteryVoltage = 0.0f;
float currentDraw = 0.0f;
float currentZeroOffsetV = 1.65f;   // calibrated at boot (3.3 V supply = 1.65 V @ 0 A)

// Connectivity
bool lteReady = false;
bool mqttReady = false;
bool imuOk = false;
bool sosActive = false;
bool impactAlarm = false;
bool buzzerOn = false;
unsigned long lastImpactAt = 0;
int cachedCsq = 99;
unsigned long lastCsqRead = 0;
int reconnectAttempts = 0;
int totalMessagesSent = 0;
int totalMessagesFailed = 0;
unsigned long deviceStartTime = 0;
unsigned long lastLteRetry = 0;   // separate from status cadence

// Timing
unsigned long lastLocationSend = 0;
unsigned long lastTelemetrySend = 0;
unsigned long lastStatusSend = 0;
unsigned long lastGPSCheck = 0;

// Runtime location interval (mutable copy of the config default;
// changed remotely via the "set_interval" command)
static unsigned long gLocationIntervalMs = LOCATION_INTERVAL_MS;

char lteResponseBuffer[2048];
int lteResponseIndex = 0;

// ═══════════════════════════════════════════════════════════════════
// FORWARD DECLARATIONS
// ═══════════════════════════════════════════════════════════════════
void initSensors();
void processGPSData();
void checkSOSButton();
void publishLocationData();
void publishStatusData(const char* status);
void publishTelemetryData();
void publishAlertData(const char* type, const char* message);
void checkImpact();
void setLocationInterval(unsigned long ms);
void updateLEDs();
void updateBuzzer();
void printSystemInfo();
float computeVibration(float ax, float ay, float az);
float readPinAvgMv(int pin, int samples);
float readCurrent();
float readBatteryVoltage();
int estimateBatteryPercent(float volts);
unsigned long gpsEpochMs();
long daysFromCivil(int y, unsigned m, unsigned d);
int getSignalStrengthCached();

bool initLTE();
bool powerOnLTE();
bool connectLTENetwork();
bool connectMQTTBroker();
bool publishMQTT(const char* topic, const char* payload, int qos);
bool subscribeMQTTTopic(const char* topic);
void disconnectMQTT();
void readLTEResponseAsync();
bool sendAT(const char* cmd, const char* expected, unsigned long timeout);
String sendATCommand(const char* cmd, unsigned long timeout);
void clearLTEResponseBuffer();
void handleIncomingCommand(char* buf);
long extractNumber(const char* buf, const char* key);

String buildLocationPayload();
String buildStatusPayload(const char* status);
String buildTelemetryPayload(float temp, float current, float voltage, float vibration);
String buildAlertPayload(const char* type, const char* message);

void enqueueOffline(const String& topic, const String& payload);
bool dequeueOffline(String& topic, String& payload);
void sendOfflineQueue();

// ═══════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(300);
  Serial.println(F("\n\n╔════════════════════════════════════════════════╗"));
  Serial.println(F("║  SmartTransit IoT v" FIRMWARE_VERSION " (Full)         ║"));
  Serial.println(F("╚════════════════════════════════════════════════╝"));
  Serial.printf("Device ID: %s\n", DEVICE_ID);

  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(GPS_FIX_LED_PIN, OUTPUT);
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LTE_PWRKEY_PIN, OUTPUT);
  pinMode(LTE_RESET_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  digitalWrite(GPS_FIX_LED_PIN, LOW);
  digitalWrite(LTE_PWRKEY_PIN, LOW);
  digitalWrite(LTE_RESET_PIN, HIGH);
  digitalWrite(BUZZER_PIN, LOW);

  deviceStartTime = millis();

  initSensors();   // GPS + I²C + DS18B20 + ACS712 offset
  initLTE();

  if (lteReady && connectLTENetwork()) {
    connectMQTTBroker();
  }

  // Boot beep: 3 short pulses
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(80);
    digitalWrite(BUZZER_PIN, LOW);
    delay(120);
  }

  Serial.println(F("\n✓ Device initialized\n"));
}

// ═══════════════════════════════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════════════════════════════
void loop() {
  unsigned long now = millis();

  // ── GPS: encode NMEA stream + 1 Hz refresh ──────────────────────────
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
  if (now - lastGPSCheck >= GPS_CHECK_INTERVAL_MS) {
    processGPSData();
    lastGPSCheck = now;
  }

  // ── IMU: keep updating continuously (MPU6050_tockn needs frequent calls) ──
  if (imuOk) mpu6050.update();

  // ── LTE: async response reading (commands, MQTT SUBRECV) ─────────────
  readLTEResponseAsync();

  // ── Retry LTE connection every 30 s while down ──────────────────────
  if (!lteReady && (now - lastLteRetry > 30000)) {
    Serial.println(F("Retrying LTE connection..."));
    if (initLTE() && connectLTENetwork()) {
      connectMQTTBroker();
    }
    lastLteRetry = now;
  }

  // ── Retry MQTT while LTE is up but MQTT is down ─────────────────────
  if (lteReady && !mqttReady && (now - lastLteRetry > RECONNECT_DELAY_MS)) {
    Serial.println(F("Reconnecting MQTT..."));
    connectMQTTBroker();
    lastLteRetry = now;
  }

  // ── Publish location every gLocationIntervalMs (default LOCATION_INTERVAL_MS) ─
  if (now - lastLocationSend >= gLocationIntervalMs) {
    if (currentGPS.hasFix) {
      double dist = TinyGPSPlus::distanceBetween(
        lastPublishedGPS.lat, lastPublishedGPS.lng,
        currentGPS.lat, currentGPS.lng);
      // Publish if moved > 10 m, or force a fresh fix every 30 s
      if (dist > 10.0 || now - lastLocationSend > 30000) {
        publishLocationData();
        lastPublishedGPS = currentGPS;
      }
    } else {
      Serial.println(F("No GPS fix yet"));
    }
    lastLocationSend = now;
  }

  // ── Publish telemetry every TELEMETRY_INTERVAL_MS ───────────────────
  if (now - lastTelemetrySend >= TELEMETRY_INTERVAL_MS) {
    publishTelemetryData();   // also runs device-side impact detection
    lastTelemetrySend = now;
  }

  // ── SOS button (3 s hold toggle) ────────────────────────────────────
  checkSOSButton();

  // ── Flush offline queue when connected ──────────────────────────────
  if (mqttReady && queueCount > 0) {
    sendOfflineQueue();
  }

  // ── Status every STATUS_INTERVAL_MS ─────────────────────────────────
  if (now - lastStatusSend >= STATUS_INTERVAL_MS) {
    publishStatusData("online");
    printSystemInfo();
    lastStatusSend = now;
  }

  // ── Indicators ──────────────────────────────────────────────────────
  updateLEDs();
  updateBuzzer();

  // ── Watchdog: stuck MQTT → hard reset of the connection ─────────────
  if (lteReady && !mqttReady && (now - deviceStartTime > WATCHDOG_TIMEOUT_MS)) {
    Serial.println(F("Watchdog: resetting MQTT..."));
    disconnectMQTT();
    delay(1000);
    connectMQTTBroker();
    deviceStartTime = now;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SENSOR INITIALIZATION
// ═══════════════════════════════════════════════════════════════════
void initSensors() {
  // GPS
  Serial.print(F("GPS (NEO-M8N): "));
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println(F("OK"));

  // I²C + MPU6050
  Serial.print(F("MPU6050: "));
  Wire.begin();
  Wire.beginTransmission(MPU6050_I2C_ADDR);
  if (Wire.endTransmission() == 0) {
    imuOk = true;
    mpu6050.begin();
    if (CALIBRATE_MPU6050) {
      Serial.print(F("calibrating (5 s)... "));
      mpu6050.calcGyroOffsets(true);
    }
    Serial.println(F("OK"));
  } else {
    Serial.println(F("NOT FOUND (check SDA/SCL wiring)"));
  }

  // DS18B20
  Serial.print(F("DS18B20: "));
  ds18b20.begin();
  ds18b20.setResolution(10);   // 0.25 °C, ~187 ms conversion — keeps blocking short
  int devs = ds18b20.getDeviceCount();
  if (devs > 0) {
    Serial.printf("OK (%d device(s))\n", devs);
  } else {
    Serial.println(F("NOT FOUND (check 1-Wire + 4.7 kΩ pull-up)"));
  }

  // ACS712 zero-current offset calibration (do this with loads OFF)
  // 3.3 V supply → midpoint 1.65 V; we re-measure to absorb part tolerances.
  currentZeroOffsetV = readPinAvgMv(ACS712_PIN, 64) / 1000.0f;
  Serial.printf("ACS712: zero offset = %.3f V\n", currentZeroOffsetV);
}

// ═══════════════════════════════════════════════════════════════════
// GPS
// ═══════════════════════════════════════════════════════════════════
void processGPSData() {
  currentGPS.hasFix = gps.location.isValid() && gps.location.age() < 2000;
  if (currentGPS.hasFix) {
    currentGPS.lat = gps.location.lat();
    currentGPS.lng = gps.location.lng();
    currentGPS.speed = gps.speed.kmph();
    currentGPS.heading = gps.course.deg();
    currentGPS.altitude = gps.altitude.meters();
    currentGPS.satellites = gps.satellites.value();
    currentGPS.hdop = gps.hdop.hdop();
  }
}

/**
 * UTC epoch milliseconds from GPS date/time. Returns 0 if no valid time
 * (backend falls back to Date.now() when timestamp is 0).
 */
unsigned long gpsEpochMs() {
  if (!gps.date.isValid() || !gps.time.isValid()) return 0;
  long days = daysFromCivil(gps.date.year(), gps.date.month(), gps.date.day());
  unsigned long secs = days * 86400UL
    + gps.time.hour() * 3600UL
    + gps.time.minute() * 60UL
    + gps.time.second();
  return secs * 1000UL;
}

/** Days since 1970-01-01 (Howard Hinnant's civil_from_days inverse). */
long daysFromCivil(int y, unsigned m, unsigned d) {
  y -= m <= 2;
  const long era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = (unsigned)(y - era * 400);                 // [0, 399]
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;     // [0, 146096]
  return era * 146097 + (long)doe - 719468;
}

// ═══════════════════════════════════════════════════════════════════
// ANALOG SENSORS
// ═══════════════════════════════════════════════════════════════════
/** Average `samples` ADC reads and return millivolts (0–3300). */
float readPinAvgMv(int pin, int samples) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delayMicroseconds(200);
  }
  return (sum / (float)samples) * (3300.0f / 4095.0f);
}

/** ACS712-30A current in amperes (3.3 V supply → 66 mV/A). */
float readCurrent() {
  float mv = readPinAvgMv(ACS712_PIN, 64);
  return (mv / 1000.0f - currentZeroOffsetV) / ACS712_SENSITIVITY;
}

/** Battery voltage through the divider. */
float readBatteryVoltage() {
  float mv = readPinAvgMv(VOLTAGE_PIN, 64);
  return (mv / 1000.0f) * VOLTAGE_DIVIDER_RATIO;
}

int estimateBatteryPercent(float volts) {
  float pct = (volts - BATTERY_EMPTY_V) / (BATTERY_FULL_V - BATTERY_EMPTY_V) * 100.0f;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return (int)pct;
}

/**
 * Vibration RMS in m/s², gravity excluded on the z-axis — identical formula
 * to the backend's telemetryService.computeVibration().
 */
float computeVibration(float ax, float ay, float az) {
  float azc = fabs(az) - 9.81f;
  if (azc < 0) azc = 0;
  return sqrt(ax * ax + ay * ay + azc * azc);
}

// ═══════════════════════════════════════════════════════════════════
// PUBLISHERS
// ═══════════════════════════════════════════════════════════════════
void publishLocationData() {
  String payload = buildLocationPayload();
  String topic = String(MQTT_TOPIC_LOCATION) + DEVICE_ID;
  if (publishMQTT(topic.c_str(), payload.c_str(), 1)) {
    if (totalMessagesSent % 10 == 0) {
      Serial.printf("📍 %.6f, %.6f | %.1f km/h | %d sats | Sent: %d\n",
        currentGPS.lat, currentGPS.lng, currentGPS.speed,
        currentGPS.satellites, totalMessagesSent);
    }
  } else {
    Serial.println(F("📍 Location queued (offline)"));
  }
}

void publishStatusData(const char* status) {
  String payload = buildStatusPayload(status);
  String topic = String(MQTT_TOPIC_STATUS) + DEVICE_ID;
  publishMQTT(topic.c_str(), payload.c_str(), 1);
}

void publishTelemetryData() {
  // Fresh IMU snapshot
  if (imuOk) {
    accX = mpu6050.getAccX();
    accY = mpu6050.getAccY();
    accZ = mpu6050.getAccZ();
    gyroX = mpu6050.getGyroX();
    gyroY = mpu6050.getGyroY();
    gyroZ = mpu6050.getGyroZ();
  }

  // DS18B20 (blocking ~187 ms at 10-bit resolution)
  ds18b20.requestTemperatures();
  engineTempC = ds18b20.getTempCByIndex(0);

  currentDraw = readCurrent();
  batteryVoltage = readBatteryVoltage();

  float vibration = computeVibration(accX, accY, accZ);

  // Device-side impact / rollover detection (immediate alert + buzzer)
  if (ENABLE_DEVICE_SIDE_IMPACT_ALERT) {
    checkImpact();
  }

  String payload = buildTelemetryPayload(engineTempC, currentDraw, batteryVoltage, vibration);
  String topic = String(MQTT_TOPIC_TELEMETRY) + DEVICE_ID;
  publishMQTT(topic.c_str(), payload.c_str(), 1);

  Serial.printf("🌡 %.1f °C | ⚡ %.2f V | %+.1f A | accel (%.2f, %.2f, %.2f) m/s² | vib %.2f\n",
    engineTempC, batteryVoltage, currentDraw, accX, accY, accZ, vibration);
}

void publishAlertData(const char* type, const char* message) {
  String payload = buildAlertPayload(type, message);
  String topic = String(MQTT_TOPIC_ALERT) + DEVICE_ID;
  publishMQTT(topic.c_str(), payload.c_str(), 2);
}

/**
 * Impact: resultant |a| ≥ 30 m/s² (~3 g)  — matches backend accident threshold.
 * Rollover: |az| ≥ 28 && |ax| ≥ 12        — matches backend rollover rule.
 * Cooldown: IMPACT_COOLDOWN_MS between automatic alerts.
 */
void checkImpact() {
  if (millis() - lastImpactAt < IMPACT_COOLDOWN_MS) return;

  float magnitude = sqrt(accX * accX + accY * accY + accZ * accZ);
  bool isImpact = magnitude >= IMPACT_THRESHOLD_MS2;
  bool isRollover = fabs(accZ) >= ROLLOVER_AZ && fabs(accX) >= ROLLOVER_AX;

  if (isImpact || isRollover) {
    lastImpactAt = millis();
    impactAlarm = true;
    Serial.printf("🚨 %s detected! magnitude=%.1f m/s²\n",
      isRollover ? "ROLLOVER" : "IMPACT", magnitude);
    publishAlertData(isRollover ? "rollover" : "impact",
      isRollover ? "Rollover detected" : "Impact detected (accident candidate)");
  }
}

// ═══════════════════════════════════════════════════════════════════
// PAYLOAD BUILDERS  (see protocol/mqtt-protocol.md for schemas)
// ═══════════════════════════════════════════════════════════════════
String buildLocationPayload() {
  String json = "{";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"lat\":" + String(currentGPS.lat, 6) + ",";
  json += "\"lng\":" + String(currentGPS.lng, 6) + ",";
  json += "\"speed\":" + String(currentGPS.speed, 1) + ",";
  json += "\"heading\":" + String(currentGPS.heading, 1) + ",";
  json += "\"altitude\":" + String(currentGPS.altitude, 1) + ",";
  json += "\"satellites\":" + String(currentGPS.satellites) + ",";
  json += "\"hdop\":" + String(currentGPS.hdop, 1) + ",";
  json += "\"sos\":" + String(sosActive ? "true" : "false") + ",";
  json += "\"signal\":" + String(getSignalStrengthCached()) + ",";
  json += "\"batteryLevel\":" + String(estimateBatteryPercent(batteryVoltage)) + ",";
  json += "\"firmware\":\"" FIRMWARE_VERSION "\",";
  json += "\"timestamp\":" + String(gpsEpochMs());
  json += "}";
  return json;
}

String buildStatusPayload(const char* status) {
  String json = "{";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"status\":\"" + String(status) + "\",";
  json += "\"gpsFix\":" + String(currentGPS.hasFix ? "true" : "false") + ",";
  json += "\"satellites\":" + String(currentGPS.satellites) + ",";
  json += "\"signal\":" + String(getSignalStrengthCached()) + ",";
  json += "\"sos\":" + String(sosActive ? "true" : "false") + ",";
  json += "\"queue\":" + String(queueCount) + ",";
  json += "\"uptime\":" + String(millis() / 1000) + ",";
  json += "\"sent\":" + String(totalMessagesSent) + ",";
  json += "\"failed\":" + String(totalMessagesFailed) + ",";
  json += "\"firmware\":\"" FIRMWARE_VERSION "\",";
  json += "\"timestamp\":" + String(gpsEpochMs());
  json += "}";
  return json;
}

String buildTelemetryPayload(float temp, float current, float voltage, float vibration) {
  String json = "{";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"engineTemperature\":" + String(temp, 1) + ",";
  json += "\"batteryVoltage\":" + String(voltage, 2) + ",";
  json += "\"currentDraw\":" + String(current, 2) + ",";
  json += "\"accelerometer\":{";
  json += "\"x\":" + String(accX, 2) + ",";
  json += "\"y\":" + String(accY, 2) + ",";
  json += "\"z\":" + String(accZ, 2) + "},";
  json += "\"gyroscope\":{";
  json += "\"x\":" + String(gyroX, 2) + ",";
  json += "\"y\":" + String(gyroY, 2) + ",";
  json += "\"z\":" + String(gyroZ, 2) + "},";
  json += "\"vibration\":" + String(vibration, 2) + ",";
  json += "\"speed\":" + String(currentGPS.speed, 1) + ",";
  json += "\"lat\":" + String(currentGPS.lat, 6) + ",";
  json += "\"lng\":" + String(currentGPS.lng, 6) + ",";
  json += "\"timestamp\":" + String(gpsEpochMs());
  json += "}";
  return json;
}

String buildAlertPayload(const char* type, const char* message) {
  String json = "{";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"type\":\"" + String(type) + "\",";
  json += "\"lat\":" + String(currentGPS.lat, 6) + ",";
  json += "\"lng\":" + String(currentGPS.lng, 6) + ",";
  json += "\"speed\":" + String(currentGPS.speed, 1) + ",";
  json += "\"heading\":" + String(currentGPS.heading, 1) + ",";
  json += "\"message\":\"" + String(message) + "\",";
  json += "\"timestamp\":" + String(gpsEpochMs());
  json += "}";
  return json;
}

// ═══════════════════════════════════════════════════════════════════
// SOS BUTTON
// ═══════════════════════════════════════════════════════════════════
void checkSOSButton() {
  static unsigned long lastCheck = 0;
  static bool lastState = HIGH;
  static unsigned long pressStart = 0;

  if (millis() - lastCheck < 50) return;
  lastCheck = millis();

  bool state = digitalRead(SOS_BUTTON_PIN);

  if (state == LOW && lastState == HIGH) pressStart = millis();

  if (state == HIGH && lastState == LOW) {
    if (millis() - pressStart >= SOS_HOLD_MS) {
      sosActive = !sosActive;
      if (sosActive) {
        Serial.println(F("🚨 SOS ACTIVATED"));
        publishAlertData("sos", "Emergency SOS triggered by driver");
        publishStatusData("sos_active");
      } else {
        Serial.println(F("✅ SOS CLEARED"));
        publishAlertData("sos_clear", "Emergency cleared by driver");
        publishStatusData("online");
      }
    }
  }
  lastState = state;
}

// ═══════════════════════════════════════════════════════════════════
// OFFLINE QUEUE (ring buffer)
// ═══════════════════════════════════════════════════════════════════
void enqueueOffline(const String& topic, const String& payload) {
  if (queueCount >= MAX_OFFLINE_QUEUE) {
    queueHead = (queueHead + 1) % MAX_OFFLINE_QUEUE;
    queueCount--;
    totalMessagesFailed++;
  }
  offlineQueue[queueTail].topic = topic;
  offlineQueue[queueTail].payload = payload;
  queueTail = (queueTail + 1) % MAX_OFFLINE_QUEUE;
  queueCount++;
}

bool dequeueOffline(String& topic, String& payload) {
  if (queueCount == 0) return false;
  topic = offlineQueue[queueHead].topic;
  payload = offlineQueue[queueHead].payload;
  queueHead = (queueHead + 1) % MAX_OFFLINE_QUEUE;
  queueCount--;
  return true;
}

void sendOfflineQueue() {
  int sent = 0;
  int batchSize = min(10, queueCount);
  while (sent < batchSize && queueCount > 0) {
    String topic, payload;
    if (dequeueOffline(topic, payload)) {
      char cmd[2048];
      String escaped = payload;
      escaped.replace("\"", "\\\"");
      escaped.replace(",", "\\,");
      snprintf(cmd, sizeof(cmd), "AT+MQTTPUB=0,\"%s\",\"%s\",1,0",
        topic.c_str(), escaped.c_str());
      String resp = sendATCommand(cmd, 3000);
      if (resp.indexOf("OK") >= 0) {
        sent++;
        totalMessagesSent++;
      } else {
        enqueueOffline(topic, payload);   // re-queue on failure
        break;
      }
    }
  }
  if (sent > 0) {
    Serial.printf("Replayed %d offline msgs. Queue: %d\n", sent, queueCount);
  }
}

// ═══════════════════════════════════════════════════════════════════
// A7670C LTE — AT COMMAND DRIVER
// ═══════════════════════════════════════════════════════════════════
bool initLTE() {
  Serial.print(F("LTE (A7670C): "));
  lteSerial.begin(LTE_BAUD, SERIAL_8N1, LTE_RX_PIN, LTE_TX_PIN);
  delay(500);

  powerOnLTE();
  delay(2000);

  for (int i = 0; i < 3; i++) {
    if (sendAT("AT", "OK", 2000)) {
      lteReady = true;
      Serial.println(F("detected"));
      sendAT("AT+CMEE=2", "OK", 1000);
      sendAT("AT+CFUN=1", "OK", 3000);
      sendAT("AT+CNMP=38", "OK", 2000);   // LTE only
      sendAT("AT+CMNB=1", "OK", 2000);    // LTE Cat-M1
      return true;
    }
    delay(1000);
  }
  Serial.println(F("not responding"));
  lteReady = false;
  return false;
}

bool powerOnLTE() {
  digitalWrite(LTE_RESET_PIN, HIGH);
  delay(100);
  digitalWrite(LTE_PWRKEY_PIN, HIGH);
  delay(1500);
  digitalWrite(LTE_PWRKEY_PIN, LOW);
  delay(3000);
  return true;
}

bool connectLTENetwork() {
  Serial.print(F("LTE Network: "));

  String simResp = sendATCommand("AT+CPIN?", 5000);
  if (simResp.indexOf("READY") < 0 && simResp.indexOf("SIM PIN") < 0) {
    Serial.println(F("SIM error"));
    Serial.println(simResp);
    return false;
  }

  sendAT("AT+CGATT=1", "OK", 10000);
  // APN depends on your SIM provider: "internet", "airtelgprs.com", "jionet"...
  sendAT("AT+CGDCONT=1,\"IP\",\"internet\"", "OK", 3000);

  String pdpResp = sendATCommand("AT+CGACT=1,1", 15000);
  if (pdpResp.indexOf("OK") < 0) {
    Serial.println(F("PDP activation failed"));
    return false;
  }

  String ipResp = sendATCommand("AT+CGPADDR=1", 3000);
  int ipStart = ipResp.indexOf("+CGPADDR: 1,");
  if (ipStart >= 0) {
    int q1 = ipResp.indexOf('"', ipStart);
    int q2 = ipResp.indexOf('"', q1 + 1);
    if (q1 >= 0 && q2 > q1) {
      Serial.printf("Connected (IP: %s)\n", ipResp.substring(q1 + 1, q2).c_str());
    } else {
      Serial.println(F("Connected"));
    }
  } else {
    Serial.println(F("Connected"));
  }

  Serial.printf("Signal: RSSI=%d\n", getSignalStrengthCached());
  return true;
}

/**
 * Connect to MQTT broker with the A7670C's built-in client:
 *   AT+MQTTCONN=<id>,"<host>",<port>,"<user>","<pass>",<keepalive>
 *   AT+MQTTPUB=<id>,"<topic>","<data>",<qos>,<retain>
 *   AT+MQTTSUB=<id>,"<topic>",<qos>
 */
bool connectMQTTBroker() {
  if (!lteReady) return false;

  Serial.printf("MQTT %s:%d: ", MQTT_BROKER, MQTT_PORT);

  sendAT("AT+MQTTCLEAN=0", "OK", 2000);

  char cmd[256];
  snprintf(cmd, sizeof(cmd),
    "AT+MQTTCONN=0,\"%s\",%d,\"%s\",\"%s\",60",
    MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASS);

  String resp = sendATCommand(cmd, 15000);
  if (resp.indexOf("OK") >= 0) {
    mqttReady = true;
    reconnectAttempts = 0;
    Serial.println(F("Connected"));

    subscribeMQTTTopic((String(MQTT_TOPIC_COMMAND) + DEVICE_ID).c_str());
    publishStatusData("online");
    if (queueCount > 0) sendOfflineQueue();
    return true;
  }

  Serial.printf("Failed: %s\n", resp.c_str());
  mqttReady = false;
  reconnectAttempts++;
  return false;
}

bool publishMQTT(const char* topic, const char* payload, int qos) {
  if (!mqttReady) {
    enqueueOffline(String(topic), String(payload));
    return false;
  }

  char cmd[2048];
  // Escape quotes and commas so the AT parser keeps them inside the payload.
  // ⚠ Assumption: the A7670C AT parser un-escapes \" and \, before sending
  // the MQTT payload. If the broker ever receives corrupted JSON, drop the
  // comma escape (quoted AT parameters usually tolerate commas) or base64.
  String escapedPayload = String(payload);
  escapedPayload.replace("\"", "\\\"");
  escapedPayload.replace(",", "\\,");

  snprintf(cmd, sizeof(cmd), "AT+MQTTPUB=0,\"%s\",\"%s\",%d,0",
    topic, escapedPayload.c_str(), qos);

  String resp = sendATCommand(cmd, 8000);
  if (resp.indexOf("OK") >= 0) {
    totalMessagesSent++;
    return true;
  }
  totalMessagesFailed++;
  enqueueOffline(String(topic), String(payload));
  return false;
}

bool subscribeMQTTTopic(const char* topic) {
  char cmd[256];
  snprintf(cmd, sizeof(cmd), "AT+MQTTSUB=0,\"%s\",1", topic);
  String resp = sendATCommand(cmd, 5000);
  if (resp.indexOf("OK") >= 0) {
    Serial.printf("Subscribed: %s\n", topic);
    return true;
  }
  Serial.printf("Subscribe failed: %s\n", topic);
  return false;
}

void disconnectMQTT() {
  if (lteReady) sendAT("AT+MQTTCLEAN=0", "OK", 2000);
  mqttReady = false;
}

// ═══════════════════════════════════════════════════════════════════
// AT COMMAND HELPERS
// ═══════════════════════════════════════════════════════════════════
bool sendAT(const char* cmd, const char* expected, unsigned long timeout) {
  clearLTEResponseBuffer();
  lteSerial.println(cmd);
  unsigned long start = millis();
  while (millis() - start < timeout) {
    if (lteSerial.available()) {
      char c = lteSerial.read();
      if (lteResponseIndex < (int)sizeof(lteResponseBuffer) - 1) {
        lteResponseBuffer[lteResponseIndex++] = c;
        lteResponseBuffer[lteResponseIndex] = '\0';
      }
      if (strstr(lteResponseBuffer, expected)) return true;
    }
  }
  return false;
}

String sendATCommand(const char* cmd, unsigned long timeout) {
  clearLTEResponseBuffer();
  lteSerial.println(cmd);
  unsigned long start = millis();
  while (millis() - start < timeout) {
    while (lteSerial.available()) {
      char c = lteSerial.read();
      if (lteResponseIndex < (int)sizeof(lteResponseBuffer) - 1) {
        lteResponseBuffer[lteResponseIndex++] = c;
        lteResponseBuffer[lteResponseIndex] = '\0';
      }
    }
    delay(10);
  }
  return String(lteResponseBuffer);
}

void clearLTEResponseBuffer() {
  memset(lteResponseBuffer, 0, sizeof(lteResponseBuffer));
  lteResponseIndex = 0;
}

/**
 * Async UART reader (call every loop). Captures unsolicited messages:
 *   +MQTTSUBRECV: 0,"bus/command/BUS_MH001",42,{"command":"ping",...}
 */
void readLTEResponseAsync() {
  static char asyncBuf[512];
  static int idx = 0;

  while (lteSerial.available()) {
    char c = lteSerial.read();
    if (idx < (int)sizeof(asyncBuf) - 1) {
      asyncBuf[idx++] = c;
      asyncBuf[idx] = '\0';
    }
    if (c == '\n') {
      if (strstr(asyncBuf, "+MQTTSUBRECV:")) {
        Serial.printf("📩 %s", asyncBuf);
        handleIncomingCommand(asyncBuf);
      }
      idx = 0;
    }
  }
}

/**
 * Parse a command payload and act on it. Commands come from the backend:
 *   {"command":"ping"} | {"command":"reboot"} | {"command":"sos_reset"}
 *   {"command":"set_interval","intervalMs":5000} | buzzer_on | buzzer_off
 */
void handleIncomingCommand(char* buf) {
  if (strstr(buf, "\"command\":\"ping\"")) {
    publishStatusData("online");
  } else if (strstr(buf, "\"command\":\"reboot\"")) {
    Serial.println(F("Rebooting..."));
    delay(1000);
    ESP.restart();
  } else if (strstr(buf, "\"command\":\"sos_reset\"")) {
    sosActive = false;
    impactAlarm = false;
    publishStatusData("online");
    Serial.println(F("SOS reset by server"));
  } else if (strstr(buf, "\"command\":\"set_interval\"")) {
    long ms = extractNumber(buf, "intervalMs");
    if (ms >= 2000 && ms <= 60000) {
      setLocationInterval((unsigned long)ms);
    }
  } else if (strstr(buf, "\"command\":\"buzzer_on\"")) {
    buzzerOn = true;
  } else if (strstr(buf, "\"command\":\"buzzer_off\"")) {
    buzzerOn = false;
    impactAlarm = false;
  }
}

void setLocationInterval(unsigned long ms) {
  gLocationIntervalMs = ms;
  Serial.printf("Location interval set to %lu ms\n", ms);
}

/** Extract the first number following a JSON key, e.g. "intervalMs":5000. */
long extractNumber(const char* buf, const char* key) {
  char needle[64];
  snprintf(needle, sizeof(needle), "\"%s\":", key);
  const char* p = strstr(buf, needle);
  if (!p) return -1;
  p += strlen(needle);
  while (*p == ' ') p++;
  long val = 0;
  bool neg = false;
  if (*p == '-') { neg = true; p++; }
  while (*p >= '0' && *p <= '9') {
    val = val * 10 + (*p - '0');
    p++;
  }
  return neg ? -val : val;
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════
/** AT+CSQ cached for 30 s (avoid blocking every publish). Only reads the
 *  module when LTE is ready — otherwise returns the stale cached value so
 *  a dead module can never stall the main loop for 2 s. */
int getSignalStrengthCached() {
  if (lteReady && (millis() - lastCsqRead > 30000 || cachedCsq == 99)) {
    String resp = sendATCommand("AT+CSQ", 2000);
    int start = resp.indexOf("+CSQ: ");
    if (start >= 0) {
      cachedCsq = resp.substring(start + 6, resp.indexOf(',', start)).toInt();
    }
    lastCsqRead = millis();
  }
  return cachedCsq;
}

void updateLEDs() {
  static unsigned long lastBlink = 0;
  unsigned long interval = mqttReady ? 2000 : (lteReady ? 1000 : 500);
  if (millis() - lastBlink >= interval) {
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    lastBlink = millis();
  }
  digitalWrite(GPS_FIX_LED_PIN, currentGPS.hasFix ? HIGH : LOW);
}

/** Buzzer: solid 1 s cadence on SOS/impact, 2 s cadence on remote buzzer_on. */
void updateBuzzer() {
  static unsigned long lastToggle = 0;
  bool shouldBeep = buzzerOn || sosActive || impactAlarm;
  if (!shouldBeep) {
    digitalWrite(BUZZER_PIN, LOW);
    lastToggle = 0;
    return;
  }
  if (lastToggle == 0) {
    digitalWrite(BUZZER_PIN, HIGH);
    lastToggle = millis();
    return;
  }
  unsigned long interval = (sosActive || impactAlarm) ? 250 : 1000;
  if (millis() - lastToggle >= interval) {
    digitalWrite(BUZZER_PIN, !digitalRead(BUZZER_PIN));
    lastToggle = millis();
  }
}

void printSystemInfo() {
  Serial.println(F("\n── System Status ──────────────────────"));
  Serial.printf("Device:      %s\n", DEVICE_ID);
  Serial.printf("Firmware:    %s\n", FIRMWARE_VERSION);
  Serial.printf("Uptime:      %lu s\n", millis() / 1000);
  Serial.printf("GPS Fix:     %s (%d sats)\n", currentGPS.hasFix ? "YES" : "NO",
    currentGPS.satellites);
  if (currentGPS.hasFix) {
    Serial.printf("Position:    %.6f, %.6f\n", currentGPS.lat, currentGPS.lng);
    Serial.printf("Speed:       %.1f km/h\n", currentGPS.speed);
  }
  Serial.printf("Engine:      %.1f °C\n", engineTempC);
  Serial.printf("Battery:     %.2f V (%d%%)\n", batteryVoltage, estimateBatteryPercent(batteryVoltage));
  Serial.printf("Current:     %+.2f A\n", currentDraw);
  Serial.printf("IMU:         accel (%.2f, %.2f, %.2f) m/s²\n", accX, accY, accZ);
  Serial.printf("LTE:         %s\n", lteReady ? "Ready" : "Not Ready");
  Serial.printf("MQTT:        %s\n", mqttReady ? "Connected" : "Disconnected");
  Serial.printf("SOS:         %s\n", sosActive ? "🚨 ACTIVE" : "Inactive");
  Serial.printf("Queue:       %d/%d\n", queueCount, MAX_OFFLINE_QUEUE);
  Serial.printf("Sent/Fail:   %d / %d\n", totalMessagesSent, totalMessagesFailed);
  Serial.printf("Signal:      RSSI=%d\n", cachedCsq);
  Serial.println(F("────────────────────────────────────────\n"));
}
