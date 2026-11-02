# Licence of assets/peds/lpc

This folder holds third-party art (layers of the Universal LPC Spritesheet Character Generator, composed into atlas.png and garage.png, and the idle and sit sheets of the layers in driver/, which the Garage's driver creator stacks in the browser) and our own painted layers on top. It is NOT covered by the licence of the rest of the repository.

- Every layer keeps its authors' licences, listed in CREDITS.md, and credit is required for all of them.
- 51 layers are used: 9 are CC0 only, 19 are permissive only (CC-BY / OGA-BY), 23 are offered under a permissive licence (OGA-BY or CC-BY) as well as CC-BY-SA / GPL (we use the permissive one), and 0 are share-alike only.
- Some of the layers offered under OGA-BY were also made by authors who contributed CC-BY-SA / GPL work to the same base. To stay on the safe side, treat atlas.png, garage.png, driver/ and anything derived from it, as available under CC-BY-SA 3.0 (or later) or GPL 3.0 (or later) as well, and keep the credits. This is kept to this folder; the game's code is not affected.
- Our own painted additions are released under the same terms as the atlas, so that any share-alike part stays in this one folder.
- The source layers (build inputs, same terms) are kept in tools/lpc/layers; only their idle and sit sheets for the driver creator's options are shipped, in driver/ (made by `node tools/lpc/driver.mjs`). Rebuild the atlas with `node tools/lpc/build.mjs`.
