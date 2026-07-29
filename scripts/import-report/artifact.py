"""Shared HTML shell for import-conversation artifacts (the pre-write `preview`
and the post-write `report` of guide §2.8).

ONE design language and ONE set of structural guarantees for every import, while
staying a toolkit rather than a template: `Doc`/`Section` give you the shell (title,
optional stats, optional destination links, contents, collapsible sections) and
`Section.add()` takes arbitrary markup, so an import can render whatever its source
material actually needs and skip everything it doesn't. Nothing below is required
except `Doc` + at least one `Section`.

Rendered under `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline';
img-src data:; font-src data:` inside a script-blocked sandboxed iframe, so:
  - NO scripts. There is deliberately no "expand all" button — it could never work.
    (Both earlier copies of this file shipped one, permanently invisible.)
  - Inline `<style>` only; no external CSS, fonts or images. Images must be `data:`.
  - Any `<details>` an anchor points INTO must be `open`, since nothing can expand it.
    `Doc.render()` ENFORCES this for `report_anchor` targets you declare via
    `Section.anchors_targeted_by_questions`.

Font stack: LD's own `--font-sans` from `site/src/lib/theme.css`, NOT `system-ui` /
`-apple-system` / `Helvetica`. That is not cosmetic — Mac Chrome's .SF NS renders
combining diacritics incorrectly (stacking them over a dotted i instead of replacing
the dot), and import reports are mostly diacritic-heavy headwords. The first three
reports shipped with the broken stack; don't reintroduce it.

Usage sketch:

    doc = Doc(heading="Dictionary of the Ponca People", eyebrow="Import report")
    doc.set_links([("Open the dictionary", url, "primary"), ...])
    questions = doc.section("questions", "Questions for you", count="3")
    questions.add(question(...).html)
"""
from __future__ import annotations

import html as html_mod
import json
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Sequence

# ---------------------------------------------------------------- design tokens

FONT = ('"Segoe UI", Arial, "Noto Sans", "Noto Sans Wancho", sans-serif, '
        '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"')

