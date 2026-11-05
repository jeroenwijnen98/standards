// MiniUI: real HID input and window screenshots for any macOS app, run from
// ssh. It is an .app launched with `open` so that it is its own TCC identity:
// the Accessibility and Screen Recording grants belong to it, not to sshd.
// The `mini-ui` wrapper launches it; see README.md for the commands.
import AppKit
import ApplicationServices

let out = FileHandle.standardOutput
func say(_ s: String) { out.write((s + "\n").data(using: .utf8)!) }
func finish(_ code: Int32, _ s: String? = nil) -> Never {
    if let s { say(s) }
    say("exit \(code)")
    exit(code)
}

let usage = """
usage: MiniUI <app> <command> [args]   (points relative to the app's main window, top-left origin)
  status | window | activate
  click x y | dclick x y | rclick x y | move x y
  drag x0 y0 x1 y1 [steps]
  key <combo>          e.g. return, cmd+shift+n, down, a
  type <text>
  shot <out.png>       main window only
  screen <out.png>     whole display
"""

var args = Array(CommandLine.arguments.dropFirst())
guard args.count >= 2 else { finish(2, usage) }
let target = args.removeFirst()
let command = args.removeFirst()

// MARK: state

func screenLocked() -> Bool {
    let d = CGSessionCopyCurrentDictionary() as? [String: Any]
    return (d?["CGSSessionScreenIsLocked"] as? Bool) ?? false
}

func runningApp() -> NSRunningApplication? {
    NSWorkspace.shared.runningApplications.first {
        $0.localizedName == target || $0.bundleIdentifier == target
    }
}

struct Window { let id: CGWindowID; let frame: CGRect }

// The app's largest normal-layer window on screen: the main window for the
// single-window apps this drives.
func mainWindow() -> Window? {
    guard let pid = runningApp()?.processIdentifier,
          let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]]
    else { return nil }
    return list.compactMap { w -> Window? in
        guard (w[kCGWindowOwnerPID as String] as? pid_t) == pid,
              (w[kCGWindowLayer as String] as? Int) == 0,
              let b = w[kCGWindowBounds as String] as? [String: Any],
              let r = CGRect(dictionaryRepresentation: b as CFDictionary),
              let id = w[kCGWindowNumber as String] as? CGWindowID
        else { return nil }
        return Window(id: id, frame: r)
    }.max { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }
}

func requireWindow() -> Window {
    guard let w = mainWindow() else { finish(4, "no on-screen window for \(target)") }
    return w
}

func activate() {
    guard let app = runningApp() else { finish(4, "\(target) is not running") }
    if !app.isActive {
        app.activate()
        usleep(400_000)
    }
}

func requireInput() {
    if screenLocked() { finish(5, "screen is locked") }
    guard AXIsProcessTrusted() else {
        _ = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary)
        finish(3, "no Accessibility grant: System Settings > Privacy & Security > Accessibility > MiniUI")
    }
}

// MARK: input

func point(_ x: String, _ y: String) -> CGPoint {
    guard let dx = Double(x), let dy = Double(y) else { finish(2, usage) }
    let f = requireWindow().frame
    return CGPoint(x: f.minX + dx, y: f.minY + dy)
}

func mouse(_ type: CGEventType, _ p: CGPoint, _ button: CGMouseButton = .left, clicks: Int64 = 1) {
    let e = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: button)
    e?.setIntegerValueField(.mouseEventClickState, value: clicks)
    e?.post(tap: .cghidEventTap)
}

func click(_ p: CGPoint, button: CGMouseButton = .left, count: Int64 = 1) {
    let (down, up): (CGEventType, CGEventType) = button == .right
        ? (.rightMouseDown, .rightMouseUp) : (.leftMouseDown, .leftMouseUp)
    mouse(.mouseMoved, p)
    usleep(150_000)
    for n in 1...count {
        mouse(down, p, button, clicks: n)
        usleep(60_000)
        mouse(up, p, button, clicks: n)
        usleep(80_000)
    }
}

let keyCodes: [String: CGKeyCode] = [
    "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9,
    "b": 11, "q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "1": 18, "2": 19,
    "3": 20, "4": 21, "6": 22, "5": 23, "=": 24, "9": 25, "7": 26, "-": 27, "8": 28,
    "0": 29, "]": 30, "o": 31, "u": 32, "[": 33, "i": 34, "p": 35, "l": 37, "j": 38,
    "'": 39, "k": 40, ";": 41, "\\": 42, ",": 43, "/": 44, "n": 45, "m": 46, ".": 47,
    "`": 50, "return": 36, "tab": 48, "space": 49, "delete": 51, "escape": 53,
    "forwarddelete": 117, "home": 115, "end": 119, "pageup": 116, "pagedown": 121,
    "left": 123, "right": 124, "down": 125, "up": 126,
    "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97,
]
let modifierFlags: [String: CGEventFlags] = [
    "cmd": .maskCommand, "shift": .maskShift, "opt": .maskAlternate,
    "alt": .maskAlternate, "ctrl": .maskControl, "fn": .maskSecondaryFn,
]

