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

## Preserved

All existing authentication, access-control, API, module-routing, module-page, and release-popup logic remains intact.

## Validation

`src/App.jsx` passed TypeScript's JSX parser and transpilation checks. A Vite production build could not be regenerated in the execution environment because the configured npm package registry returned HTTP 503 responses while installing dependencies. Run `npm ci` and `npm run build` in a normal development environment to regenerate `dist`.
