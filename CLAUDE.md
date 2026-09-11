# Arbeitsregeln habify-app

Dieses Repo ist der Code der habify30-App auf Zoho Catalyst — Functions unter `functions/`,
Oberfläche und Peer-Seiten unter `shell/`. Es hält **Records realer Teilnehmer** (E-Mail-Adressen,
Wiederherstellungscodes, Befragungsantworten, Kohortenzuordnungen) und versendet E-Mails an sie.
Die Governance steht in `kado/decision-logs/DL-2026-018`; diese Datei ist ihr Deployment und
wird bei jedem Lauf gelesen. Bei Widerspruch gilt der Log.

**Zwei Orte für das Warum:** Produkt-Entscheidungen (Datenmodell, Peer-Logik, Löschkonzept,
Zustimmungen, Bildschirme) leben im Repo `habify` unter `decisions/` (DL-001 ff.) — wer
Verhalten ändert, liest dort zuerst den Index. Die Beschreibung des Codes liegt hier:
[`README.md`](README.md) → [`functions/README.md`](functions/README.md) (Index aller Functions,
je eine README pro Function), [`docs/env-setup.md`](docs/env-setup.md),
[`TRANSACTIONAL_EMAILS.md`](TRANSACTIONAL_EMAILS.md).

## Vor Arbeitsbeginn

- `git fetch`, `git status -sb`: Ist `main` hinter `origin/main`? `git pull --ff-only`, **bevor**
  ein Branch entsteht. Ist `main` dem Server voraus, ist das ein Befund — melden.
- Offene `ai/*`- und `mn/*`-Branches (eigene, anderes Gerät, andere Session) melden. Läuft
  bereits eine Session an diesem Repo: eigener Worktree (`KONV-claude-code` §3).
- Befehle für `node`, `npm`, `catalyst` laufen in **PowerShell** — sie liegen nicht im
  Git-Bash-PATH (`docs/env-setup.md`).

## Branch, Commit, PR

- **Branch-Präfix `ai/`** für beaufsichtigte Arbeit, `build/` für unbeaufsichtigte (DL-2026-007,
  DL-2026-018 Regel 2). Die vorhandenen `mn/`-Branches sind History, kein Muster.
- **Merge-Commit**, kein Squash (`KONV-git-pr-nutzung` §5). Abschluss mit `--squash false`.
- Direkt-Push auf `main` ist gesperrt (DL-2026-018). Kein Reviewer — der PR-Weg dient der
  Rückverfolgbarkeit.
- Vor dem Öffnen `git log origin/main..HEAD`; die Beschreibung nennt jede Datei
  (`KONV-claude-code` §4).
- Commit-Messages deutsch, Betreff im Imperativ, Body erklärt das Warum, `Co-Authored-By`.

## Das Repo ist die Quelle

- Functions und Slate-App werden **aus dem Repo** deployt. Der Code-Editor der Konsole wird
  nicht zum Schreiben benutzt (DL-2026-018 Regel 1, `VTR-catalyst` 2.1).
- **Vor dem ersten CLI-Deploy einer Function:** Stand in der Konsole gegen das Repo abgleichen.
  Weicht die Konsole ab, wird der Unterschied ins Repo übernommen — nie überschrieben. Ergebnis
  in `functions/README.md` vermerken.
- `docs/` und die READMEs werden im selben PR nachgezogen wie der Code (DL-2026-016).

## Deploy

- **Jeder Zugriff nennt seine Umgebung** (`KONV-catalyst` §2). CLI: `--dc eu --org 20116360871`;
  Production ist Standard, Development braucht die ausdrückliche Angabe. MCP: `headers.Environment`
  auf jedem Aufruf.
- **Development ist klerikal:** `catalyst deploy --only functions --dc eu --org 20116360871`,
  Slate-App `peerpages` mit `catalyst deploy slate --dc eu --org 20116360871`.