func key(_ combo: String) {
    var parts = combo.lowercased().split(separator: "+").map(String.init)
    guard let name = parts.popLast(), let code = keyCodes[name] else { finish(2, "unknown key in \(combo)") }
    var flags = CGEventFlags()
    for m in parts {
        guard let f = modifierFlags[m] else { finish(2, "unknown modifier \(m)") }
        flags.insert(f)
    }
    for down in [true, false] {
        let e = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: down)
        e?.flags = flags
        e?.post(tap: .cghidEventTap)
        usleep(40_000)
    }
}

func type(_ text: String) {
    for ch in text.utf16 {
        for down in [true, false] {
            let e = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: down)
            var c = ch
            e?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c)
            e?.post(tap: .cghidEventTap)
        }
        usleep(20_000)
    }
}

// MARK: screenshots

// screencapture runs as this app's child, so the app's Screen Recording grant
// covers it.
func capture(_ path: String, window: CGWindowID?) {
    if screenLocked() { finish(5, "screen is locked") }
    try? FileManager.default.removeItem(atPath: path)
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
    p.arguments = ["-x", "-o"] + (window.map { ["-l", String($0)] } ?? []) + [path]
    do { try p.run() } catch { finish(1, "screencapture: \(error)") }
    p.waitUntilExit()
    guard p.terminationStatus == 0, FileManager.default.fileExists(atPath: path) else {
        if !CGPreflightScreenCaptureAccess() {
            _ = CGRequestScreenCaptureAccess()
            finish(6, "no Screen Recording grant: System Settings > Privacy & Security > Screen & System Audio Recording > MiniUI")
        }
        finish(1, "screencapture failed (\(p.terminationStatus))")
    }
    say("wrote \(path)")
}

// MARK: dispatch

func need(_ n: Int) { if args.count < n { finish(2, usage) } }

switch command {
case "status":
    let app = runningApp()
    say("locked \(screenLocked())")
    say("accessibility \(AXIsProcessTrusted())")
    say("screen-recording \(CGPreflightScreenCaptureAccess())")
    say("running \(app != nil)")
    if let app { say("active \(app.isActive)") }
    if let w = mainWindow() { say("window \(Int(w.frame.minX)) \(Int(w.frame.minY)) \(Int(w.frame.width)) \(Int(w.frame.height))") }
    if !AXIsProcessTrusted() {
        _ = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary)
    }
    if !CGPreflightScreenCaptureAccess() { _ = CGRequestScreenCaptureAccess() }
    let ready = !screenLocked() && AXIsProcessTrusted() && CGPreflightScreenCaptureAccess() && app != nil
    finish(ready ? 0 : 1)
case "window":
    let f = requireWindow().frame
    finish(0, "window \(Int(f.minX)) \(Int(f.minY)) \(Int(f.width)) \(Int(f.height))")
case "activate":
    if screenLocked() { finish(5, "screen is locked") }
    activate()
    finish(0)
case "click", "dclick", "rclick", "move":
    need(2); requireInput(); activate()
    let p = point(args[0], args[1])
    switch command {
    case "move": mouse(.mouseMoved, p)
    case "dclick": click(p, count: 2)
    case "rclick": click(p, button: .right)
    default: click(p)
    }
    finish(0, "\(command) \(Int(p.x)),\(Int(p.y))")
case "drag":
    need(4); requireInput(); activate()
    let a = point(args[0], args[1]), b = point(args[2], args[3])
    let steps = max(1, args.count > 4 ? Int(args[4]) ?? 20 : 20)
    mouse(.mouseMoved, a); usleep(150_000)
    mouse(.leftMouseDown, a); usleep(100_000)
    for i in 1...steps {
        let t = Double(i) / Double(steps)
        mouse(.leftMouseDragged, CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t))
        usleep(16_000)
    }
    mouse(.leftMouseUp, b)
    finish(0, "drag \(Int(a.x)),\(Int(a.y)) -> \(Int(b.x)),\(Int(b.y))")
case "key":
    need(1); requireInput(); activate()
    key(args[0])
    finish(0)
case "type":
    need(1); requireInput(); activate()
    type(args.joined(separator: " "))
    finish(0)
case "shot":
    need(1)
    capture(args[0], window: requireWindow().id)
    finish(0)
case "screen":
    need(1)
    capture(args[0], window: nil)
    finish(0)
default:
    finish(2, usage)
}
