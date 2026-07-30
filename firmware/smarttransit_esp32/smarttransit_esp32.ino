/**
 * SmartTransit IoT Firmware - A7670C MQTT AT Commands Version
 * ESP32 + NEO-M8N GPS + A7670C LTE Module
 * 
 * Reads GPS every 5 seconds, publishes MQTT location data via A7670C AT commands
 * Supports reconnect, offline queue, and SOS alerts
 * 
 * Uses A7670C's built-in MQTT client via AT commands (AT+MQTTCONN, AT+MQTTPUB, etc.)
 * No WiFi or PubSubClient needed - the LTE module handles TCP/IP and MQTT natively.
 * 
 * Hardware:
 *   - ESP32 Development Board
 *   - NEO-M8N GPS Module (UART)
 *   - A7670C LTE Module (UART)
 *   - SIM Card with data plan
 * 
 * Connections:
 *   NEO-M8N GPS -> ESP32
 *   VCC         -> 3.3V
 *   GND         -> GND
 *   TX          -> GPIO16 (RX2)
 *   RX          -> GPIO17 (TX2)
 *   
 *   A7670C LTE  -> ESP32
 *   VCC         -> 5V
 *   GND         -> GND
 *   TX          -> GPIO18 (RX1)
 *   RX          -> GPIO19 (TX1)
 *   PWRKEY      -> GPIO4
 *   RESET       -> GPIO5
 * 
 *   LED Indicator -> GPIO2
 *   SOS Button    -> GPIO15 (pull-up)
 *   GPS Fix LED   -> GPIO12
 */

#include <Arduino.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// Device Identity - CHANGE THESE for each device
#define DEVICE_ID "BUS_MH001"
#define DEVICE_SECRET "bus_secret_123"
#define FIRMWARE_VERSION "1.0.0"

// MQTT Broker
#define MQTT_BROKER "192.168.1.100"       // EMQX broker IP
#define MQTT_PORT 1883
#define MQTT_USER "smarttransit"
#define MQTT_PASS "smarttransit_secret"
#define MQTT_TOPIC_LOCATION "bus/location/"
#define MQTT_TOPIC_STATUS "bus/status/"
#define MQTT_TOPIC_ALERT "bus/alert/"
#define MQTT_TOPIC_COMMAND "bus/command/"

// GPS Configuration
#define GPS_BAUD 9600
#define GPS_TX_PIN 16    // ESP32 RX2
#define GPS_RX_PIN 17    // ESP32 TX2
#define LOCATION_INTERVAL_MS 5000  // 5 seconds

// LTE Module Configuration
#define LTE_BAUD 115200
#define LTE_TX_PIN 18    // ESP32 RX1
#define LTE_RX_PIN 19    // ESP32 TX1
#define LTE_PWRKEY_PIN 4
#define LTE_RESET_PIN 5

// System pins
#define LED_PIN 2
#define SOS_BUTTON_PIN 15
#define GPS_FIX_LED_PIN 12

// Timing
#define SERIAL_BAUD 115200
#define MAX_OFFLINE_QUEUE 500
#define RECONNECT_DELAY_MS 5000
#define MAX_RECONNECT_ATTEMPTS 20
#define WATCHDOG_TIMEOUT_MS 60000

// ═══════════════════════════════════════════════════════════════════
// GLOBAL OBJECTS
// ═══════════════════════════════════════════════════════════════════

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);   // UART2 for NEO-M8N GPS
HardwareSerial lteSerial(1);   // UART1 for A7670C LTE

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

unsigned long lastLocationSend = 0;
unsigned long lastStatusSend = 0;
unsigned long lastGPSCheck = 0;
unsigned long deviceStartTime = 0;

bool lteReady = false;
bool mqttReady = false;
bool sosActive = false;
int reconnectAttempts = 0;
int totalMessagesSent = 0;
int totalMessagesFailed = 0;
char lteResponseBuffer[2048];
int lteResponseIndex = 0;

// ═══════════════════════════════════════════════════════════════════
// FORWARD DECLARATIONS
// ═══════════════════════════════════════════════════════════════════

bool initGPS();
bool initLTE();
bool powerOnLTE();
bool connectLTENetwork();
bool connectMQTTBroker();
bool publishMQTT(const char* topic, const char* payload, int qos);
bool subscribeMQTTTopic(const char* topic);
void processGPSData();
void checkSOSButton();
void enqueueOffline(const String& topic, const String& payload);
bool dequeueOffline(String& topic, String& payload);
void sendOfflineQueue();
void updateLEDs();
void printSystemInfo();
int getSignalStrength();
String buildLocationPayload();
String buildStatusPayload(const char* status);
String buildAlertPayload(const char* type, const char* message);
void clearLTEResponseBuffer();
String waitForLTEResponse(const char* expected, unsigned long timeout);

