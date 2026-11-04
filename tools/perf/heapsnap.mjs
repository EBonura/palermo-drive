// V8 heap snapshot, parsed while it streams in (HeapProfiler.addHeapSnapshotChunk), so nothing is written to disk and no string over V8's 512 MB limit is ever built.
// Then the dominator tree (Cooper, Harvey and Kennedy, as Chrome DevTools does it: weak edges do not retain) and retained sizes.
//   const p = snapshotParser(); cdp.on('HeapProfiler.addHeapSnapshotChunk', e => p.push(e.chunk)); await cdp.send('HeapProfiler.takeHeapSnapshot'); const s = analyse(p.end());
// Used by tools/perf/memory.mjs.

export function snapshotParser() {
  let stage = 0, head = '', arr = null, n = 0, num = -1, sec = '';
  const strings = []; let inStr = false, esc = false, uni = 0, uniBuf = '', cur = [], tail = '';
  const S = {};
  const want = ['"nodes":[', '"edges":[', '"strings":['];
  function startArray(name, len) { sec = name; arr = new Uint32Array(len); n = 0; num = -1; }
  // stage 0: meta up to "nodes":[, 1: nodes, 2: skip to "edges":[, 3: edges, 4: skip to "strings":[, 5: strings, 6: done
  function push(chunk) {
    let i = 0;
    while (i < chunk.length) {
      if (stage === 0 || stage === 2 || stage === 4) {
        const s = tail + chunk.slice(i), key = want[stage >> 1], k = s.indexOf(key);
        if (stage === 0) head += chunk.slice(i);
        if (k < 0) { tail = s.slice(-16); return; }
        if (stage === 0) {
          const h = head.slice(0, head.indexOf(key)), m = JSON.parse(h.slice(h.indexOf('{', 1), h.lastIndexOf('}') + 1));
          S.meta = m.meta; S.nodeCount = m.node_count; S.edgeCount = m.edge_count;
          startArray('nodes', m.node_count * m.meta.node_fields.length);
          head = '';
        } else if (stage === 2) startArray('edges', S.edgeCount * S.meta.edge_fields.length);
        const consumed = k + key.length - tail.length;   // characters of this chunk used up to the end of the key
        i += consumed; tail = ''; stage++;
        continue;
      }
      if (stage === 1 || stage === 3) {
        let closed = false;
        for (; i < chunk.length; i++) {
          const c = chunk.charCodeAt(i);
          if (c >= 48 && c <= 57) num = num < 0 ? c - 48 : num * 10 + c - 48;
          else { if (num >= 0) { arr[n++] = num; num = -1; } if (c === 93) { i++; closed = true; break; } }   // ]
        }
        if (closed) {
          if (sec === 'nodes') { S.nodes = arr; stage = 2; } else { S.edges = arr; stage = 4; }
          arr = null;
        }
        continue;
      }
      if (stage === 5) {
        for (; i < chunk.length; i++) {
          const c = chunk.charCodeAt(i);
          if (!inStr) { if (c === 34) { inStr = true; cur = []; } else if (c === 93) { stage = 6; return; } continue; }
          if (uni) { uniBuf += chunk[i]; if (--uni === 0) cur.push(String.fromCharCode(parseInt(uniBuf, 16))); continue; }
          if (esc) { esc = false; if (c === 117) { uni = 4; uniBuf = ''; } else cur.push({ 110: '\n', 116: '\t', 114: '\r', 98: '\b', 102: '\f' }[c] || chunk[i]); continue; }
          if (c === 92) { esc = true; continue; }
          if (c === 34) { inStr = false; strings.push(cur.join('')); continue; }
          // a plain run: take it in one slice
          let j = i; while (j < chunk.length) { const d = chunk.charCodeAt(j); if (d === 34 || d === 92) break; j++; }
          cur.push(chunk.slice(i, j)); i = j - 1;
        }
        return;
      }
      return;
    }
  }
  function end() { S.strings = strings; return S; }
  return { push, end };
}

