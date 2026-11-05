# mini-ui

Real mouse clicks, keys and screenshots in a native macOS app on the Mac mini, driven over ssh. Use it for what a browser driver cannot reach: a SwiftUI or AppKit window, an Electron app's menu bar, dock or file dialogs. A web page or an Electron renderer goes through Playwright instead (see `docs/ui-testing.md`).

```sh
mini-ui Tessera status                 # ready? exit 0 = unlocked, both grants, app running
mini-ui Tessera click 410 105          # points from the window's top-left corner
mini-ui Tessera shot /tmp/after.png    # run off the mini: the png is copied back
```

| Command | Does |
|---|---|
| `status` | Prints `locked`, `accessibility`, `screen-recording`, `running`, `active`, `window x y w h`; exit 0 only when ready |
| `window` | The main window's frame, screen points |
| `activate` | Bring the app to the front |
| `click x y`, `dclick x y`, `rclick x y`, `move x y` | Left, double, right click, hover |
| `drag x0 y0 x1 y1 [steps]` | Left-button drag |
| `key combo` | `return`, `down`, `cmd+shift+n`, `a`, … (US key layout) |
| `type text` | Unicode text into the focused field |
| `shot out.png` | The main window; `screen out.png` takes the whole display |

`<app>` is the app's name or bundle id. Its main window is its largest on-screen window. Input commands bring the app to the front first: nobody works at the mini's screen, so that steals no one's focus.

Exit codes: 1 failed, 2 usage, 3 no Accessibility grant, 4 app or window missing, 5 screen locked, 6 no Screen Recording grant.

## How it works

ssh has no Accessibility or Screen Recording grant, so posted events are dropped and `screencapture` fails. `MiniUI.app` holds both grants itself: the `mini-ui` wrapper launches it with `open` and reads its output back. Off the mini the wrapper forwards over `ssh mini` (or `$MINI_UI_HOST`).

The app is signed with a self-signed identity, `MiniUI Local Signing`, in its own keychain (`~/Library/Keychains/mini-ui.keychain-db`, password in `~/.config/mini-ui/keychain-pass`). macOS ties the grants to that certificate, so rebuilds keep them. Deleting the keychain means granting again.

## Install

```sh
ssh mini '~/Developer/standards/mini-ui/install.sh --app'   # build, sign, link
~/Developer/standards/mini-ui/install.sh                    # this Mac: link the forwarding wrapper
```

The first time, switch on MiniUI under System Settings › Privacy & Security › **Accessibility** and › **Screen & System Audio Recording** on the mini. `status` adds it to both lists.
