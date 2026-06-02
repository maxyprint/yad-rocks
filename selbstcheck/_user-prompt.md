# User Prompt Template — YAD.ROCKS Unternehmensberatung

<!--
VERWENDUNG
1. Alle 5 Datenmodule ausfüllen (daten/01–05)
2. Platzhalter {{...}} durch die Inhalte der jeweiligen Datei ersetzen
3. System-Prompt (_system-prompt.md) + diesen Prompt an Claude übergeben
4. Scoring-Gewichte werden direkt im Prompt definiert — kein separater Aufruf nötig
-->

---

## Prompt-Text (wird an Claude gesendet)

```
Analysiere folgende Daten und erstelle einen Wachstumsreport für den Inhaber von {{STUDIO_NAME}} in {{STADT}}.

---
WEBSITE-DATEN
{{WEBSITE_MD}}

---
GOOGLE BUSINESS DATEN
{{GOOGLE_MD}}

---
SOCIAL MEDIA DATEN
{{SOCIAL_MD}}

---
WERBEANZEIGEN-DATEN
{{ADS_MD}}

---
WETTBEWERBSDATEN
{{WETTBEWERBER_MD}}

---

SCORING-METHODE (verwende exakt diese Gewichtung):

Google Reviews vs. Top-5-Durchschnitt: 25%
  ≥ 90% des Ø → 90–100 | 70–89% → 70–89 | 50–69% → 50–69
  30–49% → 30–49 | 10–29% → 10–29 | < 10% oder keine → 0–9
  Sterne-Bonus: Ø ≥ 4,8★ → +5 Punkte

Map-Pack-Position für primären Suchbegriff: 25%
  #1 → 100 | #2 → 90 | #3 → 80 | #4–5 → 60–70
  #6–10 → 35–55 | nicht sichtbar → 5

Instagram-Sichtbarkeit: 20%
  Teilscore A (70%): Follower vs. Top-3-Ø
    ≥ 80% → 80–100 | 60–79% → 60–79 | 40–59% → 40–59
    20–39% → 20–39 | < 20% → 5–19 | kein Account → 0
  Teilscore B (30%): Posting-Frequenz (Ø Tage zwischen Posts)
    ≤ 2,3 Tage → 90–100 | ≤ 3,5 Tage → 70–89 | ≤ 7 Tage → 50–69
    > 7 Tage → 20–49 | kein Post seit > 30 Tagen → 0–19

Website-Qualität: 20%
  Online-Buchung vorhanden → +30 | Meta Pixel → +20
  Adresse + Öffnungszeiten → +20 | CTA-Button → +15
  PageSpeed Mobile ≥ 70 → +10 | Portfolio → +5

Meta Ads aktiv: 10%
  Aktiv seit > 30 Tagen → 80–100 | Aktiv seit < 30 Tagen → 50–79
  Nur Archiv → 20–40 | Keine Ads → 0

---

Erstelle den Report in folgender Struktur.
Halte dich exakt an diese Reihenfolge und Formatierung.

---

# {{STUDIO_NAME}} — Wachstumsanalyse {{STADT}}

---

## Executive Summary

<!-- REGEL: Max. 5 Sätze. Größter Engpass zuerst. Kein einleitender Satz.
     Pflicht: Mindestens eine konkrete Zahl. Kein Konjunktiv. -->

[5 Sätze — direkt mit dem größten Engpass beginnen]

---

## Marktposition

<!-- REGEL: Nur Zahlenvergleiche. Keine Wertung, nur sachliche Einordnung.
     Pflicht: Eigene Kennzahl vs. Wettbewerber-Wert — immer als Paar. -->

[Marktposition in Bezug auf Reviews, Sichtbarkeit, Social, Buchungssystem]

---

## Die 3 größten Wachstumshebel

<!-- REGEL: Sortiert nach Umsatzwirkung, nicht nach Einfachheit.
     Pro Hebel: Problem → Beleg mit Zahl → Auswirkung in Euro/Anfragen → Priorität.
     Pflicht: Jede "Auswirkung" muss in Anfragen oder Euro enden. -->

### Hebel 1: [Titel]

**Problem:** [Was die Daten zeigen — eine Aussage, kein Absatz]
**Beleg:** [Konkrete Zahl + direkter Wettbewerbsvergleich]
**Auswirkung:** [Anfragen oder Euro, die dadurch verloren gehen oder gewonnen werden können]
**Priorität:** Hoch

### Hebel 2: [Titel]

**Problem:** [Was die Daten zeigen]
**Beleg:** [Konkrete Zahl + Vergleich]
**Auswirkung:** [Anfragen oder Euro]
**Priorität:** Hoch / Mittel

### Hebel 3: [Titel]

**Problem:** [Was die Daten zeigen]
**Beleg:** [Konkrete Zahl + Vergleich]
**Auswirkung:** [Anfragen oder Euro]
**Priorität:** Mittel

---

## Was uns überrascht hat

<!-- REGEL: Genau ein Befund. Nicht offensichtlich. Zeigt Tiefe der Analyse.
     Kein Einleitungssatz wie "Bei unserer Analyse fiel auf...".
     Direkt mit dem Befund beginnen. -->

[Ein einziger, nicht offensichtlicher Befund — Inkonsistenz, versteckte Stärke oder übersehenes Risiko]

---

## Verlorene Chancen

<!-- REGEL: Nur Wettbewerbsvergleiche. Ausschließlich Zahlen aus den Daten.
     Keine Empfehlungen in diesem Abschnitt — nur Fakten. -->

[Wo haben Wettbewerber konkret messbare Vorteile — mit Zahlenvergleich]

---

## 90-Tage-Plan

<!-- REGEL: Maximal 3 Maßnahmen. Keine Liste von 10 Punkten.
     Pro Maßnahme: Was genau tun, warum jetzt, welchen Effekt bringt es.
     Pflicht: Jede Maßnahme mit konkretem Zeithorizont. -->

### Maßnahme 1: [Titel] — Woche [X–Y]
[Was genau, warum diese Priorität, erwartbarer Effekt]

### Maßnahme 2: [Titel] — Woche [X–Y]
[Was genau, warum diese Priorität, erwartbarer Effekt]

### Maßnahme 3: [Titel] — Woche [X–Y]
[Was genau, warum diese Priorität, erwartbarer Effekt]

---

## Detailanalyse

<!-- REGEL: Pro Modul: max. 3 kurze Absätze. Kein Techniker-Jargon.
     Jeder Befund endet mit einer Geschäftsauswirkung. -->

### Website
[Befunde — immer mit Geschäftsauswirkung]

### Google Business
[Befunde — immer mit Geschäftsauswirkung]

### Instagram
[Befunde — immer mit Geschäftsauswirkung]

### Meta Ads
[Befunde — immer mit Geschäftsauswirkung]

### Wettbewerber
[Vergleichstabelle aus den Daten + 1–2 Sätze Einordnung]

---

## Wachstumspotenzial

<!-- REGEL: Scores nach Scoring-Methode berechnen. Teilscores zeigen.
     Erreichbares Potenzial = realistisch bei Umsetzung der 3 Maßnahmen.
     Begründung: 2–3 Sätze, keine Aufzählung. -->

**Aktuelle Sichtbarkeit: [X]/100**

| Kriterium | Gewichtung | Score |
|---|---|---|
| Google Reviews | 25% | [X]/100 |
| Map-Pack-Sichtbarkeit | 25% | [X]/100 |
| Instagram | 20% | [X]/100 |
| Website | 20% | [X]/100 |
| Meta Ads | 10% | [X]/100 |

**Erreichbares Potenzial in 90 Tagen: [Y]/100**

[2–3 Sätze: Warum ist das Potenzial höher — welche Hebel treiben den Sprung]

---

## Wenn wir einen Bereich zuerst angehen würden

<!-- REGEL: Genau ein Absatz. Kein CTA. Kein "Kontaktieren Sie uns".
     Kein Konjunktiv. Keine Relativierung.
     Beratungston: sachlich, direkt, auf Basis der Daten. -->

[Ein Absatz — der eine Hebel mit der stärksten Anfragen-Wirkung, basierend auf den Daten]
```
