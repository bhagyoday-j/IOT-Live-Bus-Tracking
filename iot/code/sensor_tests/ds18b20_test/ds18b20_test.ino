/**
 * DS18B20 Test — waterproof engine temperature probe
 *
 * Wiring:
 *   Red (VDD)   -> 3.3 V
 *   Black (GND) -> GND
 *   Yellow (DQ) -> GPIO13  (+ 4.7 kΩ pull-up from GPIO13 to 3.3 V!)
 *
 * Verify: Serial Monitor @ 115200 prints the probe temperature every
 * second. Touch the probe tip — the reading should follow. Expect
 * 0.25 °C resolution and ±0.5 °C accuracy.
 *
 * Libraries: OneWire, DallasTemperature
 */

#include <OneWire.h>
#include <DallasTemperature.h>

#define DS18B20_PIN 13

OneWire oneWire(DS18B20_PIN);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(115200);
  sensors.begin();
  sensors.setResolution(10);   // 0.25 °C, faster conversion

  int count = sensors.getDeviceCount();
  Serial.printf("DS18B20 devices found: %d\n", count);
  if (count == 0) {
    Serial.println(F("⚠ No device — check wiring AND the 4.7 kΩ pull-up resistor."));
  }
}

void loop() {
  sensors.requestTemperatures();          // blocking (~187 ms @ 10-bit)
  float c = sensors.getTempCByIndex(0);

  if (c == DEVICE_DISCONNECTED_C || c < -50.0f) {
    Serial.println(F("⚠ Sensor error / disconnected"));
  } else {
    Serial.printf("Engine temperature: %.2f °C (%.2f °F)\n", c, c * 9.0 / 5.0 + 32.0);
  }
  delay(1000);
}
