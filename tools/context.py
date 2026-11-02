"""Fetch the rest of Palermo (buildings + major roads) from OSM and bake context-data.js.

The playable area is the box BBOX below; this covers a ring around it out to CTX_BBOX.
Raw tiles are cached in data/context_tiles/, so reruns only fetch what is missing.

  python3 -I tools/context.py fetch     # download tiles (polite, sequential, retries)
  python3 -I tools/context.py bake      # tiles -> data/context_osm.json -> context-data.js
  python3 -I tools/context.py           # both

Local metres are the same as tools/bake.py: x east, z south, centred on Quattro Canti.
"""
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

LAT0, LON0 = 38.11572, 13.36126
KX = math.cos(math.radians(LAT0)) * 111320.0
KZ = 110540.0

BBOX = (38.1060, 13.3500, 38.1240, 13.3730)       # playable box (s, w, n, e), excluded here
CTX_BBOX = (38.07, 13.30, 38.17, 13.40)           # context area
TILE = 0.02                                       # degrees per query tile

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
UA = "palermo-drive-prototype/0.1 (hobby 3D map; contact https://github.com/EBonura/palermo-drive)"

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TILE_DIR = os.path.join(ROOT, "data", "context_tiles")
OSM_OUT = os.path.join(ROOT, "data", "context_osm.json")
JS_OUT = os.path.join(ROOT, "context-data.js")

ROAD_RE = "^(motorway|trunk|primary|secondary|tertiary)(_link)?$"


def proj(lat, lon):
    return (lon - LON0) * KX, -(lat - LAT0) * KZ


def tiles():
    s0, w0, n0, e0 = CTX_BBOX
    out = []
    la = s0
    while la < n0 - 1e-9:
        lo = w0
        while lo < e0 - 1e-9:
            out.append((round(la, 4), round(lo, 4), round(min(la + TILE, n0), 4), round(min(lo + TILE, e0), 4)))
            lo += TILE
        la += TILE
    return out


def query(bb):
    b = "%s,%s,%s,%s" % bb
    return ('[out:json][timeout:180];('
            'way["building"](%s);relation["building"](%s);'
            'way["highway"~"%s"](%s););out tags geom;' % (b, b, ROAD_RE, b))


def post(q, tries=8):
    delay = 20
    for t in range(tries):
        ep = ENDPOINTS[t % len(ENDPOINTS)]
        req = urllib.request.Request(ep, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                body = r.read()
            d = json.loads(body)
            if "elements" in d:
                return d
        except Exception as e:  # noqa: BLE001
            print("   retry (%s via %s)" % (str(e)[:60], ep.split("/")[2]), flush=True)
        time.sleep(delay)
        delay = min(delay * 1.5, 120)
    raise SystemExit("giving up on a tile")


def fetch():
    os.makedirs(TILE_DIR, exist_ok=True)
    ts = tiles()
    for i, bb in enumerate(ts):
        fn = os.path.join(TILE_DIR, "%s_%s.json" % (bb[0], bb[1]))
        if os.path.exists(fn):
            continue
        print("tile %d/%d %s" % (i + 1, len(ts), bb), flush=True)
        d = post(query(bb))
        with open(fn, "w") as f:
            json.dump(d["elements"], f, separators=(",", ":"))
        print("   %d elements" % len(d["elements"]), flush=True)
        time.sleep(5)


# ---------------------------------------------------------------- geometry

def area(pts):
    a = 0.0
    for i in range(len(pts)):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % len(pts)]
        a += x1 * z2 - x2 * z1
    return a / 2


def simplify(pts, tol):
    """Douglas-Peucker on a closed ring, plus dropping collinear vertices."""
    if len(pts) <= 4:
        return pts

    def dp(seg):
        if len(seg) < 3:
            return seg
        (x1, z1), (x2, z2) = seg[0], seg[-1]
        dx, dz = x2 - x1, z2 - z1
        L = math.hypot(dx, dz)
        best, bi = -1, 0
        for i in range(1, len(seg) - 1):
            x, z = seg[i]
            d = abs(dz * (x - x1) - dx * (z - z1)) / L if L > 1e-9 else math.hypot(x - x1, z - z1)
            if d > best:
                best, bi = d, i
        if best <= tol:
            return [seg[0], seg[-1]]
        return dp(seg[:bi + 1])[:-1] + dp(seg[bi:])
    # split the ring at the two points farthest apart so the start vertex isn't special
    n = len(pts)
    a = 0
    b = max(range(n), key=lambda i: (pts[i][0] - pts[a][0]) ** 2 + (pts[i][1] - pts[a][1]) ** 2)
    r1 = dp(pts[a:b + 1])
    r2 = dp(pts[b:] + pts[:a + 1])
    out = r1[:-1] + r2[:-1]
    return out if len(out) >= 3 else pts


