/**
 * SOS Button + LEDs + Buzzer Test
 *
 * Wiring:
 *   SOS button  -> GPIO15, other leg to GND (internal pull-up used)
 *   Status LED  -> GPIO2  via 330 Ω (onboard LED already has a resistor)
 *   GPS fix LED -> GPIO27 via 330 Ω
 *   Buzzer      -> GPIO14 (active buzzer, + to GPIO14, − to GND)
 *
 * Verify: Serial Monitor @ 115200.
 *   - Short press  (< 3 s): prints "short press" (ignored, as in firmware).
 *   - Hold 3 s     : SOS toggles — buzzer beeps fast, status LED blinks,
 *                    "🚨 SOS ACTIVE" / "✅ SOS CLEARED" printed.
 *
 * This replicates the exact debounce + 3 s hold logic used in the firmware.
 */

#define SOS_BUTTON_PIN 15
#define STATUS_LED_PIN 2
#define GPS_FIX_LED_PIN 27
#define BUZZER_PIN 14
#define SOS_HOLD_MS 3000

bool sosActive = false;

void setup() {
  Serial.begin(115200);
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(GPS_FIX_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  Serial.println(F("Hold the button 3 s to toggle SOS. GPS LED stays on."));
  digitalWrite(GPS_FIX_LED_PIN, HIGH);   // simulate "GPS fix"
}

void loop() {
  checkButton();
  updateBuzzer();
  digitalWrite(STATUS_LED_PIN, sosActive ? HIGH : (millis() % 1000 < 100));
}

/** Same 50 ms debounce + 3 s hold logic as the production firmware. */
void checkButton() {
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
        Serial.println(F("🚨 SOS ACTIVE"));
      } else {
        Serial.println(F("✅ SOS CLEARED"));
      }
    } else {
      Serial.printf("short press (%lu ms) — ignored\n",
        millis() - pressStart);
    }
  }
  lastState = state;
}

void updateBuzzer() {
  static unsigned long lastToggle = 0;
  if (!sosActive) {
    digitalWrite(BUZZER_PIN, LOW);
    lastToggle = 0;
    return;
  }
  if (lastToggle == 0) {
    digitalWrite(BUZZER_PIN, HIGH);
    lastToggle = millis();
    return;
  }
  if (millis() - lastToggle >= 250) {   // fast beep pattern while SOS
    digitalWrite(BUZZER_PIN, !digitalRead(BUZZER_PIN));
    lastToggle = millis();
  }
}
