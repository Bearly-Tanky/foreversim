# Forever talent data

**Note**: This tool targets the old proto/tree format and needs retargeting for the current engine.

Talent trees for all nine classes, used to generate `ui/core/talents/trees/*.json` and the
talents messages in `proto/*.proto`.

## Where it comes from

`data/` and `overrides/` are vendored from
[Deradon/wow-forever-talent-calc](https://github.com/Deradon/wow-forever-talent-calc) (MIT,
copy of its licence in `LICENSE.upstream`). That project extracts every talent tooltip from
the BlizzCon 2026 day 1 stream by hovering each talent on camera, reading the frame with a
vision model and reviewing the result by hand.

This is pre-beta data and it shows. Read it with the caveats:

- Only rank 1 of each talent was ever displayed. Every other rank is either copied from the
  Classic talent of the same name or extrapolated linearly. `ranksSource` on each talent says
  which: `observed`, `classic-prior`, `extrapolated` or `manual`.
- Tooltip text is machine-read. The upstream audit found no errors in high confidence records
  but most of its low confidence queue was wrong, so check `source.confidence` before trusting
  a description. `overrides/` holds the hand corrections and the importer applies them.
- Rows, columns and prerequisites come from the tree layout rather than the tooltip text and
  have held up against independent transcription of the Warlock tree.

Replace `data/` with the datamined trees once the beta client is out and rerun the importer.

## Beta day

The trees the sim runs on have moved on from `data/` by hand where the published trees
disagreed with it (talent positions, Blood Craze's name, Improved Fireball and Shatter's
five ranks in the mage tree), so the datamine is compared against the trees rather than
against `data/`, and `docs/forever_beta_checklist.md` lists every number the sim built on
a rank 1 tooltip. The pass is:

1. Export the trees from the beta client in the `data/<class>.json` schema, one file per
   class, into a directory. A tree json in the `ui/core/talents/trees` layout works too,
   with `--tree-schema`. If the export carries spell ids, put them in a `spellIds` list per
   talent and they are compared as well; the BlizzCon data has none.
2. Run the diff:

	tools/forever_talents/diff_trees.py beta/               # every class in the directory
	tools/forever_talents/diff_trees.py beta/warrior.json   # one class
	tools/forever_talents/diff_trees.py beta/ --json        # for anything that wants to read it

   It reports, per class and per talent, what the export changes against the sim: talents
   added, removed or renamed (matched by field name, then by name, then by position),
   positions, rank counts, spell ids and prerequisites that moved, and tooltips whose wording
   or numbers changed, with the numbers of every rank shown side by side so a rank 1
   extrapolation turns into a confirmed value or a corrected one. Under each changed talent
   it lists the checklist lines whose `TODO` names the talent, reads its field or sits in a
   file named after it, and for a talent with no checklist line, the sim files that read it.
   The exit code is 1 when anything changed, so it can gate.
3. Work the report: open the checklist lines it names, fix the numbers that moved, delete
   the `TODO`s, then regenerate the affected `.results` with `make test && make update-tests`.
   The class footer counts the checklist lines the diff could not tie to a changed talent;
   those are the "assumed baseline" items and still need the pass by hand.
4. Regenerate the trees and protos from the new data with the importer and rerun
   `go test ./sim/ -run TestTalentTrees`. Regenerating from `data/` as it stands today would
   undo the hand fixes above, which is what the diff of the vendored data shows:

	tools/forever_talents/diff_trees.py --apply-overrides

   reports exactly those (fourteen positions, one rename, one added talent and one rank
   count) and nothing else. `--apply-overrides` applies `overrides/` to the dataset the way
   the importer does and is only for checking the vendored data; without it the two warrior
   rank lists that `overrides/` corrects also show up. Leave it off for a datamine.

## Talents whose per-rank scaling is guesswork

58 of the 469 talents, most of them carrying `ranksSource: "manual"`, list rank 1's numbers again
for every other rank. The extra points are not free in game, so whatever the sim does with
them is invented: implementing them flat makes points 2+ inert, implementing them linearly
assumes a scale nobody observed. Either way it is a guess, and the classes were converted
before this was measured, so they do not all guess the same way.

	tools/forever_talents/import_talents.py --unranked

prints the list, per class. The importer also warns on stderr about the class it is importing,
so regenerating a tree after the beta datamine shows immediately whether the gap has closed.

The count by class today is Warlock 11, Druid 8, Hunter 8, Paladin 8, Mage 5, Priest 5,
Shaman 5, Rogue 4, Warrior 4. These are the first thing to re-check against the beta client,
because a five rank talent read from one rank is the largest single source of error in the
data.

Some of them can be closed before the beta. The write-ups that went up after BlizzCon quote
full rank lists for talents the stream only showed at rank 1, and where one of those agrees
with what the sim already assumed it is worth recording: put the ranks in `overrides/` with
the source in `reason`, and the talent drops off the list above. Bloodthrill and Dual Wield
Specialization went that way. Treat a single write-up as corroboration of an assumption, not
as a datamine, and leave the rest alone until there is a client to read.

## Regenerating a class

	tools/forever_talents/import_talents.py warlock            # print the proto message
	tools/forever_talents/import_talents.py warlock --write    # also rewrite the tree json

The tree json and the proto message have to stay in the same order, because
`FillTalentsProto` maps the nth character of a talent string to proto field number n. The
importer emits both in (row, column) order so they line up by construction. Changing the
order invalidates every saved talent string, so regenerate both together and rerun the tests.

Spell ids for talents that already exist in the tree json are preserved, so regenerating
doesn't churn the icons. New talents that have no Classic equivalent get a placeholder and
show the wrong tooltip until the beta ids are known.

The trees have since been corrected by hand (talent positions in four classes, a renamed
talent or two), so a full `--write` no longer round-trips: it would reorder fields and
invalidate every saved talent string. Diff the tree json before committing one.

### Icons and tooltips for the talents the database cannot name

A talent whose spell ids are not in `assets/database/db.json` (Forever added it, or its id
belongs to a later expansion) cannot be linked, named or drawn from Wowhead's Classic data.
The tree json carries its presentation instead, and the picker draws that: `name`,
`description` and `ranks` for the tooltip, and one of

- `icon`, a Wowhead icon name the dataset matched the video frame to (the mirror under
  `assets/img/wowhead` picks it up on the next `go run ./tools/icons`), or
- `iconUrl`, a 36 px crop of the demo video frame copied to `assets/img/talents/<class>/`,
  for the icons that are genuinely new to Forever and exist nowhere else yet.

`--presentation` refreshes exactly those fields in place and touches nothing else:

	tools/forever_talents/import_talents.py warlock --presentation --crops ../wow-forever-talent-calc

`--crops` points at a checkout of the dataset's repository, where the crops live under
`data/review/`. Without it a crop already in the tree keeps its place. When the beta client
is datamined, the real icon names replace the crops the same way.

## Beta client export (1.60.1, 17 Sep 2026)

The beta client is out, so step 1 above is a script now:

	tools/forever_talents/export_beta.py 1.60.1.69893 beta/     # data/<class>.json schema, from wago.tools
	tools/forever_talents/diff_trees.py beta/
	tools/forever_talents/apply_beta_tooltips.py beta/         # tooltips and rank numbers only

Forever's trees are in the retail-style Trait tables, not Talent/TalentTab (those are unchanged Era copies in
the beta). `apply_beta_tooltips.py` copies description and per-rank numbers into the trees and leaves
structure alone; it skips any tooltip that still references a duration, another spell or a formula the
exporter does not resolve, and lists those for a hand pass. Renames, removals and position changes are
the Go and proto pass.
