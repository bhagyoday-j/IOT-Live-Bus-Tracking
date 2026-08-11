# Connection Guide — SmartTransit IoT Device

How to wire **one** complete tracker: ESP32 + NEO-M8N GPS + A7670C LTE +
MPU6050 + DS18B20 + ACS712 + voltage divider + SOS button + LEDs + buzzer.

**Read this entire document before soldering.** Work through it in order:
① Power → ② GPS → ③ LTE → ④ Sensors → ⑤ Switches/indicators → ⑥ First power-on.

> **Safety first**
> - The bus supply is **12 V or 24 V** — always disconnect it before wiring.
> - Fuse the positive line right where it enters the box (2 A blade fuse).
> - Double-check polarity with a multimeter before connecting anything.
> - Never connect 12/24 V directly to any module pin — only through the buck
>   converter (5 V) and the LDO (3.3 V).

---

## 1. System block diagram

```
                    Vehicle battery (+12 V / +24 V)
                              │
                        [2 A blade fuse]
                              │
                        [1N5819 diode] (reverse-polarity protection)
                              │
                       [SMBJ24A TVS]──┬──GND (chassis)
                              │
                     ┌────────▼────────┐
                     │  Buck converter  │  LM2596 / MP1584
                     │  set to 5.0 V    │  (≥ 3 A)
                     └───┬──────────┬───┘
                   5 V rail        GND rail
      ┌──────┬──────┬────┼────┬─────┬───────┐
      │      │      │    │    │     │       │
   ESP32  A7670C  ACS712 LED  Buzzer  [AMS1117-3.3]
   5V/VIN  VCC    VCC        5V      (optional)
                        │                     │
                        3.3 V rail            │
          ┌──────────────┼──────────┐         │
          │              │          │         │
      NEO-M8N        MPU6050    DS18B20(3.3V) GPS ant
        VCC             VCC        VCC
      (3.3 V)         (3.3 V)     (3.3 V)
```

- **5 V rail** feeds: ESP32 (VIN), A7670C (VCC), ACS712 (VCC), buzzer, LEDs (via resistors).
- **3.3 V rail** (from ESP32's onboard regulator, or a separate AMS1117-3.3 if
  you want clean power) feeds: NEO-M8N, MPU6050, DS18B20.
- **GND** is common across everything — star-point it back to the buck converter.

---

## 2. ESP32 DevKit V1 pin reference (the pins we use)

```
              ┌───────────────────────────┐
          EN  │ ● ┌─────┐ ●               │  (USB on left edge)
      GPIO36  │ ● │     │ ● GPIO22 (SCL)  │──► MPU6050 SCL
      GPIO39  │ ● │     │ ● GPIO21 (SDA)  │──► MPU6050 SDA / OLED SDA
      GPIO34  │ ● │     │ ● GPIO19 (TX1)  │──► A7670C RX        (LTE TX ←)
      GPIO35  │ ● │     │ ● GPIO18 (RX1)  │──► A7670C TX        (LTE RX →)
      GPIO32  │ ● │     │ ● GPIO5  (RST)  │──► A7670C RESET
      GPIO33  │ ● │     │ ● GPIO17 (TX2)  │──► GPS RX           (GPS RX ←)
      GPIO25  │ ● │     │ ● GPIO16 (RX2)  │──► GPS TX           (GPS TX →)
      GPIO26  │ ● │     │ ● GPIO4         │──► A7670C PWRKEY
      GPIO27  │ ● │     │ ● GPIO0  (boot) │
      GPIO14  │ ● │     │ ● GPIO2  (LED)  │──► status LED (onboard)
      GPIO12  │ ● │     │ ● GPIO15        │──► SOS button (IN)
      GPIO13  │ ● │     │ ● GPIO3 (RX0)   │
      GPIO9   │ ● │     │ ● GPIO1 (TX0)   │
              └─┬───────┴─┬───────────────┘
                GND       VIN (5 V in)
```

> **Critical pin notes**
> - **GPIO34/35 are ADC1, input-only** — use them for ACS712 + battery voltage.
>   Never use ADC2 (GPIO12/13/14/25/26/27) for analog reads while WiFi is active.
> - **GPIO12 is a strapping pin (MTDI)** — it must not be held high at boot.
>   We avoid it entirely (GPS-fix LED moved to GPIO27).
> - **UART1 default pins (GPIO9/10) are shared with the flash** — the firmware
>   remaps UART1 to RX=GPIO18 / TX=GPIO19.
> - GPIO36/39 (ADC1_CH0/CH3) are also available if you add more analog sensors.

