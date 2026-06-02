# Scoring-Methodik — YAD.ROCKS Selbstcheck

Alle Scores werden von Claude auf Basis der bereitgestellten Daten berechnet.
Keine Interpolation, keine Schätzungen außerhalb der definierten Schwellenwerte.

---

## Gesamtscore-Formel

```
Gesamtscore = (Google_Reviews_Score × 0.25)
            + (Map_Pack_Score × 0.25)
            + (Social_Score × 0.20)
            + (Website_Score × 0.20)
            + (Ads_Score × 0.10)
```

Alle Teilscores: 0–100. Gesamtscore: 0–100.

---

## Kriterium 1 — Google Reviews (Gewichtung: 25%)

Vergleich: eigene Bewertungsanzahl vs. Durchschnitt der Top-5-Wettbewerber im selben Markt.

| Verhältnis eigene Reviews / Top-5-Ø | Punkte |
|---|---|
| ≥ 90 % | 90–100 |
| 70–89 % | 70–89 |
| 50–69 % | 50–69 |
| 30–49 % | 30–49 |
| 10–29 % | 10–29 |
| < 10 % oder keine Reviews | 0–9 |

Wenn kein Top-5-Durchschnitt vorhanden: absolute Skala.
- > 200 Reviews → 90+
- 100–199 → 70–89
- 50–99 → 50–69
- 20–49 → 30–49
- 5–19 → 10–29
- 0–4 → 0–9

Sterne-Bonus: Ø ≥ 4,8★ → +5 Punkte (max. 100).

---

## Kriterium 2 — Map-Pack-Sichtbarkeit (Gewichtung: 25%)

Position im lokalen Google-Suchergebnis (Map Pack) für den primären Suchbegriff.

| Position | Punkte |
|---|---|
| #1 | 100 |
| #2 | 90 |
| #3 | 80 |
| #4–5 | 60–70 |
| #6–10 | 35–55 |
| Seite 2 oder schlechter | 15 |
| Nicht auffindbar | 5 |

Wenn mehrere Suchbegriffe: Durchschnitt der Positionen.

---

## Kriterium 3 — Social Media / Instagram (Gewichtung: 20%)

### Teilscore A — Follower vs. lokaler Top-3-Durchschnitt (70 % des Social Score)

| Verhältnis | Punkte |
|---|---|
| ≥ 80 % | 80–100 |
| 60–79 % | 60–79 |
| 40–59 % | 40–59 |
| 20–39 % | 20–39 |
| < 20 % | 5–19 |
| Kein Account | 0 |

### Teilscore B — Posting-Frequenz (30 % des Social Score)

Berechnung auf Basis der letzten 6 Posts: Ø Tage zwischen Posts.

| Frequenz | Punkte |
|---|---|
| ≥ 3× pro Woche (Ø ≤ 2,3 Tage) | 90–100 |
| 2× pro Woche (Ø ≤ 3,5 Tage) | 70–89 |
| 1× pro Woche (Ø ≤ 7 Tage) | 50–69 |
| < 1× pro Woche | 20–49 |
| Kein Post seit > 30 Tagen | 0–19 |

Social Score = (Follower-Score × 0,70) + (Frequenz-Score × 0,30)

---

## Kriterium 4 — Website (Gewichtung: 20%)

Additive Punktevergabe — Ausgangswert: 0.

| Merkmal vorhanden | Punkte |
|---|---|
| Online-Buchungssystem | +30 |
| Meta Pixel installiert | +20 |
| Adresse auf Website | +10 |
| Öffnungszeiten auf Website | +10 |
| Direkter CTA-Button ("Termin buchen", "Anfragen" etc.) | +15 |
| PageSpeed Mobile ≥ 70 | +10 |
| PageSpeed Mobile ≥ 85 | +5 Bonus |
| Portfolio / Arbeitsbeispiele | +5 |

Max: 100. Kein Abzug — nur Aufbau.

---

## Kriterium 5 — Meta Ads (Gewichtung: 10%)

| Status | Punkte |
|---|---|
| Aktive Ads, laufen seit > 30 Tagen | 80–100 |
| Aktive Ads, laufen seit < 30 Tagen | 50–79 |
| Keine aktiven Ads, aber archivierte Ads vorhanden | 20–40 |
| Keine Ads, kein Archiv | 0 |

---

## Erreichbares Potenzial (90-Tage-Schätzung)

Berechne den realistischen Score, wenn die 3 priorisierten Maßnahmen umgesetzt werden.

Grundregel: Nur Kriterien einbeziehen, die mit den empfohlenen Maßnahmen direkt adressiert werden. Keine unrealistischen Sprünge (z.B. von 0 auf 90 bei Reviews in 90 Tagen).

Typische 90-Tage-Verbesserungen:
- Google Reviews: +20–40 Reviews bei aktiver Strategie → Score +15–25 Punkte
- Website (Buchung + Pixel + Adresse): vollständig umsetzbar → Score +45–60 Punkte
- Social Frequenz: von < 1× auf 3× pro Woche → Score +30–40 Punkte
- Map-Pack: indirekt durch Review-Aufbau → ggf. +1–2 Positionen

---

## Ausgabe im Report

Im Report erscheinen:
1. Gesamtscore (z.B. 22/100)
2. Teilscores tabellarisch
3. Erreichbares Potenzial (z.B. 61/100) mit 2-Satz-Begründung

Keine Formel im Report erklären. Nur die Zahlen zeigen.
