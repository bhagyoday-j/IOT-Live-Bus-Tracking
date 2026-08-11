/**
 * A7670C LTE Module Test — AT commands, network attach, MQTT publish
 *
 * Wiring:
 *   A7670C VCC   -> 5 V (needs 2.8–4.2 V and ≥ 2 A peak; use the buck converter)
 *   A7670C GND   -> GND (thick wire)
 *   A7670C TX    -> GPIO18 (ESP32 RX1)
 *   A7670C RX    -> GPIO19 (ESP32 TX1)
 *   A7670C PWRKEY-> GPIO4
 *   A7670C RESET -> GPIO5 (HIGH = run)
 *   + SIM card with data plan + LTE antenna connected!
 *
 * Verify: Serial Monitor @ 115200 shows:
 *   1. "Module detected" (AT exchange)
 *   2. "SIM READY" (AT+CPIN?)
 *   3. "RSSI: N" with N > 5 (AT+CSQ — 0–31, 99 = no signal)
 *   4. "PDP OK" (AT+CGACT=1,1) and an IP address
 *   5. "MQTT CONNECTED" + "MQTT PUBLISHED"
 * Then watch the message on the broker (EMQX dashboard → Topics, or
 * mosquitto_sub -t 'test/#' -v).
 *
 * Edit the broker settings below to match backend/docker-compose.yml.
 */

#include <Arduino.h>
#include <HardwareSerial.h>

HardwareSerial lteSerial(1);

#define LTE_BAUD       115200
#define LTE_RX_PIN     18
#define LTE_TX_PIN     19
#define LTE_PWRKEY_PIN 4
#define LTE_RESET_PIN  5

// ── Broker settings (match backend .env / docker-compose) ──────────
#define MQTT_BROKER  "192.168.1.100"
#define MQTT_PORT    1883
#define MQTT_USER    "smarttransit"
#define MQTT_PASS    "smarttransit_secret"
// APN for your SIM: "internet", "airtelgprs.com", "jionet", "www" ...
#define APN          "internet"

char resp[2048];
int respIdx = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LTE_PWRKEY_PIN, OUTPUT);
  pinMode(LTE_RESET_PIN, OUTPUT);
  digitalWrite(LTE_PWRKEY_PIN, LOW);
  digitalWrite(LTE_RESET_PIN, HIGH);

  lteSerial.begin(LTE_BAUD, SERIAL_8N1, LTE_RX_PIN, LTE_TX_PIN);
  delay(500);

  Serial.println(F("\n=== A7670C bring-up test ==="));

  // Power on
  digitalWrite(LTE_PWRKEY_PIN, HIGH);
  delay(1500);
  digitalWrite(LTE_PWRKEY_PIN, LOW);
  delay(3000);

  if (!at("AT", "OK", 2000)) { Serial.println(F("✗ Module not responding")); return; }
  Serial.println(F("✓ Module detected"));

  at("AT+CMEE=2", "OK", 1000);
  at("AT+CFUN=1", "OK", 3000);
  at("AT+CNMP=38", "OK", 2000);    // LTE only
  at("AT+CMNB=1", "OK", 2000);     // Cat-M1

  // SIM
  String cp = atCommand("AT+CPIN?", 5000);
  if (cp.indexOf("READY") >= 0) Serial.println(F("✓ SIM READY"));
  else { Serial.printf("✗ SIM problem: %s\n", cp.c_str()); return; }

  // Signal
  String csq = atCommand("AT+CSQ", 2000);
  int s = csq.indexOf("+CSQ: ");
  if (s >= 0) Serial.printf("✓ RSSI: %s\n", csq.substring(s + 6, csq.indexOf(',', s)).c_str());
  else Serial.println(F("✗ No signal — check antenna and location"));

  // Network attach + PDP
  at("AT+CGATT=1", "OK", 10000);
  char apnCmd[64];
  snprintf(apnCmd, sizeof(apnCmd), "AT+CGDCONT=1,\"IP\",\"%s\"", APN);
  at(apnCmd, "OK", 3000);
  String pdp = atCommand("AT+CGACT=1,1", 15000);
  if (pdp.indexOf("OK") >= 0) Serial.println(F("✓ PDP context activated"));
  else { Serial.printf("✗ PDP failed: %s\n", pdp.c_str()); return; }

  String ip = atCommand("AT+CGPADDR=1", 3000);
  Serial.printf("IP: %s\n", ip.c_str());

  // MQTT
  char cmd[256];
  snprintf(cmd, sizeof(cmd), "AT+MQTTCONN=0,\"%s\",%d,\"%s\",\"%s\",60",
    MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASS);
  String mq = atCommand(cmd, 15000);
  if (mq.indexOf("OK") >= 0) Serial.println(F("✓ MQTT CONNECTED"));
  else { Serial.printf("✗ MQTT connect failed: %s\n", mq.c_str()); return; }

  snprintf(cmd, sizeof(cmd),
    "AT+MQTTPUB=0,\"test/hello\",\"{\\\"msg\\\":\\\"hello from A7670C\\\"}\",1,0");
  String pub = atCommand(cmd, 8000);
  if (pub.indexOf("OK") >= 0) Serial.println(F("✓ MQTT PUBLISHED (topic test/hello)"));
  else Serial.printf("✗ Publish failed: %s\n", pub.c_str());

  Serial.println(F("\nDone. If you saw ✓ all the way, the module is good to go."));
}

void loop() {
  // Print any unsolicited messages from the module
  while (lteSerial.available()) {
    Serial.write(lteSerial.read());
  }
}

// ── helpers ─────────────────────────────────────────────────────────
bool at(const char* cmd, const char* expected, unsigned long timeout) {
  String r = atCommand(cmd, timeout);
  return r.indexOf(expected) >= 0;
}

String atCommand(const char* cmd, unsigned long timeout) {
  clearBuf();
  lteSerial.println(cmd);
  unsigned long start = millis();
  while (millis() - start < timeout) {
    while (lteSerial.available()) {
      char c = lteSerial.read();
      if (respIdx < (int)sizeof(resp) - 1) {
        resp[respIdx++] = c;
        resp[respIdx] = '\0';
      }
    }
    delay(10);
  }
  return String(resp);
}

void clearBuf() {
  memset(resp, 0, sizeof(resp));
  respIdx = 0;
}
