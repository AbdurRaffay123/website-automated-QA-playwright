# site-tester

A reusable, config-driven smoke/regression tester. Point it at any project by writing one config file —
no test code changes needed. Checks:

- **API**: every endpoint across GET/POST/PUT/DELETE, with auth, and chaining (e.g. create a record, then read/update/delete that exact record using its returned ID)
- **UI**: every page loads (no 404s, no blank screens, no console errors), plus optional button-click checks

## Setup

```bash
npm install
npx playwright install --with-deps chromium
```

## Run

```bash
PROJECT=anil-erp npx playwright test            # run everything
PROJECT=anil-erp npx playwright test api-tests  # API only
PROJECT=anil-erp npx playwright test ui-tests   # UI only
npx playwright show-report reports/html         # view results
```

`PROJECT` must match a filename in `configs/` (without `.json`).

## Adding a new project

Copy `configs/anil-erp.json` to `configs/<your-project>.json` and edit:

1. `baseUrl` / `frontendUrl` — where the backend API and frontend are running
2. `auth` — how to log in and get a token (currently supports `bearer-login` and `api-key`; add new types in `core/auth.js`)
3. `endpoints[]` — one entry per API route to test
4. `pages[]` — one entry per frontend route to test
5. `buttonChecks[]` (optional) — specific buttons to click and verify they do something

### Endpoint config fields

| Field | Required | Notes |
|---|---|---|
| `name` | yes | shows up in test report |
| `method` | yes | GET / POST / PUT / DELETE |
| `path` | yes | supports `{{variable}}` from a prior step's `saveResponseField` |
| `auth` | yes | `true` to send the bearer token, `false` for public routes |
| `body` | no | request payload |
| `expectStatus` | no | array of acceptable HTTP codes, default `[200]` |
| `saveResponseField` | no | `{ "as": "name", "path": "data.uuid" }` — saves a value from this response for later steps |
| `knownIssue` | no | if set, a failing assertion becomes a flagged "known issue" instead of a hard failure — use this for things you already know are stubbed/incomplete, so the suite stays green-vs-red meaningful |

### Page config fields

| Field | Required | Notes |
|---|---|---|
| `name` | yes | |
| `path` | yes | frontend route |
| `requiresAuth` | yes | logs in via UI first if true (requires `uiLogin` block in config) |
| `expectSelector` | no | CSS selector that should be visible once the page loads, default `body` |
| `knownIssue` | no | same idea as above — known placeholder/mock pages don't hard-fail |

## Why "known issues" instead of just skipping

Marking something `knownIssue` instead of deleting it from the config means:
- It still runs every time, so the moment it actually gets fixed, the report flags it as newly-passing
- It shows up in the report as a distinct "known issue" status, not invisible, so nothing rots silently

## Philosophy

One engine (`core/`), many configs. When you start a new project, you're writing JSON, not new test code.
If a project needs something genuinely new (a different auth scheme, a different kind of check), extend
`core/auth.js` or add a new generic test file — keep it generic so every other project benefits too.
