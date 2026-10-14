#!/usr/bin/env python3
"""Writes testground/web/specs.json: every sim page with the localStorage key its settings are saved
under, so the testground knows which page a saved character belongs to.

The key is the sim's own (ui/sim/player/specs/index.ts getLocalStorageKey): the spec's and the
class's friendly names, lowercased with the first space made '_', plus the page's storageKeyPart.
Run from anywhere; build.sh runs it before every release build.
"""
import json
import pathlib
import re

repo = pathlib.Path(__file__).resolve().parents[2]
ui = repo / 'ui'


def key_name(name):
    return re.sub(r'\s', '_', name.lower(), count=1)


# Spec enum → (file, class) from ui/sim/player/specs/index.ts: "[Spec.SpecDpsPriest]: PriestSpecs.DpsPriest,"
index = (ui / 'sim/player/specs/index.ts').read_text()
imports = dict(re.findall(r"import \* as (\w+) from '\./(\w+)'", index))
spec_classes = {enum: (imports[ns], cls) for enum, ns, cls in re.findall(r'\[Spec\.(Spec\w+)\]: (\w+)\.(\w+)', index)}

pages = []
for spec_ts in sorted(ui.glob('specs/*/*/spec.ts')):
    source = spec_ts.read_text()
    enum = re.search(r'defineSpec<Spec\.(Spec\w+)>', source)
    if not enum or enum.group(1) not in spec_classes:
        continue
    file, cls = spec_classes[enum.group(1)]
    specs_ts = (ui / f'sim/player/specs/{file}.ts').read_text()
    spec_name = re.search(rf'class {cls} extends.*?static friendlyName = \'([^\']*)\'', specs_ts, re.S).group(1)
    class_ts = (ui / f'sim/player/classes/{file}.ts').read_text()
    class_name = re.search(r"static friendlyName = '([^']*)'", class_ts).group(1)
    part = re.search(r"storageKeyPart: '([^']*)'", source)
    title = re.search(r"pageTitle: '([^']*)'", source)
    path = spec_ts.parent.relative_to(ui / 'specs').as_posix()
    pages.append({
        'path': path,
        'key': f'__forever_{key_name(spec_name)}_{key_name(class_name)}{part.group(1) if part else ""}',
        # "Shadow Priest"; a spec named after its class ("Hunter", "DPS Warrior") stands alone.
        'name': title.group(1) if title else (spec_name if class_name in spec_name else f'{spec_name} {class_name}'),
    })

out = repo / 'testground/web/specs.json'
out.write_text(json.dumps(pages, indent='\t') + '\n')
print(f'{len(pages)} sim pages → {out.relative_to(repo)}')
