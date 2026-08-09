# -*- coding: utf-8 -*-
"""Erzeugt die vorgelesenen Erlaeuterungen fuer das Spiel "Schon gewusst?".

Quelldateien sind dieselben wie fuer build_trivia_sql.py. Je Frage und Sprache
entsteht eine MP3-Datei im Frontend-Repo:

  aznw-routes/src/assets/trivia-audio/<lang>/<n>.mp3

Gesprochen wird ausschliesslich das Feld "e" (die Erlaeuterung zur richtigen
Antwort). Absaetze werden als Sprechpause umgesetzt.

Der Lauf ist idempotent: Vorhandene Dateien werden uebersprungen, solange sich
weder Text noch Stimme geaendert haben. Dazu merkt sich manifest.json je Datei
eine Pruefsumme. Wer eine Erlaeuterung nachtraeglich umschreibt, bekommt beim
naechsten Lauf genau diese eine Datei neu.

Zugang: AZURE_SPEECH_KEY und AZURE_SPEECH_REGION in nest-aznw-api/.env.
Der Free-Tier F0 erlaubt 20 Anfragen pro 60 Sekunden, deshalb die Drosselung.
Ein vollstaendiger Lauf ueber alle drei Sprachen dauert rund eine Viertelstunde.

Aufrufe:
  python build_trivia_audio.py --probe        eine Datei je Sprache, zum Anhoeren
  python build_trivia_audio.py                alles Fehlende
  python build_trivia_audio.py --lang de      nur eine Sprache
  python build_trivia_audio.py --force        auch Vorhandenes neu erzeugen
"""
import argparse
import hashlib
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.normpath(os.path.join(os.path.dirname(HERE), "..", ".env"))
OUT_ROOT = os.path.normpath(
    os.path.join(
        os.path.dirname(HERE), "..", "..", "aznw-routes",
        "src", "assets", "trivia-audio",
    )
)
MANIFEST = os.path.join(OUT_ROOT, "manifest.json")

PARTS = ("own-1", "own-2", "own-3")
LEAD = "de"
LANGS = ("de", "en", "hr")

# Stimme je Sprache. Kroatisch hat bei Azure genau diese beiden zur Auswahl,
# die Alternative waere hr-HR-SreckoNeural (maennlich).
VOICES = {
    "de": ("de-DE", "de-DE-KatjaNeural"),
    "en": ("en-US", "en-US-JennyNeural"),
    "hr": ("hr-HR", "hr-HR-GabrijelaNeural"),
}
# Etwas langsamer als die Vorgabe, die Texte sind erklaerend und keine Ansage.
RATE = "-4%"
# Pause zwischen zwei Absaetzen.
PARAGRAPH_BREAK = "650ms"
# 24 kHz/48 kbit mono: hoerbar besser als 16 kHz, ergibt fuer alle 270 Dateien
# zusammen gut 50 MB. Fuer die halbe Groesse: audio-16khz-32kbitrate-mono-mp3.
AUDIO_FORMAT = "audio-24khz-48kbitrate-mono-mp3"

# F0 laesst 20 Anfragen je 60 Sekunden zu. Etwas Luft, damit ein Wiederholer
# nicht sofort ins naechste Limit laeuft.
MIN_INTERVAL = 3.2
MAX_ATTEMPTS = 5


