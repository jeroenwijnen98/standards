# Checking UI by clicking it

A UI change is checked when an agent has clicked it the way a user does and seen the result. Pick the route by what owns the pixels:

| Target | Route | Where |
|---|---|---|
| Web app | Playwright, headless | anywhere, Sandcastle included |
| Electron renderer | Playwright `_electron.launch()` | anywhere; Linux needs `xvfb-run` |
| Native window (SwiftUI, AppKit) | [`mini-ui`](../mini-ui/README.md) | the Mac mini |
| Electron's native parts: menu bar, dock, file dialogs, file associations | `mini-ui` | the Mac mini |

## Why the split

Playwright sends input through the browser's own hit-testing, so a click lands on whatever covers that point, the way a user's would. A click that something else swallows fails Playwright's actionability check ("… intercepts pointer events"). It needs no window server and steals no focus.

A native window has no such driver short of the macOS window server, and on the Mac in use that means stealing focus. The mini has an always-logged-in session no one sits at, so `mini-ui` brings the app to the front there and posts real HID events.

## Simulated input misses bugs

Input that skips the window server misses bugs a real click hits. Before Tessera's `ed29fba`, a double-click gesture on each list row swallowed single clicks on the row's text. Events posted into the app's own queue (`NSApp.postEvent`, Tessera's `TESSERA_SYNTH_DRAG`) never selected a SwiftUI list row, gesture or no gesture, so the harness failed with or without the bug. Real clicks through `mini-ui` reproduced the bug and confirmed the fix.

A loop that fails even on code known to work proves nothing. Before trusting it, check it against a control: a bare `Text` row a real user can certainly click.

## Before a mini session

`mini-ui <app> status` exits 0 when the screen is unlocked, both grants are in and the app is running. Otherwise it says which one is missing. A locked screen is the user's to fix: say so rather than retrying.
