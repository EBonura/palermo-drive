// Real drives for tools/route-check/check.mjs (--drive N): the scripted driver of bot.js steers the real lapa along the guide's line through the real game.
// The car is put at the start of the line (the pickup point of a ride, the vendor's road, ...), the guide is given the baked line as a mission would (guide.path), and the bot
// follows whatever line the guide shows, recalculated ones included, until it is within 14 m of the end. Blocked = pushing but under 0.8 m/s for 2.5 s, three times.
// A drive that fails prints: DRIVE FAIL <leg> blocked at x,z (m along) / timeout / lost the line.
import fs from 'node:fs';
import path from 'node:path';

// the part of a flat polyline between arc lengths sa and sb
function cut(f, sa, sb) {
  const out = []; let acc = 0;
  const at = (i, u) => [f[i] + (f[i + 2] - f[i]) * u, f[i + 1] + (f[i + 3] - f[i + 1]) * u];
  for (let i = 0; i + 3 < f.length; i += 2) {
    const L = Math.hypot(f[i + 2] - f[i], f[i + 3] - f[i + 1]), a0 = acc, a1 = acc + L; acc = a1;
    if (a1 < sa || a0 > sb || !L) continue;
    if (!out.length) out.push(...at(i, Math.max(0, (sa - a0) / L)));
    out.push(...at(i, Math.min(1, (sb - a0) / L)));
  }
  return out.length >= 4 ? out : f;
}

export async function runDrives(ctx) {
  const { legStat, failList, page, log, DRIVE_N, REPO, OUT, arg } = ctx;
  await page.evaluate(fs.readFileSync(path.join(REPO, 'tools/route-check/bot.js'), 'utf8'));
  const failsOf = s => s.problems.filter(p => (p.r !== 'fence' && p.r !== 'narrow') || (p.r === 'fence' && p.info.free < 0));   // the same rule as check.mjs (CFG.FENCE_GAP)
  const cand = [...legStat.values()].filter(s => s.flat && !s.stray && s.leg.kind !== 'race');
  const flagged = cand.filter(s => failsOf(s).length), passed = cand.filter(s => !failsOf(s).length);
  // the legs geometry flagged first (any rave line last: it is being moved), then an even spread of the others, shortest first within each kind so that the sample is cheap
  const rank = s => (s.leg.rave ? 1 : 0), pickFlag = flagged.sort((a, b) => rank(a) - rank(b) || a.flat.length - b.flat.length);
  const byKind = {}; for (const s of passed) (byKind[s.leg.kind] || (byKind[s.leg.kind] = [])).push(s);
  const rest = []; for (const k of Object.keys(byKind)) { byKind[k].sort((a, b) => (a.leg.len || a.flat.length) - (b.leg.len || b.flat.length)); const n = byKind[k].length, take = Math.max(1, Math.round(n / 6)); for (let q = 0; q < take; q++) rest.push(byKind[k][Math.floor((q + 0.5) * n / take)]); }
  const only = arg('drive-only') ? new RegExp(arg('drive-only')) : null;
  const chosen = only ? cand.filter(s => only.test(s.leg.id)) : pickFlag.concat(rest).slice(0, DRIVE_N), results = [];
  const vmax = +arg('vmax', 11);
  for (const s of chosen) {
    // a long line that geometry flagged is driven in a window: 250 m before its first problem to 150 m after its last one; the rest of it passed, and a whole 5 km drive is 8 minutes
    const l = s.leg, ret = l.id.startsWith('return:'), len = l.len || (() => { let a = 0; for (let i = 0; i + 3 < s.flat.length; i += 2) a += Math.hypot(s.flat[i + 2] - s.flat[i], s.flat[i + 3] - s.flat[i + 1]); return a; })(), fp = failsOf(s), win = !ret && fp.length && len > +arg('window-over', 1500) ? [Math.max(0, fp[0].s - 250), fp[fp.length - 1].s + 150] : null;
    const f = win ? cut(s.flat, win[0], win[1]) : s.flat;
    const x0 = f[0], z0 = f[1], th = Math.atan2(f[2] - f[0], f[3] - f[1]);
    await page.evaluate((x, z) => window.__rc.focus(x, z), x0, z0);
    if (ret) await page.evaluate((a, b, c, d) => window.__rc.planTo(a, b, c, d), l.from[0], l.from[1], l.to[0], l.to[1]);   // a way back from an item: the car at the item, the guide asked as the hunt asks it (guide.to)
    else await page.evaluate((x, z, th, f) => { const M = window.__missions; M.X.vehicle.teleport(x, z, th); M.X.guide.off(); M.X.guide.path(f); }, x0, z0, th, f);
    await new Promise(r => setTimeout(r, 1200));
    const dest = ret ? l.to : [f[f.length - 2], f[f.length - 1]], maxT = (win ? win[1] - win[0] : len) / 4 + 60;
    await page.evaluate((o) => window.__bot.start(o), { dest, maxT, vmax });
    const t0 = Date.now(); let st;
    for (;;) {
      await new Promise(r => setTimeout(r, 2000)); st = await page.evaluate(() => window.__bot.status());
      if (st.done || Date.now() - t0 > (maxT + 60) * 1000) break;
    }
    if (!st.done) await page.evaluate(() => window.__bot.stop());
    const wall = ((Date.now() - t0) / 1000).toFixed(0), fails = failsOf(s), geo = fails.length ? 'geometry FAIL (' + [...new Set(fails.map(p => p.r))].join(',') + ')' : 'geometry pass';
    const line = `${st.ok ? 'DRIVE ok  ' : 'DRIVE FAIL'} ${l.id} (${l.kind}) ${st.ok ? 'arrived' : st.why}${st.blockedAt ? ' blocked at ' + st.blockedAt[0] + ',' + st.blockedAt[1] + ' (' + st.blockedAt[2] + ' m along)' : ''} in ${st.t} game s, ${st.dist} m driven of ${st.len}, mean ${st.vmean} m/s, reroutes ${st.reroutes}, max off ${st.offMax} m; ${geo}; ${wall} s wall`;
    console.log(line + (win ? '; window ' + Math.round(win[0]) + '-' + Math.round(win[1]) + ' m of the line' : '')); results.push({ id: l.id, ok: st.ok, why: st.why, geo: !fails.length, st, win });
    if (!st.ok) { try { const url = await page.evaluate((x, z, f) => window.__rc.picture(x, z, f, 60), st.blockedAt ? st.blockedAt[0] : st.x, st.blockedAt ? st.blockedAt[1] : st.z, f); fs.writeFileSync(path.join(OUT, 'drive_' + l.id.replace(/[^a-z0-9]+/gi, '_').slice(0, 70) + '.jpg'), Buffer.from(url.split(',')[1], 'base64')); } catch (e) { /* no picture */ } }
  }
  const okN = results.filter(r => r.ok).length, geoPassDriveFail = results.filter(r => r.geo && !r.ok).length, geoFailDriveOk = results.filter(r => !r.geo && r.ok).length;
  console.log(`DRIVES ${results.length}: ok ${okN}, failed ${results.length - okN}; flagged by geometry and driven ${results.filter(r => !r.geo).length}, passed by geometry and driven ${results.filter(r => r.geo).length}; disagreements: geometry pass but drive failed ${geoPassDriveFail}, geometry fail but drive ok ${geoFailDriveOk}`);
  fs.writeFileSync(path.join(OUT, 'drives.json'), JSON.stringify(results, null, 1));
  log('drives done');
  return results;
}
