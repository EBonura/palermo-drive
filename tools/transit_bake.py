"""Bus stops and drinking fountains from the open-data lists, as props for the world tiles (tools/tiles.py calls these in build()).

  data/bus_routes.json (AMAT GTFS, CC BY 4.0): the stops that have no OSM bus stop within 40 m (481 of 1,594) become `busstop` props, named.
  data/fountains.json: the 150 Comune fountains (AMAP list, 2019, CC BY 4.0; 133 fontanelle drinking taps, 17 fontane) that have no OSM node within 25 m become
  `water` (a drinking tap) or `fountain` props; the OSM `drinking_water` nodes are already props (kind `water`), they are only drawn now (src/props.js).
"""
import json
import math
import os


def busstop_items(path, T):
    if not os.path.exists(path):
        return {}
    out = {}
    for s in json.load(open(path))["stops"]:
        m = s.get("osm_stop_m")
        if m is not None and m <= 40:
            continue
        out.setdefault(f"{math.floor(s['x'] / T)}_{math.floor(s['z'] / T)}", []).append({"k": "busstop", "x": round(s["x"], 1), "z": round(s["z"], 1), "n": s["name"], "g": 1})
    return out


def fountain_items(path, T):
    if not os.path.exists(path):
        return {}
    out = {}
    for f in json.load(open(path))["comune"]:
        if f.get("duplicate") or (f.get("osm_m") is not None and f["osm_m"] <= 25):
            continue
        k = "fountain" if f["kind"] == "fontana" else "water"
        out.setdefault(f"{math.floor(f['x'] / T)}_{math.floor(f['z'] / T)}", []).append({"k": k, "x": round(f["x"], 1), "z": round(f["z"], 1), "n": f["address"].title(), "g": 1})
    return out