CSS = """
/* __FONT__ is substituted below — deliberately NOT %-formatting, so a literal
   `%` in a CSS value (width:100%) can never blow up the module at import time. */
:root{
  --bg:#f7f7f8;--card:#fff;--line:#e3e3e6;--soft:#f0f0f2;
  --fg:#111827;--mut:#6b7280;--dim:#374151;
  --acc:#2563eb;--acc-soft:#eef2ff;--acc-line:#c7d2fe;
  --warn:#92400e;--warn-soft:#fffbeb;--warn-line:#fde68a;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 __FONT__;padding:22px}
.wrap{max-width:1040px;margin:0 auto}
h1{font-size:24px;margin:6px 0 4px}
h2{font-size:17px;margin:0;font-weight:700}
h3{font-size:15px;margin:0 0 6px;font-weight:700}
p{margin:8px 0 0}
/* headwords are links in running prose, so the underline stays (colour alone is
   not an affordance) but is softened out of the way of the diacritics above it */
a{color:var(--acc);text-decoration-color:#93c5fd;text-underline-offset:2px}
a:hover{text-decoration-color:currentColor}

.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:0 0 12px}
.eyebrow{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);font-weight:700}
.byline{color:var(--mut)}
.lede{margin:12px 0 0}

/* at-a-glance numbers */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;margin:0 0 12px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:11px 13px}
.stat b{display:block;font-size:21px;line-height:1.2}
.stat span{font-size:12px;color:var(--mut)}

/* where to go next */
.links{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--soft)}
.links a{border:1px solid var(--line);border-radius:20px;padding:5px 13px;font-size:13px;
  text-decoration:none;color:var(--dim);display:inline-block}
.links a.primary{border-color:var(--acc-line);background:var(--acc-soft);color:#3730a3;font-weight:600}
.links a.warn{border-color:var(--warn-line);background:var(--warn-soft);color:var(--warn);font-weight:600}

/* contents */
.toc{columns:2;column-gap:26px;margin-top:8px}
.toc div{break-inside:avoid;font-size:14px;padding:3px 0}
.toc .n{color:#9ca3af}
.toc a{text-decoration:none}
.toc .c{color:#9ca3af;font-size:12px}

/* collapsible sections */
details.sec{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:0 0 12px}
details.sec>summary{cursor:pointer;list-style:none;padding:13px 16px;display:flex;align-items:baseline;gap:10px}
details.sec>summary::-webkit-details-marker{display:none}
details.sec>summary::before{content:"\\25B8";color:#9ca3af;font-size:12px}
details.sec[open]>summary::before{content:"\\25BE"}
details.sec>summary h2{flex:1}
.sec-n{font-size:12px;color:var(--mut)}
.sec-body{padding:0 16px 14px}
.sec-body>p:first-child{margin-top:0}
.blurb{color:var(--dim);margin:0 0 10px}
:target{scroll-margin-top:8px}

/* nested detail — the long exhaustive lists */
details.deep{margin:10px 0 0;border:1px solid #e9e9ec;border-radius:8px;padding:8px 12px;background:#fafafa}
details.deep>summary{cursor:pointer;font-weight:600;color:var(--dim)}
.row{padding:5px 0;border-bottom:1px solid var(--soft);font-size:13px}
.row:last-child{border-bottom:0}
.mut{color:var(--mut)}

/* questions + flagged callouts */
.q{margin:10px 0 0;padding:10px 12px;border:1px solid var(--acc-line);border-radius:8px;background:var(--acc-soft)}
.q .ask{font-weight:600;margin-top:8px}
.flag{padding:10px 12px;border:1px solid var(--warn-line);border-radius:8px;background:var(--warn-soft);margin-bottom:8px}
.flag:last-child{margin-bottom:0}

/* entries as the reader will see them */
.entry{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:0 0 12px}
.entry .hw{font-size:19px;font-weight:700}
.entry .meta{color:var(--mut);font-size:13px;margin-top:2px}
.entry ol{margin:10px 0 0;padding-left:20px}
.entry li{margin-bottom:8px}
.entry .lit{color:var(--mut);font-size:13px}
.entry .ex{margin-top:6px;padding-left:10px;border-left:3px solid var(--acc-line)}
.entry .rel{margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)}
.review{margin-top:10px;border-left:3px solid #d97706;background:var(--warn-soft);padding:9px 12px;border-radius:0 8px 8px 0}

table.nums{border-collapse:collapse;font-size:14px;margin-top:8px;width:100%;max-width:660px}
table.nums td{padding:6px 0}
table.nums tr+tr td{border-top:1px solid var(--soft)}
table.nums td.k{padding-right:14px;color:var(--dim)}
table.nums td.v{font-weight:700;text-align:right;white-space:nowrap}

.glyphs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.glyph{border:1px solid var(--line);border-radius:8px;padding:8px 12px;text-align:center;min-width:64px}
.glyph b{display:block;font-size:22px;font-weight:400}
.glyph span{font-size:11px;color:var(--mut)}

.record{color:var(--mut);font-size:12px}
""".replace('__FONT__', FONT)


def esc(text: Any) -> str:
    return html_mod.escape('' if text is None else str(text), quote=False)


# ------------------------------------------------------------------- the shell

