#!/usr/bin/env python3
"""
Extracts structured study content from the "Beginning with New Testament Greek"
EPUB (chapters, vocabulary, alphabet, paradigms) into data/content.json.

Run from anywhere; paths are resolved relative to this script.
Rerun whenever the source EPUB changes.
"""
import json
import re
import unicodedata
import zipfile
from pathlib import Path

from bs4 import BeautifulSoup

HERE = Path(__file__).parent
COURSE_DIR = HERE.parent
EPUB_PATH = COURSE_DIR / "Resources" / "Beginning with New Testament Greek.epub"
OUT_PATH = HERE / "data" / "content.json"


def read_epub_html(zf, name):
    with zf.open(name) as f:
        return BeautifulSoup(f.read(), "html.parser")


def cell_text(td):
    """Full visible text of a <td>, collapsing whitespace."""
    return re.sub(r"\s+", " ", td.get_text(" ", strip=True)).strip()


def cell_has_greek(td):
    return td.find("span", class_="greek") is not None


# ---------------------------------------------------------------------------
# Chapters (titles + topic list)
# ---------------------------------------------------------------------------

def extract_chapters(zf, names):
    chapters = []
    for name in names:
        soup = read_epub_html(zf, name)
        chno = soup.find("h1", class_="chno")
        chtitle = soup.find("h1", class_="chap_title")
        if not chno or not chtitle:
            continue
        m = re.search(r"\d+", chno.get_text())
        if not m:
            continue
        num = int(m.group(0))
        title = re.sub(r"\s+", " ", chtitle.get_text(" ", strip=True)).strip().title()
        topics = []
        for h2 in soup.find_all("h2", class_="h2"):
            t = re.sub(r"\s+", " ", h2.get_text(" ", strip=True))
            t = re.sub(r"^\d+\.\d+\s*", "", t)
            if t and not t[0].isdigit():
                topics.append(t)
        chapters.append({"number": num, "title": title, "topics": topics})
    chapters.sort(key=lambda c: c["number"])
    return chapters


# ---------------------------------------------------------------------------
# Alphabet (first table in chapter 1)
# ---------------------------------------------------------------------------

def extract_alphabet(zf):
    soup = read_epub_html(zf, "OEBPS/text/02_chapter01.xhtml")
    table = soup.find("table")
    rows = table.find("tbody").find_all("tr")
    letters = []
    for tr in rows:
        tds = tr.find_all("td")
        if len(tds) < 4:
            continue
        lower = cell_text(tds[0])
        upper = cell_text(tds[1])
        name = cell_text(tds[2])
        erasmian = cell_text(tds[3])
        koine = cell_text(tds[4]) if len(tds) > 4 else ""
        modern = cell_text(tds[5]) if len(tds) > 5 else ""
        if not lower:
            continue
        letters.append({
            "lower": lower,
            "upper": upper,
            "name": name,
            "erasmian_pronunciation": erasmian,
            "koine_pronunciation": koine,
            "modern_pronunciation": modern,
            "chapter": 1,
        })
    return letters


# ---------------------------------------------------------------------------
# Vocabulary (backmatter master list)
# ---------------------------------------------------------------------------

def extract_vocabulary(zf):
    soup = read_epub_html(zf, "OEBPS/text/03_backmatter03_vocabulary.xhtml")
    entries = []
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) != 2:
                continue
            greek_span = tds[0].find("span", class_="greek")
            if not greek_span:
                continue
            word = cell_text(tds[0])
            gloss_full = cell_text(tds[1])
            m = re.search(r"\[\s*(\d+)\s*\]", gloss_full)
            chapter = int(m.group(1)) if m else None
            gloss = re.sub(r"\s*\[\s*\d+\s*\]\s*$", "", gloss_full).strip()
            if not word or chapter is None:
                continue
            entries.append({"word": word, "gloss": gloss, "chapter": chapter})
    return entries