---

## 3. Wiring table (complete)

### 3.1 NEO-M8N GPS → ESP32 (UART2 @ 9600 baud)

| NEO-M8N pin | ESP32 pin | Wire colour (suggested) |
| ----------- | --------- | ----------------------- |
| VCC         | 3.3 V     | red                     |
| GND         | GND       | black                   |
| TX          | GPIO16 (RX2) | green                |
| RX          | GPIO17 (TX2) | yellow               |

- The active antenna (ceramic patch) plugs into the module's U.FL/SMA connector.
- Do **not** power the GPS from 5 V — the module and its backup battery are 3.3 V.

### 3.2 A7670C LTE → ESP32 (UART1 @ 115200 baud)

| A7670C pin | ESP32 pin | Notes |
| ---------- | --------- | ----- |
| VCC        | 5 V       | Needs 2.8–4.2 V *and* ≥ 2 A peak — the 5 V rail through its onboard regulator |
| GND        | GND       | Use a thick wire (transmit bursts draw ~1 A) |
| TX         | GPIO18 (RX1) | Module transmit → ESP32 receive |
| RX         | GPIO19 (TX1) | Module receive ← ESP32 transmit |
| PWRKEY     | GPIO4     | Firmware pulses this HIGH for 1.5 s to boot the module |
| RESET      | GPIO5     | HIGH = normal run (leave floating is risky; tie to GPIO5) |

> ⚠️ **Do NOT connect the A7670C's 3.3 V UART to 5 V logic.** ESP32 GPIO is
> 3.3 V so this is fine here. If you ever use an Arduino Uno (5 V), add a
> level shifter on the TX line.

### 3.3 MPU6050 → ESP32 (I²C)

| MPU6050 (GY-521) pin | ESP32 pin |
| -------------------- | --------- |
| VCC                  | 3.3 V     |
| GND                  | GND       |
| SDA                  | GPIO21    |
| SCL                  | GPIO22    |
| AD0                  | GND       | (keeps address 0x68 — default in firmware) |
| INT                  | *(leave unconnected)* |

### 3.4 DS18B20 → ESP32 (1-Wire)

| DS18B20 wire | ESP32 pin |
| ------------ | --------- |
| Red (VDD)    | 3.3 V     |
| Black (GND)  | GND       |
| Yellow (DQ)  | GPIO13    |

- **You must add a 4.7 kΩ pull-up resistor** from GPIO13 to 3.3 V (the Dallas
  library can enable one internally, but a physical resistor is more reliable).

### 3.5 ACS712 (30 A) → ESP32

| ACS712 pin | Connection |
| ---------- | ---------- |
| VCC        | **3.3 V** (see note) |
| GND        | GND       |
| OUT        | GPIO34 (ADC1_CH6) |
| IP+ / IP−  | In series with the battery positive wire (the big terminals) |

> **Why 3.3 V for the ACS712?** The ESP32 ADC only reads 0–3.3 V. With VCC=5 V
> the output sits at 2.5 V (0 A) — out of range. Powered from 3.3 V, the output
> is 1.65 V at 0 A and stays inside 0.3–3.0 V for ±20 A. The ACS712 is
> hall-effect isolated, so measuring a high-current wire from a 3.3 V supply is
> perfectly safe. (Alternative: 5 V supply + 2:1 divider on OUT, with calibration.)
> - Calibrate the 0-A offset in firmware at startup (sensors may be on/off).

### 3.6 Battery voltage divider → ESP32

For a **24 V bus** (or **12 V**):

```
 battery (+) ──┬── [100 kΩ (or 33 kΩ for 12 V)] ──┬──► GPIO35 (ADC1_CH7)
               │                                  │
               │                             [10 kΩ]──► GND
               └── (measure here with multimeter)
```

- Formula: `Vbattery = Vadc × (R1 + R2) / R2` → 24 V: ×11.0 · 12 V: ×4.3.
- Keep resistor values ≥ 10 kΩ so the divider drains < 2 mA.
- The firmware's `VOLTAGE_DIVIDER_RATIO` in `config.h` must match your resistors.

### 3.7 SOS button, LEDs, buzzer