@dataclass
class Section:
    anchor: str
    title: str
    count: str | None = None
    blurb: str | None = None
    is_open: bool = True
    parts: list[str] = field(default_factory=list)
    #: ids inside this section that a filed question's `report_anchor` points at.
    #: Declaring them makes `Doc.render()` refuse to close the section — without
    #: script a jump cannot expand it, so the manager would land on nothing.
    question_anchors: list[str] = field(default_factory=list)

    def add(self, markup: str) -> Section:
        self.parts.append(markup)
        return self

    def render(self) -> str:
        count = f'<span class="sec-n">{esc(self.count)}</span>' if self.count else ''
        blurb = f'<p class="blurb">{self.blurb}</p>' if self.blurb else ''
        return (f'<details class="sec" id="{esc(self.anchor)}"{" open" if self.is_open else ""}>'
                f'<summary><h2>{esc(self.title)}</h2>{count}</summary>'
                f'<div class="sec-body">{blurb}{"".join(self.parts)}</div></details>')


class Doc:
    def __init__(self, *, heading: str, eyebrow: str | None = None,
                 byline: str | None = None, lede: str | None = None,
                 title: str | None = None) -> None:
        self.heading = heading
        self.eyebrow = eyebrow
        self.byline = byline
        self.lede = lede
        self.title = title or heading
        self.stats: list[tuple[str, str]] = []
        self.links: list[tuple[str, str, str]] = []
        self.sections: list[Section] = []

    def set_stats(self, stats: Sequence[tuple[Any, str]]) -> Doc:
        """Big scannable numbers above the contents. Optional — skip for a small import."""
        self.stats = [(str(value), label) for value, label in stats]
        return self

    def set_links(self, links: Sequence[tuple[str, str, str] | tuple[str, str]]) -> Doc:
        """Destination chips: (label, href, style) where style is ''|'primary'|'warn'.

        A report is read beside the dictionary. Always give at least the dictionary
        home; add whatever else the import produced (grammar, about, a filtered
        entries view) so no claim in the prose is unreachable.
        """
        self.links = [(item[0], item[1], item[2] if len(item) > 2 else '') for item in links]
        return self

    def section(self, anchor: str, title: str, count: str | None = None,
                blurb: str | None = None, is_open: bool = True,
                question_anchors: Sequence[str] = ()) -> Section:
        section = Section(anchor, title, count, blurb, is_open, question_anchors=list(question_anchors))
        self.sections.append(section)
        return section

    def render(self) -> str:
        for section in self.sections:
            if section.question_anchors and not section.is_open:
                raise ValueError(
                    f'section {section.anchor!r} holds question anchors '
                    f'{section.question_anchors} but is closed — no script can open it')

        head = [f'<div class="eyebrow">{self.eyebrow}</div>' if self.eyebrow else '',
                f'<h1>{esc(self.heading)}</h1>',
                f'<div class="byline">{self.byline}</div>' if self.byline else '',
                f'<p class="lede">{self.lede}</p>' if self.lede else '']

        out = ['<!doctype html><html lang="en"><meta charset="utf-8">',
               '<meta name="viewport" content="width=device-width,initial-scale=1">',
               f'<title>{esc(self.title)}</title>',
               f'<style>{CSS}</style>',
               '<body><div class="wrap">',
               f'<div class="card">{"".join(part for part in head if part)}</div>']

        if self.stats:
            cells = ''.join(f'<div class="stat"><b>{esc(value)}</b><span>{esc(label)}</span></div>'
                            for value, label in self.stats)
            out.append(f'<div class="stats">{cells}</div>')

        rows = ''.join(
            f'<div><span class="n">{index}.</span> <a href="#{esc(section.anchor)}">{esc(section.title)}</a>'
            + (f' <span class="c">— {esc(section.count)}</span>' if section.count else '')
            + '</div>'
            for index, section in enumerate(self.sections, 1))
        links = ''
        if self.links:
            chips = ''.join(f'<a class="{style}" href="{esc(href)}">{esc(label)}</a>'
                            for label, href, style in self.links)
            links = f'<div class="links">{chips}</div>'
        out.append(f'<div class="card"><div class="eyebrow">Contents</div>'
                   f'<div class="toc">{rows}</div>{links}</div>')

        out += [section.render() for section in self.sections]
        out.append('</div></body></html>')
        return '\n'.join(out)

    def write(self, path) -> str:
        markup = self.render()
        path.write_text(markup, encoding='utf-8')
        return markup


