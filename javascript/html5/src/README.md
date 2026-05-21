# Fanorona and Vela (HTML5 + JavaScript)

[![Language: JavaScript](https://img.shields.io/badge/language-JavaScript-f7df1e?logo=javascript&logoColor=000)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Modules: ESM](https://img.shields.io/badge/modules-ESM-2f74c0)](https://developer.mozilla.org/docs/Web/JavaScript/Guide/Modules)
[![UI: HTML5 + SVG](https://img.shields.io/badge/UI-HTML5%20%2B%20SVG-e34f26?logo=html5&logoColor=fff)](https://developer.mozilla.org/docs/Web/SVG)
[![Technique: Web Worker](https://img.shields.io/badge/technique-Web%20Worker-3b82f6)](https://developer.mozilla.org/docs/Web/API/Web_Workers_API)
[![AI: UCT/MCTS](https://img.shields.io/badge/AI-UCT%2FMCTS-0ea5e9)](doc/engine_mcts_ucb.md)
[![Tests: Vitest + Playwright](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-16a34a)](tests)

Browser implementation of Fanorona and Vela with a built-in AI based on UCT / MCTS (UCB1).

The application is fully browser-based, uses modern ES modules, and has no runtime UI framework dependency.

## Features

- Two variants in one app: Fanorona and Vela.
- 9x5 Fanorona line-board rendered as SVG (no bitmap board dependency).
- Human vs Human, Human vs AI, AI vs AI.
- Side-specific AI difficulty for Red (South) and Yellow (North): Easy, Medium, Hard.
- Device profile budgeting for AI: Auto, Desktop, Mobile.
- Piece selection modes:
  - Must Move (default)
  - Flexible
- AI move selection through UCT / MCTS in a Web Worker.
- Rules summary in-app (Rules panel), variant selection in Options.
- Unit and E2E tests with high branch and code coverage targets.

## Rule Scope In This Implementation

- Fanorona:
  - Mandatory capture when captures exist.
  - Approach and withdrawal capture implemented.
  - Multi-capture continuation with same piece.
  - Direction repeat and point revisit are disallowed within a capture sequence.
  - Paika move when no capture exists.
- Vela:
  - Phase 1 with designated capturer and single-piece capture limit.
  - Phase 2 switches to regular Fanorona capture rules.

## Tech Stack

- Language: JavaScript (ES modules)
- UI: HTML5 + CSS + SVG DOM API
- Concurrency: Web Worker (`js/controller.js`)
- AI: UCT / MCTS (`js/uct/`)
- Unit tests: Vitest
- E2E tests: Playwright

## Project Structure

```text
src/
├── index.html
├── README.md
├── package.json
├── vitest.config.js
├── playwright.config.js
├── css/
│   └── index.css
├── doc/
│   ├── engine_mcts_ucb.md
│   └── software_architecture.md
├── js/
│   ├── common.js
│   ├── board.js
│   ├── store.js
│   ├── renderer.js
│   ├── hmi.js
│   ├── controller.js
│   └── uct/
│       ├── uct.js
│       └── uctnode.js
├── tests/
│   ├── server.js
│   ├── unit/
│   └── e2e/
└── img/
```

## Getting Started

### Install dependencies

```powershell
npm install
```

### Run local app

```powershell
node tests/server.js
```

Then open `http://localhost:4173`.

## Testing

### Unit tests

```powershell
npm test
```

### Coverage

```powershell
npm run test:coverage
```

### E2E tests

```powershell
npm run test:e2e
```

### All tests

```powershell
npm run test:all
```

## PWA / Offline Support

This app is a Progressive Web App (PWA):

- Installable on desktop and mobile ("Add to Home Screen" or "Install App")
- Works offline after first load (caches all essential assets)
- See [doc/pwa.md](doc/pwa.md) for details

## Architecture Documentation

- [doc/software_architecture.md](doc/software_architecture.md)
- [doc/engine_mcts_ucb.md](doc/engine_mcts_ucb.md)

## Troubleshooting

If `node` resolves to Microsoft HPC tooling on Windows, run npm via:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' test
```

## License

- Source code: MIT License
- Image assets: see in-app About section and repository license files.
