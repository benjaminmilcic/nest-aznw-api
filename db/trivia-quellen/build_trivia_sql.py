# -*- coding: utf-8 -*-
"""Erzeugt db/trivia_questions.sql aus den eigenen Fragen.

Quelldateien im selben Verzeichnis:
  own-1.json, own-2.json, own-3.json          Deutsch (Leitsprache)
  own-1-en.json, own-2-en.json, own-3-en.json Englisch
  own-1-hr.json, own-2-hr.json, own-3-hr.json Kroatisch

Die Leitsprache bestimmt die richtige Antwort, das Bild und die Reihenfolge.
Uebersetzungen listen ihre Antworten in derselben Reihenfolge wie das Deutsche;
der Ausgleich der Loesungsbuchstaben wird auf alle Sprachen identisch angewandt,
damit derselbe Buchstabe in jeder Sprache richtig ist.

Bilder: Ein Eintrag bekommt nur dann einen Bildpfad, wenn die zugehoerige
SVG-Datei in src/assets/quiz-illustrations/ tatsaechlich existiert.
"""
import io
import json
import os
import random
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
# db/trivia-quellen -> db/trivia_questions.sql
OUT = os.path.join(os.path.dirname(HERE), "trivia_questions.sql")
# Illustrationen liegen im Frontend-Repo, das neben diesem liegt.
ASSETS = os.path.normpath(
    os.path.join(
        os.path.dirname(HERE), "..", "..", "aznw-routes",
        "src", "assets", "quiz-illustrations",
    )
)
ASSET_URL_PREFIX = "assets/quiz-illustrations"

PARTS = ("own-1", "own-2", "own-3")
# Alles ausserhalb dieses Bereichs deutet auf einen Tippfehler hin, etwa ein
# kyrillisches Zeichen, das einem lateinischen zum Verwechseln aehnlich sieht.
ALLOWED_CHARS = re.compile(
    r"^[ -~"          # ASCII
    r" -ſ"            # Latin-1 und Latin Extended-A (Umlaute, caron, acute)
    r"‐-―‘’‚“-„… "  # Striche, Anfuehrungen, Auslassung
    r"°²³₂₃"  # Grad, hoch- und tiefgestellte Ziffern
    r"\n]*$"
)
LEAD = "de"
LANGS = ("de", "en", "hr")
VALID = {"A", "B", "C"}


def load(lang):
    """Laedt eine Sprache. Gibt None zurueck, wenn sie noch nicht existiert."""
    items = []
    for part in PARTS:
        name = f"{part}.json" if lang == LEAD else f"{part}-{lang}.json"
        path = os.path.join(HERE, name)
        if not os.path.isfile(path):
            return None
        with open(path, encoding="utf-8") as fh:
            items.extend(json.load(fh))
    return items


def odd_chars(item):
    """Zeichen, die in keiner der drei Sprachen vorkommen sollten."""
    found = set()
    texts = [item.get("q", ""), item.get("cat", ""), item.get("e", "")]
    texts.extend(item.get("a", []))
    for text in texts:
        if not ALLOWED_CHARS.match(text):
            for char in text:
                if not ALLOWED_CHARS.match(char):
                    found.add(char)
    return sorted(found)


def esc(value):
    """MySQL-Stringliteral."""
    if value is None:
        return "NULL"
    out = value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
    return "'" + out + "'"


def validate_lead(items):
    problems = []
    seen = set()
    for it in items:
        n = it["n"]
        if n in seen:
            problems.append(f"Frage {n}: Nummer doppelt")
        seen.add(n)
        if len(it["a"]) != 3:
            problems.append(f"Frage {n}: {len(it['a'])} Antworten statt 3")
        if it["correct"] not in VALID:
            problems.append(f"Frage {n}: correct='{it['correct']}' ungueltig")
        if len(set(it["a"])) != 3:
            problems.append(f"Frage {n}: doppelte Antworttexte")
        if "\n\n" not in it["e"]:
            problems.append(f"Frage {n}: Erlaeuterung hat nur einen Absatz")
        for field in ("q", "cat", "e"):
            if not it[field].strip():
                problems.append(f"Frage {n}: Feld {field} leer")
        odd = odd_chars(it)
        if odd:
            problems.append(f"Frage {n}: fremde Zeichen {odd}")
    missing = sorted(set(range(1, max(seen) + 1)) - seen)
    if missing:
        problems.append(f"Fehlende Nummern: {missing}")
    return problems


def validate_translation(lang, lead, items):
    """Uebersetzung muss dieselben Nummern in derselben Reihenfolge haben."""
    problems = []
    if len(items) != len(lead):
        problems.append(f"{lang}: {len(items)} Fragen statt {len(lead)}")
        return problems
    for lead_item, item in zip(lead, items):
        n = lead_item["n"]
        if item["n"] != n:
            problems.append(f"{lang}: Reihenfolge weicht ab bei {n} (steht {item['n']})")
            continue
        if len(item["a"]) != 3:
            problems.append(f"{lang} Frage {n}: {len(item['a'])} Antworten statt 3")
        if len(set(item["a"])) != 3:
            problems.append(f"{lang} Frage {n}: doppelte Antworttexte")
        if "\n\n" not in item["e"]:
            problems.append(f"{lang} Frage {n}: Erlaeuterung hat nur einen Absatz")
        for field in ("q", "cat", "e"):
            if not item.get(field, "").strip():
                problems.append(f"{lang} Frage {n}: Feld {field} leer")
        # Sicherheitsnetz: Wo eine Frage nicht woertlich uebersetzt, sondern
        # lokalisiert wurde (Redewendungen), kann die richtige Antwort leicht
        # an einer anderen Position landen. Dann waere sie in dieser Sprache
        # falsch. Wer "correct" mitgibt, laesst das hier pruefen.
        odd = odd_chars(item)
        if odd:
            problems.append(f"{lang} Frage {n}: fremde Zeichen {odd}")
        if "correct" not in item:
            problems.append(f"{lang} Frage {n}: Feld correct fehlt")
        elif item["correct"] != lead_item["correct"]:
            problems.append(
                f"{lang} Frage {n}: richtige Antwort steht auf "
                f"{item['correct']}, im Deutschen auf {lead_item['correct']}"
            )
    return problems


