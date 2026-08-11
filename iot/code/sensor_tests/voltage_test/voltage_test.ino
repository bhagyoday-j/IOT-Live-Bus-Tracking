/**
 * Battery Voltage Test — resistive divider on GPIO35 (ADC1_CH7)
 *
 * Wiring (24 V bus shown; 12 V bus uses 33 kΩ + 10 kΩ):
 *
 *   battery (+) ──┬── [100 kΩ] ──┬──► GPIO35
 *                 │              │
 *                 │          [10 kΩ]──► GND
 *                 └── (measure with multimeter)
 *
 * Formula:  Vbattery = Vadc × (R1 + R2) / R2
 *   24 V bus: (100 kΩ + 10 kΩ) / 10 kΩ = 11.0   → set RATIO = 11.0
 *   12 V bus: ( 33 kΩ + 10 kΩ) / 10 kΩ =  4.3   → set RATIO = 4.3
 *
 * Verify: Serial Monitor @ 115200 prints the computed battery voltage.
 * Compare with a multimeter across the battery — should agree within
 * ~0.2–0.5 V (ESP32 ADC is not perfectly linear; adjust RATIO if needed).
 */

#define VOLTAGE_PIN           35
#define VOLTAGE_DIVIDER_RATIO 11.0f   // ← match your resistors!
#define SAMPLES               64

void setup() {
  Serial.begin(115200);
  Serial.printf("Divider ratio: %.2f (24 V bus → 11.0, 12 V bus → 4.3)\n",
    VOLTAGE_DIVIDER_RATIO);
}

void loop() {
  float mv = readAvgMv(VOLTAGE_PIN);
  float batteryV = (mv / 1000.0f) * VOLTAGE_DIVIDER_RATIO;

  // Rough state-of-charge for a 24 V lead-acid battery
  float pct = (batteryV - 22.0f) / (27.6f - 22.0f) * 100.0f;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;

  Serial.printf("ADC = %.0f mV | Battery = %.2f V | ~%d%% SOC\n",
    mv, batteryV, (int)pct);
  delay(1000);
}

float readAvgMv(int pin) {
  long sum = 0;
  for (int i = 0; i < SAMPLES; i++) {
    sum += analogRead(pin);
    delayMicroseconds(200);
  }
  return (sum / (float)SAMPLES) * (3300.0f / 4095.0f);
}
