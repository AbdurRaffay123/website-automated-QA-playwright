# QA Automation Platform

A config-driven, plugin-based QA automation framework for validating entire ERP systems before production deployment. Point it at any project with a single JSON config — no project-specific test code required.

```bash
PROJECT=my-erp npx playwright test
```

## Capabilities

| # | Feature | Config Section | Plugin |
|---|---------|----------------|--------|
| 1 | CRUD workflow testing | `workflows[]` | workflows |
| 2 | Form testing (all input types) | `forms[]` | forms |
| 3 | Validation rule testing | `validations[]` | validators |
| 4 | Table/grid testing | `tables[]` | tables |
| 5 | Data persistence verification | `persistence[]` | persistence |
| 6 | Navigation testing | `navigation` | navigation |
| 7 | UI health checks | `uiHealth` | uiHealth |
| 8 | Network verification | `network` | network |
| 9 | Performance checks | `performance` | performance |
| 10 | Visual regression | `visual` | visual |
| 11 | Responsive testing | `responsive` | responsive |
| 12 | Role-based testing | `roles[]` | roles |
| 13 | Multi-browser support | `BROWSERS` env | playwright projects |
| 14 | File upload/download | `files[]` | files |
| 15 | Notifications/modals | `notifications[]` | notifications |
| 16 | Search testing | `search[]` | search |
| 17 | Dashboard testing | `dashboards[]` | dashboard |
| 18 | HTML report generation | automatic | qaReporter |
| 19 | Evidence collection | automatic on failure | evidence helper |
| 20 | Retry strategy | `retry` | retry |
| 21 | Test data management | `testData`, `cleanupTargets` | testData |
| 22 | Accessibility scans | `accessibility` | accessibility |
| 23 | Link checking | `links` | links |
| 24 | Extended JSON config | all sections | config |
| 25 | Plugin architecture | `plugins` | pluginRegistry |
| — | API smoke tests (legacy) | `endpoints[]` | api |
| — | UI page smoke tests (legacy) | `pages[]` | ui |

## Quick Start

```bash
npm install
npx playwright install --with-deps chromium

# Run full suite
PROJECT=anil-erp npx playwright test

# Run specific plugins
PLUGINS=api,ui,workflows PROJECT=anil-erp npx playwright test

# Run smoke-tagged tests only
TAGS=smoke PROJECT=anil-erp npx playwright test

# All browsers
BROWSERS=chromium,firefox,webkit PROJECT=anil-erp npm run test:all-browsers

# View reports
npm run report          # Playwright HTML report
npm run report:qa       # Custom QA report with perf/a11y warnings
```

## Architecture

```
core/           Engine: config loader, context, plugin registry, runner, retry
plugins/        One plugin per capability (api, ui, workflows, forms, …)
helpers/        Reusable utilities (forms, tables, network, evidence, …)
reporting/      Custom HTML QA reporter
configs/        One JSON file per project
tests/          Unified suite entry point
api-tests/      Legacy API-only entry (backward compatible)
ui-tests/       Legacy UI-only entry (backward compatible)
```

### Plugin System

Each plugin exports:

```javascript
export default {
  id: 'workflows',
  priority: 30,
  isEnabled: (config) => config.workflows.length > 0,
  register({ test, config, context, authHeadersRef }) {
    // Register Playwright tests from config
  },
};
```

Enable/disable plugins in config:

```json
{
  "plugins": {
    "api": true,
    "visual": false,
    "accessibility": true
  }
}
```

Or via environment: `PLUGINS=api,ui,workflows`

## Adding a New Project

1. Copy `configs/project-template.json` → `configs/my-erp.json`
2. Set `baseUrl`, `frontendUrl`, `auth`, `uiLogin`
3. Add `endpoints[]` for API smoke tests
4. Add `pages[]` for UI smoke tests
5. Add `workflows[]` for CRUD flows
6. Add other sections as needed

Run: `PROJECT=my-erp npx playwright test`

## Config Reference

### Workflows (CRUD)

```json
{
  "workflows": [{
    "name": "Customer CRUD",
    "tags": ["crud", "smoke"],
    "requiresAuth": true,
    "steps": [
      { "action": "api", "method": "POST", "path": "/api/customers", "body": { "name": "{{unique:name}}" }, "saveAs": "customerId" },
      { "action": "api", "method": "GET", "path": "/api/customers/{{customerId}}", "expectStatus": [200] },
      { "action": "ui", "path": "/customers/{{customerId}}", "expectSelector": ".details" },
      { "action": "form", "navigateTo": "/customers/{{customerId}}/edit", "fields": [...], "submit": true },
      { "action": "search", "inputSelector": "#search", "query": "{{unique:name}}", "expectContains": "{{unique:name}}" },
      { "action": "api", "method": "DELETE", "path": "/api/customers/{{customerId}}", "expectStatus": [204] },
      { "action": "verify-notification", "selector": ".toast", "text": "deleted" }
    ]
  }]
}
```

