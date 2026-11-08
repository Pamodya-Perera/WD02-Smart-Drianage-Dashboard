# Drain Monitor dashboard

Web dashboard for the WD-02 Smart Drainage Monitoring and Flood Detection System (IT1040, SLIIT).
React + Vite + TypeScript. It runs on a built-in simulator today and switches to Firebase Realtime
Database when the ESP32 side is ready.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

## Design

The dashboard is laid out like an engineer's drawing sheet rather than a card grid.

| Route | What it is |
|---|---|
| `/` Overview | A plain-language headline ("All quiet."), a drawing-sheet title block, and a section drawing of the prototype drain. The drawing shows the real hardware from the proposal: the ultrasonic sensor with its echo path, the rain sensor, the temperature probe, the solar pole, and the ESP32 box whose three LEDs and buzzer mirror the live status. Readings sit on it as dimension lines and callouts. Below it: recorder-paper chart, logbook, dimensions. |
| `/history` | 1h / 6h / 24h / 7d recorder chart with event pens (rain along the top edge, warning and critical along the bottom), summary, readings table, **Export CSV** for the section 5.13 analysis |
| `/alerts` | The logbook: every status change, rapid rise, blockage and connection loss, filterable by severity |
| `/device` | Spec sheet: connection, thresholds, notification settings, the Firebase data contract |

Type is Instrument Serif (headlines), Geist (text) and Geist Mono (readings). Night mode is the same sheet with dark paper.

## Demo simulator

Click **Simulator** in the header. Scenarios: Normal, Light rain, Heavy rain, Drain blockage, Wi-Fi drop.
Speed 1x / 5x / 20x, and a slider to set the water level directly. These line up with the
evaluation tests in the proposal (6.1 to 6.6).

The simulator has its own clock, which runs faster than real time at 5x and 20x. The header labels it
"Sim clock" so nobody mistakes it for real time.

Scenarios can also be launched by link:

```
/?scenario=heavy-rain&speed=20      scenarios: normal, light-rain, heavy-rain, blockage, wifi-drop
/?theme=light                       force light or dark theme
```

## Switching to Firebase

1. Create the Realtime Database and register a web app (Project settings > Your apps > Web).
2. Copy `.env.example` to `.env` and fill it in, with `VITE_DATA_SOURCE=firebase`.
3. Restart `npm run dev`.

Database layout the dashboard reads (also shown on the Device page):

```
/devices/drain-01
  latest/    waterLevel, distance, rainDetected, temperature, riseRate, status, blockage, timestamp
  history/   one pushed entry per reading, same fields
  config/    warningLevel, criticalLevel, rapidRiseRate, drainDepth, sensorHeight,
             blockageLevel, blockageHoldMin
```

- `status` is `NORMAL`, `WARNING` or `CRITICAL`. The ESP32 decides it, so the LEDs and buzzer work
  without Wi-Fi. The dashboard only displays it.
- `timestamp` is epoch milliseconds. Seconds are converted automatically, and a missing timestamp falls
  back to the time the reading arrived.
- `config` is optional. Defaults live in `src/data/site.ts`.
- History queries need an index. In the database rules:

```json
{
  "rules": {
    ".read": true,
    ".write": true,
    "devices": { "$id": { "history": { ".indexOn": "timestamp" } } }
  }
}
```

These rules are open for development. Lock them down before the final demo.

## Deploy

```
npm run build
npx firebase-tools deploy --only hosting
```

## Code map

```
src/data/      DataSource interface, mock + Firebase implementations
src/sim/       drain physics, scenarios, FirmwareModel (the ESP32's rules in software)
src/state/     DashboardProvider (live data, history, connection, toasts), alert derivation
src/charts/    DrainDrawing (the section drawing), LevelChart (recorder chart), hand-built SVG with d3-scale / d3-shape
src/views/     Overview, History, Alerts, Device
src/lib/       formatting, plain-language narration (narrate.ts), hooks
src/shell/     masthead and navigation, simulator drawer, toasts
```

`src/sim/firmwareModel.ts` is a reference for the firmware author: rise-rate window, status
thresholds with hysteresis, and the blockage rule.
