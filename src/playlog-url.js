// Where the play log goes (src/playlog.js, joinlog/README.md): the address of the joinlog service on Cloud Run, for example 'https://joinlog-xxxxxxxx-oa.a.run.app/e'.
// EMPTY means nothing is sent and the privacy wording on the name card keeps saying "Non salviamo nulla" / "We store nothing". Filling it in switches on three things together:
// the reports, the other wording, and the service's host in the page's Content-Security-Policy (tools/build/build.mjs reads this same constant).
export const PLAYLOG_URL = 'https://joinlog-502854225296.europe-west8.run.app/e';
