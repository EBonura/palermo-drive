# Buried and missing road stretches (dense ray-cast scan)

Method: a Puppeteer-driven headless Chrome loads the game with `?debug`, parks the camera over each 450 m cell of the mountain-foot areas, waits for tile streaming to settle, then casts a ray straight down at one road centreline sample about every 24 m. If the first hit is a `terrain_*` or `far_*` mesh above the `street_asphalt`, `street_paving` or `street_raised` mesh, the road is buried by that many metres (only 0.25 m or more is reported). If no street mesh is hit at all it is listed as missing. Roads scanned: primary to residential, unclassified and living_street, no tracks, no tunnels or bridges. Areas: Pellegrino/Addaura/Arenella/Acquasanta/Vergine Maria/Favorita north (38.14 to 38.205 N, 13.325 to 13.385 E), Billiemi/Boccadifalco/Baida/Bellolampo (38.075 to 38.13, 13.24 to 13.315), Grifone/Villagrazia/Ciaculli/Falsomiele (38.045 to 38.10, 13.31 to 13.43), Monte Gallo/Mondello/Sferracavallo/Tommaso Natale (38.17 to 38.23, 13.24 to 13.34).

Samples scanned: pellegrino 8330, billiemi 7304, grifone 13813, gallo 12335. Mode `warm` = cells visited in sorted order so neighbouring tiles were already loaded; mode `cold` = fresh page per cell (like a spawn or teleport into the area).

## Load order matters (important)

The same road can be clean or buried depending on what was loaded first. Experiment on Via Pietro Bonanno near 38.15217,13.36476 (the pe08 hairpin): loaded cold at street level the ray cast finds 2 to 8 buried samples with up to 9.24 m and 7.1 m of terrain over the asphalt, and the state is still there 32 s later; the same spot after flying in from 900 m away and 400 m away shows 0 buried samples. Two cold runs gave different counts, so it is a race: when a tile is shaped (computeShape in src/world.js) before its neighbours are loaded, the bench uses the coarse far grid at the tile border. The warm scan below therefore under-reports what a player sees after a teleport or a spawn on the mountain roads. Fix direction: shape against the far grid only, or defer the bench of a tile until its 8 neighbours have `nearS`, and rebuild terrain and street meshes together when a neighbour arrives.

## Stretches (323 buried, 2 without street mesh)

