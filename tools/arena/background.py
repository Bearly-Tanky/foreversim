#!/usr/bin/python

# Runs an arena rebuild or talent search on this machine without holding anything open, and
# edits a single Discord message as it goes rather than posting a new one every minute.
#
#   python tools/arena/background.py --detach --optimise
#   python tools/arena/background.py --specs druid/balance,mage
#   python tools/arena/background.py --detach --optimise --push --specs warlock   # one class
#   ARENA_REF=arena/port python tools/arena/background.py --detach --optimise   # a local branch
#   python tools/arena/background.py --detach --optimise --all   # rerun even unchanged specs
#
# Incremental by default: a spec whose class (sim/<class>/, ui/specs/<class>/) and the shared
# sim code, protos and data are unchanged since its last run keeps its file in arena-out, and
# the run skips it. When something did change, each shape's climb resumes from the build it
# reached last time (sim/arenalib), so a spec already at its peak costs one step, not a climb.
#
# --specs matches package paths (sim/druid/balance; sim/priest holds both priests), not the
# page's spec keys.
#
# --detach hands the work to a process that outlives whatever started it, which is the point:
# a search is hours, and the session that kicks it off is usually a chat turn that ends in
# seconds. Without it the run dies with its parent halfway through.
#
# Progress is counted from the spec files themselves - the arena writes one JSON per spec into
# arena-out - and only files written since the run started are counted, because the directory
# is never empty. That makes the bar honest at spec granularity and costs nothing to produce;
# the alternative is parsing go test's output, which reports packages, not progress.

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARENA_OUT = os.path.join(REPO, 'arena-out')
# The run happens in its own worktree, never in the checkout people edit. A four hour search
# used to read sim code and the item database out of the working tree while other work was
# regenerating that same database underneath it; every package compiled after the edit saw
# the new data and every one before it the old. arena-out stays in the main checkout - it is
# untracked, so git never touches it, and subset runs need the other specs' files to merge.
WORK = REPO + '-arena'
# The branch the run checks out, and pushes the leaderboard to with --push.
BRANCH = os.environ.get('ARENA_BRANCH', 'master')
# What the worktree is reset to: the branch's tip on origin, or any ref this repository has -
# a local branch, to search something that is not merged yet.
REF = os.environ.get('ARENA_REF', f'origin/{BRANCH}')
RESULTS = 'ui/app/arena/results.json'
WEBHOOK_FILE = os.path.expanduser('~/.openclaw-alfred/secrets/forever_webhook.url')
# Discord's edge refuses a default python or powershell user agent with a bare 403 that reads
# exactly like a missing permission. It is not one.
AGENT = 'DiscordBot (https://github.com/ElliotWood/Forever, 1.0)'
EVERY = 30


def webhook():
    url = os.environ.get('FOREVER_WEBHOOK')
    if not url and os.path.exists(WEBHOOK_FILE):
        url = open(WEBHOOK_FILE).read().strip()
    return url


