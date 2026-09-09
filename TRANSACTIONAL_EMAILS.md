# Transaktionale E-Mails

Jede E-Mail, die das System an Teilnehmende verschickt — vollständig, mit Auslöser,
Empfänger und Quelle. **Der Code bleibt die technische Quelle der Wahrheit**
(`functions/<funktion>/index.js`); diese Datei ist der lesbare Spiegel. Laufen beide
auseinander, gilt der Code.

**Stand: elf Mails, alle aus der Funktion `peer`.** `recovery` und `zohoformswebhook`
verschicken heute nichts. Kommt eine weitere versendende Funktion dazu, bekommt sie hier
einen eigenen Abschnitt — die Nummerierung unten ist die Reihenfolge der Aufnahme, nicht
die des Teilnehmerwegs. Den Weg zeigt der Index.

Platzhalter in `{geschweiften Klammern}` werden zur Laufzeit ersetzt.

## Index

Nach dem Teilnehmerweg geordnet, nicht nach Abschnittsnummer.

| Mail | Betreff | Wann | An wen |
|---|---|---|---|
| [11](#11-eintragungs-bestätigung-double-opt-in) | Bitte bestätige deine Eintragung für die Peergruppe | Formular abgeschickt | die eingetragene Adresse |
| [2](#2-formierungsmail-stichtag) | Deine habify30-Peergruppe steht | Gruppenbildung am Stichtag | jedes Gruppenmitglied |
| [3](#3-nicht-genug-anmeldungen) | Peergruppe: diesmal keine Zuteilung | am Stichtag nur eine Person | diese Person |
| [6](#6-wartelisten-info) | Du stehst auf der Warteliste für eine Peergruppe | Eintritt in den Wartepool ohne sofortige Zuordnung | diese Person |
| [7](#7-async-match-a--zwei-wartende-werden-ein-paar) | Geschafft - deine habify30-Peergruppe steht nun fest | zwei Wartende werden ein Paar | beide |
| [8](#8-async-match-b--beitritt-zu-einer-bestehenden-gruppe) | Du bist in eine Peergruppe aufgenommen | Aufnahme in eine offene Zweiergruppe | die dazukommende Person |
| [9](#9-neues-mitglied-an-die-bestehende-gruppe) | Eure Peergruppe hat ein neues Mitglied | derselbe Vorgang wie 8 | die bestehenden Mitglieder |
| [10](#10-3-tage-broadcast) | Jemand wartet auf eine Peergruppe | jemand wartet ≥ 3 Tage | noch geschlossene Zweiergruppen |
| [1](#1-austritts-bestätigung) | Abmeldung aus deiner Peergruppe bestätigen | Abmeldelink angefordert | die eingegebene Adresse |
| [4](#4-austritts-benachrichtigung-an-die-verbleibenden) | Ein Mitglied hat eure Peergruppe verlassen | Austritt bestätigt | die verbleibenden Mitglieder |
| [5](#5-gruppe-aufgelöst--wartepool-link) | Deine Peergruppe wurde aufgelöst | Zweiergruppe schrumpft auf eine Person | die zurückgebliebene Person |

## Gilt für alle Mails

- **Betreff** wird automatisch mit dem Programmnamen der Kohorte präfixt:
  `{program_name}: <Betreff>` (aus `AccessControl.programm_name`).
- **Fußzeile** in jeder Mail: Hinweis, dass es eine automatische Nachricht ist, plus
  `AccessControl.contact_email` als Adresse für Rückfragen.
- **Absender:** `noreply.habify30@k-a-d-o.com` (als `ZEPTOMAIL_FROM` gesetzt).
- Fehlen Programmname oder Kontaktadresse in der Kohorte, wird die Mail trotzdem
  verschickt — nur ohne Präfix bzw. ohne Fußzeile.

## Abnahmestand

Mails **1–10** wurden von Matthias am 2026-09-08 final abgenommen. Mail **11** ist am
2026-09-09 mit dem Double-Opt-In entstanden, ist im Wortlaut von mir und **noch nicht
abgenommen**.

---

## 1. Austritts-Bestätigung
**Auslöser:** jemand fordert auf der Austrittsseite einen Abmeldelink an
**Empfänger:** die eingegebene Adresse · **Quelle:** DL-053 (nicht verhandelbar)
**Betreff:** Abmeldung aus deiner Peergruppe bestätigen

> Du hast angefragt, deine habify30-Peergruppe zu verlassen.
>
> Klicke auf den folgenden Link, um dich abzumelden. Erst dann wirst du aus der Gruppe entfernt und die anderen Gruppenmitglieder werden über deinen Austritt informiert:
>
> **[Abmeldung bestätigen]({link})**
>
> Der Link ist 24 Stunden gültig. Hast du das nicht angefragt, ignoriere diese E-Mail einfach.

---

## 2. Formierungsmail (Stichtag)
**Auslöser:** Gruppenbildung am Stichtag · **Empfänger:** jedes Gruppenmitglied
**Quelle:** DL-035 („genau eine operative E-Mail bei der Formation")
**Betreff:** Deine habify30-Peergruppe steht

> Deine Peergruppe für die Momentumphase steht — ihr begleitet euch gegenseitig durch die 30 Tage.
>
> Das sind die anderen aus deiner Gruppe:
> - {adresse}
> - {adresse}
>
> Meldet euch untereinander über eure Email-Adressen und entscheidet euch für einen Kanal, der für euch am besten passt (MS Teams, Messenger App, Treffen in der Kantine). Der Kanal und der Rhythmus für den Austausch sollte so gewählt sein, dass ich euch gegenseitig in der Momentumphase über kurze Updates gegenseitig motiviert dran zu bleiben. 

>
> *Nur bei Zweiergruppen zusätzlich:*
> Aktuell seid ihr zu zweit in dieser Gruppe. Wenn ihr offen für ein drittes Mitglied seid, könnt ihr eure Gruppe hier öffnen — so haben Nachzügler eine besser Chance, auch noch in einer Gruppe unterzukommen.  
> **[Gruppe für neue Mitglieder öffnen/schließen]({link})**
> Über den gleichen Link könnt ihr eure Gruppe jederzeit wieder schließen:
---

## 3. Nicht genug Anmeldungen
**Auslöser:** am Stichtag hat sich nur **eine** Person eingetragen
**Empfänger:** diese Person · **Quelle:** DL-037 („never silent")
**Betreff:** Peergruppe: diesmal keine Zuteilung

> Es haben sich noch nicht genügend Teilnehmende auf der Warteliste eingetragen, um eine Gruppe zu bilden. Sobald jemand dazukommt, ordnen wir dich zu und du bekommst eine automatische Benachrichtigung.

---

## 4. Austritts-Benachrichtigung an die Verbleibenden
**Auslöser:** ein Mitglied hat den Austritt bestätigt · **Empfänger:** die verbleibenden Mitglieder
**Quelle:** DL-037; Opt-in-Zusatz bei 3er→2er per DL-087
**Betreff:** Ein Mitglied hat eure Peergruppe verlassen

> Ein Mitglied hat eure habify30-Peergruppe verlassen.
>
> Ihr könnt euch als verbleibende Gruppe weiter austauschen wie bisher.
>
> *Nur wenn ihr dadurch auf zwei geschrumpft seid:*
> Ihr seid jetzt zu zweit. Wenn ihr offen für ein neues drittes Mitglied seid, könnt ihr eure Gruppe hier öffnen — und jederzeit wieder schließen:
> **[Gruppe für neue Mitglieder öffnen/schließen]({link})**

---

## 5. Gruppe aufgelöst (+ Wartepool-Link)
**Auslöser:** eine Zweiergruppe schrumpft durch einen Austritt auf eine Person
**Empfänger:** die allein zurückgebliebene Person · **Quelle:** DL-087
**Betreff:** Deine Peergruppe wurde aufgelöst

> Deine habify30-Peergruppe wurde aufgelöst: nachdem das andere Mitglied ausgetreten ist, wärst du allein zurückgeblieben — und eine Peergruppe aus einer Person ist keine.
>
> Wenn du weiterhin eine Gruppe möchtest, trag dich hier auf die Warteliste ein. Wir ordnen dich dann einer neuen Gruppe zu:
>
> **[Auf die Warteliste setzen]({link})**
>
> Wenn du nichts tust, passiert nichts weiter — du stehst dann auf keiner Liste.

---

## 6. Wartelisten-Info
**Auslöser:** jemand ist in den Wartepool eingetreten **und wurde nicht sofort zugeordnet**
(Nachzügler nach der Anmeldung, oder Klick auf den Wartepool-Link)
**Empfänger:** diese Person · **Quelle:** DL-087
**Betreff:** Du stehst auf der Warteliste für eine Peergruppe

> Du stehst jetzt auf der Warteliste für eine Peergruppe. So läuft die Zuordnung:
>
> - Sobald eine zweite wartende Person da ist, bilden wir aus euch beiden eine Gruppe — auf eine dritte warten wir nicht.
> - Öffnet sich in der Zwischenzeit eine bestehende Zweiergruppe für ein neues Mitglied, kommst du dort dazu.
> - In beiden Fällen bekommst du sofort eine E-Mail mit den Kontaktdaten deiner Gruppe.
> - Tut sich drei Tage lang nichts, fragen wir bestehende Zweiergruppen, ob sie sich für ein neues Mitglied öffnen.
>
> Ehrlich gesagt: eine Zuordnung ist nicht garantiert. Trägt sich in diesem Durchlauf niemand mehr ein, kann es leider nichts werden. Abmelden von der Warteliste kannst du dich jederzeit.

*(Der letzte Absatz benennt bewusst das von DL-037 akzeptierte Restrisiko — es zu verschweigen wäre die stille Variante, die der Kanon ablehnt.)*

---

## 7. Async-Match (a) — zwei Wartende werden ein Paar
**Auslöser:** zwei Solos im Wartepool werden zusammengeführt · **Empfänger:** beide
**Quelle:** DL-041 A5, Sub-Fall (a) — bewusst **anderer Text** als die Formierungsmail
**Betreff:** Geschafft - deine habify30-Peergruppe steht nun fest

> Es hat geklappt — du hast eine Peergruppe. Ihr seid zu zweit: jemand hat wie du auf eine Gruppe gewartet.
>
> Das ist die andere Person:
> - {adresse}
>
> MMeldet euch untereinander über eure Email-Adressen und entscheidet euch für einen Kanal, der für euch am besten passt (MS Teams, Messenger App, Treffen in der Kantine). Der Kanal und der Rhythmus für den Austausch sollte so gewählt sein, dass ich euch gegenseitig in der Momentumphase über kurze Updates gegenseitig motiviert dran zu bleiben. 
>
> Ihr seid zu zweit. Wenn ihr offen für ein drittes Mitglied seid, könnt ihr eure Gruppe hier öffnen — und jederzeit wieder schließen:
> **[Gruppe für neue Mitglieder öffnen/schließen]({link})**

---

## 8. Async-Match (b) — Beitritt zu einer bestehenden Gruppe
**Auslöser:** ein einzelner Wartender wird in eine offene Zweiergruppe aufgenommen
**Empfänger:** die dazukommende Person · **Quelle:** DL-041 A5, Sub-Fall (b)
**Betreff:** Du bist in eine Peergruppe aufgenommen

> Du bist in eine bestehende Peergruppe aufgenommen worden. Die beiden sind schon ein Stück zusammen unterwegs — du kommst dazu.
>
> Das sind ihre Email-Adressen:
> - {adresse}
> - {adresse}
>
> Schreib ihnen am besten direkt, damit sie wissen, dass du da bist und sie dich in ihren Kommunikations-Kanal aufnehmen können. 

---

## 9. Neues Mitglied (an die bestehende Gruppe)
**Auslöser:** derselbe Vorgang wie 8 · **Empfänger:** die zwei bestehenden Mitglieder
**Quelle:** DL-041 A4
**Betreff:** Eure Peergruppe hat ein neues Mitglied

> Eure habify30-Peergruppe hat ein neues Mitglied — ihr seid jetzt zu dritt.
>
> Neu dabei:
> - {adresse}
>
> Nehmt die Person bitte in euren Kommunikations-Kanal auf.

---

## 10. 3-Tage-Broadcast
**Auslöser:** jemand wartet seit ≥3 Tagen unvermittelt
**Empfänger:** die Mitglieder der **noch geschlossenen** Zweiergruppen (gebündelt, einmal pro Warte-Episode)
**Quelle:** DL-037, Ziel-Präzisierung durch DL-087
**Betreff:** Jemand wartet auf eine Peergruppe

> Gerade {wartet eine Person / warten N Personen} auf eine Peergruppe und findet keine.
>
> Ihr seid zu zweit in eurer Gruppe. Wenn ihr euch vorstellen könnte, eine wartende Person aufzunehmen, öffnet eure Gruppe hier — wir ordnen dann automatisch jemanden zu:
>
> **[Gruppe für ein neues Mitglied öffnen]({link})**
>
> Wenn das für euch nicht passt, ignoriere diese E-Mail einfach.

---

---

## 11. Eintragungs-Bestätigung (Double Opt-In)
**Auslöser:** jemand schickt das Eintragungsformular ab
**Empfänger:** die eingetragene Adresse · **Quelle:** DL-090
**Betreff:** Bitte bestätige deine Eintragung für die Peergruppe

> Fast geschafft — es fehlt nur noch deine Bestätigung.
>
> **[Eintragung bestätigen]({link})**
>
> **Ohne diesen Klick wirst du keiner Peergruppe zugeteilt.** Wir bestätigen so, dass die Adresse wirklich dir gehört — sonst könnte ein Tippfehler dazu führen, dass deine Gruppendaten an eine fremde Person gehen. *(Nur solange die Kohorte noch nicht gebildet ist:)* Die Zuteilung erfolgt am {stichtag}.
>
> Der Link ist 7 Tage gültig. Hast du das nicht angefragt, ignoriere diese E-Mail einfach — ohne Bestätigung passiert nichts.

*(Diese Mail geht jedem Eintrag voraus: bis sie bestätigt ist, steht die Adresse auf
`pending` und kann keiner Gruppe zugeteilt werden. Der Stichtag-Satz entfällt für
Nachzügler, die nach der Gruppenbildung bestätigen — die kommen in den Wartepool und
bekommen danach Mail 6. Wortlaut noch nicht abgenommen.)*

## Beim Übertragen still korrigiert
- `MMeldet` → `Meldet` (Mail 7) · „eine besser Chance" → „eine bessere Chance" (Mail 2) ·
  „wenn ihr euch vorstellen könnte" → „könntet" (Mail 10).
- Der Kanal-Satz war in Mail 2 und 7 verrutscht („…dass **ich** euch gegenseitig … über kurze
  Updates **gegenseitig** motiviert dran zu bleiben"). Repariert zu: „…dass **ihr euch** in der
  Momentumphase über kurze Updates gegenseitig motiviert, dranzubleiben." Steht jetzt als ein
  gemeinsamer Baustein in beiden Mails.
- Mail 10: Für den Mehrzahlfall „warten N Personen … und **finden** keine" (vorher stand dort
  in beiden Fällen „findet").

## Was beim Schreiben auffiel (erledigt)
- **Betreff 2 und 7 sind identisch** („Deine habify30-Peergruppe steht"), obwohl DL-041 A5 die beiden Situationen ausdrücklich unterscheidet. Inhaltlich unterscheiden sie sich, im Postfach nicht.
    > habe ich angepasst 
- **Ansprache/Tonalität** ist durchgehend geduzt und knapp gehalten, analog zu den Figma-Seiten — aber nirgends abgestimmt.
    > Tonalität passt
- **Kein Absender-Kontext**: keine Nennung des Programmnamens der Kohorte, keine Signatur, kein Hinweis, an wen man sich bei Fragen wendet. In `AccessControl` liegen `programm_name` und `contact_email` — beides könnte in die Mails.
    > guter Fang; wenn wir zeptomail aufsetzen, dann vielleicht noreply.habify30@k-a-d-o.com; bei Fragen - contact_email, program_name immer in den Betreff: program_name: ...
- **Mail 3 („nicht genug Anmeldungen")** verspricht „Sobald jemand dazukommt, ordnen wir dich zu" — das stimmt, weil diese Person im Pool bleibt und das Matching sofort läuft.