def permutations(count):
    """Zielbuchstaben je Frage, gleichmaessig auf A/B/C verteilt.

    Fester Seed, damit dieselbe Eingabe immer dieselbe Verteilung ergibt und
    Fragennummern zwischen Laeufen stabil bleiben.
    """
    rng = random.Random(20260809)
    letters = ["A", "B", "C"]
    targets = [letters[i % 3] for i in range(count)]
    rng.shuffle(targets)
    return targets


def apply_permutation(items, lead, targets):
    """Tauscht die richtige Antwort auf die Zielposition - in jeder Sprache gleich."""
    letters = ["A", "B", "C"]
    for item, lead_item, target in zip(items, lead, targets):
        current = letters.index(lead_item["correct"])
        wanted = letters.index(target)
        answers = list(item["a"])
        answers[current], answers[wanted] = answers[wanted], answers[current]
        item["a"] = answers
        item["correct"] = target


def image_path(slug):
    if not slug:
        return None
    if not os.path.isfile(os.path.join(ASSETS, slug + ".svg")):
        return None
    return f"{ASSET_URL_PREFIX}/{slug}.svg"


def main():
    lead = load(LEAD)
    if lead is None:
        print("FEHLER: Die deutschen Quelldateien fehlen.")
        return 1

    problems = validate_lead(lead)
    languages = {LEAD: lead}
    for lang in LANGS:
        if lang == LEAD:
            continue
        items = load(lang)
        if items is None:
            print(f"Hinweis: {lang} noch nicht vorhanden, wird uebersprungen.")
            continue
        problems.extend(validate_translation(lang, lead, items))
        languages[lang] = items

    if problems:
        print("FEHLER:")
        for p in problems:
            print("  -", p)
        return 1

    targets = permutations(len(lead))
    for items in languages.values():
        apply_permutation(items, lead, targets)

    rows = []
    with_image = 0
    for lang in LANGS:
        if lang not in languages:
            continue
        for item, lead_item in zip(languages[lang], lead):
            img = image_path(lead_item.get("img"))
            if img and lang == LEAD:
                with_image += 1
            a, b, c = item["a"]
            rows.append(
                "({n},{lang},{q},{a},{b},{c},{corr},{e},{img},{cat})".format(
                    n=lead_item["n"],
                    lang=esc(lang),
                    q=esc(item["q"]),
                    a=esc(a),
                    b=esc(b),
                    c=esc(c),
                    corr=esc(item["correct"]),
                    e=esc(item["e"]),
                    img=esc(img),
                    cat=esc(item["cat"]),
                )
            )

    sql = []
    sql.append('-- Eigene Quizfragen fuer das Spiel "Schon gewusst?"')
    sql.append("-- Erzeugt aus scratchpad/own-*.json. Idempotent: DROP + CREATE + INSERT.")
    sql.append("SET NAMES utf8mb4;")
    sql.append("")
    sql.append("DROP TABLE IF EXISTS `trivia_questions`;")
    sql.append("CREATE TABLE `trivia_questions` (")
    sql.append("  `id` int NOT NULL AUTO_INCREMENT,")
    sql.append("  `questionNumber` int NOT NULL,")
    sql.append("  `language` enum('de','en','hr') NOT NULL,")
    sql.append("  `question` text NOT NULL,")
    sql.append("  `answerA` text NOT NULL,")
    sql.append("  `answerB` text NOT NULL,")
    sql.append("  `answerC` text NOT NULL,")
    sql.append("  `correctAnswer` enum('A','B','C') NOT NULL,")
    sql.append("  `explanation` mediumtext NOT NULL,")
    sql.append("  `image` varchar(255) DEFAULT NULL,")
    sql.append("  `category` varchar(64) NOT NULL,")
    sql.append("  PRIMARY KEY (`id`),")
    sql.append("  UNIQUE KEY `uq_trivia_number_language` (`questionNumber`,`language`),")
    sql.append("  KEY `idx_trivia_language` (`language`)")
    sql.append(") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;")
    sql.append("")
    sql.append(
        "INSERT INTO `trivia_questions` (`questionNumber`,`language`,`question`,"
        "`answerA`,`answerB`,`answerC`,`correctAnswer`,`explanation`,`image`,"
        "`category`) VALUES"
    )
    sql.append(",\n".join(rows) + ";")
    sql.append("")

    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(sql))

    letters = {}
    for it in lead:
        letters[it["correct"]] = letters.get(it["correct"], 0) + 1

    print(f"OK: {len(rows)} Zeilen -> {OUT}")
    print("  Sprachen:", ", ".join(k for k in LANGS if k in languages))
    print("  Fragen je Sprache:", len(lead))
    print("  Loesungsverteilung:", dict(sorted(letters.items())))
    print("  Mit Illustration:", with_image)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