// -> { N, name(i), type(i), self(i), retained Float64Array, idom Int32Array, edgesOf(i, fn), findProp(nodeIdx, name), ... }
export function analyse(S) {
  const NF = S.meta.node_fields.length, EF = S.meta.edge_fields.length, N = S.nodeCount;
  const nT = S.meta.node_fields.indexOf('type'), nN = S.meta.node_fields.indexOf('name'), nS = S.meta.node_fields.indexOf('self_size'), nE = S.meta.node_fields.indexOf('edge_count');
  const eT = S.meta.edge_fields.indexOf('type'), eN = S.meta.edge_fields.indexOf('name_or_index'), eTo = S.meta.edge_fields.indexOf('to_node');
  const nodeTypes = S.meta.node_types[nT], edgeTypes = S.meta.edge_types[eT];
  const WEAK = edgeTypes.indexOf('weak'), ELEM = edgeTypes.indexOf('element'), HID = edgeTypes.indexOf('hidden');
  const nodes = S.nodes, edges = S.edges, str = S.strings;
  const first = new Uint32Array(N + 1);
  for (let i = 0; i < N; i++) first[i + 1] = first[i] + nodes[i * NF + nE];
  const to = i => edges[i * EF + eTo] / NF;
  // reachable through strong edges: iterative DFS, post-order numbers
  const post = new Int32Array(N).fill(-1), order = new Uint32Array(N), stack = new Uint32Array(N), it = new Uint32Array(N), seen = new Uint8Array(N);
  let sp = 0, pc = 0; stack[sp++] = 0; seen[0] = 1; it[0] = first[0];
  while (sp) {
    const v = stack[sp - 1];
    if (it[v] < first[v + 1]) {
      const e = it[v]++;
      if (edges[e * EF + eT] === WEAK) continue;
      const w = to(e); if (seen[w]) continue;
      seen[w] = 1; it[w] = first[w]; stack[sp++] = w;
    } else { sp--; post[v] = pc; order[pc++] = v; }
  }
  const R = pc;   // reachable count; root has post R - 1
  // predecessors in post-order numbering
  const pcount = new Uint32Array(R + 1);
  for (let v = 0; v < N; v++) { if (post[v] < 0) continue; for (let e = first[v]; e < first[v + 1]; e++) { if (edges[e * EF + eT] === WEAK) continue; const w = to(e); if (post[w] >= 0) pcount[post[w] + 1]++; } }
  for (let i = 0; i < R; i++) pcount[i + 1] += pcount[i];
  const preds = new Uint32Array(pcount[R]), fill = pcount.slice(0, R);
  for (let v = 0; v < N; v++) { if (post[v] < 0) continue; for (let e = first[v]; e < first[v + 1]; e++) { if (edges[e * EF + eT] === WEAK) continue; const w = to(e); if (post[w] >= 0) preds[fill[post[w]]++] = post[v]; } }
  const dom = new Int32Array(R).fill(-1); dom[R - 1] = R - 1;
  for (let changed = true, pass = 0; changed; pass++) {
    changed = false;
    for (let b = R - 2; b >= 0; b--) {
      let nd = -1;
      for (let k = pcount[b]; k < pcount[b + 1]; k++) {
        let p = preds[k]; if (dom[p] < 0) continue;
        if (nd < 0) { nd = p; continue; }
        let a = p, c = nd; while (a !== c) { while (a < c) a = dom[a]; while (c < a) c = dom[c]; } nd = a;
      }
      if (nd >= 0 && dom[b] !== nd) { dom[b] = nd; changed = true; }
    }
    if (pass > 200) break;
  }
  const retained = new Float64Array(N), idom = new Int32Array(N).fill(-1);
  for (let b = 0; b < R; b++) { const v = order[b]; retained[v] += nodes[v * NF + nS]; if (b < R - 1) { const d = order[dom[b]]; idom[v] = d; retained[d] += retained[v]; } }
  const name = i => { const t = nodeTypes[nodes[i * NF + nT]]; const x = nodes[i * NF + nN]; return t === 'number' ? '(number)' : str[x]; };
  const type = i => nodeTypes[nodes[i * NF + nT]];
  const self = i => nodes[i * NF + nS];
  const edgesOf = (i, fn) => { for (let e = first[i]; e < first[i + 1]; e++) { const et = edges[e * EF + eT], en = edges[e * EF + eN]; fn(edgeTypes[et], et === ELEM || et === HID ? en : str[en], to(e)); } };
  const prop = (i, nm) => { let r = -1; edgesOf(i, (t, n, w) => { if (r < 0 && n === nm && t !== 'weak') r = w; }); return r; };
  return { N, R, name, type, self, retained, idom, edgesOf, prop, strings: str, reachable: v => post[v] >= 0 };
}