def discord(url, content, message_id=None):
    """Posts, or edits if given an id. Returns the message id, or the old one if Discord said no."""
    if not url:
        return None
    target = f'{url}/messages/{message_id}' if message_id else f'{url}?wait=true'
    request = urllib.request.Request(
        target,
        data=json.dumps({'content': content}).encode(),
        headers={'Content-Type': 'application/json', 'User-Agent': AGENT},
        method='PATCH' if message_id else 'POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read())['id']
    except Exception as error:
        # A failed progress update must never take the run down with it.
        print(f'discord: {error}', file=sys.stderr)
        return message_id


def bar(done, total, width=16):
    filled = 0 if not total else round(width * done / total)
    return '#' * filled + '.' * (width - filled)


def elapsed(seconds):
    minutes, seconds = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    return f'{hours}h {minutes:02d}m' if hours else f'{minutes}m {seconds:02d}s'


def run_git(*args, check=True):
    return subprocess.run(['git', *args], cwd=WORK, check=check)


def prepare_worktree():
    """A detached worktree at REF, created on first use."""
    subprocess.run(['git', 'fetch', '-q', 'origin'], cwd=REPO, check=True)
    if not os.path.isdir(WORK):
        subprocess.run(['git', 'worktree', 'add', '--detach', WORK, REF], cwd=REPO, check=True)
    else:
        run_git('checkout', '-q', '--detach', REF)
        run_git('reset', '-q', '--hard', REF)
    # The generated protos are gitignored, so a worktree has none and every package fails setup.
    # They are generated here from the worktree's own .proto files. Copying the main checkout's
    # used to be the shortcut, and it went stale the first time a .proto changed without that
    # checkout being rebuilt: the post-#441 search died on a missing PseudoStat before simming
    # anything. protoc comes from the main checkout's node_modules (@protobuf-ts/protoc), and
    # protoc-gen-go from PATH (go install google.golang.org/protobuf/cmd/protoc-gen-go@latest).
    protoc = os.path.join(REPO, 'node_modules', '@protobuf-ts', 'protoc', 'protoc.js')
    protos = sorted(os.path.join('proto', n) for n in os.listdir(os.path.join(WORK, 'proto')) if n.endswith('.proto'))
    subprocess.run(['node', protoc, '-I=./proto',
                    '--go_opt=Mgoogle/protobuf/descriptor.proto=google.golang.org/protobuf/types/descriptorpb',
                    '--go_out=./sim/core', *protos], cwd=WORK, check=True)


def remove_worktree():
    """Gone after every run, pass or fail: a full checkout plus generated protos, on a disk that is
    nearly full. The next run recreates it in seconds. Kept only when it holds a commit REF does
    not have - a leaderboard whose push was rejected - because removing it would lose that."""
    ahead = subprocess.run(['git', 'rev-list', '--count', f'{REF}..HEAD'], cwd=WORK, capture_output=True, text=True)
    if ahead.returncode != 0 or ahead.stdout.strip() != '0':
        print(f'kept {WORK}: it has a commit {REF} does not')
        return
    subprocess.run(['git', 'worktree', 'remove', '--force', WORK], cwd=REPO, check=False)


def packages(specs):
    # Not check=True: sim/web imports a generated binary_dist that is not committed, so `go list`
    # exits 1 while still printing every other package. Failing on that exit code would make this
    # unrunnable for a reason that has nothing to do with the arena.
    listed = subprocess.run(['go', 'list', './sim/...'], cwd=WORK, capture_output=True, text=True)
    found = [p for p in listed.stdout.split() if '/sim/web' not in p]
    if not found:
        sys.exit(f'go list found no packages: {listed.stderr.strip()}')
    if specs:
        found = [p for p in found if any(s in p for s in specs)]
        if not found:
            sys.exit('no packages matched: ' + ', '.join(specs))
    return found


def arena_entries(pkgs):
    """How many spec files the run will write: the arenalib.Run calls in the packages it tests.
    Both priests are one package, and most of ./sim/... is core and shared code with none."""
    count = 0
    for pkg in pkgs:
        directory = os.path.join(WORK, *pkg.split('/')[3:])  # github.com/wowsims/forever/...
        for name in os.listdir(directory):
            if name.endswith('_test.go'):
                count += open(os.path.join(directory, name), encoding='utf-8').read().count('arenalib.Run(')
    return count


# Which commit each package's spec files in arena-out were last produced at, by mode. Not .json,
# so neither the progress count nor the merge mistakes it for a spec file.
STAMPS = os.path.join(ARENA_OUT, '.stamps')


def load_stamps():
    try:
        return json.load(open(STAMPS))
    except Exception:
        return {}


def class_of(pkg):
    return pkg.split('/sim/')[1].split('/')[0]


def current(pkgs, optimise):
    """The packages whose files in arena-out are still what a run today would produce: nothing
    they read has changed since. Only a package's own class (sim/<class>/, ui/specs/<class>/) or
    shared sim code, protos and data count; the site, docs and workflows do not move a number.
    A search stamp also covers a plain rebuild, never the other way round."""
    stamps = load_stamps()
    head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=WORK, capture_output=True, text=True).stdout.strip()
    classes = {class_of(p) for p in pkgs}
    fresh = []
    for pkg in pkgs:
        stamp = stamps.get('search', {}).get(pkg) or (None if optimise else stamps.get('rebuild', {}).get(pkg))
        if not stamp:
            continue
        diff = subprocess.run(['git', 'diff', '--name-only', stamp, head], cwd=WORK, capture_output=True, text=True)
        if diff.returncode != 0:
            continue
        own = (f'sim/{class_of(pkg)}/', f'ui/specs/{class_of(pkg)}/')
        shared = lambda f: f.startswith(('sim/', 'proto/', 'assets/')) and not any(f.startswith(f'sim/{c}/') for c in classes)
        if not any(f.startswith(own) or shared(f) for f in diff.stdout.split()):
            fresh.append(pkg)
    return fresh


