# Security

Palermo Drive is a static browser game on GitHub Pages (https://palermo-drive.it). There are no accounts and no passwords, and nothing a player types is stored on a server.

## Reporting a problem

Please report a vulnerability privately: on this repository's **Security** tab choose **Report a vulnerability**. Please do not open a public issue for it. You will get an answer there.

Useful in a report: what you did, what happened, the address you used (with its query string) and the browser.

## What is in scope

- The game as served at palermo-drive.it and the code in this repository.
- The online multiplayer (`src/online/`) and its relay (`relay-worker/`): anything one player can do to another player's game or browser, and anything a player can do to the relay.
- The play statistics service (`joinlog/`). The older relay in `relay/` is not part of the game any more.

Known and accepted: the play statistics endpoint checks the `Origin` header, which a script can forge, so the statistics can be polluted within the service's daily limits; it returns no data.

## More

The audits of the repository and of the live site, with what was found and what was changed, are in [docs/SECURITY.md](docs/SECURITY.md).
