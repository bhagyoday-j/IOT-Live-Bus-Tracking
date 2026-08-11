# Bill of Materials — SmartTransit IoT Device

Everything needed to build **one** in-bus IoT tracker. Costs are approximate
online prices (AliExpress/Amazon.in/ElectronicsComp, 2026) — shop around; bulk
prices drop ~30–40%. **≈ ₹3,200 / $38 per device** plus SIM card.

> 🔑 **Key decisions before buying**
> - **GPS:** NEO-M8N (u-blox, 72 channels, ~2.5 m accuracy, ₹600) is used in
>   this project's firmware. Cheaper NEO-6M (₹350) works with the same code.
> - **LTE:** A7670C (Cat-M1/NB-IoT, ₹1,050) has a **built-in MQTT client** and
>   low power. SIM800L (₹500) is cheaper but 2G is being shut down worldwide.
>   SIM7600 (₹2,400) is 4G Cat-1 + GNSS and works with the same AT-command style.
> - **SIM:** any Airtel / Jio / Vi IoT or regular data SIM with at least 100 MB
>   per month per bus (location every 5 s ≈ 8–10 MB/month per bus).

---

## Core modules

| # | Component | Purpose | Specs to look for | Qty | Est. cost |
|---|-----------|---------|-------------------|-----|-----------|
| 1 | **ESP32 DevKit V1** (WROOM-32E) | Main controller — runs firmware, reads all sensors, drives the LTE module | Dual-core 240 MHz, 4 MB flash, WiFi+BT, USB, 3.3 V logic, ≥ 2 free UARTs + I²C + 2 ADC1 pins | 1 | ₹450 / $6 |
| 2 | **NEO-M8N GPS module** (with ceramic patch antenna) | Live position, speed, heading, altitude, UTC time | u-blox NEO-M8N, 72-channel, UART @ 9600 baud, active antenna LNA, backup battery holder | 1 | ₹600 / $7 |
| 3 | **A7670C 4G LTE module** (Cat-M1/NB-IoT) | Cellular data + **built-in MQTT** (AT commands), no WiFi needed | SIMCom A7670C, Cat-M1/NB-IoT, UART @ 115200, PWRKEY + RESET pins, 2.8–4.2 V supply | 1 | ₹1,050 / $12 |
| 4 | **SIM card** (data plan) | Network identity for the LTE module | Any 4G IoT/prepaid SIM, APN like `internet`, `airtelgprs.com`, `jionet` | 1 | ₹150/mo |
| 5 | **MPU6050 breakout (GY-521)** | 6-axis IMU → accident detection (impact/rollover), harsh braking/turns, vibration | MPU6050, I²C (addr 0x68), 3.3–5 V, ±2…±16 g accel, ±250…±2000 °/s gyro | 1 | ₹150 / $2 |
| 6 | **DS18B20 waterproof probe** | Engine / radiator temperature for health monitoring | 1-Wire digital, −55…+125 °C, ±0.5 °C, stainless steel probe + 1 m cable, needs 4.7 kΩ pull-up | 1 | ₹120 / $1.5 |
| 7 | **ACS712 current sensor (30 A)** | Battery current draw for predictive maintenance | ACS712-30A, hall-effect (isolated), 66 mV/A sensitivity, VCC 3.3–5 V | 1 | ₹110 / $1.5 |
| 8 | **Voltage divider resistors** | Measure 12 V / 24 V bus battery voltage on the 3.3 V ADC | 33 kΩ + 10 kΩ (12 V bus) **or** 100 kΩ + 10 kΩ (24 V bus), 1% metal film, 1/4 W | 1 set | ₹10 |
| 9 | **SOS button** | Driver emergency panic button | Momentary, waterproof, panel-mount (16 mm or 22 mm), NO contact | 1 | ₹80 / $1 |

## Power & protection

| # | Component | Purpose | Specs | Qty | Est. cost |
|---|-----------|---------|-------|-----|-----------|
| 10 | **Buck converter (LM2596 / MP1584)** | 12–24 V vehicle power → stable 5 V for ESP32 + LTE | Input 4.5–28 V (LM2596) / 4.5–28 V (MP1584), output 5 V, ≥ 3 A, adjustable trimpot | 1 | ₹120 / $1.5 |
| 11 | **Blade fuse + holder (2 A)** | Protect the device from vehicle power spikes/shorts | 2 A auto blade fuse in inline holder on the +12/24 V line | 1 | ₹60 |
| 12 | **Schottky diode (e.g. 1N5819)** | Reverse-polarity protection on the vehicle supply | 1N5819 (1 A/40 V) or SS34 | 1 | ₹10 |
| 13 | **TVS diode (SMBJ24A)** | Clamp cranking/load-dump voltage spikes | Bidirectional 24 V TVS across the input | 1 | ₹20 |
| 14 | **AMS1117-3.3 regulator** *(optional)* | Clean 3.3 V for GPS + IMU (bypasses onboard regulator noise) | 3.3 V, 1 A LDO, TO-223 | 1 | ₹15 |
| 15 | **LTE external antenna** *(often included)* | Signal for the A7670C | 4G rubber-duck or PCB antenna, U.FL/SMA | 1 | ₹150 / $2 |
| 16 | **GPS active antenna** *(often included)* | Sky view for the NEO-M8N | 25×25 mm ceramic patch + LNA, U.FL/SMA, 3.3 V | 1 | ₹180 / $2 |

## Build & debug

| # | Component | Purpose | Specs | Qty | Est. cost |
|---|-----------|---------|-------|-----|-----------|
| 17 | LEDs (red + green) + 330 Ω resistors | Status & GPS-fix indicators | 5 mm diffused LEDs | 2–3 | ₹15 |
| 18 | Active buzzer (5 V) | Audible SOS/impact alarm | 5 V active (self-oscillating) buzzer | 1 | ₹25 |
| 19 | Dupont wires / hookup wire | Wiring | Male-female + male-male jumpers | 30 | ₹100 |
| 20 | Perfboard / protoboard or custom PCB | Mounting | 7×9 cm or custom | 1 | ₹50 |
| 21 | Weatherproof enclosure | Protection from vibration/dust/moisture | ABS project box ~150×100×60 mm, cable glands | 1 | ₹250 / $3 |
| 22 | Micro-USB cable | Flashing + debug | Data cable | 1 | ₹100 |
| 23 | Multimeter + soldering iron + wire strippers | Build & troubleshoot | — | — | — |

---

## Optional extras

| Component | Why |
|-----------|-----|
| **SSD1306 0.96" OLED (I²C)** | On-device debug display (GPS fix, RSSI, MQTT state). Shares GPIO21/22 with MPU6050. |
| **MicroSD card module** | Local logging of every GPS point (recovers data after no-network stretches). |
| **INA219 breakout** | Replaces ACS712 + voltage divider with a single I²C chip (high-side, 0–26 V, ±3.2 A). |
| **DS3231 RTC** | Battery-backed time so messages carry a real timestamp even before GPS fix. |
| **Second SOS button (passenger side)** | Extra emergency trigger; wire in parallel. |
| **MAX30102 heart-rate** *(over-engineering)* | Not needed — don't buy. |

---

## Where the money goes & scaling

- ~33% is the **LTE module + antenna**, ~19% the GPS, ~14% the ESP32. If you
  already have buses with WiFi coverage in depots, the LTE module can be dropped
  for a WiFi-only build (see `code/README.md` note) — but on the road you lose
  connectivity, so **LTE is strongly recommended**.
- Bulk order of 50 devices ≈ ₹2,200/unit. SIM data plans for 50 buses ≈ ₹7,500/mo.
