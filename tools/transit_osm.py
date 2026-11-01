#!/usr/bin/env python3
"""Cut the Palermo tram out of the project's OSM extract (Geofabrik, ODbL) into a small cache.

  tools/.venv/bin/python -I tools/transit_osm.py [data/city/isole-latest.osm.pbf] [data/tram_osm.json]

Keeps, around the AMAT tram network only: railway=tram ways, tram stops and platforms, the route=tram relations (AMAT
L1 to L4), the roads and barriers next to the tracks (to tell a street tram from a railed median) and any power poles.
City wide it also keeps the tags of every route=bus relation, the highway=bus_stop nodes and the amenity=drinking_water
nodes, which tools/transit.py compares with the AMAT GTFS and the Comune fountain list.
Coordinates stay WGS84 here; tools/transit.py projects them. Runs in about a minute (nodes are read once with locations).
"""
import json
import os
import sys

import osmium

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PBF = os.path.join(ROOT, "data", "city", "isole-latest.osm.pbf")
OUT = os.path.join(ROOT, "data", "tram_osm.json")
CITY = (37.95, 13.15, 38.25, 13.50)   # s, w, n, e: the city; Messina and Cagliari have trams too, so they are cut away
MARGIN = 0.004                        # degrees around the tram ways in which roads and barriers are kept
BARRIERS = {"fence", "guard_rail", "wall", "handrail", "kerb", "retaining_wall", "gate", "bollard"}


def tags_of(o):
    return {t.k: t.v for t in o.tags}


def in_box(lat, lon, box):
    return box[0] <= lat <= box[2] and box[1] <= lon <= box[3]


def main(pbf, out):
    # pass 1: relations (route=tram of the Palermo network)
    rels, bus_rels = [], []
    for r in osmium.FileProcessor(pbf, osmium.osm.RELATION).with_filter(osmium.filter.KeyFilter("route")):
        t = tags_of(r)
        if t.get("route") == "bus":
            bus_rels.append({"id": r.id, "tags": t, "members": len(r.members)})
        if t.get("route") == "tram" and t.get("operator") == "AMAT":
            rels.append({"id": r.id, "tags": t, "members": [{"type": m.type, "ref": m.ref, "role": m.role} for m in r.members]})
    print(f"{len(rels)} AMAT tram relations")

    # pass 2: ways with locations, tram first; then the neighbourhood is known and the rest is filtered by it
    ways, others, nodes, bus_stops, water = [], [], [], [], []
    fp = osmium.FileProcessor(pbf, osmium.osm.NODE | osmium.osm.WAY).with_locations()
    for o in fp:
        if not len(o.tags):
            continue
        t = tags_of(o)
        if o.is_node():
            lat, lon = o.location.lat, o.location.lon
            if not in_box(lat, lon, CITY):
                continue
            if t.get("highway") == "bus_stop" or (t.get("public_transport") == "platform" and t.get("bus") == "yes"):
                bus_stops.append({"id": o.id, "lat": lat, "lon": lon, "tags": t})
            if t.get("amenity") == "drinking_water":
                water.append({"id": o.id, "lat": lat, "lon": lon, "tags": t})
            if (t.get("railway") in ("tram_stop", "tram_crossing", "buffer_stop", "signal") or t.get("tram") == "yes"
                    or t.get("power") in ("pole", "catenary_mast") or t.get("railway:catenary_mast")):
                nodes.append({"id": o.id, "lat": lat, "lon": lon, "tags": t})
            continue
        if not (t.get("railway") in ("tram", "platform") or t.get("highway") or t.get("barrier") in BARRIERS):
            continue
        pts = [(n.lat, n.lon) for n in o.nodes if n.location.valid()]
        if len(pts) < 2 or not in_box(pts[0][0], pts[0][1], CITY):
            continue
        el = {"id": o.id, "tags": t, "pts": [[round(a, 7), round(b, 7)] for a, b in pts]}
        (ways if t.get("railway") == "tram" else others).append(el)
    print(f"{len(ways)} tram ways, {len(others)} other ways in the city, {len(nodes)} candidate nodes, "
          f"{len(bus_rels)} bus relations, {len(bus_stops)} bus stops, {len(water)} drinking water nodes")
    # AMAT network only: Palermo ways are the ones the relations use or that carry operator AMAT
    keep_ids = {m["ref"] for r in rels for m in r["members"] if m["type"] == "w"}
    ways = [w for w in ways if w["id"] in keep_ids or w["tags"].get("operator") == "AMAT"]
    s = min(p[0] for w in ways for p in w["pts"]) - MARGIN
    n = max(p[0] for w in ways for p in w["pts"]) + MARGIN
    wst = min(p[1] for w in ways for p in w["pts"]) - MARGIN
    e = max(p[1] for w in ways for p in w["pts"]) + MARGIN
    box = (s, wst, n, e)
    others = [w for w in others if any(in_box(p[0], p[1], box) for p in w["pts"])
              and (w["tags"].get("highway") or w["tags"].get("barrier") or w["tags"].get("tram") == "yes")]
    nodes = [d for d in nodes if in_box(d["lat"], d["lon"], box)]
    print(f"kept: {len(ways)} tram ways, {len(others)} roads and barriers and platforms, {len(nodes)} nodes, box {box}")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"source": "OpenStreetMap contributors, ODbL (Geofabrik extract)", "box": box, "relations": rels,
                   "tram_ways": ways, "other_ways": others, "nodes": nodes,
                   "bus_relations": bus_rels, "bus_stops": bus_stops, "drinking_water": water}, f, separators=(",", ":"), ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else PBF, sys.argv[2] if len(sys.argv) > 2 else OUT)
