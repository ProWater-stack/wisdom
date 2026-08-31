# Premium Dashboard Rebuild

## Updated

- Rebuilt the post-login home dashboard in `src/App.jsx`.
- Added a responsive premium navigation rail and mobile drawer.
- Added a personalised command-center hero and workspace summary.
- Added access, module-readiness, version, and role metrics.
- Added searchable module cards while preserving existing permissions.
- Added recent-module quick access stored locally in the browser.
- Added integrated profile-photo controls and refined sign-out access.
- Added responsive tablet and mobile layouts.
- Bumped the application version to `2.15.0` and added a changelog entry.

## IoT Module Changes (31 August 2026)

- Removed Pressure and Flow KPI gauge cards from the IoT gauge row — now shows only pH, TDS, Temp, and Tank.
- Center-aligned all table headers in the Recent Readings, Consumption, and Recent Heartbeats tables.
- Replaced the cloudy weather bar (solid rect) with a floating multi-layer cloud SVG animation using the `pwCloudFloat` keyframes.

## Documentation

- Updated `src/DOCUMENTATION.md` to reflect APP_VERSION 2.29.286 and corrected TDS unit label from mg/L to ppm throughout.

## Preserved

All existing authentication, access-control, API, module-routing, module-page, and release-popup logic remains intact.

## Validation

`src/App.jsx` passed TypeScript's JSX parser and transpilation checks. A Vite production build could not be regenerated in the execution environment because the configured npm package registry returned HTTP 503 responses while installing dependencies. Run `npm ci` and `npm run build` in a normal development environment to regenerate `dist`.
