# Setup-Manual — habify30 Dev-Environment (Zweitgerät)

> Vormals `DOK-habify30-env-setup` in `kado/dokumentation/`; seit DL-2026-016 lebt die
> Dokumentation eines Code-Repos im Code-Repo.

Schritt-für-Schritt-Anleitung, um die **Entwicklungsumgebung des Projekts habify30** auf einem
Windows-Rechner aufzusetzen, damit eine Claude-Code-Session am Repo weiterarbeiten und gegen
**Catalyst Development** deployen/testen kann. Bewusst schlank — Handgriffe, Befehle,
Prüfschritte.

Abgrenzung: Dies ist die **Umgebung eines konkreten Produktprojekts**, nicht die Kado-System-Basis
(dafür `kado/dokumentation/anleitung_setup.md`). Das **Warum** hinter den habify-Architektur­entscheidungen
lebt im habify-Repo (`decisions/`), nicht hier.

**Konventionen in diesem Dokument:**
- Befehle laufen in **PowerShell**, nicht Git Bash — `node`/`npm`/`catalyst` liegen nur im
  **Windows-PATH**, nicht im Git-Bash-PATH.
- ⚠ = kritischer Schritt, hier entstehen typische Fehler.
- ✅ = Verifikationsschritt mit erwarteter Ausgabe. Stimmt sie nicht, nicht weitermachen.
- Basispfad ist `C:\repos` — Doku/Memory nehmen das an, bitte so belassen.

---

## Teil 1 — Voraussetzungen installieren

1. **Git** vorhanden? Sonst `winget install Git.Git`. Azure-DevOps-Zugang zum Konto **kado-org**
   nötig.
2. **Node 24 LTS:** `winget install OpenJS.NodeJS.LTS`. Danach ein **neues** Terminal öffnen
   (PATH neu einlesen).
3. ⚠ **PowerShell-Skripte erlauben** — nötig, damit die npm-/catalyst-`.ps1`-Shims überhaupt
   laufen. Ohne diesen Schritt scheitert jedes `npm …` mit
   „npm.ps1 kann nicht geladen werden … Ausführung von Skripts ist deaktiviert":
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```
4. **Catalyst CLI (global):** `npm i -g zcatalyst-cli`.

✅ In einem **neuen** PowerShell-Fenster:
```powershell
node -v            # erwartet: v24.x
npm -v             # erwartet: eine Versionsnummer (kein .ps1-Fehler)
catalyst --version # erwartet: eine Versionsnummer
```

---

## Teil 2 — Repos holen

```powershell
mkdir C:\repos ; cd C:\repos
git clone https://dev.azure.com/kado-org/kado/_git/habify
git clone https://dev.azure.com/kado-org/kado/_git/habify-app
```

- **`habify`** — Wissens-/Kanon-Repo des Projekts (README, CLAUDE.md, `00_Index.md`,
  `decisions/`, `skills/`).
- **`habify-app`** — Code-Repo: Frontend-`shell/` (React+Vite+TS), Catalyst-`functions/`,
  Catalyst-Konfiguration.

### ⚠ 2.1 Bestehende Clones zuerst syncen
Wer die Repos **schon** geklont hat, muss vor der Arbeit den Server-Stand ziehen — ein alter
Clone zeigt eine **veraltete Struktur**. Konkret erscheinen `habify-app/shell/`, `functions/`,
`catalyst.json` und `.catalystrc` erst nach dem Pull; ein Clone von vor diesen Commits enthält
nur eine Funktions-Rohablage und keinen Frontend-Ordner.
```powershell
cd C:\repos\habify     ; git pull --ff-only origin main
cd C:\repos\habify-app ; git pull --ff-only origin main
```
✅ Danach existiert `C:\repos\habify-app\shell\` und `C:\repos\habify-app\catalyst.json`. Fehlt
das, ist der Sync nicht durchgelaufen — nicht weitermachen.

---

## Teil 3 — Abhängigkeiten (Bundling)

### 3.1 Frontend
```powershell
cd C:\repos\habify-app\shell ; npm install
```
✅ Kurzer Toolchain-Nachweis (erzeugt `dist/`, ist gitignored):
```powershell
npm run build      # erwartet: "tsc -b && vite build" laeuft durch, nur Chunk-Size-Warnung
```

### 3.2 Catalyst-Functions (nur falls deployt wird)
Jede Funktion trägt ein eigenes `package.json` + Lockfile; die Deps (`express`,
`zcatalyst-sdk-node`) werden fürs Bundling gebraucht:
```powershell
cd C:\repos\habify-app\functions\accesscontrol   ; npm ci
cd C:\repos\habify-app\functions\recovery        ; npm ci
cd C:\repos\habify-app\functions\zohoformswebhook; npm ci
```
Hinweis: npm warnt, dass `zcatalyst-sdk-node@2.2.1` veraltet ist — die Version ist im Repo
bewusst gepinnt, nicht eigenmächtig anheben.

---

## Teil 4 — Catalyst CLI verbinden (interaktiv)

```powershell
cd C:\repos\habify-app ; catalyst login --dc eu     # Browser-OAuth, EU
```
- `catalyst.json` und `.catalystrc` sind **schon im Repo** (Projekt bereits verknüpft: **Habify30**,
  Projekt-ID `22671000000014048`, aktive Env **Development**) → **kein** `catalyst init` nötig.
- ⚠ **Deploy nur auf Development** (Prod bewusst außen vor). `.catalystrc` führt die aktive Env
  bereits auf Development; der Deploy zielt damit standardmäßig dorthin.
  ```powershell
  catalyst deploy --only functions:<name> --dc eu   # z. B. functions:accesscontrol
  ```
- ⚠ Vor jedem Function-Deploy prüfen, ob die Repo-`index.js` gegenüber dem im Catalyst-Editor
  laufenden Dev-Stand vor- oder zurückliegt (der Editor ist die Ausführungs-Source-of-Truth) —
  siehe `functions/README.md`, damit ein Deploy nichts ungewollt überschreibt.

---

## Teil 5 — Claude-Code-Connectors autorisieren (interaktiv)

Auf dem Gerät müssen in Claude Code **Figma-MCP** und **Catalyst-MCP** verbunden/autorisiert sein
(Connector-Einstellungen bzw. `/mcp` in einer interaktiven Session). Ohne sie: kein
Figma-Design-Zugriff / keine Catalyst-Infra-Tools.

✅ Figma-Check: `whoami` des Figma-MCP muss den eigenen Account (Pro) zurückgeben; ein
`get_metadata` auf die Datei „habify30 Screens" (`3U4mfBmslvlnTlhvE5BvvW`) muss die Screen-Struktur
liefern.

---

## Teil 6 — Starten & prüfen

```powershell
cd C:\repos\habify-app\shell ; npm run dev
```
Vite-Proxy `/api`→Dev vermeidet CORS.

⚠ **`127.0.0.1` funktioniert nicht — `localhost` schon.** Vite 8 lauscht nur auf **IPv6 (`::1`)**;
`http://127.0.0.1:5173` läuft ins Leere. Test:
```
http://localhost:5173/?pid=TEST_ACTIVE_001
```
(Wer zwingend IPv4 braucht: `npm run dev -- --host 127.0.0.1`.)

