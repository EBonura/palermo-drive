"""Fetch street furniture from OpenStreetMap (Overpass) and write props-data.js.

Output is window.PALERMO_PROPS = {...} in the same local metre coordinates as palermo-data.js
(x east, z south, centred on Quattro Canti). Raw dump goes to data/props_osm.json.

Usage: python3 -I tools/props.py            (fetches, then bakes)
       python3 -I tools/props.py --offline  (re-bake from data/props_osm.json)
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
BB = "38.1060,13.3500,38.1240,13.3730"  # s, w, n, e (same as bake.py BBOX)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
RAW = os.path.join(ROOT, "data", "props_osm.json")
OUT = os.path.join(ROOT, "props-data.js")

QUERY = f"""[out:json][timeout:120];
(
  node["natural"="tree"]({BB});
  way["natural"="tree_row"]({BB});
  node["highway"="street_lamp"]({BB});
  node["amenity"~"^(waste_disposal|waste_basket|recycling|bench|fountain|drinking_water|bicycle_parking|motorcycle_parking|parking_entrance|taxi|post_box|telephone|bicycle_rental|atm|fuel|marketplace|vending_machine|clock)$"]({BB});
  way["amenity"~"^(parking|fountain|marketplace|bicycle_parking|motorcycle_parking)$"]({BB});
  node["man_made"]({BB});
  node["barrier"~"^(bollard|cycle_barrier|gate|lift_gate|block)$"]({BB});
  way["barrier"~"^(fence|wall|guard_rail|handrail|bollard)$"]({BB});
  node["highway"~"^(crossing|bus_stop|traffic_signals|stop|give_way|speed_camera)$"]({BB});
  node["public_transport"~"^(platform|stop_position)$"]({BB});
  node["shop"]({BB});
  node["amenity"~"^(cafe|bar|restaurant|ice_cream|pub|fast_food)$"]({BB});
  node["tourism"~"^(artwork|attraction|viewpoint|information)$"]({BB});
  node["memorial"]({BB});
  node["historic"]({BB});
  node["leisure"~"^(playground|fitness_station)$"]({BB});
  node["emergency"="fire_hydrant"]({BB});
);
out body;
>;
out skel qt;
"""


def proj(lat, lon):
    return round((lon - LON0) * KX, 1), round(-(lat - LAT0) * KZ, 1)


def fetch():
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    last = None
    for url in ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"):
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, data=data, headers={"User-Agent": "palermo-drive-prototype/0.1 (props)"})
                with urllib.request.urlopen(req, timeout=180) as r:
                    raw = r.read()
                json.loads(raw)
                open(RAW, "wb").write(raw)
                return
            except Exception as e:  # noqa: BLE001
                last = e
                print("fetch failed", url, e, file=sys.stderr)
                time.sleep(5 * (attempt + 1))
    raise SystemExit(f"Overpass failed: {last}")


def kind_of(t):
    """Map OSM tags to one of our prop kinds, or None."""
    n = t.get("natural")
    if n == "tree":
        return "tree"
    h = t.get("highway")
    if h == "street_lamp":
        return "lamp"
    if h == "crossing":
        return "crossing"
    if h in ("bus_stop",) or t.get("public_transport") == "platform":
        return "busstop"
    if h == "traffic_signals":
        return "signal"
    a = t.get("amenity")
    if a in ("waste_disposal", "recycling"):
        return "bin_big"
    if a == "waste_basket":
        return "bin_small"
    if a == "bench":
        return "bench"
    if a == "fountain":
        return "fountain"
    if a == "drinking_water":
        return "water"
    if a in ("bicycle_parking", "motorcycle_parking"):
        return "bikepark"
    if a in ("cafe", "bar", "restaurant", "ice_cream", "pub", "fast_food"):
        return "cafe"
    if a == "post_box":
        return "postbox"
    if a == "telephone":
        return "phone"
    if a == "fuel":
        return "fuel"
    if t.get("emergency") == "fire_hydrant":
        return "hydrant"
    b = t.get("barrier")
    if b in ("bollard", "block", "cycle_barrier", "lift_gate"):
        return "bollard"
    if t.get("tourism") == "artwork" or t.get("memorial") or t.get("historic") in ("memorial", "monument", "wayside_cross", "wayside_shrine"):
        return "monument"
    if t.get("man_made") in ("flagpole", "street_cabinet", "surveillance", "utility_pole", "pole"):
        return t["man_made"]
    if t.get("shop"):
        return "shop"
    return None


def main():
    if "--offline" not in sys.argv:
        fetch()
    els = json.load(open(RAW))["elements"]
    nodes = {e["id"]: e for e in els if e["type"] == "node"}
    out = {"attribution": "Street furniture: OpenStreetMap contributors, ODbL", "items": [], "areas": [], "counts": {}}
    counts = out["counts"]
    for e in els:
        t = e.get("tags")
        if not t:
            continue
        if e["type"] == "node":
            k = kind_of(t)
            if not k:
                continue
            x, z = proj(e["lat"], e["lon"])
            it = {"k": k, "x": x, "z": z}
            for src, dst in (("species", "sp"), ("genus", "ge"), ("leaf_type", "lt"), ("leaf_cycle", "lc"), ("height", "h"),
                             ("name", "n"), ("shop", "shop"), ("direction", "dir"), ("lamp_mount", "mount"), ("support", "support"),
                             ("denotation", "den"), ("crossing", "cr"), ("traffic_signals", "ts"), ("lamp_type", "ltype"),
                             ("waste", "waste"), ("backrest", "back"), ("seats", "seats"), ("capacity", "cap"),
                             ("artwork_type", "art"), ("amenity", "am"), ("outdoor_seating", "out"), ("memorial", "mem"), ("tourism", "tour"), ("man_made", "mm")):
                if t.get(src):
                    it[dst] = t[src]
            out["items"].append(it)
            counts[k] = counts.get(k, 0) + 1
        elif e["type"] == "way":
            a = t.get("amenity")
            pts = [proj(nodes[n]["lat"], nodes[n]["lon"]) for n in e.get("nodes", []) if n in nodes]
            if len(pts) < 2:
                continue
            flat = [c for p in pts for c in p]
            if t.get("natural") == "tree_row":
                out["areas"].append({"k": "tree_row", "p": flat})
                counts["tree_row"] = counts.get("tree_row", 0) + 1
            elif a in ("parking", "bicycle_parking", "motorcycle_parking"):
                out["areas"].append({"k": "parking" if a == "parking" else "bikepark", "p": flat,
                                     "ptype": t.get("parking", ""), "access": t.get("access", ""), "cap": t.get("capacity", "")})
                counts["parking_area"] = counts.get("parking_area", 0) + 1
            elif a == "marketplace":
                out["areas"].append({"k": "market", "p": flat})
                counts["market_area"] = counts.get("market_area", 0) + 1
            elif a == "fountain":
                out["areas"].append({"k": "fountain", "p": flat})
                counts["fountain_area"] = counts.get("fountain_area", 0) + 1
            elif t.get("barrier") in ("fence", "guard_rail", "handrail", "bollard"):
                out["areas"].append({"k": "fence", "p": flat, "b": t["barrier"]})
                counts["fence"] = counts.get("fence", 0) + 1
    with open(OUT, "w") as f:
        f.write("window.PALERMO_PROPS = " + json.dumps(out, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print("wrote", OUT, counts)


if __name__ == "__main__":
    main()