# ---------------------------------------------------------------------------
# Appendix paradigms — generic grid extraction per table, keyed by its
# header title. Each table becomes {title, rows: [[cells]]} where each cell
# records {text, greek(bool)}. Kept generic (rather than semantically parsed
# per table shape) because noun/adjective/pronoun tables use a case x
# singular/plural grid while verb tables use a person x singular/plural grid
# with different column counts — a single row/col-label + cell structure
# handles both without per-shape logic.
# ---------------------------------------------------------------------------

def extract_paradigms(zf):
    soup = read_epub_html(zf, "OEBPS/text/03_backmatter01_appendix.xhtml")
    tables = []
    for table in soup.find_all("table"):
        thead = table.find("thead")
        if not thead:
            continue
        thead_tds = thead.find_all("td")
        if len(thead_tds) == 1:
            # A single merged header cell across the row is the table's title
            # (e.g. "FIRST DECLENSION NOUN—ETA PATTERN").
            title = cell_text(thead_tds[0])
            column_headers = None
        else:
            # Real per-column headers (e.g. principal-parts / frequency
            # tables) — the title lives in the nearest preceding heading.
            heading = table.find_previous("h2")
            title = cell_text(heading) if heading else "Reference Table"
            column_headers = [cell_text(td) for td in thead_tds]
            if title and title.strip().upper() == "PARADIGMS":
                # Generic top-of-appendix heading, not a real section title
                # for this specific table (e.g. subjunctive mood tables with
                # no sub-heading of their own) — derive one from the header
                # row's own (non-blank) labels instead.
                header_row = thead.find_all("tr")[0].find_all("td")
                labels = [cell_text(td) for td in header_row if cell_text(td)]
                if labels:
                    title = " / ".join(labels)
        if not title:
            continue
        rows = []
        tbody = table.find("tbody")
        for tr in (tbody.find_all("tr") if tbody else []):
            row = []
            for td in tr.find_all("td"):
                text = cell_text(td)
                colspan = int(td.get("colspan", 1) or 1)
                cell = {"text": text, "greek": cell_has_greek(td)}
                row.append(cell)
                # Label/banner rows (e.g. "SINGULAR" spanning 3 columns)
                # use colspan to merge cells visually; repeat the cell so
                # header column count lines up 1:1 with data column count.
                row.extend({**cell} for _ in range(colspan - 1))
            if any(c["text"] for c in row):
                rows.append(row)
        tables.append({"title": title, "column_headers": column_headers, "rows": rows})
    return tables


