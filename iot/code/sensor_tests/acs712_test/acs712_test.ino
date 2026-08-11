/**
 * ACS712 Test — 30 A hall-effect current sensor
 *
 * Wiring:
 *   VCC -> 3.3 V      (NOT 5 V — see note below)
 *   GND -> GND
 *   OUT -> GPIO34     (ADC1_CH6, input-only pin)
 *   IP+ / IP-  -> series with the load's positive wire (the big terminals)
 *
 * Why 3.3 V? The ESP32 ADC reads 0–3.3 V. At 5 V supply the sensor idles
 * at 2.5 V (out of range); at 3.3 V it idles at 1.65 V and stays inside
 * range for ±20 A. The ACS712 is isolated (hall-effect), so it safely
 * measures a high-current wire from a 3.3 V supply.
 *
 * Verify: Serial Monitor @ 115200 prints the zero offset first, then the
 * live current. With nothing connected through the terminals it should
 * read ~0 A (within ±0.5 A noise). Turn a fan/bulb through it to see a
 * real reading.
 *
 * Sensitivity: 30 A variant → 66 mV/A (20 A → 100 mV/A, 5 A → 185 mV/A).
 */

#define ACS712_PIN          34
#define ACS712_SENSITIVITY  0.066f   // V/A for the 30 A variant
#define SAMPLES             64

float zeroOffsetV = 1.65f;   // midpoint at 3.3 V supply

void setup() {
  Serial.begin(115200);

  // Calibrate zero-current offset (keep the load OFF during this read)
  zeroOffsetV = readAvgMv(ACS712_PIN) / 1000.0f;
  Serial.printf("Zero-current offset: %.3f V\n", zeroOffsetV);
  Serial.println(F("Now connect a load through the IP+ / IP- terminals."));
}

void loop() {
  float mv = readAvgMv(ACS712_PIN);
  float current = (mv / 1000.0f - zeroOffsetV) / ACS712_SENSITIVITY;
  Serial.printf("OUT = %.3f V | Current = %+.2f A\n", mv / 1000.0f, current);
  delay(500);
}

float readAvgMv(int pin) {
  long sum = 0;
  for (int i = 0; i < SAMPLES; i++) {
    sum += analogRead(pin);
    delayMicroseconds(200);
  }
  return (sum / (float)SAMPLES) * (3300.0f / 4095.0f);
}
