#!/usr/bin/env python3
"""One-off: promote the Ponca grammar's parent-stranded tables into subsections.

Lane 2 (`repartition-grammar.py`) re-homed every parent chapter's interleaved
prose into the child sections that already existed. It could not fix five
chapters whose tables had NO caption in the PDF and therefore never became
children at import: the renderer draws `parent body → children`, so those tables
kept rendering ahead of subsections that the PDF places before them.

This script creates the missing subsections (9 of them, across 5 chapters) and
moves the stranded lead-in prose + table + follow-up commentary out of the parent
body and into them, restoring PDF reading order for all 10 chapters. Prose is
NEVER created, deleted or reworded — the only new text is each section TITLE,
and every title fragment is lifted verbatim from that section's own content
(`--verify` proves it).

Order comes from `~/import-work/ponca/grammar-blocks.md`; TEXT comes from
production (prod carries de-CAPS + round-4 + italics fixes the blocks file
predates). See `.issues/ponca-grammar-round-2.md` Lane 6.

Usage (stdlib only). Dump prod's sections first:

  cat > /tmp/dump.js <<'EOF'
  const db = require('better-sqlite3')('/data/dictionaries/ponca.db', { readonly: true })
  process.stdout.write(JSON.stringify(db.prepare(
    'SELECT id, parent_id, sort_key, title, body FROM grammar_sections ORDER BY sort_key').all()))
  EOF
  ssh living 'docker exec -i sveltekit_blue node' < /tmp/dump.js > prod-sections.json

  python3 promote-residual-subsections.py --plan   --sections prod-sections.json
  python3 promote-residual-subsections.py --verify --sections prod-sections.json
  python3 promote-residual-subsections.py --apply  --sections prod-sections.json --key=ldk_…

`--apply` is idempotent: section ids are fixed below, POST returns the existing
row untouched on a second run, and the guard refuses to run at all once prod no
longer matches the expected post-Lane-2 block sequence.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BASE_URL = 'https://livingdictionaries.app'

_spec = importlib.util.spec_from_file_location('repartition_grammar', os.path.join(HERE, 'repartition-grammar.py'))
lane2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lane2)

# Chapter short-id -> the subsections to create, in PDF order.
#   id     fixed UUID (idempotent re-runs)
#   title  the new section title — every `fragment` below must appear verbatim
#          (normalized) inside the section's own moved content
#   blocks chapter block indices (grammar-blocks.md order) to move out of the parent
#   after  short id of the sibling this section follows ('' = first child, i.e.
#          the previous new section in this same list)
PROMOTIONS: dict[str, list[dict]] = {
    # §7 — the Íʼbahą̀ paradigm closes the chapter in the PDF but rendered right after the intro.
    '759d0367': [
        {'id': '1b3e91f0-9d6a-49a7-9768-990b8385b612',
         'title': 'Íʼbahą̀ ‘to know’',
         'fragments': ['íʼbahą̀ ‘to know’'],
         'blocks': [10, 11], 'after': '19d11ce5'},
    ],
    # §8 — likewise the Mąđí ‘to walk’ paradigm plus its follow-up note.
    '04455415': [
        {'id': 'd67c6b64-403f-4552-96c5-5aa3bbce070e',
         'title': 'Mąđí ‘to walk’',
         'fragments': ['mąđí', 'to walk'],
         'blocks': [8, 9, 10], 'after': '519a6a6f'},
    ],
    # §9 — the summary chart SUMMARIZES the six Đihą́ paradigms, so it belongs after them.
    'f62c1a47': [
        {'id': '368a56f6-25bd-4624-8f86-c1d783830db9',
         'title': 'Full system of conjugations—Đihą́ ‘to lift’',
         'fragments': ['full system of conjugations', 'đihą́ ‘to lift’'],
         'blocks': [25, 26], 'after': 'a1302362'},
    ],
    # §10 — five uncaptioned prefix charts sat above §10.1 (Sé ‘to cut’), which the PDF prints first.
    '8acaaeba': [
        {'id': '67f52574-54c6-4477-87a6-5503d35a7f5e',
         'title': 'Instrumental prefixes',
         'fragments': ['instrumental prefixes'],
         'blocks': [2, 3], 'after': 'bc9bb13d'},
        {'id': '92d59b77-0bb8-4f83-b008-3a6ab2ddd758',
         'title': 'Xíáđa ‘to fall’',
         'fragments': ['xíáđa ‘to fall’'],
         'blocks': [4, 5], 'after': ''},
        {'id': '4588c197-202a-438c-9357-a692a8cdf381',
         'title': 'The adverbial prefix Áʼ-',
         'fragments': ['the adverbial prefix áʼ-'],
         'blocks': [6, 7], 'after': ''},
        {'id': 'e5aec8af-4db3-4485-b434-85815e5a22dc',
         'title': 'The adverbial prefix Íʼ-',
         'fragments': ['the adverbial prefix íʼ-'],
         'blocks': [8, 9], 'after': ''},
        {'id': '11d147f8-d655-41af-9c16-7e6b64a58bc1',
         'title': 'The adverbial prefix Úʼ-',
         'fragments': ['the adverbial prefix úʼ-'],
         'blocks': [10, 11], 'after': ''},
    ],
    # §11 — the cause/negation table sat between the intro and §11.1 čábe, which the intro leads into.
    '13f97ae7': [
        {'id': '72bb967b-62d1-4ed8-83b5-e53bff17ee29',
         'title': 'Verb-final grammatical markers: cause or negation',
         'fragments': ['verb-final grammatical markers', 'cause or negation'],
         'blocks': [4, 5], 'after': '8c418763'},
    ],
}


def chapter_blocks(short: str) -> list[dict]:
    needle = lane2.CHAPTERS[short]
    chapters = lane2.parse_blocks()
    return next(c for c in chapters if needle in c['title_raw'])['blocks']


def parent_block_indices(short: str, blocks: list[dict]) -> list[int]:
    """Chapter block indices Lane 2 left in the parent body, in order."""
    assign = lane2.ASSIGN[short]
    out = []
    for idx, block in enumerate(blocks):
        if block['kind'] == 'captioned_table':
            continue
        if assign.get(idx) == 'P':
            out.append(idx)
    return out


def build(sections_path: str) -> list[dict]:
    """Per-chapter plan; raises when prod isn't in the expected post-Lane-2 shape."""
    rows = json.load(open(sections_path))
    by_short = {row['id'][:8]: row for row in rows}
    kids: dict[str, list] = {}
    for row in rows:
        if row['parent_id']:
            kids.setdefault(row['parent_id'][:8], []).append(row)
    for key in kids:
        kids[key].sort(key=lambda r: r['sort_key'])

    plan = []
    for short, promotions in PROMOTIONS.items():
        blocks = chapter_blocks(short)
        parent = by_short[short]
        parent_body = lane2.multistring(parent['body']).get('default', '')
        prod_blocks = lane2.split_body(parent_body)
        expected = parent_block_indices(short, blocks)

        if len(prod_blocks) != len(expected) or any(
                lane2.norm(blocks[idx]['text']) != lane2.norm(block['text'])
                for idx, block in zip(expected, prod_blocks)):
            raise SystemExit(
                f'{short}: parent body is not in the expected post-Lane-2 shape '
                f'({len(prod_blocks)} blocks, expected {len(expected)}) — re-audit before writing')

        text_of = dict(zip(expected, (b['text'] for b in prod_blocks)))
        promoted_idx = {i for promotion in promotions for i in promotion['blocks']}
        missing = promoted_idx - set(expected)
        if missing:
            raise SystemExit(f'{short}: blocks {sorted(missing)} are not in the parent body')

        child_shorts = [child['id'][:8] for child in kids[short]]
        new_sections = []
        previous_new = ''
        for promotion in promotions:
            after = promotion['after'] or previous_new
            if not promotion['after'] and not previous_new:
                raise SystemExit(f"{short}: {promotion['title']} has no anchor sibling")
            if promotion['after'] and promotion['after'] not in child_shorts:
                raise SystemExit(f"{short}: anchor {promotion['after']} is not a child")
            body = '\n\n'.join(text_of[i] for i in promotion['blocks'])
            new_sections.append({
                'id': promotion['id'], 'short': promotion['id'][:8], 'title': promotion['title'],
                'fragments': promotion['fragments'], 'body': body,
                'after_short': after, 'after_id': next(
                    (child['id'] for child in kids[short] if child['id'][:8] == after), promotion['id']),
            })
            previous_new = promotion['id'][:8]

        # `after_id` for a section anchored on a previous NEW section is that section's id.
        by_new = {section['short']: section['id'] for section in new_sections}
        for section in new_sections:
            if section['after_short'] in by_new:
                section['after_id'] = by_new[section['after_short']]

        plan.append({
            'parent_id': parent['id'], 'parent_short': short,
            'title': lane2.multistring(parent['title']).get('default', ''),
            'old_body': parent_body,
            'new_body': '\n\n'.join(text_of[i] for i in expected if i not in promoted_idx),
            'children': [{'short': child['id'][:8], 'title': lane2.multistring(child['title']).get('default', ''),
                          'body': lane2.multistring(child['body']).get('default', '')} for child in kids[short]],
            'new_sections': new_sections,
        })
    return plan


