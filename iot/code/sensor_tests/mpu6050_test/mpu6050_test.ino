/**
 * MPU6050 Test — 6-axis accelerometer + gyroscope (GY-521)
 *
 * Wiring:
 *   VCC -> 3.3 V    GND -> GND
 *   SDA -> GPIO21   SCL -> GPIO22
 *   AD0 -> GND (address 0x68)
 *
 * Verify: Serial Monitor @ 115200. At rest, acceleration should read
 * ~(0, 0, 9.8) m/s² (gravity on Z) and gyro ~(0, 0, 0) °/s.
 * A hard tap on the board should make the resultant magnitude spike
 * above 30 m/s² (the backend's accident threshold).
 *
 * Library: MPU6050_tockn
 */

#include <Wire.h>
#include <MPU6050_tockn.h>

MPU6050 mpu6050(Wire);

unsigned long lastPrint = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  mpu6050.begin();
  Serial.println(F("Calibrating gyro offsets (keep board still, ~5 s)..."));
  mpu6050.calcGyroOffsets(true);
  Serial.println(F("MPU6050 ready"));
}

void loop() {
  mpu6050.update();   // must be called frequently

  if (millis() - lastPrint >= 500) {
    lastPrint = millis();

    float ax = mpu6050.getAccX();
    float ay = mpu6050.getAccY();
    float az = mpu6050.getAccZ();
    float magnitude = sqrt(ax * ax + ay * ay + az * az);

    // Vibration RMS (gravity excluded on Z) — same formula as backend
    float azc = fabs(az) - 9.81f;
    if (azc < 0) azc = 0;
    float vibration = sqrt(ax * ax + ay * ay + azc * azc);

    Serial.printf("accel (%7.2f, %7.2f, %7.2f) m/s² | mag %6.2f | ",
      ax, ay, az, magnitude);
    Serial.printf("gyro (%7.2f, %7.2f, %7.2f) °/s | temp %6.2f °C | vib %5.2f\n",
      mpu6050.getGyroX(), mpu6050.getGyroY(), mpu6050.getGyroZ(),
      mpu6050.getTempC(), vibration);

    if (magnitude >= 30.0f) {
      Serial.println(F("🚨 IMPACT DETECTED (≥ 30 m/s²)"));
    }
  }
}
