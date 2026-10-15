# Forever Sim (the program) and the 3D testground

The sim and a 3D testground in one program for Windows and Linux. It reads models, textures,
sounds and game tables from the user's own WoW install; nothing from Blizzard is committed or
shipped (`cache/` and the embedded copies are ignored by git).

    make                # once, so dist/forever (the sim) exists
    ./run.sh            # then open http://127.0.0.1:8090/  (serves dist/ and web/ from the checkout)
    ./build.sh 1.2.0    # the release files in release/ (CI does this, see below)

The sim is at /forever/ on the same origin, so the testground reads the characters it saves in
localStorage.

**Releasing:** GitHub → Actions → Release → Run workflow, with a version (higher than the last) and
what's new. The workflow builds the sim and both programs and publishes a release; every copy's
"Update to …" button then installs it (checked against SHA256SUMS, swapped in, restarted).
`FOREVERSIM_RELEASES_API=<url of a releases/latest JSON>` points a copy at another release feed,
for testing updates.

The program keeps its settings (`config.json`, the WoW folder), `log.txt` and everything it
extracts in the user config folder: `%APPDATA%\ForeverSim` or `~/.config/ForeverSim`. It finds
WoW by itself (the launcher's registry entry and the usual folders on Windows; Wine, Lutris,
Bottles and Steam prefixes on Linux) or asks on first start.

- **Practice**: you play. The sim's engine runs one fight live on the server (`/api/live/*`): the
  request the sim page would run, with the rotation emptied; every 50 ms the page asks it to catch
  up to now and to use what was pressed. Keys 1–= and Shift+1–=, T auto attack, Esc pause (and
  leaving the window pauses). Timed fights end with a comparison against the sim's own rotation
  (1,000 fights of the same request, run in the background at start: `/api/live/summary`).
  Player and target frames, swing timers, glowing reactive abilities, game sounds (`sound.js`:
  weapon sounds by item subclass, spell sounds through SpellXSpellVisual → SpellVisualEvent →
  SpellVisualKitEffect type 5 → SoundKitEntry), drag abilities onto the bar (saved per character). Movement (`movement.js`): WoW controls and
  follow camera; each tick sends distance (from the dummy's edge), moving, behind and facing to the
  engine, which moves with `Unit.MoveTo`; moving cancels casts, attacks need the target in the
  front 180°, behind turns off the target's parry and block.
- **Logs**: the game's own combat logs (`/combatlog` → `<game folder>/Logs/WoWCombatLog*.txt`),
  read by `server/combatlog.go` into boss encounters and other stretches of combat. A player's fight
  replays in 3D and compares with the sim's rotation in a fight as long (`/api/logs/*`). The line
  layout follows the log's COMBAT_LOG_VERSION (20+ adds absorb, base amount and off-hand fields).
- **Import from the game** (in the sim, inside the program): the ForeverSim addon
  (`server/addon/`, installed by the program into the game's AddOns) saves each character's gear,
  trait-tree talents (by definition ID, so any client language works), race, class and professions;
  `/api/game/characters` reads its SavedVariables. `tools/addon_test.lua` runs the addon against a
  mock of the game's API (luajit).
- **Character**: race, sex, looks and gear (or "Load a character from the sim"), any animation.
- **Replay**: opens the sim page in a hidden frame, presses Simulate, catches the request it sends
  its worker and reruns it as one fight with the combat log on (`/api/replay-request`), then plays
  that log back against a dummy: swings, casts, projectiles, floating numbers, DPS meter.
- **Items**: any item's model on a turntable.

Code:

- `server/`: Go, localhost only, built with `-tags=with_db`. `main.go` the program (setup, serving,
  one copy at a time), `update.go` updates, `wowfind*.go` finding WoW, `assets.go` what is embedded,
  `game.go` the install's files and tables. Game files by FileDataID through
  tools/db2tool's CASC reader, falling back to Blizzard's download servers for files the install
  has not streamed in; any client table as JSON (`/api/db/<Table>?col=X&eq=N`); the sim engine for
  replays; `dist/forever` at `/forever/`.
- `web/js/`: `blp.js` textures, `m2.js` models, skins, bones and animation tracks, `model.js`
  skinned meshes, geosets, animation, attachments, `character.js` customization, body texture
  compositing and gear, `replay.js` the fight replay, `practice.js` the live practice fight (server side: `live.go`), `game.js` table and item lookups.
- `tools/`: screenshot scripts used for checking (`shot.mjs`, `shots.sh`, `replaytest.mjs`).