def verify(plan: list[dict]) -> bool:
    """HARD INVARIANTS: identical prose/table multisets, and titles lifted verbatim."""
    ok = True
    for chapter in plan:
        before = lane2.split_body(chapter['old_body'])
        after = lane2.split_body(chapter['new_body'])
        for child in chapter['children']:
            blocks = lane2.split_body(child['body'])
            before += blocks
            after += blocks
        for section in chapter['new_sections']:
            after += lane2.split_body(section['body'])
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
        titles_ok = True
        for section in chapter['new_sections']:
            haystack = lane2.norm(section['body'])
            for fragment in section['fragments']:
                if fragment not in haystack:
                    titles_ok = False
                    ok = False
                    print(f"    TITLE FRAGMENT NOT IN CONTENT: {fragment!r} ({section['title']})")
        print(f"  {chapter['parent_short']} prose+tables preserved: {ok}; titles lifted verbatim: {titles_ok}")
    return ok


def render_blocks(rows: list[dict], section_id: str) -> list[dict]:
    """Blocks in RENDER order for a section: own body, then each child depth-first."""
    by_id = {row['id']: row for row in rows}
    children: dict[str, list] = {}
    for row in rows:
        if row['parent_id']:
            children.setdefault(row['parent_id'], []).append(row)
    for key in children:
        children[key].sort(key=lambda r: r['sort_key'])

    def walk(sid: str) -> list[dict]:
        out = lane2.split_body(lane2.multistring(by_id[sid]['body']).get('default', ''))
        for child in children.get(sid, []):
            out += walk(child['id'])
        return out

    return walk(section_id)


