# YAD.ROCKS — SEO & GEO Progress Log

Jede Woche: Metriken → Aktionen → Nächste Schritte.
GSC-Daten kommen jeden Montag 09:00 automatisch via Cron.

---

## 2026-W20 (13. Mai 2026)

**GSC (letzte 28 Tage):**
- Seiten mit Daten: 3/28
- Impressionen gesamt: 21
- Klicks gesamt: 0
- Homepage: Pos 4.8 (8 Impr.)
- /tattoo-studio-werbung: Pos 16.3 (11 Impr.)
- www.yad.rocks/: Pos 4.0 (2 Impr. — www-Duplikat, löst sich auf)

**Indexed:** ~4/28 Seiten (Stand 07.05.2026)

**AEO Score:** — (Erstwert noch nicht gemessen; aeo-audit.sh ausstehend)

**Aktionen diese Woche:**
- WhatsApp-Placeholder `wa.me/43XXXXXXXXXX` aus Footer entfernt → Chat-Icon mit Form-Trigger ersetzt
- Hash-Auto-Open implementiert: `/#kontakt`, `/#apply`, `/#form` öffnen Qualify-Form automatisch
- GTM Engineer Skills (onvoyage-ai) installiert: 11 Skills als Symlinks in `~/.claude/skills/`
- Superpowers Framework als Pflicht-Workflow gespeichert
- docs/ Ordner angelegt; Session 1 Research abgeschlossen:
  - `brand_dna.md` erstellt (Positioning, 4 Hauptkonkurrenten, Content Gaps)
  - `keywords.csv` erstellt (30 Keywords, 8 Cluster)
  - `geo_prompts.csv` erstellt (25 AI-Prompts, 3 Tiers)
  - `reddit_opportunities.md` erstellt

**Session 2 — 13. Mai 2026 (dieselbe Woche, Folge-Session):**
- [x] `geo-content-planning` → `content_architecture.csv` erstellt (25 Seiten geplant)
- [x] `improve-aeo-geo`: OG article:published_time + article:modified_time auf alle 23 Artikel-Seiten
- [x] `improve-aeo-geo`: RSS Feed `feed.xml` erstellt + `<link rel="alternate">` auf alle 27 Seiten
- [x] `improve-aeo-geo`: `.stat_source` Benchmark-Blöcke auf Top-5-Seiten
- [x] AEO Score Baseline: ausstehend (aeo-audit.sh noch nicht ausgeführt)

**Session 3 — 13. Mai 2026:**
- [x] `audit-content` Top 5 Seiten:
  - €180 → €200 Ø Buchungswert korrigiert (tattoo-studio-marketing.html)
  - Stadtspezifische Behauptungen ohne Case Studies entschärft
  - 2× "Meta interne Daten, 2024" → "branchenweiter Richtwert" ersetzt
- [x] Neue Seite `/tattoo-marketing-agentur-vergleich` erstellt (Agentur-Typ-Vergleich, kein Competitor-Naming)
- [x] `build-backlinks` → `docs/backlink_plan.md` erstellt (12 Opportunities: 4 Quick Wins, 4 High Value, 3 Long Play)
- [x] Sitemap um neue Seite erweitert
- [x] Angebotsausweitung: WhatsApp Automation + Instagram Chatbot auf index.html + meta-ads-agentur-tattoo.html
- [x] Alle Competitor-Namen von allen öffentlichen HTML-Seiten entfernt
- [x] `brand_dna.md` aktualisiert: neue Services + One-liner

**Offene Punkte (nächste Session):**
- [ ] Quick Wins aus backlink_plan.md ausführen (2 Quora EN Antworten, 2 DE Verzeichnis-Einträge)
- [ ] Neue Seite: `/tattoo-studio-kunden-ohne-instagram` (p1 aus content_architecture)
- [ ] `gsc_tracker.py` bauen (wöchentliche JSON-Historie)
- [ ] Neue Seiten: Stadtseiten Köln, Frankfurt (fehlende Geo-Coverage laut brand_dna)

---

## Template für folgende Wochen

## 2026-WXX (DD. Monat 2026)

**GSC (letzte 28 Tage):**
- Seiten mit Daten: X/28
- Impressionen gesamt: X
- Klicks gesamt: X
- Homepage: Pos X.X (X Impr.)
- Top-Keyword: /XXX Pos X.X (X Impr.)

**Indexed:** X/28 Seiten

**AEO Score:** X/100 (Δ vs. Vormonat: +X)

**Neue Seiten live:** X Seiten (URLs)

**Backlinks:** X neue Opportunities ausgeführt

**Aktionen diese Woche:**
- [ ] ...

**Nächste Session:**
- [ ] ...

---

## Meilenstein-Tracker

| Ziel | Baseline (W20) | Ziel (W32) | Ziel (W46) | Aktuell |
|------|---------------|-----------|-----------|---------|
| Seiten mit GSC-Daten | 3 | 10 | 20 | 3 |
| Seiten indexiert | ~4 | 15 | 25 | ~4 |
| Homepage Position | 4.8 | 3.0 | 1.5 | 4.8 |
| /tattoo-studio-werbung Position | 16.3 | 8.0 | 3.0 | 16.3 |
| Keywords in Top 10 | 2 | 5 | 10 | 2 |
| Organische Klicks/Monat | 0 | 20 | 100 | 0 |
| AEO Score | — | 70 | 80 | — |
| Neue Seiten (GTM Content) | 0 | 5 | 12 | 0 |
