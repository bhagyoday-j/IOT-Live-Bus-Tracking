/**
 * GPS Test — NEO-M8N (or NEO-6M/7M)
 *
 * Wiring:
 *   NEO-M8N VCC -> 3.3 V
 *   NEO-M8N GND -> GND
 *   NEO-M8N TX  -> GPIO16 (ESP32 RX2)
 *   NEO-M8N RX  -> GPIO17 (ESP32 TX2)
 *   (active antenna connected to the module's U.FL/SMA connector)
 *
 * Verify: Serial Monitor @ 115200 prints raw NMEA activity immediately,
 * then a fix (lat/lng/sats) within ~1–5 min outdoors. Indoors it may
 * never fix — hold it near a window.
 *
 * Library: TinyGPSPlus
 */

#include <TinyGPS++.h>
#include <HardwareSerial.h>

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);   // UART2

#define GPS_BAUD   9600
#define GPS_RX_PIN 16          // ESP32 RX2  <- GPS TX
#define GPS_TX_PIN 17          // ESP32 TX2  -> GPS RX
#define FIX_LED_PIN 27         // optional LED, on = fix

unsigned long lastPrint = 0;

void setup() {
  Serial.begin(115200);
  pinMode(FIX_LED_PIN, OUTPUT);
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println(F("GPS test starting — waiting for NMEA..."));
}

void loop() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  digitalWrite(FIX_LED_PIN, gps.location.isValid() ? HIGH : LOW);

  // Print once per second
  if (millis() - lastPrint >= 1000) {
    lastPrint = millis();

    if (gps.charsProcessed() == 0) {
      Serial.println(F("⚠ No NMEA data — check TX/RX wiring and baud rate."));
      return;
    }

    Serial.printf("Sats: %2d | ", gps.satellites.value());
    if (gps.location.isValid()) {
      Serial.printf("Lat: %.6f | Lng: %.6f | Speed: %.1f km/h | Course: %.1f° | Alt: %.1f m | HDOP: %.1f\n",
        gps.location.lat(), gps.location.lng(),
        gps.speed.kmph(), gps.course.deg(), gps.altitude.meters(), gps.hdop.hdop());
      Serial.printf("UTC: %04d-%02d-%02d %02d:%02d:%02d\n",
        gps.date.year(), gps.date.month(), gps.date.day(),
        gps.time.hour(), gps.time.minute(), gps.time.second());
    } else {
      Serial.println(F("...no fix yet (need ≥ 3 satellites)"));
    }
  }
}
