# WoW Forever Simulator

A local simulator for World of Warcraft: Forever. Pick a class, race, talents and gear, and it
simulates fights to show your DPS (and threat and damage taken for tanks), compare items, and work
out stat weights.

Unofficial and unaffiliated with Blizzard. Forever is still in beta, so every number is provisional.

## Running it

Needs Go 1.25 or newer, Node 22 or newer, and `protoc` with `protoc-gen-go`
(see [docs/installation.md](docs/installation.md)). Node 22 from Homebrew isn't on the PATH by
default, so first run:

```sh
export PATH="/home/linuxbrew/.linuxbrew/opt/node@22/bin:$HOME/go/bin:$PATH"
```

Then:

```sh
npm ci                              # once, installs the JavaScript dependencies
make                                # builds the sim into dist/
npx http-server dist -p 8080        # serves it; open http://localhost:8080/forever/
```

## Developing

```sh
go test --tags=with_db ./sim/...    # all sim tests
make update-tests                   # accept new expected results after an intentional change
make db DB2TOOL_FLAGS="--cdn"       # refresh game data from Blizzard's CDN (a few hundred MB download)
```

[docs/commands.md](docs/commands.md) lists the other commands. [docs/forever_rules.md](docs/forever_rules.md)
and [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) explain where the Forever numbers come from.

## Credits

Built on [ElliotWood/Forever](https://github.com/ElliotWood/Forever) (imported at commit `859556a`),
which is based on [wowsims](https://github.com/wowsims). Both are MIT licensed; see [LICENSE](LICENSE).
This project is developed separately from them.
