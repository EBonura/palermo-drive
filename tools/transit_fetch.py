#!/usr/bin/env python3
"""Download the open transit data of Palermo (Comune di Palermo open data portal, CC BY 4.0).

  tools/.venv/bin/python -I tools/transit_fetch.py <gtfs_dir> <fountains_dir> [--dataset N] [--today YYYY-MM-DD]

Downloads are untrusted data: each goes into its own new, empty directory that is passed in as an argument, the zip is
unpacked without trusting its member names, and nothing in there is ever executed. Then run
  tools/.venv/bin/python -I tools/transit.py <gtfs_dir> <fountains_dir>/fontanelle.csv

AMAT GTFS: the catalogue (opendata-dataset.php?dataset=N) lists one dataset per edition, ids rising with time. This walks
the ids upwards from the last edition we know about and takes the newest one that covers today; if none does (the
feed expired and the next one is not out yet) it takes the latest edition and says so.
Fountains: dataset 1249, the CSV behind its "Apri risorsa" link.
"""
import datetime
import os
import re
import sys
import zipfile

import requests

PORTAL = "https://opendata.comune.palermo.it/"
FIRST_ID = 1807          # AMAT GTFS, 25/08/2026 to 31/10/2026 when this was written; later editions have higher ids
LOOK_AHEAD = 12          # ids tried past the last good one
FOUNTAINS_CSV = PORTAL + "ws.php?id=1905&fmt=csv"
UA = {"User-Agent": "palermo-drive-prototype/0.1 (open data fetch)"}


def get(url, **kw):
    r = requests.get(url, headers=UA, timeout=180, **kw)
    r.raise_for_status()
    return r


def fresh_dir(path):
    os.makedirs(path, exist_ok=True)
    if os.listdir(path):
        sys.exit(f"{path} is not empty: give every download its own new directory")


def parse_date(s):
    return datetime.datetime.strptime(s, "%d/%m/%Y").date()


def edition(n):
    """(title, start, end, zip_url, last_zip_url) of a GTFS dataset page, or None when the id is not a dataset."""
    html = get(f"{PORTAL}opendata-dataset.php?dataset={n}").text
    if "Pagina di errore" in html:
        return None
    m = re.search(r"<title>Portale Open Data - ([^<]*?) - Comune di Palermo", html)
    a = re.search(r"data inizio\):\s*(?:<[^>]*>\s*)*(\d\d/\d\d/\d{4})", html)
    b = re.search(r"data fine\):\s*(?:<[^>]*>\s*)*(\d\d/\d\d/\d{4})", html)
    z = re.search(r'uploads/dataset/gtfs/(_\d+\.zip)', html)
    if not (m and a and b and z and "AMAT" in m.group(1)):
        return None
    return m.group(1), parse_date(a.group(1)), parse_date(b.group(1)), PORTAL + "js/server/uploads/dataset/gtfs/" + z.group(1)


def pick(today, forced=None):
    if forced:
        ed = edition(forced)
        if not ed:
            sys.exit(f"dataset {forced} is not an AMAT GTFS edition")
        return forced, ed
    found, miss = {}, 0
    n = FIRST_ID
    while miss < LOOK_AHEAD:
        ed = edition(n)
        if ed:
            found[n], miss = ed, 0
        else:
            miss += 1
        n += 1
    valid = [n for n, e in found.items() if e[1] <= today <= e[2]]
    best = max(valid) if valid else max(found)
    if not valid:
        print(f"WARNING: no edition covers {today}; using the latest one, which ran {found[best][1]} to {found[best][2]}")
    return best, found[best]


def unpack(zpath, out):
    """Extract flat .txt members only; names with a path or odd characters are refused."""
    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            if not re.fullmatch(r"[A-Za-z0-9_]+\.txt", info.filename):
                print("skipped", info.filename)
                continue
            with z.open(info) as src, open(os.path.join(out, info.filename), "wb") as dst:
                dst.write(src.read())


def main():
    args = [a for a in sys.argv[1:]]
    opt = {}
    for k in ("--dataset", "--today"):
        if k in args:
            i = args.index(k)
            opt[k] = args[i + 1]
            del args[i:i + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    gtfs_dir, fountains_dir = args
    today = datetime.date.fromisoformat(opt["--today"]) if "--today" in opt else datetime.date.today()
    fresh_dir(gtfs_dir)
    fresh_dir(fountains_dir)
    n, (title, a, b, url) = pick(today, int(opt["--dataset"]) if "--dataset" in opt else None)
    print(f"GTFS dataset {n}: {title} ({a} to {b})\n  {url}")
    zpath = os.path.join(gtfs_dir, "gtfs.zip")
    with open(zpath, "wb") as f:
        f.write(get(url).content)
    unpack(zpath, gtfs_dir)
    with open(os.path.join(fountains_dir, "fontanelle.csv"), "wb") as f:
        f.write(get(FOUNTAINS_CSV).content)
    print("done:", sorted(os.listdir(gtfs_dir)), sorted(os.listdir(fountains_dir)))


if __name__ == "__main__":
    main()