# Paradigm table titles are terse ("AORIST ACTIVE INDICATIVE") and don't carry
# their own chapter number, so map them to the chapter that introduces that
# form, based on the chapter titles/order in the book.
CHAPTER_KEYWORD_TO_PARADIGM_TITLES = {
    2: ["FIRST DECLENSION NOUN"],
    3: ["SECOND DECLENSION NOUN"],
    4: ["PRESENT INDICATIVE-ΕΙΜΙ"],
    5: ["PRESENT ACTIVE INDICATIVE", "PRESENT MIDDLE/PASSIVE INDICATIVE"],
    6: ["IMPERFECT ACTIVE INDICATIVE", "IMPERFECT MIDDLE/PASSIVE INDICATIVE",
        "IMPERFECT INDICATIVE-ΕΙΜΙ"],
    9: ["FIRST PERSON PERSONAL PRONOUN", "SECOND PERSON PERSONAL PRONOUN",
        "THIRD PERSON PERSONAL PRONOUN", "RELATIVE PRONOUN"],
    10: ["FUTURE ACTIVE INDICATIVE", "FUTURE MIDDLE INDICATIVE", "FUTURE PASSIVE INDICATIVE"],
    # Checked before chapter 11 below: "SECOND AORIST ACTIVE INDICATIVE"
    # contains "AORIST ACTIVE INDICATIVE" as a substring, so without this
    # entry coming first these Ch.12 tables would false-match Ch.11's
    # keyword and unlock a chapter early.
    12: ["SECOND AORIST"],
    11: ["AORIST ACTIVE INDICATIVE", "AORIST MIDDLE INDICATIVE", "AORIST PASSIVE INDICATIVE"],
    14: ["THIRD DECLENSION NOUN"],
    15: ["PERFECT ACTIVE INDICATIVE", "PERFECT MIDDLE/PASSIVE INDICATIVE"],
    16: ["FIRST AND SECOND DECLENSION ADJECTIVE", "THIRD DECLENSION ADJECTIVE"],
    17: ["PRESENT ACTIVE PARTICIPLE", "PRESENT MIDDLE/PASSIVE PARTICIPLE"],
    18: ["FIRST AORIST ACTIVE PARTICIPLE", "FIRST AORIST MIDDLE PARTICIPLE",
         "FIRST AORIST PASSIVE PARTICIPLE"],
    19: ["PERFECT ACTIVE PARTICIPLE", "PERFECT MIDDLE/PASSIVE PARTICIPLE"],
    20: ["NEAR DEMONSTRATIVE PRONOUN", "INTERROGATIVE / INDEFINITE PRONOUNS"],
    21: ["PRESENT AND AORIST INFINITIVES"],
    22: ["PRESENT ACTIVE SUB", "AORIST ACTIVE SUB", "AORIST MIDDLE SUB", "AORIST PASSIVE SUB"],
    23: ["PRESENT ACTIVE IMPERATIVE", "AORIST ACTIVE IMPERATIVE", "PRESENT MIDDLE/PASSIVE IMPERATIVE"],
    24: ["ACTIVE INDICATIVE FORMS OF", "ACTIVE NON-INDICATIVE FORMS OF"],
}



def normalize_for_match(text):
    """Uppercase, strip accents/breathing marks, and normalize dashes so
    Greek-bearing titles like 'PRESENT INDICATIVE—εἰμί' can be matched
    against plain keyword strings."""
    text = text.upper().replace("—", "-").replace("–", "-")
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


def tag_paradigms_with_chapter(paradigms):
    for p in paradigms:
        p["chapter"] = None
        title_norm = normalize_for_match(p["title"])
        for chapter, keywords in CHAPTER_KEYWORD_TO_PARADIGM_TITLES.items():
            if any(normalize_for_match(kw) in title_norm for kw in keywords):
                p["chapter"] = chapter
                break
        # Tables with real per-column headers (frequency lists, principal
        # parts) are reference material, not a clean case/person drill grid —
        # flag them so the app shows but doesn't quiz on them (for now). The
        # master verb chart is a nested-header summary table, not a drillable
        # single-paradigm grid either, so it's excluded explicitly.
        p["drillable"] = (
            p["column_headers"] is None
            and "MASTER VERB CHART" not in p["title"].upper()
        )
    return paradigms


# ---------------------------------------------------------------------------
# Parsing exercises — from the backmatter "Key to the Practice Exercises",
# the chapters with a dedicated "Parsing" answer-key subsection (indicative
# verbs, participles, infinitives, subjunctives, imperatives). Each entry is
# "form—LEXICAL tag tag tag, “translation”" e.g.
#   ἀκούεις—ἀκούω pres act ind 2nd sg, "You (sg) are hearing"
# Chapter 20 (pronoun parsing) uses a different, classification-based
# format and is intentionally excluded; chapter 11 has no dedicated parsing
# subsection in the book's own answer key.
PARSING_CHAPTERS = [5, 6, 7, 10, 12, 13, 15, 17, 18, 19, 21, 22, 23]

TENSE_TOKENS = {"pres": "Present", "impf": "Imperfect", "fut": "Future",
                "aor": "Aorist", "perf": "Perfect", "plup": "Pluperfect"}
