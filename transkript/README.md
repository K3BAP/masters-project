# Sitzungsprotokoll der KI-gestützten Implementierung

`sitzung-2026-07.jsonl` ist das vollständige, unbearbeitete Protokoll der
Claude-Code-Sitzung, in der Theorem 4 und Theorem 1 aus Bekos et al. sowie die
Webanwendung entstanden sind. Es ist die Primärquelle für die Zahlen in
Abschnitt 4 des Projektberichts.

- Sitzungs-ID `a54e20b3-b5fc-4d48-9df9-d031365a8e8a`
- 2026-07-02 06:46 UTC bis 2026-07-13 22:11 UTC (= 14. Juli MESZ)
- 3044 Zeilen, 12,4 MB
- SHA-256 `080041f7795b3a740e6fc5aef706a052fbc939905995455f716c1b2cedd7bfa9`

## Aufbau

Eine JSON-Zeile je Ereignis. Relevante Felder: `type` (`user`, `assistant`,
`system`, `attachment`, `mode`, …), `timestamp`, `message.model`,
`message.content` mit den Blöcken `text`, `thinking`, `tool_use` und
`tool_result`.

Die 1369 Assistenz-Ereignisse verteilen sich auf 767 Werkzeugaufrufe,
421 Denkblöcke und 181 Textantworten. Nutzerseitig stehen 29 inhaltliche
Nachrichten darin; die übrigen `user`-Zeilen sind Werkzeugergebnisse, die das
Format ebenfalls als `user` führt.

## Beteiligte Modelle

| Modell | Ereignisse | Zeitraum | Anteil der Arbeit |
|---|---|---|---|
| `claude-fable-5` | 1117 | 02.07. – 12.07. | beide Algorithmen, Verifier, Tests, Webanwendung |
| `claude-opus-4-8` | 191 | 12.07. – 13.07. | Wurzelknotenvorgabe, GraphML-Im- und Export, Umbau des technischen Implementierungsberichts |
| `claude-sonnet-5` | 60 | 02.07., 17:38 – 17:45 | Layoutkorrekturen an der Editor-Werkzeugleiste |

Die beiden `/compact`-Verdichtungen liegen bei 2026-07-03 12:04 UTC und
2026-07-12 11:02 UTC.

## Auswertung

Die Zahlen lassen sich mit Bordmitteln nachzählen, etwa:

```
python3 -c "
import json, collections
c = collections.Counter()
for line in open('sitzung-2026-07.jsonl', encoding='utf-8'):
    o = json.loads(line)
    if o.get('type') != 'assistant': continue
    for b in o['message'].get('content', []):
        c[b.get('type')] += 1
print(c)"
```
