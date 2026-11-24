// ?mats=off: every builder makes its own materials, as it did before docs/PERF.md "Fewer materials in view". Read once at page load, for comparing the two on a phone.
// Without it a material that two builders would make with every parameter the same is made once, so the draws of both are one run for three.js (see the notes at each use).
export const SHARE = new URLSearchParams(location.search).get('mats') !== 'off';
