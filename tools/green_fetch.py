"""Download the open datasets behind data/trees.json, tree_rows.json, verges.json and walls.json (see tools/green.py).

Each source goes into its own new, empty folder that you pass on the command line; nothing here reads or writes anywhere else.
Pages are cached as they arrive, so an interrupted run can be repeated on the same folder.

    tools/.venv/bin/python -I tools/green_fetch.py ctr   <empty dir>   # Regione Siciliana CTR 1:10,000 (2012-13), CC BY 4.0
    tools/.venv/bin/python -I tools/green_fetch.py ua    <empty dir>   # Copernicus Urban Atlas Street Tree Layer 2018
    tools/.venv/bin/python -I tools/green_fetch.py verde <empty dir>   # Comune di Palermo "Area Verde" shapefile, CC BY 4.0

Requests are made one at a time with a pause between them (--delay, default 1 s) and 500 features per request.
The area is the game's bounding box (tools/tiles.py BBOX_LL). Downloads are untrusted data: green.py reads them with -I and never
executes anything from them.
"""
import argparse
import json
import os
import sys
import time
import zipfile

import requests
from pyproj import Transformer

BBOX_LL = (38.045, 13.235, 38.230, 13.455)  # s, w, n, e, same as tools/tiles.py
UA = "palermo-drive-prototype/0.1 (green_fetch; sequential, cached; CC BY 4.0 data)"

CTR = "https://map.sitr.regione.sicilia.it/gis/rest/services/ctr_10000/ctr_2013_dbtrs/MapServer"
# 6 vegetation symbols (Albero isolato, Pino, Olivo ...), 24 walls/fences/hedges, 25 tree rows and field limits,
# 26 vegetation areas (parks, orchards, scrub), 27 citrus groves
CTR_LAYERS = (6, 24, 25, 26, 27)
UA_URL = "https://copernicus.discomap.eea.europa.eu/arcgis/rest/services/UrbanAtlas/UA_StreetTreeLayer_2018/MapServer/0"
VERDE_URL = "https://opendata.comune.palermo.it/js/server/uploads/dataset/shp/_10012018113342.zip"
CHUNK = 500


def envelope(epsg, margin_m=300):
    s, w, n, e = BBOX_LL
    t = Transformer.from_crs(4326, epsg, always_xy=True)
    pts = [t.transform(lon, lat) for lat in (s, n) for lon in (w, e)]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return {"xmin": min(xs) - margin_m, "ymin": min(ys) - margin_m, "xmax": max(xs) + margin_m, "ymax": max(ys) + margin_m,
            "spatialReference": {"wkid": epsg}}


def post(url, data, tries=5):
    last = None
    for a in range(tries):
        try:
            r = requests.post(url, data=data, headers={"User-Agent": UA}, timeout=180)
            r.raise_for_status()
            j = r.json()
            if "error" in j:
                raise RuntimeError(str(j["error"])[:300])
            return j
        except (requests.RequestException, ValueError, RuntimeError) as ex:
            last = ex
            time.sleep(min(60, 4 * 3 ** a))
    raise RuntimeError(f"giving up on {url}: {last}")


def check_empty(d, allow_existing=True):
    os.makedirs(d, exist_ok=True)
    if not allow_existing and os.listdir(d):
        sys.exit(f"{d} is not empty")


def arcgis_layer(base, layer, out_dir, name, in_epsg, out_epsg, delay):
    """All features of one layer inside the envelope, as raw ArcGIS JSON pages in out_dir (ids first, then 500 per POST)."""
    url = f"{base}/{layer}/query"
    ids_path = os.path.join(out_dir, f"{name}_ids.json")
    if os.path.exists(ids_path):
        ids = json.load(open(ids_path))
    else:
        j = post(url, {"f": "json", "where": "1=1", "geometry": json.dumps(envelope(in_epsg)), "geometryType": "esriGeometryEnvelope",
                       "inSR": in_epsg, "spatialRel": "esriSpatialRelIntersects", "returnIdsOnly": "true"})
        ids = sorted(j.get("objectIds") or [])
        json.dump(ids, open(ids_path, "w"))
        time.sleep(delay)
    print(f"{name}: {len(ids)} features", flush=True)
    for k in range(0, len(ids), CHUNK):
        p = os.path.join(out_dir, f"{name}_{k // CHUNK:04d}.json")
        if os.path.exists(p):
            continue
        j = post(url, {"f": "json", "objectIds": ",".join(map(str, ids[k:k + CHUNK])), "outFields": "*", "returnGeometry": "true",
                       "outSR": out_epsg})
        if "features" not in j:
            raise RuntimeError(f"{name} page {k}: no features")
        with open(p + ".part", "w") as f:
            json.dump(j, f)
        os.replace(p + ".part", p)
        print(f"  {name} {min(k + CHUNK, len(ids))}/{len(ids)}", flush=True)
        time.sleep(delay)


def fetch_ctr(d, delay):
    check_empty(d)
    for layer in CTR_LAYERS:
        arcgis_layer(CTR, layer, d, f"layer{layer}", 25833, 25833, delay)


def fetch_ua(d, delay):
    check_empty(d)
    arcgis_layer(UA_URL[:UA_URL.rindex("/")], int(UA_URL.rsplit("/", 1)[1]), d, "stl", 3857, 4326, delay)


def fetch_verde(d, delay):
    check_empty(d)
    z = os.path.join(d, "verde.zip")
    if not os.path.exists(z):
        r = requests.get(VERDE_URL, headers={"User-Agent": UA}, timeout=180)
        r.raise_for_status()
        if not r.content.startswith(b"PK"):
            sys.exit("the Comune download is not a zip file (the dataset page may have moved)")
        open(z, "wb").write(r.content)
    with zipfile.ZipFile(z) as zf:
        for info in zf.infolist():
            base = os.path.basename(info.filename)
            if info.is_dir() or not base or base.startswith(".") or os.path.splitext(base)[1].lower() not in (".shp", ".shx", ".dbf", ".prj", ".cpg"):
                continue
            with open(os.path.join(d, base), "wb") as f:
                f.write(zf.read(info))
    print(sorted(os.listdir(d)))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", choices=("ctr", "ua", "verde"))
    ap.add_argument("dir")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between requests")
    a = ap.parse_args()
    {"ctr": fetch_ctr, "ua": fetch_ua, "verde": fetch_verde}[a.source](a.dir, a.delay)


if __name__ == "__main__":
    main()
