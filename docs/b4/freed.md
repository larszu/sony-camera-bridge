# FreeD-Ausgabe (Phase 5)

Tracking-Daten im FreeD-Format als UDP ausgeben — das Format, das die Unreal
Engine über Live Link liest. Nach dem Umsetzungsplan ist Phase 5 der Punkt, an
dem ein **anschlussfähiges Gerät ohne eine einzige bewegte Achse** entsteht:
der kürzeste Weg zu etwas, das außer dem Erbauer jemand benutzen will.

## Die drei Teile

| Datei | Was |
|---|---|
| `protocol/FreeD.ts` | Encoder und Decoder des D1-Pakets. Reine Funktionen. |
| `protocol/FreeDScale.ts` | Roher Optik-Wert → FreeD-Bereich 0–4095, über eine Kennlinie. |
| `transport/FreeDSender.ts` | Die eine Stelle mit Socket und Zeitgeber. |

## Warum der Sender zieht, statt geschoben zu werden

Ein Tracking-Abnehmer erwartet einen gleichmäßigen Strom mit fester Rate. Optik
und Kopf liefern nicht in dieser Rate — sie liefern, wann sie wollen, und eine
serielle Antwort kann spät kommen oder ausbleiben. Jede Messung direkt
hinauszuschicken ergäbe einen zappelnden Strom mit unvorhersehbarer Rate, und
ein Empfänger, der interpoliert, interpoliert dann das Zappeln.

Der Sender fragt deshalb: je Takt ruft er `sample()`, nimmt den aktuellen Stand
und schickt genau ein Paket.

**Vorgabe 25 Hz** — ein Paket je Bild bei der Rate, mit der hier gearbeitet
wird. FreeD trägt keinen Zeitstempel; der Empfänger ordnet Pakete den Bildern
nach Ankunft zu. Schneller zu senden gibt ihm mehr zum Wegwerfen, langsamer
zwingt ihn zum Interpolieren. `rateHz`, `host` und `port` sind einstellbar.

## Fehlende Achsen werden nicht gefüllt

Meldet eine Achse nichts, **schickt der Sender gar nichts** und zählt den
übersprungenen Takt mit; `onSkip` nennt die fehlenden Felder.

Eine Null wäre eine Aussage — „die Kamera zeigt geradeaus" — und das ist etwas
anderes als „niemand hat den Schwenk gemessen". FreeD kann „unbekannt" nicht
ausdrücken: jedes Feld sind 24 Bit von irgendetwas. Stille ist das ehrliche
Signal, und jeder Tracking-Abnehmer kommt mit einer Lücke zurecht.

## Zoom und Fokus: warum eine Kennlinie

Drei Bereiche treffen aufeinander, und keiner passt zum anderen:

| Herkunft | Bereich |
|---|---|
| Seriell `0x31` / `0x32` | `0x0000`–`0xFFFF` |
| Analog Pin 10 / Pin 11 | 2–7 V |
| FreeD | 0–4095 |

Der naheliegende Weg ist `roh * 4095 / 65535`. Er ist auch falsch, und zwar aus
einem Grund, der erst an echtem Glas auffällt: `0x0000`–`0xFFFF` ist der Bereich
des **Gebers**, nicht der der Optik. Eine bestimmte Optik erreicht ihren
mechanischen Anschlag womöglich bei `0xE200` und meldet darüber nichts; eine
andere kommt nie unter `0x0C00`. Eine feste Division bildet beide auf einen
Bereich ab, den sie nie einnehmen — und die empfangende Engine sieht eine
Optik, die ihre Anschläge nicht erreicht.

Die Abbildung geht deshalb über eine Kennlinie, so wie die Iris auch: eine
kurze Liste gemessener Punkte, dazwischen linear, außerhalb geklemmt. Zwei
Punkte sind eine Gerade und schon besser als eine Annahme; fünf folgen einem
nichtlinearen Zoomring eng genug.

**Ohne gemessene Kennlinie** gilt der volle Geberbereich. Das ist die ehrliche
Vorgabe: es ist, was das Protokoll sagt, und es ist auf eine *sichtbare* Weise
falsch — die Optik wirkt, als erreiche sie ihre Anschläge nicht. Eine
plausibel aussehende falsche Zahl wäre schlimmer.

`0x14`/`0x15` liefern die Brennweiten an Tele und Weitwinkel, `0x16` die
Naheinstellgrenze. Wer sie ausliest, kann eine Kennlinie in **physikalischen**
Einheiten bauen; das Modul trägt sie unverändert durch.

## Was hier nicht geprüft ist

- **Kein Mitschnitt echter FreeD-Geräte.** Geprüft sind die Eigenschaften, die
  öffentliche Quellen belegen: Länge, Kennung, Prüfsummenregel, Feldlage,
  Vorzeichen und die Winkelskala. Byte-Gleichheit gegen eine echte Aufnahme
  steht aus.
- **Die Positions-Skala 1/64 mm ist vorläufig.** Der verbreitete Wert, aber die
  beiden maßgeblichen Dokumente waren beim Schreiben nicht erreichbar. Winkel,
  Zoom und Fokus sind davon nicht betroffen.
- **Der Interop-Test gegen Unreal Live Link** ist ein eigenes Issue (#56) und
  braucht eine Unreal-Installation.