# ------------------------------------------------------ headwords that must link

class Linker:
    """Every headword printed anywhere in a report must link to its live entry
    (guide §2.8, checklist item 1). This is the ONLY way to print one: it raises on
    a word it cannot resolve, so a report can't quietly ship with dead text, and
    `assert_complete()` proves no other code path emitted an entry link.
    """

    def __init__(self, *, base_url: str, ids_by_lexeme: dict[str, str],
                 ids_by_key: dict[Any, str] | None = None) -> None:
        self.base_url = base_url.rstrip('/')
        self.ids_by_lexeme = ids_by_lexeme
        self.ids_by_key = ids_by_key or {}
        self.count = 0

    def id_of(self, lexeme: str, key: Any = None) -> str:
        if key is not None and (lexeme, key) in self.ids_by_key:
            return self.ids_by_key[(lexeme, key)]
        if lexeme in self.ids_by_lexeme:
            return self.ids_by_lexeme[lexeme]
        raise KeyError(f'headword with no entry link: {lexeme!r} (key={key!r})')

    def lex(self, lexeme: str, key: Any = None, *, bold: bool = False, plain: bool = False) -> str:
        entry_id = self.id_of(lexeme, key)
        self.count += 1
        tag = 'b' if bold else ('span' if plain else 'i')
        return f'<a href="{self.base_url}/entry/{entry_id}"><{tag}>{esc(lexeme)}</{tag}></a>'

    def assert_complete(self, markup: str, *, minimum: int = 1) -> None:
        found = markup.count(f'{self.base_url}/entry/')
        if found != self.count:
            raise AssertionError(f'{found} entry links in the HTML but lex() was called {self.count} times '
                                 '— some headword was printed without going through lex()')
        if self.count < minimum:
            raise AssertionError(f'only {self.count} linked headwords — suspiciously few')


# --------------------------------------------------------- optional content bits

def numbers_table(rows: Iterable[tuple[str, Any]]) -> str:
    cells = ''.join(f'<tr><td class="k">{label}</td><td class="v">{value}</td></tr>' for label, value in rows)
    return f'<table class="nums">{cells}</table>'


def glyph_chips(glyphs: Iterable[tuple[str, str]]) -> str:
    chips = ''.join(f'<div class="glyph"><b>{glyph}</b><span>{esc(caption)}</span></div>'
                    for glyph, caption in glyphs)
    return f'<div class="glyphs">{chips}</div>'


def bullets(items: Iterable[str]) -> str:
    return '<ul style="margin:10px 0 0;padding-left:20px;color:#374151">' \
        + ''.join(f'<li style="margin-bottom:8px">{item}</li>' for item in items) + '</ul>'


def deep(summary: str, body: str) -> str:
    """A collapsed exhaustive list. Keeps the main flow readable (guide §2.8 length rule)."""
    return f'<details class="deep"><summary>{esc(summary)}</summary>{body}</details>'


def rows(lines: Iterable[str]) -> str:
    return ''.join(f'<div class="row">{line}</div>' for line in lines)


def flag(title: str, body: str, extra: str = '') -> str:
    """A review-queue category card: why entries land here, its count, examples."""
    return f'<div class="flag"><b>{title}</b><p>{body}</p>{extra}</div>'


