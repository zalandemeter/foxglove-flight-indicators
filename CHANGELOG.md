# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Gauge** panel — generic single-needle center-pivot gauge with fully dynamic markings; all single-gauge panels (Tachometer, Airspeed) are thin wrappers supplying default config to the shared `createGaugePanel` factory
- **Tachometer** panel — 0–8000 RPM with 9 ticks (0–8 × 1000), green/yellow/red zones, dynamic labels "RPM" / "x 1000"
- **Airspeed** panel — 0–160 km/h with 9 ticks, green/yellow/red zones, detailed sub-ticks, dynamic labels "AIRSPEED" / "KM/H"
- **Dual Gauge** panel — generic dual-needle gauge with fully configurable data pipeline and display; all dual-gauge panels are thin wrappers supplying default config to the shared `createDualGaugePanel` factory
- **Dual Tachometer** panel — helicopter-style split tachometer (engine % RPM left, rotor % RPM right); defaults: 5800 RPM engine / 600 RPM rotor, 50–110% display range
- **Dual Fuel Gauge** panel — left/right tank quantity gauge; normalizes raw kg values (0–50) to 0–1 display range with E / ½ / F tick labels and red/yellow/green zones
- **Dual Oil Gauge** panel — oil temperature (°C, left) and oil pressure (PSI, right) with custom tick positions and color zones matching typical limits
- `gauge_mechanics.svg` — blank gauge face (dark circle) for all single-gauge panels; face markings are now fully dynamic
- `instrumentShared.ts` — shared module extracting `drawTickLines`, `drawColorArcs`, `buildZones`, `makeZoneChildren`, expression helpers (`applyExpr`, `exprError`), and tick/zone validation from DualGauge into a common module used by Gauge, DualGauge, and Heading Indicator

#### Single Gauge configurable features
- **Data**: optional expression transform (`x`-variable, powered by `expr-eval`), optional normalization with configurable input/output range, clamping with configurable min/max (clamp range defines display range)
- **Display**: tick count (0–20), tick precision, custom tick positions/labels (csv), sub-ticks (None / Simple / Detailed), up to 7 color arc zones, full circle toggle (360° vs 320° sweep)
- **Labels**: configurable top and bottom text

#### Heading Indicator configurable features
- **Input mode** select: Scalar angle or Quaternion (x, y, z, w as four independent message paths — no schema coupling, works with any field names)
- **Unit**: Degrees or Radians (scalar mode); quaternion yaw is derived via `atan2(2(wz+xy), 1−2(y²+z²))`
- **Expression transform** (`x`-variable, powered by `expr-eval`): subsumes offset, direction flip (`-x`), and reverse (`x + 180`) into one field. `x` is always degrees post-unit-conversion / post-yaw-extraction so expressions behave identically across modes
- **Staleness Check** toggle (default on)

#### Staleness detection (all panels)
- `STALE_TIMEOUT_SEC` (1s) and `STALE_STYLE` (opacity + grayscale) exported from `useInstrumentPanel`
- `isStale(path)` returns true when the path is empty/unparseable, no message has arrived, or the last `receiveTime` is >1s older than `renderState.currentTime` (falls back to `Date.now()` when playback time is unavailable)
- Every panel's General section gains a "Staleness Check" boolean (default on)
- For multi-topic panels, the fade only triggers when **all** subscribed paths are stale — if at least one is delivering fresh data, the panel stays vibrant

#### Dual Gauge configurable features
- **Data** sub-node per side: optional expression transform (`x`-variable, powered by `expr-eval`), optional normalization with configurable input and output range, always-on clamping with configurable min/max (clamp range also defines the display range)
- **Display** sub-node per side: tick count, tick precision, custom tick positions (csv, must match tick count), custom tick labels (csv, must match tick count), sub-ticks (None / Simple / Detailed), up to 7 color arc zones
- **Labels**: top, bottom (csv — 1 value centered, 2 values split left/right), left/right labels with optional vertical character stacking and length-aware font scaling

### Changed

- `ensureCss` in `BundledFlightIndicators.ts` is now exported so new instrument components can share the single CSS injection guard
- Sub-ticks changed from boolean toggle to 3-mode select: None, Simple (1 mid-tick), Detailed (3 ticks: short/medium/short at ¼, ½, ¾)
- Maximum color zones increased from 5 to 7 for all gauge types
- `toDataUrl` and `mirrorSvgX` moved from `BundledFlightIndicators.ts` to `utils.ts` for reuse
- Tachometer and Airspeed panels no longer use baked-in SVG face markings; all ticks, labels, and zones are now rendered dynamically and fully configurable through settings
- SVG text labels ("RPM", "× 1000", "AIRSPEED", "KM / H") removed from `tachometer_mechanics.svg` and `speed_mechanics.svg`; replaced by dynamic top/bottom label settings
- Color arc rendering now correctly handles arcs spanning >180° (large-arc flag) and full 360° arcs (two-semicircle fallback)
- `gaugeShared.ts` renamed to `instrumentShared.ts` — module is no longer gauge-specific now that Heading Indicator consumes `applyExpr` / `exprError` from it; contents unchanged, four importers updated
- `useInstrumentPanel` now tracks `receiveTime` per topic and watches `renderState.currentTime` to power staleness detection; return type additively exposes `isStale(path)`

### Fixed

- Tick and arc positioning on single gauges: added 180° offset to align cos/sin placement with CSS needle rotation (needle SVG points left)
- Division by zero when tick count is 1 (`i / (count - 1)` guard)
- Full-circle mode: first tick label hidden when it would overlap the last at 12 o'clock

---

## [1.0.0] - 2026-04-03

Initial public release.

### Added

- **Airspeed Indicator** panel — displays indicated airspeed (0–160 KIAS)
- **Altimeter** panel — three-pointer altimeter with QNH Kollsman window (altitude in ft, pressure in hPa)
- **Attitude Indicator** panel — gyroscopic horizon with pitch and roll inputs
- **Heading Indicator** panel — directional gyro compass rose with automatic [0°, 360°) normalization
- **Turn Coordinator** panel — turn-and-bank needle clamped to ±20° standard-rate deflection
- **Variometer** panel — vertical speed indicator, ±1950 ft/min range
- **Message path inputs** — each panel field accepts a Foxglove-native message path string (`/topic.field`, `/topic[0].field`, etc.) with Studio autocomplete; works with any message type that resolves to a finite number
- **Auto-sizing** — instruments resize to fill the panel at any window dimension via `ResizeObserver`
- SVG instrument graphics vendored as inline data URLs — no static file server required in the bundled extension environment
- `npm run win-install` script for one-step build and install to Foxglove Studio on Windows from WSL

### Technical

- Rendering powered by [flight-indicators-js](https://github.com/teocci/js-module-flight-indicators) (MIT), replacing an earlier GPL-3.0 dependency
- No custom ROS message types required — compatible with `std_msgs/Float64` and any other schema
- Message path parsing supports dot notation and bracket array indexing (`field.nested`, `arr[0].value`)