VOICE_TOKENS = {"mid/pass": "Middle/Passive", "mid": "Middle", "pass": "Passive", "act": "Active"}
MOOD_TOKENS = {"ind": "Indicative", "sub": "Subjunctive", "imp": "Imperative",
               "inf": "Infinitive", "ptc": "Participle", "opt": "Optative"}
PERSON_TOKENS = {"1st": "1st", "2nd": "2nd", "3rd": "3rd"}
NUMBER_TOKENS = {"sg": "Singular", "pl": "Plural"}
GENDER_TOKENS = {"masc/fem/neut": "Masc/Fem/Neut", "masc/fem": "Masc/Fem",
                  "masc/neut": "Masc/Neut", "fem/neut": "Fem/Neut",
                  "masc": "Masculine", "fem": "Feminine", "neut": "Neuter"}
CASE_TOKENS = {"nom": "Nominative", "gen": "Genitive", "dat": "Dative", "acc": "Accusative"}


def classify_parse_tags(tag_text):
    fields = {}
    for raw in tag_text.replace(",", " ").split():
        tok = raw.strip(".").lower()
        if tok in TENSE_TOKENS:
            fields["tense"] = TENSE_TOKENS[tok]
        elif tok in VOICE_TOKENS:
            fields["voice"] = VOICE_TOKENS[tok]
        elif tok in MOOD_TOKENS:
            fields["mood"] = MOOD_TOKENS[tok]
        elif tok in PERSON_TOKENS:
            fields["person"] = PERSON_TOKENS[tok]
        elif tok in NUMBER_TOKENS:
            fields["number"] = NUMBER_TOKENS[tok]
        elif tok in GENDER_TOKENS:
            fields["gender"] = GENDER_TOKENS[tok]
        elif tok in CASE_TOKENS:
            fields["case"] = CASE_TOKENS[tok]
    return fields


# Greek (incl. extended/polytonic) letter ranges, used to recognize where an
# entry's inflected form starts (as opposed to a stray number elsewhere in
# the English prose, e.g. "section 5.6").
GREEK_CHAR = r"[Ͱ-Ͽἀ-῿]"
ENTRY_MARKER_RE = re.compile(r"(\d{1,2})\.\s+(?=" + GREEK_CHAR + ")")


def extract_parsing(zf):
    soup = read_epub_html(zf, "OEBPS/text/03_backmatter02_keypractice.xhtml")
    full_text = soup.get_text(" ", strip=True)
    chapter_starts = [(int(m.group(1)), m.start()) for m in
                       re.finditer(r"ANSWER KEY TO CHAPTER (\d+)", full_text)]
    chapter_starts.append((None, len(full_text)))

    entries = []
    for i, (chapter, start) in enumerate(chapter_starts[:-1]):
        if chapter not in PARSING_CHAPTERS:
            continue
        end = chapter_starts[i + 1][1]
        chunk = full_text[start:end]
        m = re.search(r"[A-Z]\.\s*Parsing\s*:", chunk)
        if not m:
            continue
        section = chunk[m.end():]
        # Stop at the next lettered heading (e.g. "C. Translation:").
        stop = re.search(r"[A-Z]\.\s+[A-Z][a-zA-Z ]*\s*:", section)
        if stop:
            section = section[:stop.start()]

        markers = list(ENTRY_MARKER_RE.finditer(section))
        for j, marker in enumerate(markers):
            entry_start = marker.end()
            entry_end = markers[j + 1].start() if j + 1 < len(markers) else len(section)
            entry_text = section[entry_start:entry_end].strip()

            parts = re.split(r"\s*[—-]\s*", entry_text, maxsplit=1)
            if len(parts) != 2:
                continue
            form, rest = parts[0].strip(), parts[1].strip()

            tok = rest.split(None, 1)
            if len(tok) != 2:
                continue
            lexical, remainder = tok[0], tok[1]

            boundary = re.search(r"[,“”\"]", remainder)
            tags_text = remainder[:boundary.start()] if boundary else remainder
            fields = classify_parse_tags(tags_text)
            if not fields:
                continue

            trans_m = re.search(r"[“\"]([^”\"]+)[”\"]", remainder)
            translation = trans_m.group(1) if trans_m else ""

            entries.append({
                "chapter": chapter,
                "form": form,
                "lexical": lexical,
                "translation": translation,
                **fields,
            })
    return entries