- **Production ist Egress** — nur auf ausdrückliche Anweisung je Deploy. Functions erreichen
  Production über die Umgebungs-Übernahme in der Konsole (`KONV-catalyst` §3), die Slate-App
  über `--production`. „Merge" heißt nicht „Deploy"; ein Sammelauftrag umfasst keinen
  Production-Deploy (`KONV-claude-code` §9).
- **Mailtexte sind Egress** (DL-2026-018 Regel 4). Eine Änderung an Betreff oder Text einer
  Teilnehmer-Mail wird vor dem Deploy in `TRANSACTIONAL_EMAILS.md` gelesen und benannt.
- **Nach jedem Deploy die Gegenprobe** am ausliefernden Host (`KONV-catalyst` §4) — für
  Functions: die Route mit einem erfundenen `pid` aufrufen, Statuscode und Antwortform prüfen.

## Daten

- **Production-Records werden nie als Einzelzeile gelesen** (DL-2026-018 Regel 3). Kein
  `SELECT` auf `UserRecovery`, `FormSubmissions`, `PeerSignups`, `PeerGroups`, `AccessControl`
  in Production außer aggregiert; keine Zeile in einem Chat, einer Datei, einem PR. Fehlersuche
  in Development mit erfundenen Daten (`KONV-catalyst` §7, §9).
- **Probedaten** nur in Development, Präfix `zz_probe_`, am Ende einzeln benannt.
- **Keine Testzeilen in Production**, sobald echte Daten fließen (Regel 5). Die in
  `functions/README.md` genannten `PROD_TEST_…` werden vor der ersten realen Kohorte entfernt.
- **Partner-Sphäre vor Kohorte** (Regel 6): Bevor ein `pid` für eine Kohorte aus einer
  Partner-Organisation angelegt wird, existiert deren Partner-Log in `kado/decision-logs/`.
- **Keine Speicherung über das Produkt hinaus:** Jede neue Tabelle, jede neue Spalte mit
  Personenbezug, jedes erweiterte Logging ist eine Produkt-Entscheidung — `habify/decisions/`
  zuerst, dann Code.

## Geheimnisse

- `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_FROM`, `PEER_ORIGIN` leben nur als Function-Variablen in der
  Konsole. **Sie werden nie gelesen** — nicht über die Management-API, nicht über das MCP
  (`KONV-catalyst` §6). Ein sichtbar gewordener Schlüssel wird gewechselt.
- Kein Secret in einer Datei dieses Repos, keine `.env` mit Schlüsseln im Commit.

## Werkzeug

`KONV-claude-code` (`kado/konventionen/claude-code-konventionen.md`) gilt vollständig; hier
greifen vor allem §5 (Verweigerung ist Stopp), §6 (Prüfung getrennt vom Schritt), §7 (erledigt
heißt geprüft), §8 (Beleg schlägt Doku).

## Rückfluss

| Gegenstand | Ziel |
|---|---|
| Produkt-Entscheidung (Datenmodell, Peer-Logik, Screens, Löschung) | `habify/decisions/` |
| Werkzeugbefund zu Catalyst, Claude Code, Figma | `kado/konventionen/` bzw. `kado/dokumentation/referenz_…` |
| Datenklassen mit Kado-Reichweite, Partner-Sphären | `kado/decision-logs/` (Gate) |
| habify30-Design | eigene Governance (`VTR-figma`, Reichweite über das Werkzeug) |

## Bindende Regeln aus `kado`

Nicht hier wiederholt (`C:\repos\kado`, geräteabhängig):

- `vertraege/catalyst.md` — Datenklassen je Dienst, Egress, Exit
- `konventionen/catalyst-konventionen.md` — §2 Umgebung, §3 Deploy, §6 Einstellungen, §7 Probedaten, §9 Aggregat
- `konventionen/claude-code-konventionen.md` — Arbeitsregeln des Werkzeugs
- `konventionen/git-pr-nutzung.md` — §4 Commit-Identität, §5 Merge-Typ
- `vertraege/claude-ai.md` §3, §5 — Sphären, Egress, Ingress
- `decision-logs/DL-2026-018` — dieser Log, autoritativ für alles oben
