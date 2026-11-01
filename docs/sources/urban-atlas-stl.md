# Copernicus Urban Atlas, Street Tree Layer 2018

Used for: `data/trees.json` (source `ua`, trees outside the lidar area).

- Licence: Copernicus Land Monitoring Service, free, full and open; the source must be acknowledged. Service: `https://copernicus.discomap.eea.europa.eu/arcgis/rest/services/UrbanAtlas/UA_StreetTreeLayer_2018/MapServer/0` (layer "STL 2018 Vector", queried with Web Mercator envelopes, returned in EPSG:4326). Reference year 2018.
- Fetched by `tools/green_fetch.py ua DIR`: 5,568 polygons (fua_name PALERMO, `stl` = 1) in the game bounding box, 14.3 km2 in all. Fields used: `OBJECTID` (seeds the lattice), geometry. Nothing else is informative.
- What it is: tree canopy polygons (median 1,175 m2, none below about 500 m2), not individual trees and not only street trees. Individual street trees are mostly missing: only 16 % of the OSM trees stand inside a polygon (4 m margin), and 26 % of the lidar crowns do.
- How it is used: a jittered hex lattice at 7.5 m (about 49 m2 per tree) inside each polygon, 1.5 m in from the edge, dropped where there is lidar (lidar decides there), on a building, on a carriageway, in an OSM forest or scrub area, within 3.5 m of another tree. Polygons mostly in a CTR orchard, olive, citrus, vine or scrub area (684), in OSM forest (270), over 15 ha (2), farther than 60 m from any building or road (159) are skipped. Result: 126,159 lattice trees. They carry no crown size and no species: the positions are plausible, not surveyed. Do not run row detection on them (the lattice is regular).
- Known issues: outside the lidar area (ZEN, Favorita, Brancaccio west, all of the west and south) this is the only canopy information besides CTR points; it shows gardens and parks well and avenues badly.
- Credit line for the README: `Contains modified Copernicus Land Monitoring Service information: Urban Atlas Street Tree Layer 2018, European Environment Agency (EEA).`
