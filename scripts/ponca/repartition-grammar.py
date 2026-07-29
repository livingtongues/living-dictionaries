#!/usr/bin/env python3
"""One-off: re-home the Ponca grammar's interleaved prose into its subsections.

The 2026-07 import concatenated every parent chapter's prose into the parent
`body` and pushed each CAPTIONed table into its own child section, so lead-in
sentences ("…as given here:") ended up nowhere near their tables. This script
restores the PDF reading order WITHOUT touching a single character of prose:
each paragraph is simply moved into the child section whose table it leads into
(or comments on). See `.issues/ponca-grammar-round-2.md` Lane 2 for the rules
and the verification results of the production run (2026-07-29).

Order comes from `~/import-work/ponca/grammar-blocks.md` (the reconstructed PDF
reading order). TEXT comes from production — prod carries the de-CAPS, round-4
and italics fixes that the blocks file predates.

Usage (stdlib only, no deps). Dump prod's sections first:

  cat > /tmp/dump.js <<'EOF'
  const db = require('better-sqlite3')('/data/dictionaries/ponca.db', { readonly: true })
  process.stdout.write(JSON.stringify(db.prepare(
    'SELECT id, parent_id, sort_key, title, body FROM grammar_sections ORDER BY sort_key').all()))
  EOF
  ssh living 'docker exec -i sveltekit_blue node' < /tmp/dump.js > prod-sections.json

  python3 repartition-grammar.py --plan   --sections prod-sections.json
  python3 repartition-grammar.py --verify --sections prod-sections.json
  python3 repartition-grammar.py --apply  --sections prod-sections.json --key=ldk_…
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import urllib.request

BLOCKS_MD = '/home/jacob/import-work/ponca/grammar-blocks.md'
BASE_URL = 'https://livingdictionaries.app'

# Parent short-id -> a substring identifying its chapter heading in the blocks file.
CHAPTERS = {
    '986477d1': 'BASIC VERB',
    'e30492c7': 'FIRST PERSON Ą',
    '759d0367': 'SECOND PERSON Š',
    '04455415': 'FIRST PERSON B',
    'f62c1a47': 'BOTH SUBJECT',
    '8acaaeba': 'VERB PREFIXES',
    '13f97ae7': 'VERBAL SUFFIXES',
    'ea1aca92': 'TENSE MARKING',
    'c59a4322': 'INTERNAL MODIFIERS',
    'e233d9d5': 'PONCA ARTICLES',
}

# Destination of each PDF block index within a chapter:
#   'P'             keep in the parent body (relative order preserved)
#   (n, 'before')   move into child n, ABOVE its table
#   (n, 'after')    move into child n, BELOW its table
#   (n, 'fill')     append to an EMPTY stub child whose title names exactly this content
# Rule of thumb: a back-referencing opener goes 'after' the previous child, a
# forward/fresh opener goes 'before' the next one. Prose ahead of the first
# captioned table stays in the parent (it already renders above child 1), and
# prose that owns a plain uncaptioned table stays in the parent with it.
ASSIGN = {
    '986477d1': {0: 'P', 2: (0, 'after'), 3: (1, 'before'), 5: (2, 'before'), 7: (2, 'after'), 8: (3, 'before')},
    'e30492c7': {0: 'P', 2: (1, 'before'), 4: (2, 'before'), 6: (2, 'after')},
    '759d0367': {0: 'P', 2: (1, 'before'), 4: (1, 'after'), 5: (2, 'before'), 7: (3, 'before'), 9: (3, 'after'), 10: 'P', 11: 'P'},
    '04455415': {0: 'P', 2: (1, 'before'), 4: (2, 'before'), 6: (3, 'before'), 8: 'P', 9: 'P', 10: 'P'},
    'f62c1a47': {0: 'P', 1: 'P', 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P',
                 7: (0, 'before'), 9: (0, 'after'), 10: (1, 'before'), 12: (1, 'after'),
                 13: (2, 'before'), 15: (2, 'after'), 16: (3, 'before'), 18: (3, 'after'),
                 19: (4, 'before'), 21: (4, 'after'), 22: (5, 'before'), 24: (5, 'after'),
                 25: 'P', 26: 'P',
                 27: (6, 'fill'), 28: (6, 'fill'), 29: (6, 'fill'), 30: (6, 'fill'),
                 31: (6, 'fill'), 32: (6, 'fill'), 33: (6, 'fill'), 34: (6, 'fill')},
    '8acaaeba': {**{i: 'P' for i in [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}, 12: (1, 'before')},
    '13f97ae7': {0: 'P', 2: (1, 'fill'), 3: (1, 'fill'), 4: 'P', 5: 'P', 6: (2, 'fill'), 7: (2, 'fill')},
    'ea1aca92': {0: 'P', 2: (1, 'before'), 4: (1, 'after'), 6: (2, 'after'), 8: (4, 'before'),
                 10: (4, 'after'), 12: (6, 'before'), 14: (7, 'before'), 16: (7, 'after')},
    'c59a4322': {0: 'P', 2: (0, 'after'), 3: (1, 'before')},
    'e233d9d5': {0: 'P'},
}


def parse_blocks(path: str = BLOCKS_MD) -> list[dict]:
    """Parse grammar-blocks.md into chapters of ordered blocks."""
    lines = open(path).read().split('\n')
    chapters: list[dict] = []
    cur: dict | None = None
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        if stripped.startswith('# ') or stripped.startswith('## '):
            match = re.match(r'#+\s*\[p(\d+)\]\s*(.*)', stripped)
            cur = {'title_raw': match.group(2), 'page': int(match.group(1)), 'blocks': []}
            chapters.append(cur)
            i += 1
        elif not stripped:
            i += 1
        elif stripped.startswith('**CAPTION'):
            match = re.match(r'\*\*CAPTION \[p(\d+)\]\*\*\s*(.*)', stripped)
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            table = None
            if j < len(lines) and lines[j].strip().startswith('<!-- table'):
                j += 1
                rows = []
                while j < len(lines) and lines[j].strip().startswith('|'):
                    rows.append(lines[j].rstrip())
                    j += 1
                table = '\n'.join(rows)
            cur['blocks'].append({'kind': 'captioned_table', 'caption': match.group(2), 'text': table})
            i = j
        elif stripped.startswith('<!-- table'):
            j = i + 1
            rows = []
            while j < len(lines) and lines[j].strip().startswith('|'):
                rows.append(lines[j].rstrip())
                j += 1
            cur['blocks'].append({'kind': 'table', 'caption': None, 'text': '\n'.join(rows)})
            i = j
        else:
            cur['blocks'].append({'kind': 'para', 'caption': None, 'text': stripped})
            i += 1
    return chapters


def split_body(body: str) -> list[dict]:
    """Split a markdown body into its blocks: tables (runs of `|` lines) and paragraphs."""
    out: list[dict] = []
    cur: list[str] = []
    cur_kind: str | None = None
    for line in body.split('\n'):
        stripped = line.strip()
        kind = 'table' if stripped.startswith('|') else ('blank' if not stripped else 'para')
        if kind == 'blank' or (cur_kind and kind != cur_kind):
            if cur:
                out.append({'kind': cur_kind, 'text': '\n'.join(cur)})
            cur, cur_kind = [], None
            if kind == 'blank':
                continue
        cur_kind = kind
        cur.append(line.rstrip())
    if cur:
        out.append({'kind': cur_kind, 'text': '\n'.join(cur)})
    return out


def norm(text: str | None) -> str:
    """Compare-only normalization: NFC, emphasis markers dropped, whitespace collapsed."""
    if not text:
        return ''
    text = unicodedata.normalize('NFC', text)
    text = re.sub(r'[*_]', '', text)
    return re.sub(r'\s+', ' ', text).strip().lower()


def multistring(value) -> dict:
    return json.loads(value) if value else {}


def build(sections_path: str) -> list[dict]:
    """Return the per-chapter plan; raises when prod no longer matches the PDF split."""
    chapters = parse_blocks()
    rows = json.load(open(sections_path))
    by_short = {row['id'][:8]: row for row in rows}
    kids: dict[str, list] = {}
    for row in rows:
        if row['parent_id']:
            kids.setdefault(row['parent_id'][:8], []).append(row)
    for key in kids:
        kids[key].sort(key=lambda r: r['sort_key'])

    plan = []
    for short, needle in CHAPTERS.items():
        chapter = next(c for c in chapters if needle in c['title_raw'])
        parent = by_short[short]
        children = kids[short]
        parent_blocks = split_body(multistring(parent['body']).get('default', ''))

        pdf_plain = [b for b in chapter['blocks'] if b['kind'] != 'captioned_table']
        if len(pdf_plain) != len(parent_blocks) or any(
                norm(a['text']) != norm(b['text']) for a, b in zip(pdf_plain, parent_blocks)):
            raise SystemExit(f'{short}: parent body no longer matches the PDF block sequence — re-audit before writing')

        # chapter block index -> ('CAP', nth captioned) | ('PAR', nth parent block)
        source, parent_i, cap_i = {}, 0, 0
        for idx, block in enumerate(chapter['blocks']):
            if block['kind'] == 'captioned_table':
                source[idx] = ('CAP', cap_i)
                cap_i += 1
            else:
                source[idx] = ('PAR', parent_i)
                parent_i += 1

        assign = ASSIGN[short]
        unassigned = [i for i in source if source[i][0] == 'PAR' and i not in assign]
        if unassigned:
            raise SystemExit(f'{short}: unassigned parent blocks {unassigned}')

        new_parent: list[str] = []
        before: dict[int, list[str]] = {}
        after: dict[int, list[str]] = {}
        for idx in sorted(source):
            kind, nth = source[idx]
            if kind == 'CAP':
                continue
            text = parent_blocks[nth]['text']
            dest = assign[idx]
            if dest == 'P':
                new_parent.append(text)
            else:
                child_i, where = dest
                (before if where == 'before' else after).setdefault(child_i, []).append(text)

        new_children = []
        for i, child in enumerate(children):
            body = before.get(i, []) + [b['text'] for b in split_body(multistring(child['body']).get('default', ''))] + after.get(i, [])
            new_children.append({
                'id': child['id'], 'short': child['id'][:8],
                'title': multistring(child['title']).get('default', ''),
                'old_body': multistring(child['body']).get('default', ''),
                'new_body': '\n\n'.join(body),
            })
        plan.append({
            'parent_id': parent['id'], 'parent_short': short,
            'title': multistring(parent['title']).get('default', ''),
            'old_body': multistring(parent['body']).get('default', ''),
            'new_body': '\n\n'.join(new_parent),
            'children': new_children,
        })
    return plan


def patches(plan: list[dict]) -> list[tuple[str, str, dict]]:
    out = []
    for chapter in plan:
        if chapter['new_body'] != chapter['old_body']:
            out.append((chapter['parent_id'], chapter['parent_short'], {'body': {'default': chapter['new_body']}}))
        for child in chapter['children']:
            if child['new_body'] != child['old_body']:
                out.append((child['id'], child['short'], {'body': {'default': child['new_body']}}))
    return out


def verify(plan: list[dict]) -> bool:
    """HARD INVARIANT: prose + tables are identical multisets of exact strings before and after."""
    ok = True
    for chapter in plan:
        before, after = [], []
        before += split_body(chapter['old_body'])
        after += split_body(chapter['new_body'])
        for child in chapter['children']:
            before += split_body(child['old_body'])
            after += split_body(child['new_body'])
        for kind in ('para', 'table'):
            was = sorted(b['text'] for b in before if b['kind'] == kind)
            now = sorted(b['text'] for b in after if b['kind'] == kind)
            if was != now:
                ok = False
                print(f"  {chapter['parent_short']} {kind} MULTISET CHANGED")
                for text in now:
                    if text not in was:
                        print('    ADDED:', text[:90])
                for text in was:
                    if text not in now:
                        print('    LOST :', text[:90])
        print(f"  {chapter['parent_short']} prose+tables preserved: {ok}")
    return ok


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--sections', required=True, help='JSON dump of prod grammar_sections')
    parser.add_argument('--plan', action='store_true')
    parser.add_argument('--verify', action='store_true')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--key', default='')
    parser.add_argument('--base', default=BASE_URL)
    args = parser.parse_args()

    plan = build(args.sections)
    todo = patches(plan)

    if args.verify or args.plan:
        print(f'{len(todo)} sections would change')
        for _, short, patch in todo:
            print(f"  {short}  {len(patch['body']['default'])} chars")
    if args.verify:
        print('invariant check:')
        if not verify(plan):
            sys.exit(1)
    if not args.apply:
        return
    if not args.key:
        sys.exit('--apply needs --key=ldk_…')

    ok = 0
    for section_id, short, patch in todo:
        request = urllib.request.Request(
            f'{args.base}/api/v1/dictionaries/ponca/grammar/sections/{section_id}',
            data=json.dumps(patch).encode(), method='PATCH',
            headers={'content-type': 'application/json', 'authorization': f'Bearer {args.key}'})
        try:
            with urllib.request.urlopen(request) as response:
                json.load(response)
                ok += 1
                print('  ok', short)
        except Exception as error:  # noqa: BLE001 — one-off script, report and continue
            detail = error.read().decode()[:300] if hasattr(error, 'read') else ''
            print(f'  FAIL {short}: {error} {detail}')
    print(f'patched {ok}/{len(todo)}')


if __name__ == '__main__':
    main()