def chain_rings(ways):
    """Join way fragments (lists of points) into closed rings."""
    ways = [w[:] for w in ways if len(w) >= 2]
    rings = []
    key = lambda p: (round(p[0], 1), round(p[1], 1))  # noqa: E731
    while ways:
        cur = ways.pop()
        guard = 0
        while key(cur[0]) != key(cur[-1]) and guard < 500:
            guard += 1
            for i, w in enumerate(ways):
                if key(w[0]) == key(cur[-1]):
                    cur += w[1:]
                elif key(w[-1]) == key(cur[-1]):
                    cur += w[::-1][1:]
                elif key(w[-1]) == key(cur[0]):
                    cur = w[:-1] + cur
                elif key(w[0]) == key(cur[0]):
                    cur = w[::-1][:-1] + cur
                else:
                    continue
                ways.pop(i)
                break
            else:
                break
        if key(cur[0]) == key(cur[-1]) and len(cur) >= 4:
            rings.append(cur[:-1])
    return rings


def parse_m(v):
    try:
        return float(str(v).lower().replace("m", "").replace(",", ".").strip())
    except ValueError:
        return None


def in_box(lat, lon):
    return BBOX[0] <= lat <= BBOX[2] and BBOX[1] <= lon <= BBOX[3]


# ---------------------------------------------------------------- heights

def hash01(n):
    n = (n * 2654435761) & 0xFFFFFFFF
    n ^= n >> 15
    n = (n * 2246822519) & 0xFFFFFFFF
    n ^= n >> 13
    return (n & 0xFFFFFF) / 0xFFFFFF


# building kind codes used by the renderer
K_RES, K_IND, K_LOW, K_VILLA, K_CIVIC, K_SHED = 0, 1, 2, 3, 4, 5


def classify(tags, a, lat, lon, bid):
    """Return (kind, height_m). Tagged height / levels win, otherwise estimate."""
    b = tags.get("building", "yes")
    r = hash01(bid)
    h = parse_m(tags["height"]) if "height" in tags else None
    lv = parse_m(tags["building:levels"]) if "building:levels" in tags else None
    if h is None and lv is not None and lv > 0:
        h = lv * 3.3 + 1.0
    # zones: Via Liberta corridor, port, hillside/low-rise rim
    liberta = 38.122 < lat < 38.150 and 13.341 < lon < 13.360
    port = 38.115 < lat < 38.135 and 13.363 < lon < 13.385 and (lat - 38.115) < 0.014
    if b in ("industrial", "warehouse", "hangar", "storage_tank", "silo", "factory", "service", "garage", "garages", "carport", "roof", "shed", "hut", "cabin", "greenhouse", "farm_auxiliary", "container"):
        kind = K_SHED if b not in ("storage_tank", "silo") else K_IND
        est = 6 + 4 * r if b in ("industrial", "warehouse", "hangar", "factory") else 3.2 + 1.5 * r
        if b in ("garage", "garages", "carport", "shed", "hut", "cabin", "greenhouse", "roof", "container"):
            est = 2.8 + r
    elif b in ("church", "cathedral", "chapel", "monastery", "mosque", "temple", "synagogue"):
        kind, est = K_CIVIC, 12 + 6 * r
    elif b in ("school", "university", "hospital", "public", "civic", "government", "hotel", "retail", "commercial", "office", "supermarket", "kindergarten", "train_station", "stadium", "sports_hall"):
        kind = K_CIVIC
        est = 12 + 8 * r if a > 600 else 9 + 5 * r
    elif b in ("house", "detached", "semidetached_house", "bungalow", "villa", "terrace"):
        kind = K_VILLA if liberta else K_LOW
        est = 7 + 5 * r if liberta else 5.5 + 2.5 * r
    else:  # yes, residential, apartments, ...
        if port:
            kind, est = K_SHED, 7 + 5 * r
        elif a < 45:
            kind, est = K_LOW, 4 + 4 * r
        elif liberta:
            if r < 0.35:
                kind, est = K_VILLA, 9 + 4 * r
            else:
                kind, est = K_RES, 22 + 9 * r      # 1960s blocks, 7 to 9 floors
        else:
            # post-war palazzine: mostly 5 to 8 floors, larger footprints go taller
            fl = 4 + 5 * r + min(2.0, a / 400.0)
            kind, est = K_RES, fl * 3.3 + 1.0
    return kind, (h if h else est), (h is not None)


# ---------------------------------------------------------------- bake

def q1(v):
    return int(round(v))


