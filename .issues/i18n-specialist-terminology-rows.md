# i18n — 18 specialist terminology rows awaiting human confirmation

Leftover from the 2026-07-22 AI i18n audit (sets A/C/D applied; this was set B, deliberately left
for specialist judgment). All 18 rows remain in the `/translate` AI-review queue with their CURRENT
values — nothing was changed. When a specialist/translator for the locale is available, confirm or
apply the proposals below (full audit context in git history:
`.issues/i18n-audit-corpus-import.md` @ 2026-07-22).

| Key | English · UI context | Locale(s) | Current | Proposed | Why uncertain |
|---|---|---|---|---|---|
| `discourse.reported_speech` | Reported speech · a narrative clause-role alongside storyline/background/flashback; intended as an umbrella that can include directly quoted speech | es, de, sw, ru, he, pt, id, bn, as, hi, vi, ha, am, or | `Discurso indirecto`; `Indirekte Rede`; `Usemi wa taarifa`; `Косвенная речь`; `דיבור עקיף`; `Discurso indireto`; `Ujaran tidak langsung`; `পরোক্ষ উক্তি`; `পৰোক্ষ উক্তি`; `अप्रत्यक्ष कथन`; `Lời dẫn gián tiếp`; `Maganar bayarwa`; `ተዘዋዋሪ ንግግር`; `ପରୋକ୍ଷ ଉକ୍ତି` | `Discurso referido`; `Redewiedergabe`; `Usemi ulioripotiwa`; `Чужая речь`; `דיבור מדווח`; `Discurso relatado`; `Tuturan yang dilaporkan`; `প্রতিবেদিত উক্তি`; `প্ৰতিবেদিত উক্তি`; `वर्णित कथन`; `Lời nói được thuật lại`; `Maganar da aka ruwaito`; `የተዘገበ ንግግር`; `ବର୍ଣ୍ଣିତ ଉକ୍ତି` | Most current rows explicitly mean **indirect** speech — narrower than the app's narrative-role use if direct quotation is also tagged here. Confirm the intended English taxonomy before changing all 14. |
| `discourse.flashback` | Flashback · narrative time-role option | hi | `पूर्वदृश्य` | `अतीत-दृश्य` | Current literally means a preview/advance view (suggests foreshadowing — the opposite time direction). A Hindi literary specialist may prefer `पूर्वदीप्ति`. |
| `text_tag.motif` | Motif · folklore text-tag kind, potentially carrying a Thompson/ATU index code | sw, ha, am | `Kijelezo`; `Jigo`; `ጭብጥ` | `Motifu`; `Motif`; `ተደጋጋሚ ጭብጥ` | Current terms mean descriptor/theme rather than a recurring folklore motif. Borrowing/transliteration may be more precise but check recognizability with local reviewers. |