| Item | Pin | Wiring |
| ---- | --- | ------ |
| SOS button (NO) | GPIO15 | One leg → GPIO15, other leg → GND. Firmware enables the internal pull-up (INPUT_PULLUP), so no resistor needed. |
| Status LED | GPIO2  | Anode → GPIO2 via 330 Ω, cathode → GND (onboard LED already has a resistor). |
| GPS-fix LED | GPIO27 | Anode → GPIO27 via 330 Ω, cathode → GND. |
| Buzzer (active) | GPIO14 | Positive → GPIO14, negative → GND. |

---

## 4. Step-by-step build sequence

1. **Power first.** Set the buck converter output to 5.0 V *before* connecting
   anything to it: connect fuse → diode → TVS → buck input from a bench supply
   (or carefully from the battery), then adjust the trimpot while measuring with
   a multimeter. Lock it with a drop of nail polish/glue.
2. **ESP32 on the board.** Solder female headers; test with a blink sketch via USB.
3. **GPS.** Wire NEO-M8N, plug in the antenna (face up, clear of metal), flash
   `sensor_tests/gps_test`, confirm a fix outdoors.
4. **LTE.** Wire A7670C + insert SIM, flash `sensor_tests/a7670c_test`, confirm
   `+CSQ` signal, PDP context and an MQTT publish to your broker.
5. **Sensors.** Wire MPU6050, DS18B20, ACS712, voltage divider — flash each test
   sketch in `code/sensor_tests/` and confirm sane readings.
6. **Buttons/indicators.** Wire SOS, LEDs, buzzer; test with `sos_button_test`.
7. **Full integration.** Flash `code/smarttransit_esp32/`, power from the vehicle,
   and watch the backend / EMQX dashboard receive `bus/location/BUS_*` messages.
8. **Box it up.** Mount the antenna high and away from metal, GPS antenna face-up
   on/near the roof line, add strain relief, close the enclosure.

---

## 5. Antenna & mechanical placement (very important for GPS + LTE)

| Item | Rule |
| ---- | ---- |
| GPS antenna | Top surface of the bus, at least 30 cm from the LTE antenna and metal racks. Patch faces up (toward sky). |
| LTE antenna | Vertical, ≥ 30 cm from GPS antenna, away from the ECU and fuse box. |
| Separation | Keep GPS and LTE antennas ≥ 30 cm apart, or the LTE transmitter will desensitize GPS. |
| Enclosure | Plastic (ABS) — a metal box blocks GPS and LTE completely. |
| Cabling | Route away from ignition coils / high-current cables. |

---

## 6. First power-on checklist

- [ ] Multimeter: buck output = 5.0 V, no voltage on 3.3 V rail before ESP32 boots.
- [ ] ESP32 boots (USB serial shows the SmartTransit banner at 115200 baud).
- [ ] GPS LED turns on within 5 min outdoors (firmware `GPS_FIX_LED` GPIO27).
- [ ] Serial log shows `LTE (A7670C): detected`, `MQTT: Connected`.
- [ ] EMQX dashboard (`http://<host>:18083`, admin/public) shows the device client.
- [ ] Backend log shows `Subscribed to MQTT topic: bus/location/+` and then
      `MQTT received: bus/location/BUS_MH001`.
- [ ] Hold SOS for 3 s → buzzer sounds, red alert appears in the frontend.
- [ ] Simulate an impact (> 3 g) by tapping the MPU6050 → automatic accident alert.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| ESP32 won't boot / brownout | 5 V sag under LTE TX bursts | Add a 470–1000 µF cap on 5 V; use thicker wires; check buck current rating. |
| `LTE (A7670C): not responding` | Module not powered, wrong UART pins, PWRKEY wiring | Check 5 V + GND, verify TX/RX are crossed, confirm PWRKEY→GPIO4. |
| `AT+CSQ` returns 99 | No SIM / no network / antenna unplugged | Check SIM seating, APN, antenna, `AT+CPIN?` → READY. |
| GPS never gets a fix | Antenna not facing sky / metal nearby / in building | Go outdoors, wait 3–5 min (cold start), check antenna connection. |
| Voltage reads 0.0 | Divider not connected or on wrong pin | Verify GPIO35 + ratio in `config.h`. |
| Current reads wrong | 0-A offset drifted / wrong ACS712 variant | Re-run 0-A calibration; verify sensitivity (30 A → 66 mV/A). |
| Backend ignores messages | Device ID not registered on a Bus | Create the bus with `deviceId: BUS_MH001` (or whatever ID the device uses). |
| ADC values noisy/jumpy | Ground bounce, long wires | Star-point grounds, add 0.1 µF decoupling caps at each module, average in firmware. |