def bake():
    seen = set()
    blds, roads = [], []
    files = sorted(os.listdir(TILE_DIR)) if os.path.isdir(TILE_DIR) else []
    if not files:
        raise SystemExit("no tiles, run fetch first")
    for fn in files:
        with open(os.path.join(TILE_DIR, fn)) as f:
            els = json.load(f)
        for e in els:
            key = (e["type"], e["id"])
            if key in seen:
                continue
            seen.add(key)
            t = e.get("tags", {})
            if "building" in t:
                if t.get("building") in ("no",) or "tunnel" in t:
                    continue
                if e["type"] == "way":
                    g = e.get("geometry")
                    if not g or len(g) < 4:
                        continue
                    rings = [[(g_["lat"], g_["lon"]) for g_ in g[:-1 if g[0] == g[-1] else None]]]
                else:
                    frag = []
                    for m in e.get("members", []):
                        if m.get("role") in ("outer", "") and m.get("geometry"):
                            frag.append([(p["lat"], p["lon"]) for p in m["geometry"]])
                    rings = chain_rings(frag)
                for ring in rings:
                    if len(ring) < 3:
                        continue
                    clat = sum(p[0] for p in ring) / len(ring)
                    clon = sum(p[1] for p in ring) / len(ring)
                    if in_box(clat, clon):
                        continue
                    pts = [proj(*p) for p in ring]
                    a = abs(area(pts))
                    if a < 14:
                        continue
                    pts = simplify(pts, 1.0)
                    if len(pts) < 3 or abs(area(pts)) < 12:
                        continue
                    if area(pts) < 0:
                        pts = pts[::-1]
                    kind, h, tagged = classify(t, a, clat, clon, e["id"])
                    blds.append({"id": e["id"], "k": kind, "h": round(h, 1), "tag": tagged, "a": round(a), "p": [[round(x, 1), round(z, 1)] for x, z in pts]})
            elif "highway" in t and e["type"] == "way":
                if t.get("tunnel") not in (None, "no") or not e.get("geometry"):
                    continue
                hw = t["highway"].replace("_link", "")
                pts = [proj(p["lat"], p["lon"]) for p in e["geometry"]]
                roads.append({"id": e["id"], "c": hw, "p": [[round(x, 1), round(z, 1)] for x, z in pts]})
    with open(OSM_OUT, "w") as f:
        json.dump({"buildings": blds, "roads": roads}, f, separators=(",", ":"))
    print("merged: %d buildings, %d roads -> %s" % (len(blds), len(roads), OSM_OUT))

    # ---- compact context-data.js
    # building: [ox, oz, h (0.5 m units), kind, dx0, dz0, dx1, dz1, ...] with ox/oz whole metres and
    # deltas in decimetres from the origin. roads: [classIndex, ox, oz, dx, dz, ...] (decimetres).
    cls = ["motorway", "trunk", "primary", "secondary", "tertiary"]
    B = []
    for b in blds:
        ox, oz = q1(b["p"][0][0]), q1(b["p"][0][1])
        row = [ox, oz, q1(b["h"] * 2), b["k"]]
        for x, z in b["p"]:
            row += [q1((x - ox) * 10), q1((z - oz) * 10)]
        B.append(row)
    R = []
    for r in roads:
        if r["c"] not in cls:
            continue
        pts = [p for p in r["p"]]
        # drop segments inside the playable box (the game draws its own roads there)
        x0, z0 = proj(BBOX[2], BBOX[1])
        x1, z1 = proj(BBOX[0], BBOX[3])
        pts = [p for p in pts]
        runs, cur = [], []
        for p in pts:
            inside = x0 <= p[0] <= x1 and z0 <= p[1] <= z1
            if inside:
                if len(cur) > 1:
                    runs.append(cur)
                cur = []
            else:
                cur.append(p)
        if len(cur) > 1:
            runs.append(cur)
        for run in runs:
            run = simplify_open(run, 3.0)
            ox, oz = q1(run[0][0]), q1(run[0][1])
            row = [cls.index(r["c"]), ox, oz]
            for x, z in run:
                row += [q1((x - ox) * 10), q1((z - oz) * 10)]
            R.append(row)
    out = {"v": 1, "b": B, "r": R}
    with open(JS_OUT, "w") as f:
        f.write("window.PALERMO_CONTEXT=")
        json.dump(out, f, separators=(",", ":"))
        f.write(";\n")
    print("wrote %s: %d buildings, %d road lines, %.2f MB" % (JS_OUT, len(B), len(R), os.path.getsize(JS_OUT) / 1e6))


def simplify_open(pts, tol):
    if len(pts) < 3:
        return pts
    (x1, z1), (x2, z2) = pts[0], pts[-1]
    dx, dz = x2 - x1, z2 - z1
    L = math.hypot(dx, dz)
    best, bi = -1, 0
    for i in range(1, len(pts) - 1):
        x, z = pts[i]
        d = abs(dz * (x - x1) - dx * (z - z1)) / L if L > 1e-9 else math.hypot(x - x1, z - z1)
        if d > best:
            best, bi = d, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return simplify_open(pts[:bi + 1], tol)[:-1] + simplify_open(pts[bi:], tol)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd in ("fetch", "all"):
        fetch()
    if cmd in ("bake", "all"):
        bake()
