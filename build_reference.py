#!/usr/bin/env python3
"""
Extracts the Quiz 1-4 PDFs and the Practice Exercises PDF as read-only
reference text (tagged by chapter) into data/reference.json.

These are graded/assessment materials, not auto-generated drill content —
PDF text extraction can introduce diacritic glitches, so they're surfaced in
the app as a review panel rather than auto-graded quiz items. The app's own
auto-graded quizzes/flashcards are built from the clean EPUB-derived
vocabulary and paradigm data in content.json instead.

Run from anywhere; paths are resolved relative to this script.
"""
import json
import re
from pathlib import Path

import pdfplumber

HERE = Path(__file__).parent
COURSE_DIR = HERE.parent
RESOURCES_DIR = COURSE_DIR / "Resources"
OUT_PATH = HERE / "data" / "reference.json"

# Which chapter each quiz's material lines up with (the chapter that
# introduces the paradigm/topic the quiz centers on).
QUIZ_CHAPTER = {
    "Quiz 1.pdf": 2,
    "Quiz 2.pdf": 5,
    "Quiz 3.pdf": 9,
    "Quiz 4.pdf": 11,
}


def extract_pdf_text(path):
    with pdfplumber.open(path) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def build_quizzes():
    quizzes = []
    for filename, chapter in QUIZ_CHAPTER.items():
        path = RESOURCES_DIR / filename
        if not path.exists():
            continue
        text = extract_pdf_text(path)
        quizzes.append({
            "title": filename.replace(".pdf", ""),
            "chapter": chapter,
            "text": text.strip(),
        })
    quizzes.sort(key=lambda q: q["chapter"])
    return quizzes


def build_practice_exercises():
    path = RESOURCES_DIR / "Practice Exercises for Plummer Grammar.pdf"
    if not path.exists():
        return []
    text = extract_pdf_text(path)
    # Split on headers like "1.10 Practice", "12.7 Practice", capturing the
    # leading chapter number of each header as the split point.
    pattern = re.compile(r"\n(\d+)\.\d+\s*Practice")
    matches = list(pattern.finditer(text))
    sections = []
    for i, m in enumerate(matches):
        chapter = int(m.group(1))
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections.append({"chapter": chapter, "text": text[start:end].strip()})
    return sections


def main():
    reference = {
        "quizzes": build_quizzes(),
        "practice_exercises": build_practice_exercises(),
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(reference, f, ensure_ascii=False, indent=2)
    print(f"Quizzes: {len(reference['quizzes'])}")
    print(f"Practice exercise sections: {len(reference['practice_exercises'])}")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
