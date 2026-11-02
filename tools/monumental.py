"""Monumental trees of Palermo as tree prop items (board item d2, see docs/sources/street-furniture.md).

Source: Regione Siciliana, "Alberi Monumentali di Sicilia" (dati.regione.sicilia.it, CKAN licence cc-by), list under L. 10/2013 and DM 23 Oct 2014, updated 5 May 2021.
data/monumental_trees.geojson is that dataset's GeoJSON (git-ignored like the other data/ files; fetch() downloads it again).

A point is a tree the survey measured: species, trunk circumference, height. The bake turns the ones in the Comune of Palermo into `tree` items
({k, x, z, r, h, kd | ge}) that src/props.js already draws (a model by `ge`/`kd`, scaled to the crown radius `r`), and drops the generic tree items
(OSM, CTR, lidar, Urban Atlas lattice) that stand where the real one does, so the same tree is not drawn twice. Groups ("Insieme omogeneo di ...",
one point for a whole palm avenue) are skipped: one tree at the point would be wrong.
Crown radius is not in the dataset: `r = clamp(0.35 * height, 3, 9)` is a game value (the in-game ficus is scaled by r / 2.7, at most 2.4 times).
"""
import json
import math
import os
import re
import urllib.request

from bake import KX, KZ, LAT0, LON0

URL = ("https://dati.regione.sicilia.it/dataset/e97e6962-69db-4de8-b321-1795dd4e0b58/resource/"
       "05ae82f3-077a-4e9f-9430-099692cec8f0/download/alberi-monumentali-sicilia.geojson")
CREDIT = "Monumental trees: Regione Siciliana, Alberi Monumentali di Sicilia (open data, 2021), CC BY"
COMUNE = "Palermo"
MONOCOT = re.compile(r"Dracaena|Dracena|Nolina|Yucca", re.I)
CONIFER = re.compile(r"Cupressus|Araucaria|Pinus|Cedrus", re.I)
PALM = re.compile(r"Washingtonia|Phoenix|Trachycarpus|Chamaerops|Livistona", re.I)


def fetch(path):
    req = urllib.request.Request(URL, headers={"User-Agent": "palermo-drive-bake"})
    with urllib.request.urlopen(req, timeout=60) as r, open(path + ".part", "wb") as f:
        f.write(r.read())
    os.replace(path + ".part", path)


def _height(s):
    m = re.search(r"[\d]+(?:[.,]\d+)?", str(s or ""))
    return float(m.group(0).replace(",", ".")) if m else None


def load(path):
    """-> [{x, z, id, sci, h, item}] for the single monumental trees of the Comune of Palermo."""
    if not os.path.exists(path):
        return []
    out = []
    for f in json.load(open(path))["features"]:
        p = f["properties"]
        if p.get("COMUNE") != COMUNE or not f.get("geometry"):
            continue
        sci = (p.get("SPECIE NOME SCIENTIFICO") or "").strip()
        if re.match(r"(?i)insieme", sci):
            continue
        lon, lat = f["geometry"]["coordinates"][:2]
        x, z = (lon - LON0) * KX, (LAT0 - lat) * KZ
        h = _height(p.get("ALTEZZA (m)"))
        it = {"k": "tree", "x": round(x, 1), "z": round(z, 1)}
        if h:
            it["h"] = round(h, 1)
            it["r"] = round(max(3.0, min(9.0, 0.35 * h)), 1)
        genus = sci.split(" ")[0] if sci else ""
        if re.match(r"(?i)ficus", genus) or PALM.match(genus):
            it["ge"], it["sp"] = genus.capitalize(), sci
        elif re.match(r"(?i)olea", genus):
            it["kd"] = "olive"
        elif CONIFER.match(genus):
            it["kd"] = "pine"
        elif MONOCOT.match(genus):
            it["kd"] = "tall"
        elif "r" in it:
            it["r"] = min(it["r"], 4.2)     # props.js draws any broadleaf with a crown over 4.2 m as a ficus
        out.append({"x": x, "z": z, "id": p.get("ID SCHEDA"), "sci": sci, "item": it})
    return out


def apply(path, tile_props, T, inside, log=print):
    """Add the monumental trees to tile_props ({'i_j': [item]}), dropping generic tree items they replace. -> (added, dropped)."""
    added = dropped = 0
    for t in load(path):
        if not inside(t["x"], t["z"]):
            continue
        key = "%d_%d" % (math.floor(t["x"] / T), math.floor(t["z"] / T))
        rad = max(4.0, 0.7 * (t["item"].get("r") or 3.0))
        keep = []
        for q in tile_props.get(key, []):
            if q.get("k") == "tree" and math.hypot(q["x"] - t["x"], q["z"] - t["z"]) < rad:
                dropped += 1
            else:
                keep.append(q)
        keep.append(t["item"])
        tile_props[key] = keep
        added += 1
    log(f"  monumental trees: {added} added, {dropped} generic trees replaced")
    return added, dropped