def check_order(sections_path: str) -> bool:
    """Independent check: every chapter's RENDERED block sequence == the PDF's."""
    rows = json.load(open(sections_path))
    by_short = {row['id'][:8]: row for row in rows}
    chapters = lane2.parse_blocks()
    ok = True
    for short, needle in lane2.CHAPTERS.items():
        pdf = [b for b in next(c for c in chapters if needle in c['title_raw'])['blocks']]
        rendered = render_blocks(rows, by_short[short]['id'])
        want = [lane2.norm(b['text']) for b in pdf]
        got = [lane2.norm(b['text']) for b in rendered]
        if want == got:
            print(f'  {short} ✅ {len(want)} blocks in PDF order')
            continue
        ok = False
        print(f'  {short} ❌ PDF {len(want)} blocks vs rendered {len(got)}')
        for i in range(max(len(want), len(got))):
            if want[i:i + 1] != got[i:i + 1]:
                print(f'    first divergence at {i}:')
                print(f'      pdf     : {(want[i] if i < len(want) else "—")[:90]}')
                print(f'      rendered: {(got[i] if i < len(got) else "—")[:90]}')
                break
    return ok


def post(url: str, key: str, payload: dict, method: str = 'POST') -> dict:
    request = urllib.request.Request(
        url, data=json.dumps(payload).encode(), method=method,
        headers={'content-type': 'application/json', 'authorization': f'Bearer {key}'})
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--sections', required=True, help='JSON dump of prod grammar_sections')
    parser.add_argument('--plan', action='store_true')
    parser.add_argument('--verify', action='store_true')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--bodies', action='store_true', help='print full new bodies')
    parser.add_argument('--order', action='store_true', help='check all 10 chapters against PDF block order')
    parser.add_argument('--key', default='')
    parser.add_argument('--base', default=BASE_URL)
    args = parser.parse_args()

    if args.order:
        print('PDF block order (all 10 chapters):')
        sys.exit(0 if check_order(args.sections) else 1)

    plan = build(args.sections)

    if args.plan or args.verify:
        total = sum(len(chapter['new_sections']) for chapter in plan)
        print(f'{total} sections to create, {len(plan)} parents to trim')
        for chapter in plan:
            print(f"  {chapter['parent_short']} {chapter['title']}")
            print(f"    parent body {len(chapter['old_body'])} -> {len(chapter['new_body'])} chars")
            for section in chapter['new_sections']:
                print(f"    + {section['title']!r} ({len(section['body'])} chars) after {section['after_short']}")
                if args.bodies:
                    print(re.sub(r'^', '        ', section['body'], flags=re.M))
    if args.verify:
        print('invariant check:')
        if not verify(plan):
            sys.exit(1)
    if not args.apply:
        return
    if not args.key:
        sys.exit('--apply needs --key=ldk_…')

    created = 0
    for chapter in plan:
        for section in chapter['new_sections']:
            payload = {'id': section['id'], 'parent_id': chapter['parent_id'],
                       'after_section_id': section['after_id'],
                       'title': {'default': section['title']}, 'body': {'default': section['body']}}
            try:
                result = post(f"{args.base}/api/v1/dictionaries/ponca/grammar/sections", args.key, payload)
                created += 1
                print(f"  created={result['created']} {section['short']} {section['title']!r} sort_key={result['section']['sort_key']}")
            except Exception as error:  # noqa: BLE001 — one-off script, report and continue
                detail = error.read().decode()[:300] if hasattr(error, 'read') else ''
                print(f"  FAIL create {section['title']!r}: {error} {detail}")
    print(f'created {created}/{sum(len(c["new_sections"]) for c in plan)}')

    trimmed = 0
    for chapter in plan:
        if chapter['new_body'] == chapter['old_body']:
            continue
        try:
            post(f"{args.base}/api/v1/dictionaries/ponca/grammar/sections/{chapter['parent_id']}",
                 args.key, {'body': {'default': chapter['new_body']}}, method='PATCH')
            trimmed += 1
            print('  trimmed', chapter['parent_short'])
        except Exception as error:  # noqa: BLE001
            detail = error.read().decode()[:300] if hasattr(error, 'read') else ''
            print(f"  FAIL trim {chapter['parent_short']}: {error} {detail}")
    print(f'trimmed {trimmed}/{len(plan)} parents')


if __name__ == '__main__':
    main()
