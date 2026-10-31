// Adaptive render scale (performance pass). Phones aim for ~30 fps, desktops for 60.
// The quality tier from the options screen sets the ceiling (setMax); this module moves the actual pixel ratio between
// a floor and that ceiling from the measured frame interval: down quickly when the game is slow, up slowly (and with
// back-off) when there is headroom. Resizing the drawing buffer costs a few ms, so changes are rare and quantised.
//
//   const perf = createPerf({ renderer, mobile });
//   perf.setMax(pixelRatioCeiling);   // from applySettings()
//   perf.frame(now);                  // once per animation frame, `now` in ms (the setAnimationLoop timestamp)
//   window.__perf / perf.stats()      // { ratio, max, ema, lowers, raises }
export function createPerf({ renderer, mobile }) {
  const target = mobile ? 33.3 : 16.7;           // ms per frame we want
  const slow = mobile ? 41 : 20.5;               // lower the resolution above this average frame time
  const fast = mobile ? 25 : 17.6;               // may raise it again when the average stays below this
  const floor = mobile ? 0.5 : 0.75;
  const STEP = 0.125;                            // quantise the ratio: fewer distinct buffer sizes
  let max = 1, ratio = 1, applied = 0;
  let ema = target, last = 0, warm = 120, hold = 0, goodSince = 0, raiseWait = 4000, lastRaise = -1e9;
  let probe = null, probeAt = 0, noLowerUntil = 0;   // a lowering step is checked ~2 s later: if the frame time did not improve we are CPU bound
  const st = { lowers: 0, raises: 0, reverted: 0 };
  const params = new URLSearchParams(location.search);
  const off = params.has('fixres');              // ?fixres disables the adaptation (for benchmarks)

  function apply() {
    const q = Math.max(0.25, Math.round(ratio / STEP) * STEP);
    if (Math.abs(q - applied) < 1e-3) return;
    applied = q;
    renderer.setPixelRatio(q);
  }
  return {
    // Ceiling from the quality tier. Also resets the measurement: shaders recompile after a settings change.
    setMax(m) {
      max = m;
      ratio = off ? m : Math.min(m, Math.max(ratio, floor));
      if (!applied) ratio = m; // first call: start at the ceiling, step down only if the device struggles
      warm = 90; goodSince = 0;
      apply();
    },
    frame(now) {
      if (off) return;
      const dt = now - last; last = now;
      if (dt <= 0 || dt > 100 || document.hidden) { goodSince = 0; return; } // hitch, tab switch or first frame
      if (warm > 0) { warm--; return; }                                       // shader compiles, texture uploads
      ema += (dt - ema) * 0.06;
      if (hold > 0) { hold -= dt; return; }
      if (probe && now >= probeAt) {
        if (ema > probe.ema * 0.93) { ratio = probe.ratio; st.reverted++; apply(); noLowerUntil = now + 30000; } // fewer pixels did not help: CPU bound, keep the sharp image
        probe = null; goodSince = 0; return;
      }
      if (probe) return;
      if (ema > slow && ratio > floor + 1e-3 && now >= noLowerUntil) {
        // proportional: cost scales with ratio^2, so aim at the target interval
        probe = { ratio, ema }; probeAt = now + 2000;
        ratio = Math.max(floor, ratio * Math.min(0.95, Math.max(0.7, Math.sqrt(target / ema))));
        if (now - lastRaise < 10000) raiseWait = Math.min(raiseWait * 2, 120000); // we raised too eagerly: wait longer next time
        st.lowers++; apply(); hold = 1200; goodSince = 0;
      } else if (ema < fast && ratio < max - 1e-3) {
        goodSince = goodSince || now;
        if (now - goodSince > raiseWait) {
          ratio = Math.min(max, ratio + STEP);
          st.raises++; lastRaise = now; apply(); ema = target; hold = 1200; goodSince = 0;
        }
      } else goodSince = 0;
    },
    stats: () => ({ ratio: applied, max, ema: +ema.toFixed(1), ...st }),
  };
}
