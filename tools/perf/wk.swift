// A bare WKWebView (real WebKit, ANGLE on Metal, this Mac's Apple GPU) for measuring: no Xcode, built by tools/perf/gpucost.mjs with swiftc.
//   wk <url> <probe.js> <width> <height> <seconds>     every message the probe posts goes to stdout; "done" ends it, and so does the time limit
// Nothing shows and nothing plays: no Dock icon and never active, a fully transparent window far outside every display that takes no mouse, and the probe stops all
// audio before the page runs. It refuses to run if the window would touch a display. WebKit keeps drawing because its occlusion detection and inactive scheduling are off.
import Cocoa
import WebKit

final class Sink: NSObject, WKScriptMessageHandler {
  func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
    let s = "\(m.body)"
    print(s); fflush(stdout)
    if s == "done" { exit(0) }
  }
}
// AppKit pulls ordinary windows back onto a display: this one stays where it is put
final class Away: NSWindow {
  override func constrainFrameRect(_ r: NSRect, to s: NSScreen?) -> NSRect { r }
  override var canBecomeKey: Bool { false }
  override var canBecomeMain: Bool { false }
}
let A = CommandLine.arguments
guard A.count >= 6, let url = URL(string: A[1]), let probe = try? String(contentsOfFile: A[2], encoding: .utf8), let W = Double(A[3]), let H = Double(A[4]), let limit = Double(A[5]) else { print("usage: wk url probe.js w h seconds"); exit(2) }
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let cfg = WKWebViewConfiguration()
cfg.websiteDataStore = .nonPersistent()
cfg.mediaTypesRequiringUserActionForPlayback = .all
if #available(macOS 14.0, *) { cfg.preferences.inactiveSchedulingPolicy = .none }
let sink = Sink()
cfg.userContentController.add(sink, name: "probe")
cfg.userContentController.addUserScript(WKUserScript(source: probe, injectionTime: .atDocumentStart, forMainFrameOnly: true))
// further out than any arrangement of displays reaches
let frame = NSRect(x: 40000, y: 40000, width: W, height: H)
let web = WKWebView(frame: NSRect(x: 0, y: 0, width: W, height: H), configuration: cfg)
let sel = Selector(("_setWindowOcclusionDetectionEnabled:"))
if web.responds(to: sel) { web.perform(sel, with: nil) }   // nil is NO: an off screen window still gets animation frames
let win = Away(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
win.isOpaque = false
win.backgroundColor = .clear
win.alphaValue = 0
win.hasShadow = false
win.ignoresMouseEvents = true
win.level = NSWindow.Level(rawValue: NSWindow.Level.normal.rawValue - 1)
win.collectionBehavior = [.transient, .ignoresCycle, .stationary]
win.contentView = web
win.setFrame(frame, display: false)
if NSScreen.screens.contains(where: { $0.frame.intersects(win.frame) }) { print("{\"error\":\"the window would touch a display, not running\"}"); exit(3) }
win.orderFrontRegardless()
web.load(URLRequest(url: url))
DispatchQueue.main.asyncAfter(deadline: .now() + limit) { print("{\"timeout\":true}"); fflush(stdout); exit(1) }
app.run()
