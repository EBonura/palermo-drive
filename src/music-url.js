// Where the music files live: the car radio (src/radio.js) and the pub songs (src/pubs.js). The files are only in the R2 bucket palermo-drive-music (served as
// music.palermo-drive.it); the repo keeps their credits in assets/music/CREDITS.md. Empty: next to the game, in assets/music/, which then needs the files copied back.
// A full https address ending in /: a public bucket (Cloudflare R2), and then tools/build/build.mjs leaves the audio out of the published site and lets the page's policy play from there.
// The bucket must answer cross-origin requests (CORS) for the game's address: the radio plays through Web Audio, which stays silent on audio from another origin without it.
export const MUSIC_BASE = 'https://music.palermo-drive.it/';
export const musicUrl = file => (MUSIC_BASE || new URL('../assets/music/', import.meta.url).href) + file;
export const musicCross = !!MUSIC_BASE;   // the audio elements then ask with CORS (crossOrigin 'anonymous')