def entry_card(*, headword: str, meta: str | None = None, senses: Sequence[dict] = (),
               related: Sequence[tuple[str, str]] = (), related_label: str | None = None,
               source_rows: str | None = None, review: str | None = None,
               open_link: str | None = None) -> str:
    """One entry as the reader will see it. Every field optional — a spreadsheet
    import passes glosses + `source_rows`; a book import passes pronunciation,
    numbered senses with literal readings and examples, and related forms."""
    parts = [f'<div class="entry"><div class="hw">{headword}</div>']
    if meta:
        parts.append(f'<div class="meta">{meta}</div>')
    if senses:
        parts.append('<ol>')
        for sense in senses:
            line = f'<b>{esc(sense.get("gloss", ""))}</b>'
            if sense.get('definition'):
                line += f' &mdash; {esc(sense["definition"])}'
            if sense.get('literal'):
                line += f'<div class="lit">literally: {esc(sense["literal"])}</div>'
            for example in sense.get('examples', []):
                translation = example.get('translation', '')
                line += (f'<div class="ex"><i>{esc(example["text"])}</i>'
                         + (f'<br>{esc(translation)}' if translation else '') + '</div>')
            parts.append(f'<li>{line}</li>')
        parts.append('</ol>')
    if related:
        label = related_label or 'Related forms'
        body = ''.join(f'<div style="margin-top:4px">{link} &mdash; {esc(gloss)}</div>' for link, gloss in related)
        parts.append(f'<div class="rel"><div class="eyebrow">{esc(label)}</div>{body}</div>')
    if source_rows:
        parts.append(deep('the source it came from', source_rows))
    if review:
        parts.append(f'<div class="review">{review}</div>')
    if open_link:
        parts.append(f'<p><a href="{esc(open_link)}">Open this entry in the dictionary &rarr;</a></p>')
    parts.append('</div>')
    return ''.join(parts)


# ------------------------------------------------- questions, filed and rendered

@dataclass
class Question:
    """One whole-import question, rendered in the report AND filed as an answerable
    object. Built together so the two can never drift: `.html` goes in the report,
    `.payload` goes to `POST …/conversations/{id}/questions`.

    Set `answerable=False` for a judgement call you are reporting but not asking
    about — it renders identically and files nothing.
    """
    anchor: str
    number: int
    title: str
    html: str
    payload: dict | None

    @property
    def answerable(self) -> bool:
        return self.payload is not None


def question(*, anchor: str, number: int, title: str, paragraphs: Sequence[str],
             ask: str | None = None, short_title: str | None = None,
             body_html: str | None = None, options: Sequence[tuple[str, str]] | None = None,
             entries_query: dict | None = None, entries_query_label: str | None = None,
             answerable: bool = True) -> Question:
    """`title` is the reader's heading; `short_title` (default: `title`) is what the
    answer card in the app shows, so keep it under ~70 characters and phrase it as a
    real question. `options` makes it a `choice` — always include an escape option."""
    body = ''.join(f'<p>{text}</p>' for text in paragraphs)
    if ask:
        body += f'<p class="ask">{ask}</p>'
    html = f'<div class="q" id="{esc(anchor)}"><h3>{number}&nbsp;&middot;&nbsp;{title}</h3>{body}</div>'

    payload = None
    if answerable:
        payload = {
            'kind': 'choice' if options else 'text',
            'title': short_title or re.sub('<[^>]+>', '', title),
            'report_anchor': f'#{anchor}',
        }
        if body_html:
            payload['body_html'] = body_html
        if options:
            payload['options'] = [{'value': value, 'label': label} for value, label in options]
        if entries_query:
            payload['entries_query'] = entries_query
            if entries_query_label:
                payload['entries_query_label'] = entries_query_label
    return Question(anchor=anchor, number=number, title=title, html=html, payload=payload)


def questions_payload(questions: Iterable[Question]) -> str:
    """The exact JSON body for `POST …/conversations/{thread_id}/questions`."""
    filed = [q.payload for q in questions if q.payload]
    return json.dumps({'questions': filed}, ensure_ascii=False, indent=2)


def assert_question_anchors(markup: str, questions: Iterable[Question]) -> None:
    """Every filed question's `report_anchor` must actually exist in the HTML."""
    for question_ in questions:
        if question_.payload and f'id="{question_.anchor}"' not in markup:
            raise AssertionError(f'question anchor #{question_.anchor} is not in the report')