def stamp(pkgs, optimise):
    stamps = load_stamps()
    head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=WORK, capture_output=True, text=True).stdout.strip()
    stamps.setdefault('search' if optimise else 'rebuild', {}).update({pkg: head for pkg in pkgs})
    json.dump(stamps, open(STAMPS, 'w'), indent=1)


def written_since(start):
    if not os.path.isdir(ARENA_OUT):
        return []
    return [f for f in os.listdir(ARENA_OUT)
            if f.endswith('.json') and os.path.getmtime(os.path.join(ARENA_OUT, f)) >= start]


def leaderboard():
    """The top few rows of whatever the run just produced, for the closing message."""
    try:
        rows = json.load(open(os.path.join(WORK, RESULTS)))['builds']
    except Exception:
        return ''
    best = {}
    for row in rows:
        if row['dps'] > best.get(row['spec'], {'dps': 0})['dps']:
            best[row['spec']] = row
    top = sorted(best.values(), key=lambda r: -r['dps'])[:5]
    return '\n'.join(f'{i + 1}. {r["spec"]} - {r["dps"]:.1f}' for i, r in enumerate(top))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--optimise', action='store_true', help='search the talent trees too (hours)')
    parser.add_argument('--push', action='store_true', help='commit and push the leaderboard when done')
    parser.add_argument('--specs', default='', help='comma separated, substring matched')
    parser.add_argument('--detach', action='store_true', help='run in a process that outlives this one')
    parser.add_argument('--all', action='store_true', help='rerun specs even if nothing they read has changed')
    args = parser.parse_args()
    if args.push and REF != f'origin/{BRANCH}':
        # The push is HEAD:BRANCH, and HEAD would carry REF's unmerged commits along with it.
        sys.exit(f'--push only from origin/{BRANCH}; ARENA_REF={REF} would push that ref to {BRANCH}')

    if args.detach:
        command = [sys.executable, os.path.abspath(__file__)] + [a for a in sys.argv[1:] if a != '--detach']
        # Its own output goes to a file: a run that fails before go test starts (the fetch, the
        # worktree, go list) would otherwise fail into DEVNULL and say nothing at all.
        os.makedirs(ARENA_OUT, exist_ok=True)
        out = open(os.path.join(ARENA_OUT, 'background.log'), 'w')
        # CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP: a hidden console that go and the test
        # binaries share. DETACHED_PROCESS left them none, and Windows opens a window for every
        # console program started without one. BREAKAWAY_FROM_JOB lets the run outlive a session
        # that lives in a job object; where the job forbids it, it starts without.
        options = dict(cwd=REPO, close_fds=True, stdout=out, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
        if os.name == 'nt':
            flags = 0x08000000 | 0x00000200
            try:
                child = subprocess.Popen(command, creationflags=flags | 0x01000000, **options)
            except OSError:
                child = subprocess.Popen(command, creationflags=flags, **options)
        else:
            child = subprocess.Popen(command, start_new_session=True, **options)
        print(f'detached as pid {child.pid}, log in {out.name}')
        return

    prepare_worktree()
    try:
        run(args)
    finally:
        remove_worktree()


def run(args):
    specs = [s for s in args.specs.split(',') if s]
    # Only packages that register an arena spec; the rest of ./sim/... is core with nothing to run.
    pkgs = [p for p in packages(specs) if arena_entries([p])]
    what = 'talent search' if args.optimise else 'arena rebuild'
    url = webhook()
    # A spec whose class and the shared sim have not changed since it last ran keeps its file:
    # rerunning it would reproduce the same numbers, hours later.
    skipped = [] if args.all else current(pkgs, args.optimise)
    pkgs = [p for p in pkgs if p not in skipped]
    if skipped:
        print('unchanged since their last run, kept: ' + ', '.join(class_of(p) + p.split(class_of(p))[1] for p in skipped))
    if not pkgs:
        discord(url, f'**{what}** skipped - nothing the arena reads has changed since the last run')
        return
    total = arena_entries(pkgs)
    start = time.time()

    message = discord(url, f'**{what}** starting - {total} specs')

    # What the merge says each build was run for: sim/arenalib's iterations.
    environment = dict(os.environ, ARENA_OUT=ARENA_OUT, ARENA_OPTIMISE='1' if args.optimise else '',
                       ARENA_ITERATIONS='5000')
    os.makedirs(ARENA_OUT, exist_ok=True)
    # -timeout 0 is the whole reason this runs here and not on a GitHub runner.
    # Kept, not discarded. The first long search threw its output away, so when seven specs came
    # back without an exhaustive result there was nothing to read to find out why.
    log = open(os.path.join(ARENA_OUT, 'run.log'), 'w')
    # One package at a time: a spec's search keeps every core busy on its own. -count=1 because a
    # cached pass writes nothing, and the test cache cannot know the files are the point.
    command = ['go', 'test', '--tags=with_db', '-timeout', '0', '-count=1', '-p', '1', '-v', '-run', 'TestArena'] + pkgs
    run = subprocess.Popen(command, cwd=WORK, env=environment, stdout=log, stderr=subprocess.STDOUT)

    done = 0
    while run.poll() is None:
        time.sleep(EVERY)
        done = len(written_since(start))
        message = discord(url, f'**{what}** - {done}/{total} specs  `{bar(done, total)}`  {elapsed(time.time() - start)}', message)

    if run.returncode != 0:
        discord(url, f'**{what} failed** after {elapsed(time.time() - start)} - exit {run.returncode}', message)
        sys.exit(run.returncode)

    stamp(pkgs, args.optimise)
    merge = subprocess.run(['go', 'run', './tools/arena', ARENA_OUT, RESULTS], cwd=WORK, env=environment)
    if merge.returncode != 0:
        discord(url, f'**{what}** ran but the merge failed after {elapsed(time.time() - start)}', message)
        sys.exit(merge.returncode)

    pushed = ''
    if args.push:
        run_git('add', RESULTS)
        if run_git('diff', '--cached', '--quiet', check=False).returncode != 0:
            run_git('commit', '-q', '-m', 'chore(arena): rebuild the leaderboard')
            # Never check=True on the push. A rejected push killed a four hour search between
            # its last progress update and its report, so the only evidence it had finished at
            # all was a commit sitting unpushed in the working tree. Rejection usually just means
            # master moved during the run, so rebase once and try again before giving up.
            ok = run_git('push', '-q', 'origin', f'HEAD:{BRANCH}', check=False).returncode == 0
            if not ok and run_git('pull', '-q', '--rebase', 'origin', BRANCH, check=False).returncode == 0:
                ok = run_git('push', '-q', 'origin', f'HEAD:{BRANCH}', check=False).returncode == 0
            pushed = ' - pushed' if ok else f' - **committed but the push was rejected**, push from {WORK}'
        else:
            pushed = ' - leaderboard unchanged'

    discord(url, f'**{what} done** - {done} specs in {elapsed(time.time() - start)}{pushed}\n```\n{leaderboard()}\n```', message)


if __name__ == '__main__':
    main()