✅ Erwartet: HTTP 200, ausgelieferte Shell mit `<title>habify30</title>` und `<div id="root">`.

---

## Gotchas

- ⚠ **Agent-Shell kann sandboxed sein** — sie teilt `C:\repos`, aber **nicht** das
  Windows-Profil/`AppData`. Globale npm-Installs und `catalyst login` landen dann in der Sandbox,
  nicht auf dem Host → **CLI-Login/-Deploy und globale Installs im Host-Terminal ausführen**,
  nicht über die Agent-Shell. Lokale Projekt-Installs (`npm install`/`npm ci` in `shell/` bzw.
  `functions/*`) schreiben nach `C:\repos` und sind für den Host sichtbar.
- ⚠ **`npm` blockiert trotz Installation** — meldet PowerShell einen `.ps1`-Ausführungsfehler,
  fehlt Teil 1.3 (`Set-ExecutionPolicy … RemoteSigned`). Notweg ohne Policy-Änderung: npm über
  Node direkt aufrufen, z. B.
  `& "C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install`
  (`.cmd`-Shim und dieser Node-Aufruf sind von der `.ps1`-Restriktion nicht betroffen).
- `node`/`npm` liegen nur im **Windows-PATH**, nicht in Git Bash → **PowerShell** nutzen.
- Deploy zielt standardmäßig auf **Development** (kein Prod-Risiko).

## Nicht im Git (manuell mitkopieren, falls gewünscht)

- **Memory** (gerätelokal): `~/.claude/projects/C--repos/memory/` — Projekt-Stand + Arbeitsweise;
  auf einem neuen Rechner nicht vorhanden.
- **`.wip`-Handoffs** (gitignored) im `habify`-Repo — nur nötig, wenn ein konkreter Arbeitsstrom
  drüben fortgesetzt wird.

## Projektkontext (zum Reingrounden)

- Lesen: `habify/README.md`, `habify/CLAUDE.md`, `habify/00_Index.md`, plus die aktuellen
  Decision-Logs unter `habify/decisions/` (u. a. State-Vertrag der Shell, Build-Reconciliations,
  Page-Builder).
- **Arbeitsweise:** Screens aus Figma bauen; vor jedem Screen `00_Index.md` prüfen; Copy/IDs exakt
  auslesen; Entscheidungen als Decision-Log im `habify`-Repo festhalten.
- **Figma:** „habify30 Screens" — File-Key `3U4mfBmslvlnTlhvE5BvvW`.
- **Catalyst Dev:** Projekt `22671000000014048`, org/env-zgid `20116360871` (Prod `30042214524`).