**Step actions:** `api`, `ui`, `form`, `click`, `search`, `verify-notification`, `verify-network`, `verify-present`, `verify-absent`, `wait`, `refresh`

### Forms

Supported field types: `text`, `email`, `password`, `number`, `textarea`, `select`, `dropdown`, `radio`, `checkbox`, `multiselect`, `autocomplete`, `date`, `datetime`, `datepicker`, `file`, `hidden`

```json
{
  "forms": [{
    "name": "Create customer",
    "path": "/customers/new",
    "fields": [
      { "name": "email", "type": "email", "selector": "#email", "value": "{{unique:email}}" },
      { "name": "status", "type": "select", "selector": "#status", "value": "active" }
    ],
    "expectNotification": { "text": "created", "type": "success" },
    "verifyPersistence": true
  }]
}
```

### Template Variables

| Variable | Description |
|----------|-------------|
| `{{runTag}}` | Unique per-run tag (`qa-test-a1b2c3d4`) |
| `{{unique}}` | Random unique string |
| `{{unique:email}}` | Random unique email |
| `{{unique:name}}` | Random unique name |
| `{{customerId}}` | Saved from earlier step via `saveAs` |

### Roles

```json
{
  "roles": [{
    "name": "Sales",
    "email": "sales@example.com",
    "password": "password",
    "accessiblePages": [{ "name": "Customers", "path": "/customers" }],
    "hiddenPages": [{ "name": "Settings", "path": "/settings" }],
    "forbiddenActions": [{ "name": "Delete all", "path": "/customers", "selector": "[data-delete-all]" }]
  }]
}
```

### Performance Thresholds

```json
{
  "performance": {
    "failOnSlow": false,
    "thresholds": {
      "pageLoadMs": 5000,
      "apiResponseMs": 2000,
      "jsBundleBytes": 2097152
    }
  }
}
```

### Visual Regression

```bash
# Update baselines
VISUAL_UPDATE=true PROJECT=my-erp npx playwright test --update-snapshots
```

```json
{
  "visual": {
    "screenshots": [{
      "name": "Dashboard",
      "path": "/dashboard",
      "fullPage": true,
      "mask": [".timestamp"]
    }]
  }
}
```

### Retry Strategy

```json
{
  "retry": {
    "maxRetries": 2,
    "delayMs": 1000,
    "transientOnly": true
  }
}
```

Automatically retries on network errors, timeouts, 502/503/504. Real assertion failures are not retried.

## Reports

After a run, three reports are generated:

| Report | Path | Contents |
|--------|------|----------|
| Playwright HTML | `reports/html/` | Standard Playwright report with traces, videos |
| JSON results | `reports/results.json` | Machine-readable results |
| QA Report | `reports/qa/qa-report.html` | Passed/failed/known issues, perf warnings, a11y violations, screenshots |

On failure, evidence is saved to `reports/evidence/`:
- Screenshot, video, trace (Playwright built-in)
- DOM snapshot, console logs, network log
- Request/response payloads, stack trace

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PROJECT` | Config name (required) — matches `configs/{PROJECT}.json` |
| `PLUGINS` | Comma-separated plugin IDs to run |
| `TAGS` | Comma-separated test tags to filter |
| `BROWSERS` | `chromium,firefox,webkit` |
| `HEADED` | `true` for headed mode |

## Philosophy

- **One engine, many configs** — new projects write JSON, not test code
- **Plugin-based** — new capabilities = new plugin, core stays untouched
- **Backward compatible** — existing `endpoints[]` and `pages[]` configs work unchanged
- **Opt-in advanced features** — performance, a11y, visual, responsive require explicit config
- **Known issues** — mark broken features with `knownIssue` so they don't hard-fail but stay visible

## Extending

To add a new capability:

1. Create `plugins/myFeature/index.js` with `id`, `priority`, `isEnabled`, `register`
2. Register it in `core/pluginRegistry.js` `loadPlugins()`
3. Add config section to `configs/project-template.json`
4. Document in this README

No changes to core runner or other plugins required.