// ═══════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(SERIAL_BAUD);
  Serial.println(F("\n\n╔══════════════════════════════════════╗"));
  Serial.println(F("║  SmartTransit IoT v" FIRMWARE_VERSION " (A7670C MQTT)  ║"));
  Serial.println(F("╚══════════════════════════════════════╝"));
  Serial.printf("Device ID: %s\n", DEVICE_ID);

  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(GPS_FIX_LED_PIN, OUTPUT);
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LTE_PWRKEY_PIN, OUTPUT);
  pinMode(LTE_RESET_PIN, OUTPUT);
  
  digitalWrite(LED_PIN, LOW);
  digitalWrite(GPS_FIX_LED_PIN, LOW);
  digitalWrite(LTE_PWRKEY_PIN, LOW);
  digitalWrite(LTE_RESET_PIN, HIGH);

  deviceStartTime = millis();

  // Initialize GPS
  initGPS();

  // Initialize LTE module via AT commands
  if (!initLTE()) {
    Serial.println(F("WARNING: LTE module not responding. Will retry in loop."));
  }

  // Connect to LTE network
  if (lteReady && connectLTENetwork()) {
    // Connect MQTT broker
    connectMQTTBroker();
  }

  Serial.println(F("\n✓ Device initialized\n"));
}

// ═══════════════════════════════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════════════════════════════

void loop() {
  unsigned long now = millis();

  // ── Process GPS Data (1Hz) ──────────────────────────────────────
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
  if (now - lastGPSCheck >= 1000) {
    processGPSData();
    lastGPSCheck = now;
  }

  // ── Read async LTE responses ────────────────────────────────────
  readLTEResponseAsync();

  // ── Retry LTE connection if needed (every 30s) ──────────────────
  if (!lteReady && (now - lastStatusSend > 30000)) {
    Serial.println(F("Retrying LTE connection..."));
    if (initLTE() && connectLTENetwork()) {
      connectMQTTBroker();
    }
    lastStatusSend = now;
  }

  // ── Retry MQTT connection if LTE is up but MQTT is down ─────────
  if (lteReady && !mqttReady && (now - lastStatusSend > RECONNECT_DELAY_MS)) {
    Serial.println(F("Reconnecting MQTT..."));
    connectMQTTBroker();
    lastStatusSend = now;
  }

  // ── Publish Location (Every 5 seconds) ──────────────────────────
  if (now - lastLocationSend >= LOCATION_INTERVAL_MS) {
    if (currentGPS.hasFix) {
      // Only publish if position changed significantly (>10m)
      double dist = TinyGPSPlus::distanceBetween(
        lastPublishedGPS.lat, lastPublishedGPS.lng,
        currentGPS.lat, currentGPS.lng
      );

      if (dist > 0.01 || now - lastLocationSend > 30000) {
        publishLocationData();
        lastPublishedGPS = currentGPS;
      }
    } else {
      Serial.println(F("No GPS fix yet"));
    }
    lastLocationSend = now;
  }

  // ── Check SOS Button ────────────────────────────────────────────
  checkSOSButton();

  // ── Send Offline Queue ──────────────────────────────────────────
  if (mqttReady && queueCount > 0) {
    sendOfflineQueue();
  }

  // ── Status Update (Every 60 seconds) ────────────────────────────
  if (now - lastStatusSend >= 60000) {
    publishStatusData("online");
    printSystemInfo();
    lastStatusSend = now;
  }

  // ── Update LEDs ─────────────────────────────────────────────────
  updateLEDs();

  // ── Watchdog ────────────────────────────────────────────────────
  if (lteReady && !mqttReady && (now - deviceStartTime > WATCHDOG_TIMEOUT_MS)) {
    Serial.println(F("Watchdog: Resetting MQTT..."));
    disconnectMQTT();
    delay(1000);
    connectMQTTBroker();
    deviceStartTime = now;
  }
}

// ═══════════════════════════════════════════════════════════════════
// GPS INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

bool initGPS() {
  Serial.print(F("GPS (NEO-M8N): "));
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_TX_PIN, GPS_RX_PIN);
  Serial.println(F("OK"));
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// LTE MODULE (A7670C) - AT COMMAND DRIVER
// ═══════════════════════════════════════════════════════════════════

/**
 * Initialize LTE module and check basic AT communication
 */