# Conceptual grammar terms (voice/mood/tense) — not inflected forms, so they
# don't fit the vocabulary or paradigm extraction. Definitions are quoted/
# paraphrased directly from the book's own explanatory prose in section 4.4
# (Voice), 4.5 (Mood), and 4.6 (Tense and Aspect), where all three are first
# introduced together.
GRAMMAR_CONCEPTS = [
    {"category": "Voice", "term": "Active", "chapter": 4,
     "definition": "The subject performs the action."},
    {"category": "Voice", "term": "Middle", "chapter": 4,
     "definition": "The subject both performs and is affected by the action."},
    {"category": "Voice", "term": "Passive", "chapter": 4,
     "definition": "The subject does not perform the action but receives it."},

    {"category": "Mood", "term": "Indicative", "chapter": 4,
     "definition": "Represents something as certain or asserted — presented as factual."},
    {"category": "Mood", "term": "Subjunctive", "chapter": 4,
     "definition": "Represents something as probable, contingent, or indefinite."},
    {"category": "Mood", "term": "Optative", "chapter": 4,
     "definition": "Represents something as possible or hoped for."},
    {"category": "Mood", "term": "Imperative", "chapter": 4,
     "definition": "Represents something as requested or commanded."},

    {"category": "Tense", "term": "Present", "chapter": 4,
     "definition": "Imperfective aspect — the action is depicted as ongoing or in process, with no focus on its beginning or end."},
    {"category": "Tense", "term": "Imperfect", "chapter": 4,
     "definition": "Imperfective aspect in past time — a past action depicted as ongoing or in process."},
    {"category": "Tense", "term": "Future", "chapter": 4,
     "definition": "Perfective aspect — a future action depicted as a complete whole."},
    {"category": "Tense", "term": "Aorist", "chapter": 4,
     "definition": "Perfective aspect — the action is depicted as complete or as a whole, without indicating how it took place."},
    {"category": "Tense", "term": "Perfect", "chapter": 4,
     "definition": "Stative aspect — a state of affairs or ongoing relevance resulting from a past action."},
    {"category": "Tense", "term": "Pluperfect", "chapter": 4,
     "definition": "Stative aspect in past time — a past state resulting from an earlier action."},
]


def main():
    with zipfile.ZipFile(EPUB_PATH) as zf:
        chapter_names = sorted(
            n for n in zf.namelist()
            if re.match(r"OEBPS/text/02_chapter\d+\.xhtml$", n)
        )
        chapters = extract_chapters(zf, chapter_names)
        alphabet = extract_alphabet(zf)
        vocabulary = extract_vocabulary(zf)
        paradigms = extract_paradigms(zf)
        paradigms = tag_paradigms_with_chapter(paradigms)
        parsing = extract_parsing(zf)

    content = {
        "chapters": chapters,
        "alphabet": alphabet,
        "vocabulary": vocabulary,
        "paradigms": paradigms,
        "parsing": parsing,
        "concepts": GRAMMAR_CONCEPTS,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(content, f, ensure_ascii=False, indent=2)

    print(f"Chapters: {len(chapters)}")
    print(f"Alphabet letters: {len(alphabet)}")
    print(f"Vocabulary entries: {len(vocabulary)}")
    untagged = sum(1 for p in paradigms if p["chapter"] is None)
    print(f"Paradigm tables: {len(paradigms)} ({untagged} untagged)")
    print(f"Parsing entries: {len(parsing)}")
    print(f"Grammar concepts: {len(GRAMMAR_CONCEPTS)}")


if __name__ == "__main__":
    main()