| road | class | lat, lon | samples | max depth m | mode | region |
|---|---|---|---|---|---|---|
| Via Padre Giordano Cascini | unclassified | 38.17513, 13.3613 | 4 | 3.92 | cold | pellegrino |
| Via Grotte Partanna | unclassified | 38.20909, 13.30408 | 3 | 3.86 | warm | gallo |
| (unnamed) | unclassified | 38.05239, 13.35698 | 1 | 3.04 | warm | grifone |
| Via Pietro Bonanno | unclassified | 38.15404, 13.36123 | 3 | 2.96 | cold | pellegrino |
| Via Pietro Bonanno | unclassified | 38.15252, 13.36158 | 7 | 2.66 | cold | pellegrino |
| (unnamed) | unclassified | 38.08553, 13.247 | 1 | 2.24 | warm | billiemi |
| Raccordo per Via Belgio | motorway | 38.18595, 13.28822 | 1 | 2 | warm | gallo |
| Via Monte Ercta | unclassified | 38.18909, 13.3385 | 5 | 1.93 | cold | pellegrino |
| Via Pietro Bonanno | unclassified | 38.15404, 13.36123 | 1 | 1.82 | warm | pellegrino |
| Via Monte Ercta | unclassified | 38.1859, 13.33816 | 5 | 1.74 | cold | pellegrino |
| Via Palmiro Togliatti | residential | 38.08408, 13.29086 | 1 | 1.73 | warm | billiemi |
| (unnamed) | residential | 38.1725, 13.29028 | 1 | 1.69 | warm | gallo |
| Via Monte Ercta | residential | 38.19263, 13.33755 | 2 | 1.69 | cold | pellegrino |
| Via Monte Ercta | residential | 38.19263, 13.33755 | 2 | 1.69 | warm | gallo |
| Via Monte Ercta | unclassified | 38.1889, 13.33683 | 1 | 1.67 | cold | pellegrino |
| (unnamed) | tertiary | 38.06147, 13.42787 | 1 | 1.61 | warm | grifone |
| Via Poggio Ridente | residential | 38.10199, 13.30353 | 3 | 1.58 | warm | billiemi |
| (unnamed) | unclassified | 38.09764, 13.29557 | 1 | 1.53 | warm | billiemi |
| Via Monte Ercta | unclassified | 38.18816, 13.33741 | 1 | 1.47 | cold | pellegrino |
| (unnamed) | unclassified | 38.1052, 13.30771 | 3 | 1.36 | warm | billiemi |
| Via Portella di Palermo | unclassified | 38.06216, 13.37839 | 1 | 1.3 | warm | grifone |
| Via San Martino | tertiary | 38.1078, 13.29371 | 1 | 1.29 | warm | billiemi |
| Via Cannolicchio | residential | 38.08567, 13.29561 | 2 | 1.28 | warm | billiemi |
| Via Torrente d'Inverno | residential | 38.10849, 13.29014 | 3 | 1.26 | warm | billiemi |
| (unnamed) | unclassified | 38.08484, 13.2827 | 5 | 1.25 | warm | billiemi |
| Via Francesco de Pinedo | residential | 38.10649, 13.30431 | 2 | 1.25 | warm | billiemi |
| (unnamed) | unclassified | 38.07765, 13.38124 | 7 | 1.23 | warm | grifone |
| Via Spina Santa | residential | 38.19118, 13.29791 | 1 | 1.21 | warm | gallo |
| Autostrada Palermo-Mazara del Vallo | motorway | 38.19266, 13.28019 | 2 | 1.19 | warm | gallo |
| (unnamed) | residential | 38.11109, 13.29672 | 5 | 1.18 | warm | billiemi |
| Autostrada Palermo-Mazara del Vallo | motorway | 38.19784, 13.27021 | 4 | 1.17 | warm | gallo |
| Via Esterna San Nicola | residential | 38.07955, 13.2728 | 2 | 1.16 | warm | billiemi |
| (unnamed) | residential | 38.07539, 13.27474 | 2 | 1.15 | warm | billiemi |
| Via Villagrazia | residential | 38.09765, 13.36786 | 1 | 1.13 | warm | grifone |
| (unnamed) | residential | 38.08837, 13.29918 | 1 | 1.12 | warm | billiemi |
| (unnamed) | residential | 38.09765, 13.28057 | 1 | 1.1 | warm | billiemi |
| Via Bonta | residential | 38.04929, 13.38775 | 1 | 1.1 | warm | grifone |
| Via Pietro Calandra | residential | 38.19461, 13.27677 | 2 | 1.1 | warm | gallo |
| Via Pietro Calandra | residential | 38.19405, 13.27809 | 2 | 1.08 | warm | gallo |
| (unnamed) | residential | 38.08642, 13.29495 | 2 | 1.05 | warm | billiemi |
| Autostrada Palermo-Mazara del Vallo | motorway | 38.19609, 13.27216 | 1 | 1.05 | warm | gallo |
| Via Spina Santa | residential | 38.19267, 13.29818 | 1 | 1.05 | warm | gallo |
| (unnamed) | residential | 38.09024, 13.29818 | 3 | 1.04 | warm | billiemi |
| (unnamed) | residential | 38.10223, 13.30057 | 3 | 1.03 | warm | billiemi |
| Via Monte Erta | unclassified | 38.17912, 13.33951 | 1 | 1.03 | cold | pellegrino |
| Via Luoghicelli | residential | 38.18811, 13.28357 | 1 | 1.02 | warm | gallo |
| Via Spina Santa | residential | 38.19512, 13.29519 | 1 | 1.02 | warm | gallo |
| Autostrada Palermo-Mazara del Vallo | motorway | 38.19528, 13.27492 | 5 | 1.01 | warm | gallo |
| (unnamed) | residential | 38.09061, 13.26666 | 1 | 1 | warm | billiemi |
| Via Monte Ercta | unclassified | 38.18822, 13.3356 | 5 | 1 | cold | pellegrino |
| Via Placido Rizzotto | unclassified | 38.04782, 13.31279 | 1 | 1 | warm | grifone |
| (unnamed) | residential | 38.11207, 13.29569 | 1 | 0.99 | warm | billiemi |
| (unnamed) | residential | 38.19281, 13.29769 | 2 | 0.98 | warm | gallo |
| (unnamed) | residential | 38.20104, 13.28629 | 1 | 0.97 | warm | gallo |
| (unnamed) | residential | 38.18995, 13.35595 | 2 | 0.96 | warm | pellegrino |
| (unnamed) | residential | 38.11121, 13.29371 | 1 | 0.94 | warm | billiemi |
| Autostrada Palermo-Mazara del Vallo | motorway | 38.19677, 13.27139 | 2 | 0.94 | warm | gallo |
| Via Alcide De Gasperi | tertiary | 38.04862, 13.38426 | 1 | 0.93 | warm | grifone |
| Via Pietro Germi | residential | 38.11271, 13.29443 | 2 | 0.93 | warm | billiemi |
| Viale Regione Siciliana Nord Ovest | tertiary | 38.18524, 13.2897 | 2 | 0.93 | warm | gallo |
| (unnamed) | unclassified | 38.09781, 13.35997 | 1 | 0.9 | warm | grifone |
| Via Alla Falconara | tertiary | 38.11654, 13.289 | 2 | 0.9 | warm | billiemi |
| Via Luparello | tertiary | 38.11159, 13.29978 | 3 | 0.9 | warm | billiemi |
| Via Torrente d'Inverno | residential | 38.1084, 13.29225 | 2 | 0.88 | warm | billiemi |
| Via Pietro Bonanno | unclassified | 38.14937, 13.36696 | 1 | 0.87 | cold | pellegrino |
| Via XXV Aprile | residential | 38.04926, 13.38948 | 2 | 0.85 | warm | grifone |
| Via Monte Ercta | unclassified | 38.18818, 13.33563 | 4 | 0.83 | warm | gallo |
| (unnamed) | residential | 38.08752, 13.29785 | 2 | 0.82 | warm | billiemi |
| (unnamed) | tertiary | 38.05239, 13.42676 | 1 | 0.82 | warm | grifone |
| Via Monte Ercta | residential | 38.1881, 13.34161 | 1 | 0.82 | cold | pellegrino |
| Via Michele Fanara | tertiary | 38.10872, 13.30709 | 1 | 0.81 | warm | billiemi |
| Via San Martino | unclassified | 38.1055, 13.2982 | 1 | 0.8 | warm | billiemi |
| (unnamed) | unclassified | 38.09931, 13.37568 | 2 | 0.79 | warm | grifone |
| (unnamed) | unclassified | 38.0886, 13.25111 | 1 | 0.77 | warm | billiemi |
| Via Francesca Morvillo | tertiary | 38.0493, 13.38643 | 4 | 0.77 | warm | grifone |
| (unnamed) | residential | 38.08531, 13.29267 | 1 | 0.76 | warm | billiemi |
| Via Barcarello | residential | 38.21076, 13.28792 | 1 | 0.76 | warm | gallo |
| Via Agostino Barbarigo | residential | 38.18972, 13.34927 | 1 | 0.75 | cold | pellegrino |
| Via Agostino Barbarigo | residential | 38.18972, 13.34927 | 1 | 0.75 | warm | pellegrino |
| Via Monte Ercta | residential | 38.1881, 13.34161 | 1 | 0.75 | warm | pellegrino |

(first 80 by depth; everything is in buried-roads.json)

## Roads with no street mesh at all

| road | class | lat, lon | samples | mode | region |
|---|---|---|---|---|---|
| (unnamed) | unclassified | 38.16698, 13.36655 | 1 | warm | pellegrino |
| (unnamed) | residential | 38.0972, 13.41705 | 1 | warm | grifone |