bool initLTE() {
  Serial.print(F("LTE (A7670C): "));
  lteSerial.begin(LTE_BAUD, SERIAL_8N1, LTE_TX_PIN, LTE_RX_PIN);
  delay(500);

  // Power on the module
  powerOnLTE();
  delay(2000);

  // Check basic AT communication (up to 3 attempts)
  for (int i = 0; i < 3; i++) {
    if (sendAT("AT", "OK", 2000)) {
      lteReady = true;
      Serial.println(F("detected"));
      
      // Enable verbose error codes
      sendAT("AT+CMEE=2", "OK", 1000);
      
      // Set full functionality
      sendAT("AT+CFUN=1", "OK", 3000);
      
      // Set preferred network to LTE only
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

/**
 * Power on the A7670C module using PWRKEY pin
 */
bool powerOnLTE() {
  digitalWrite(LTE_RESET_PIN, HIGH);
  delay(100);
  
  // Pulse PWRKEY for 1.5 seconds
  digitalWrite(LTE_PWRKEY_PIN, HIGH);
  delay(1500);
  digitalWrite(LTE_PWRKEY_PIN, LOW);
  delay(3000);  // Wait for module to boot
  
  return true;
}

/**
 * Connect to LTE cellular network with SIM
 */
bool connectLTENetwork() {
  Serial.print(F("LTE Network: "));

  // Check SIM status
  String simResp = sendATCommand("AT+CPIN?", 5000);
  if (simResp.indexOf("READY") < 0 && simResp.indexOf("SIM PIN") < 0) {
    Serial.println(F("SIM error"));
    Serial.println(simResp);
    return false;
  }

  // Attach to network
  sendAT("AT+CGATT=1", "OK", 10000);

  // Configure PDP context (APN depends on SIM provider)
  // Common APNs: "internet", "airtelgprs.com", "jionet", "www"
  sendAT("AT+CGDCONT=1,\"IP\",\"internet\"", "OK", 3000);

  // Activate PDP context
  String pdpResp = sendATCommand("AT+CGACT=1,1", 15000);
  if (pdpResp.indexOf("OK") < 0) {
    Serial.println(F("PDP activation failed"));
    return false;
  }

  // Get IP address
  String ipResp = sendATCommand("AT+CGPADDR=1", 3000);
  int ipStart = ipResp.indexOf("+CGPADDR: 1,");
  if (ipStart >= 0) {
    int quote1 = ipResp.indexOf('"', ipStart);
    int quote2 = ipResp.indexOf('"', quote1 + 1);
    if (quote1 >= 0 && quote2 > quote1) {
      String ip = ipResp.substring(quote1 + 1, quote2);
      Serial.printf("Connected (IP: %s)\n", ip.c_str());
    } else {
      Serial.println(F("Connected"));
    }
  } else {
    Serial.println(F("Connected"));
  }

  int rssi = getSignalStrength();
  Serial.printf("Signal: RSSI=%d\n", rssi);

  return true;
}

/**
 * Connect to MQTT broker using A7670C built-in MQTT AT commands
 * 
 * A7670C MQTT AT commands:
 *   AT+MQTTCONN=<id>,"<host>",<port>[,"<user>","<pass>"][,<keepalive>]
 *   AT+MQTTPUB=<id>,"<topic>","<data>",<qos>,<retain>
 *   AT+MQTTSUB=<id>,"<topic>",<qos>
 *   AT+MQTTCONN?  - Check connection
 */
bool connectMQTTBroker() {
  if (!lteReady) return false;

  Serial.printf("MQTT %s:%d: ", MQTT_BROKER, MQTT_PORT);

  // Disconnect any existing MQTT session
  sendAT("AT+MQTTCLEAN=0", "OK", 2000);

  // Connect to MQTT broker: AT+MQTTCONN=<id>,"<host>",<port>,"<user>","<pass>",<keepalive>
  char cmd[256];
  snprintf(cmd, sizeof(cmd),
    "AT+MQTTCONN=0,\"%s\",%d,\"%s\",\"%s\",60",
    MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASS);

  String resp = sendATCommand(cmd, 15000);
  
  if (resp.indexOf("OK") >= 0) {
    mqttReady = true;
    reconnectAttempts = 0;
    Serial.println(F("Connected"));

    // Subscribe to command topic: AT+MQTTSUB=<id>,"<topic>",<qos>
    subscribeMQTTTopic((String(MQTT_TOPIC_COMMAND) + DEVICE_ID).c_str());

    // Publish online status
    publishStatusData("online");

    // Send offline queue if any
    if (queueCount > 0) {
      sendOfflineQueue();
    }

    return true;
  }

  Serial.printf("Failed: %s\n", resp.c_str());
  mqttReady = false;
  reconnectAttempts++;
  return false;
}

/**
 * Publish MQTT message using A7670C AT commands
 * 
 * AT+MQTTPUB=<id>,"<topic>","<data>",<qos>,<retain>
 */
bool publishMQTT(const char* topic, const char* payload, int qos = 1) {
  if (!mqttReady) {
    enqueueOffline(String(topic), String(payload));
    return false;
  }

  char cmd[2048];
  
  // Need to escape special characters in payload for AT command
  String escapedPayload = String(payload);
  escapedPayload.replace("\"", "\\\"");
  escapedPayload.replace(",", "\\,");
  
  snprintf(cmd, sizeof(cmd),
    "AT+MQTTPUB=0,\"%s\",\"%s\",%d,0",
    topic, escapedPayload.c_str(), qos);

  String resp = sendATCommand(cmd, 5000);
  
  if (resp.indexOf("OK") >= 0) {
    totalMessagesSent++;
    return true;
  }

  totalMessagesFailed++;
  enqueueOffline(String(topic), String(payload));
  return false;
}

/**
 * Subscribe to MQTT topic
 * AT+MQTTSUB=<id>,"<topic>",<qos>
 */
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

/**
 * Disconnect MQTT
 */
void disconnectMQTT() {
  if (lteReady) {
    sendAT("AT+MQTTCLEAN=0", "OK", 2000);
  }
  mqttReady = false;
}

// ═══════════════════════════════════════════════════════════════════
// GPS DATA PROCESSING
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

// ═══════════════════════════════════════════════════════════════════
// LOCATION PUBLISHING
// ═══════════════════════════════════════════════════════════════════

void publishLocationData() {
  String payload = buildLocationPayload();
  String topic = String(MQTT_TOPIC_LOCATION) + DEVICE_ID;

  if (publishMQTT(topic.c_str(), payload.c_str(), 1)) {
    if (totalMessagesSent % 10 == 0) {
      Serial.printf("📍 %.4f, %.4f | %.1f km/h | %d sats | Sent: %d\n",
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

void publishAlertData(const char* type, const char* message) {
  String payload = buildAlertPayload(type, message);
  String topic = String(MQTT_TOPIC_ALERT) + DEVICE_ID;
  publishMQTT(topic.c_str(), payload.c_str(), 2);
}

// ═══════════════════════════════════════════════════════════════════
// PAYLOAD BUILDERS
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
  json += "\"signal\":" + String(getSignalStrength()) + ",";
  json += "\"firmware\":\"" FIRMWARE_VERSION "\",";
  json += "\"timestamp\":" + String(millis());
  json += "}";
  return json;
}

String buildStatusPayload(const char* status) {
  String json = "{";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"status\":\"" + String(status) + "\",";
  json += "\"gpsFix\":" + String(currentGPS.hasFix ? "true" : "false") + ",";
  json += "\"satellites\":" + String(currentGPS.satellites) + ",";
  json += "\"signal\":" + String(getSignalStrength()) + ",";
  json += "\"sos\":" + String(sosActive ? "true" : "false") + ",";
  json += "\"queue\":" + String(queueCount) + ",";
  json += "\"uptime\":" + String(millis() / 1000) + ",";
  json += "\"sent\":" + String(totalMessagesSent) + ",";
  json += "\"failed\":" + String(totalMessagesFailed) + ",";
  json += "\"firmware\":\"" FIRMWARE_VERSION "\",";
  json += "\"timestamp\":" + String(millis());
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
  json += "\"timestamp\":" + String(millis());
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
    if (millis() - pressStart > 3000) {
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
// OFFLINE QUEUE
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
      snprintf(cmd, sizeof(cmd),
        "AT+MQTTPUB=0,\"%s\",\"%s\",1,0",
        topic.c_str(), payload.c_str());
      
      String resp = sendATCommand(cmd, 3000);
      if (resp.indexOf("OK") >= 0) {
        sent++;
        totalMessagesSent++;
      } else {
        enqueueOffline(topic, payload);  // Re-queue on failure
        break;
      }
    }
  }

  if (sent > 0) {
    Serial.printf("Replayed %d offline msgs. Queue: %d\n", sent, queueCount);
  }
}

// ═══════════════════════════════════════════════════════════════════
// AT COMMAND HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Send AT command and wait for expected response
 */
bool sendAT(const char* cmd, const char* expected, unsigned long timeout) {
  clearLTEResponseBuffer();
  lteSerial.println(cmd);
  
  unsigned long start = millis();
  while (millis() - start < timeout) {
    if (lteSerial.available()) {
      char c = lteSerial.read();
      if (lteResponseIndex < sizeof(lteResponseBuffer) - 1) {
        lteResponseBuffer[lteResponseIndex++] = c;
        lteResponseBuffer[lteResponseIndex] = '\0';
      }
      
      // Check if we have the expected response
      if (strstr(lteResponseBuffer, expected)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Send AT command and return full response
 */
String sendATCommand(const char* cmd, unsigned long timeout) {
  clearLTEResponseBuffer();
  lteSerial.println(cmd);
  
  unsigned long start = millis();
  while (millis() - start < timeout) {
    while (lteSerial.available()) {
      char c = lteSerial.read();
      if (lteResponseIndex < sizeof(lteResponseBuffer) - 1) {
        lteResponseBuffer[lteResponseIndex++] = c;
        lteResponseBuffer[lteResponseIndex] = '\0';
      }
    }
    delay(10);
  }
  
  return String(lteResponseBuffer);
}

/**
 * Read LTE response asynchronously (call in main loop)
 * Used to capture unsolicited MQTT messages
 */
void readLTEResponseAsync() {
  while (lteSerial.available()) {
    char c = lteSerial.read();
    
    // Check for incoming MQTT messages from subscribed topics
    // Format: +MQTTSUBRECV: <id>,"<topic>",<len>,<data>
    static char asyncBuf[256];
    static int idx = 0;
    
    if (idx < sizeof(asyncBuf) - 1) {
      asyncBuf[idx++] = c;
      asyncBuf[idx] = '\0';
    }
    
    if (c == '\n') {
      if (strstr(asyncBuf, "+MQTTSUBRECV:")) {
        Serial.printf("📩 %s", asyncBuf);
        // Parse and handle incoming commands here
        if (strstr(asyncBuf, "\"sos_reset\"")) {
          sosActive = false;
          publishStatusData("online");
          Serial.println(F("SOS reset by server"));
        } else if (strstr(asyncBuf, "\"reboot\"")) {
          Serial.println(F("Rebooting..."));
          delay(1000);
          ESP.restart();
        } else if (strstr(asyncBuf, "\"ping\"")) {
          publishStatusData("online");
        }
      }
      idx = 0;
    }
  }
}

void clearLTEResponseBuffer() {
  memset(lteResponseBuffer, 0, sizeof(lteResponseBuffer));
  lteResponseIndex = 0;
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════

int getSignalStrength() {
  String resp = sendATCommand("AT+CSQ", 2000);
  int start = resp.indexOf("+CSQ: ");
  if (start >= 0) {
    return resp.substring(start + 6, resp.indexOf(',', start)).toInt();
  }
  return 99;
}

void updateLEDs() {
  static unsigned long lastBlink = 0;
  unsigned long interval = mqttReady ? 2000 : (lteReady ? 1000 : 500);
  
  if (millis() - lastBlink >= interval) {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    lastBlink = millis();
  }
  
  digitalWrite(GPS_FIX_LED_PIN, currentGPS.hasFix ? HIGH : LOW);
}

void printSystemInfo() {
  Serial.println(F("\n── System Status ──────────────────────"));
  Serial.printf("Device:      %s\n", DEVICE_ID);
  Serial.printf("Firmware:    %s\n", FIRMWARE_VERSION);
  Serial.printf("Uptime:      %lu s\n", millis() / 1000);
  Serial.printf("GPS Fix:     %s (%d sats)\n", currentGPS.hasFix ? "YES" : "NO", currentGPS.satellites);
  if (currentGPS.hasFix) {
    Serial.printf("Position:    %.6f, %.6f\n", currentGPS.lat, currentGPS.lng);
    Serial.printf("Speed:       %.1f km/h\n", currentGPS.speed);
  }
  Serial.printf("LTE:         %s\n", lteReady ? "Ready" : "Not Ready");
  Serial.printf("MQTT:        %s\n", mqttReady ? "Connected" : "Disconnected");
  Serial.printf("SOS:         %s\n", sosActive ? "🚨 ACTIVE" : "Inactive");
  Serial.printf("Queue:       %d/%d\n", queueCount, MAX_OFFLINE_QUEUE);
  Serial.printf("Sent/Fail:   %d / %d\n", totalMessagesSent, totalMessagesFailed);
  Serial.printf("Signal:      RSSI=%d\n", getSignalStrength());
  Serial.println(F("────────────────────────────────────────\n"));
}
