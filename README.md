# Methadone Dose Calculator

A clinical decision-support tool for calculating methadone restart doses based on missed dosing days.

## Features

- Calculate restart doses based on the standard dose-adjustment algorithm
- Color-coded results (safe, verify, see provider)
- Calculation history with timestamps
- Works offline, stores data locally

## Usage

Open `index.html` in any modern web browser.

The daily [Inventory Manager](https://medassistant-ux.github.io/nmts-inventory/) also has a **Dose Calculator** button beside **Daily Temperature Log**. It opens this calculator in a new tab.

## Interface theme

`clinic-theme.css` supplies the screen-only clinic theme matching Inventory Manager. The original `calculator.js`, dosing chart, field constraints, storage keys, note generator, and print stylesheet are unchanged. History and note preferences continue using their existing browser storage.

The refresh was checked against 810 original calculation cases and the original 23 controls, with browser checks for validation, chart highlighting, history/reload/clear, note editing/regeneration, prescriber preferences, clipboard copying, status warnings, desktop/mobile layout, and print visibility. These checks establish behavior preservation, not clinical validation of the underlying dosing protocol.

## Disclaimer

This calculator is a decision-support tool only. Always verify results against clinical judgment and consult the provider when indicated.
