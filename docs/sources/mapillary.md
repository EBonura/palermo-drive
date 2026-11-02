# Mapillary: licence check for detected street furniture (board item d2)

Status: **not cleared for the bake. No Mapillary detections were fetched, stored or used.** This note records why, and what would change the answer.

The project holds a Mapillary access token (`data/mapillary_token`, git-ignored). Until now Mapillary has only been looked at as a reference for how things look (tram railing, Via Maqueda surface,
pub lanes); no Mapillary coordinates, images or detections are in the repo or in the baked world. That stays true.

## What was read (2 November 2026)

- Mapillary Terms of Use, https://www.mapillary.com/terms (fetched in full): section 3 (licence to use the services), section 11 (Additional Terms for Developers), section 12 (commercial use).
- OpenStreetMap wiki, "Mapillary" page.
- The Mapillary help-centre licensing article (help.mapillary.com, article 115001770409) answered 403 to both curl and the fetch tool, so it could not be read. The API documentation page is rendered by script and
  shows no licence text without a browser session.

## What the terms say

- Section 3: "Your use of any User Content provided by other users is subject to the Creative Commons Share Alike (CC BY-SA) license, unless we indicate otherwise", and Mapillary may offer some data
  "under a separate set of license terms (such as the Creative Commons Attribution NonCommercial Share Alike (CC BY-NC-SA license)". Any use not specifically authorised "without our prior written permission, is strictly prohibited".
- Section 11 (applies to anyone using the API or vector tiles): the application must be registered and "designed to provide products or services that materially supplement those provided via the Mapillary Services
  (and not to merely redistribute Content or create applications that substantially replicate the functionality of Mapillary Services)". Data extracted from images through the API or vector tiles must be attributed
  "by visibly displaying the Mapillary logo and linking back to the Mapillary homepage".
- Section 12: commercial use is limited to listed purposes and requires safeguards against re-identification. Not relevant while the game is non-commercial, but it is a constraint if that changes.
- Section 13: Mapillary content may be used "to develop, edit and contribute content to OpenStreetMap or the Overture Maps Foundation". The OSM wiki words it the same way: permission to derive data from the photos
  "for contributing to OpenStreetMap". That is permission to contribute to OSM, not a general licence to embed the data elsewhere.
- Nothing in the terms or the OSM wiki states a licence for the **detections** themselves (the object points: lamps, poles, signs, benches, bins, crossings, hydrants). They are extracted from CC BY-SA images and
  served by an API under section 11. Whether they are CC BY-SA, CC BY-NC-SA or API-only content is not stated on any page that could be read.

## Why this stops here

1. **Public repo, committed data.** The baked tiles in `world/tiles/` are committed to a public GitHub repository (EBonura/palermo-drive) and shipped to every player. Putting detection positions into the bake
   is redistribution of Mapillary-derived data, which section 11 only allows if the product "materially supplements" Mapillary rather than redistributes its content. A game map with every lamp position is arguably
   the second thing.
2. **Share-alike against ODbL.** If the detections are CC BY-SA (the only licence the terms name for content derived from user images), the baked tiles would carry share-alike data inside a database that the README
   licenses as ODbL. CC BY-SA 4.0 and ODbL are not compatible, so the tiles could not satisfy both. Every other source in the project is CC BY 4.0 or ODbL; this would be the first share-alike one.
   (The AMAT tram data is CC BY-SA too, but the project uses OSM tram geometry for it, see `docs/sources/transit.md`.)
3. **Visible logo.** Section 11 wants the Mapillary logo displayed with a link. That means shipping the logo in the game's credits, which needs its own brand-use check.
4. **Licence unclear.** Where the one page that would settle the detections' licence is unreadable, the rule is to not use the data.

## What would unblock it

- A written answer from Mapillary (the terms point to "prior written permission") that detections may be baked into a public ODbL-licensed repository, or the licence of the detections stated in readable form
  and shown to be compatible with the repository's licensing.
- Or the owner deciding that the game's own licence can be CC BY-SA for this layer (a separate data file, not mixed into the ODbL tiles), with the logo credit added.
- Or no Mapillary at all: street furniture from the Comune di Palermo open data (public lighting, benches, bins if published there) and OSM (`highway=street_lamp`, `amenity=bench`, `amenity=waste_basket`,
  `emergency=fire_hydrant`, crossings, which `tools/tiles.py` already reads). Whether the Comune portal has a lighting or furniture dataset has not been checked yet.

Nothing was requested from the Mapillary API for this note.