def read_env():
    """Liest KEY und REGION aus der .env der API."""
    if not os.path.isfile(ENV_FILE):
        return None, None
    key = region = None
    with open(ENV_FILE, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line.startswith("AZURE_SPEECH_KEY="):
                key = line.split("=", 1)[1].strip().strip("\"'")
            elif line.startswith("AZURE_SPEECH_REGION="):
                region = line.split("=", 1)[1].strip().strip("\"'")
    return key, region


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


def xml_escape(text):
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def build_ssml(text, lang):
    """Absaetze werden zu Sprechpausen, sonst bleibt der Text unveraendert."""
    locale, voice = VOICES[lang]
    parts = [p.strip() for p in text.split("\n\n") if p.strip()]
    body = f'<break time="{PARAGRAPH_BREAK}"/>'.join(xml_escape(p) for p in parts)
    return (
        f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xml:lang="{locale}">'
        f'<voice name="{voice}">'
        f'<prosody rate="{RATE}">{body}</prosody>'
        f"</voice></speak>"
    )


def fingerprint(text, lang):
    """Aendert sich, sobald Text, Stimme oder Sprechtempo anders sind."""
    _, voice = VOICES[lang]
    raw = f"{voice}|{RATE}|{PARAGRAPH_BREAK}|{AUDIO_FORMAT}|{text}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def synthesize(ssml, key, region):
    """Ein Aufruf der Echtzeit-API. Gibt die MP3-Bytes zurueck."""
    url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    request = urllib.request.Request(
        url,
        data=ssml.encode("utf-8"),
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": AUDIO_FORMAT,
            "User-Agent": "aznw-trivia-audio",
        },
        method="POST",
    )
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as err:
            if err.code == 429 or err.code >= 500:
                if attempt == MAX_ATTEMPTS:
                    raise
                wait = int(err.headers.get("Retry-After") or 0) or 5 * attempt
                print(f"    HTTP {err.code}, warte {wait}s und versuche erneut")
                time.sleep(wait)
                continue
            # 401 falscher Key, 400 fehlerhaftes SSML - Wiederholen hilft nicht.
            detail = err.read().decode("utf-8", "replace")[:200]
            raise RuntimeError(f"HTTP {err.code}: {detail}") from err
    raise RuntimeError("unerreichbar")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lang", choices=LANGS, help="nur diese Sprache")
    parser.add_argument("--probe", action="store_true",
                        help="nur die erste Frage je Sprache, zum Probehoeren")
    parser.add_argument("--force", action="store_true",
                        help="auch unveraenderte Dateien neu erzeugen")
    args = parser.parse_args()

    key, region = read_env()
    if not key or not region:
        print(f"FEHLER: AZURE_SPEECH_KEY oder AZURE_SPEECH_REGION fehlt in {ENV_FILE}")
        return 1

    manifest = {}
    if os.path.isfile(MANIFEST):
        with open(MANIFEST, encoding="utf-8") as fh:
            manifest = json.load(fh)

    langs = (args.lang,) if args.lang else LANGS
    jobs = []
    for lang in langs:
        items = load(lang)
        if items is None:
            print(f"Hinweis: {lang} noch nicht vorhanden, wird uebersprungen.")
            continue
        if args.probe:
            items = items[:1]
        for item in items:
            text = item.get("e", "").strip()
            if not text:
                print(f"Hinweis: {lang} Frage {item['n']} hat keine Erlaeuterung.")
                continue
            rel = f"{lang}/{item['n']}.mp3"
            target = os.path.join(OUT_ROOT, lang, f"{item['n']}.mp3")
            stamp = fingerprint(text, lang)
            if not args.force and manifest.get(rel) == stamp and os.path.isfile(target):
                continue
            jobs.append((rel, target, text, lang, stamp))

    if not jobs:
        print("Nichts zu tun, alle Dateien sind aktuell.")
        return 0

    chars = sum(len(j[2]) for j in jobs)
    minutes = int(len(jobs) * MIN_INTERVAL / 60)
    print(f"{len(jobs)} Dateien, {chars} Zeichen, geschaetzte Dauer ~{minutes} Minuten.")
    print(f"Ziel: {OUT_ROOT}\n")

    done = 0
    try:
        for index, (rel, target, text, lang, stamp) in enumerate(jobs, 1):
            if index > 1:
                time.sleep(MIN_INTERVAL)
            print(f"  [{index}/{len(jobs)}] {rel} ({len(text)} Zeichen)")
            audio = synthesize(build_ssml(text, lang), key, region)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, "wb") as fh:
                fh.write(audio)
            manifest[rel] = stamp
            done += 1
    except (RuntimeError, urllib.error.URLError, KeyboardInterrupt) as err:
        # Abbruch ist unkritisch: Das Manifest wird geschrieben, der naechste
        # Lauf setzt an derselben Stelle fort.
        print(f"\nABBRUCH nach {done} Dateien: {err}")
        write_manifest(manifest)
        return 1

    write_manifest(manifest)
    total = sum(
        os.path.getsize(os.path.join(OUT_ROOT, rel.replace("/", os.sep)))
        for rel in manifest
        if os.path.isfile(os.path.join(OUT_ROOT, rel.replace("/", os.sep)))
    )
    print(f"\nOK: {done} Dateien erzeugt, {chars} Zeichen verbraucht.")
    print(f"  Bestand gesamt: {len(manifest)} Dateien, {total / 1024 / 1024:.1f} MB")
    return 0


def write_manifest(manifest):
    os.makedirs(OUT_ROOT, exist_ok=True)
    with open(MANIFEST, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(dict(sorted(manifest.items())), fh, indent=2)
        fh.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())
