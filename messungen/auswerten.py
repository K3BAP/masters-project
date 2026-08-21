#!/usr/bin/env python3
"""Auswertung der Messkampagne (roh.csv -> Aggregate + kennzahlen.tex).

Nur Standardbibliothek. Flaechen werden als Python-Ganzzahlen gerechnet,
weil die Schranken von Theorem 1 den Bereich von 64-Bit-Produkten
verlassen; measure.cpp schreibt deshalb nur Breiten und Hoehen.

Flaeche = (Breite+1) * (Hoehe+1), also die Gitterpunkte des umschliessenden
Rechtecks. Dieselbe Konvention gilt fuer die Schranke, damit der Quotient
vergleichbar bleibt und im entarteten Fall Breite=0 definiert ist.

Aufruf:  python3 bericht/messungen/auswerten.py
"""

import csv
import math
import os
import statistics
import sys
from collections import defaultdict

HIER = os.path.dirname(os.path.abspath(__file__))
ROH = os.path.join(HIER, "roh.csv")


# Die Sonderexperimente laufen mit abweichendem k und duerfen nicht in
# die Ausnutzungsstatistik der Papier-Wahl eingehen.
SONDER = ("ksweep", "kwahl")


def haupt(z):
    return z["familie"] not in SONDER


def lade():
    with open(ROH, newline="", encoding="utf-8") as f:
        zeilen = list(csv.DictReader(f))
    gesamt = len(zeilen)
    gut = [z for z in zeilen if z["verifiziert"] == "1"]
    return zeilen, gut, gesamt


def i(z, key):
    v = z[key]
    return int(v) if v not in ("", None) else None


def flaeche(b, h):
    return (b + 1) * (h + 1)


def kennzahlen_der_zeile(z):
    b, h = i(z, "breite"), i(z, "hoehe")
    bs, hs = i(z, "breite_schranke"), i(z, "hoehe_schranke")
    f, fs = flaeche(b, h), flaeche(bs, hs)
    return b, h, bs, hs, f, fs


def fmt(x, stellen=None):
    """Deutsche Zahl fuer LaTeX: Komma als Dezimaltrenner.

    Ohne Vorgabe wird die Stellenzahl an die Groesse angepasst, damit
    weder 59{,}841 noch 0{,}07 im Text stehen."""
    if stellen is None:
        a = abs(x)
        stellen = 1 if a >= 10 else (2 if a >= 1 else 3)
    return f"{x:.{stellen}f}".replace(".", "{,}")


def fmt_gross(x):
    """Ganzzahl mit schmalem Trennzeichen: 15566 -> 15\\,566."""
    s = f"{int(round(x)):d}"
    teile = []
    while len(s) > 3:
        teile.insert(0, s[-3:])
        s = s[:-3]
    teile.insert(0, s)
    return "\\,".join(teile)


def regression(xs, ys):
    """Kleinste Quadrate auf (log x, log y): liefert Exponent und R^2."""
    lx = [math.log(x) for x in xs]
    ly = [math.log(y) for y in ys]
    n = len(lx)
    mx, my = sum(lx) / n, sum(ly) / n
    sxx = sum((a - mx) ** 2 for a in lx)
    sxy = sum((a - mx) * (b - my) for a, b in zip(lx, ly))
    b = sxy / sxx
    a = my - b * mx
    syy = sum((v - my) ** 2 for v in ly)
    rss = sum((v - (a + b * u)) ** 2 for u, v in zip(lx, ly))
    r2 = 1 - rss / syy if syy > 0 else 1.0
    return b, r2


def schreibe(name, kopf, zeilen):
    pfad = os.path.join(HIER, name)
    with open(pfad, "w", encoding="utf-8") as f:
        f.write(" ".join(kopf) + "\n")
        for z in zeilen:
            f.write(" ".join(str(v) for v in z) + "\n")
    return pfad


def ganz(x):
    """Median ganzzahliger Groessen wieder ganzzahlig ausgeben --
    pgfplots soll keine Exponentialschreibweise lesen muessen."""
    return int(round(x))


def mmm(werte):
    return (statistics.median(werte), min(werte), max(werte))


def mmm_ganz(werte):
    med, lo, hi = mmm(werte)
    return (ganz(med), ganz(lo), ganz(hi))


# ---------------------------------------------------------------------
def main():
    if not os.path.exists(ROH):
        sys.exit(f"{ROH} fehlt -- erst ./build/measure laufen lassen.")
    alle, gut, gesamt = lade()
    makros = {}
    makros["MessInstanzen"] = fmt_gross(gesamt)
    makros["MessInstanzenVerifiziert"] = fmt_gross(len(gut))
    makros["MessInstanzenThmVier"] = fmt_gross(sum(1 for z in gut if z["verfahren"] == "thm4"))
    makros["MessInstanzenThmEins"] = fmt_gross(sum(1 for z in gut if z["verfahren"] == "thm1"))
    # Hauptkampagne ohne die beiden Sonderexperimente, die mit
    # abweichendem k rechnen
    makros["MessHaupt"] = fmt_gross(sum(1 for z in gut if haupt(z)))
    makros["MessHauptThmVier"] = fmt_gross(
        sum(1 for z in gut if haupt(z) and z["verfahren"] == "thm4"))
    makros["MessHauptThmEins"] = fmt_gross(
        sum(1 for z in gut if haupt(z) and z["verfahren"] == "thm1"))
    makros["MessSonder"] = fmt_gross(sum(1 for z in gut if not haupt(z)))
    makros["MessFehlschlaege"] = fmt_gross(gesamt - len(gut))

    # -----------------------------------------------------------------
    # 1. Flaeche ueber n
    # -----------------------------------------------------------------
    for verf in ("thm4", "thm1"):
        proN = defaultdict(lambda: defaultdict(list))
        for z in gut:
            if z["verfahren"] != verf:
                continue
            fam = z["familie"]
            if fam not in ("prisma", "antiprisma", "maximal_planar"):
                continue
            _, _, _, _, f, fs = kennzahlen_der_zeile(z)
            proN[fam][i(z, "n_in")].append((f, fs))
        ns = sorted({n for fam in proN for n in proN[fam]})
        kopf = ["n"]
        for fam in ("prisma", "antiprisma", "maximal_planar"):
            kopf += [fam, fam + "_min", fam + "_max", fam + "_schranke"]
        rows = []
        for n in ns:
            r = [n]
            for fam in ("prisma", "antiprisma", "maximal_planar"):
                if n in proN[fam]:
                    fl = [a for a, _ in proN[fam][n]]
                    sc = [b for _, b in proN[fam][n]]
                    med, lo, hi = mmm_ganz(fl)
                    r += [med, lo, hi, ganz(statistics.median(sc))]
                else:
                    r += ["nan"] * 4
            rows.append(r)
        schreibe(f"flaeche-{verf}.csv", kopf, rows)

        # Exponenten: nur konstantes Delta (Prisma/Antiprisma) ist sauber
        for fam in ("prisma", "antiprisma", "maximal_planar"):
            punkte = sorted(proN[fam].items())
            if len(punkte) < 3:
                continue
            xs = [n for n, _ in punkte]
            ys = [statistics.median([a for a, _ in v]) for _, v in punkte]
            zs = [statistics.median([b for _, b in v]) for _, v in punkte]
            bg, r2g = regression(xs, ys)
            bs, _ = regression(xs, zs)
            tag = {"prisma": "Prisma", "antiprisma": "Antiprisma",
                   "maximal_planar": "Triang"}[fam]
            v = "Vier" if verf == "thm4" else "Eins"
            makros[f"MessExp{v}{tag}"] = fmt(bg)
            makros[f"MessExp{v}{tag}Schranke"] = fmt(bs)
            makros[f"MessExp{v}{tag}RSQ"] = fmt(r2g, 3)

        # Ausnutzungsgrade
        quoten, quoten_b, quoten_h = [], [], []
        for z in gut:
            if z["verfahren"] != verf or not haupt(z):
                continue
            b, h, bs, hs, f, fs = kennzahlen_der_zeile(z)
            if fs > 0:
                quoten.append(f / fs)
                quoten_b.append((b + 1) / (bs + 1))
                quoten_h.append((h + 1) / (hs + 1))
        if quoten_b:
            v = "Vier" if verf == "thm4" else "Eins"
            makros[f"MessBreitenquote{v}"] = fmt(100 * statistics.median(quoten_b))
            makros[f"MessHoehenquote{v}"] = fmt(100 * statistics.median(quoten_h))
        if quoten:
            v = "Vier" if verf == "thm4" else "Eins"
            makros[f"MessQuote{v}Median"] = fmt(100 * statistics.median(quoten))
            makros[f"MessQuote{v}Max"] = fmt(100 * max(quoten))
            kehr = 1 / statistics.median(quoten)
            makros[f"MessQuote{v}Faktor"] = fmt_gross(kehr) if kehr >= 10 else fmt(kehr)

    # -----------------------------------------------------------------
    # 2. Steigungen ueber Delta
    # -----------------------------------------------------------------
    for verf in ("thm4", "thm1"):
        proD = defaultdict(lambda: {"ohne": [], "mit": []})
        for z in gut:
            if z["verfahren"] != verf or not haupt(z):
                continue
            d = i(z, "delta_in")
            if d < 1:
                continue
            aug = i(z, "augmentiert") or i(z, "bump")
            proD[d]["mit" if aug else "ohne"].append(i(z, "steigungen"))
        kopf = ["delta", "ohne", "ohne_min", "ohne_max",
                "mit", "mit_min", "mit_max", "s_satz", "s_korollar"]
        rows = []
        for d in sorted(proD):
            r = [d]
            for gruppe in ("ohne", "mit"):
                w = proD[d][gruppe]
                r += list(mmm_ganz(w)) if w else ["nan"] * 3
            if verf == "thm4":
                r += [max(2, (d + 1) // 2), max(2, (d + 1) // 2 + 1)]
            else:
                r += [max(2, 3 * max(d, 5) - 8), max(2, (9 * d + 1) // 2 + 1)]
            rows.append(r)
        schreibe(f"steigungen-{verf}.csv", kopf, rows)

        # Wie schnell waechst die benutzte Steigungszahl in Delta?
        punkte = defaultdict(list)
        for z in gut:
            if z["verfahren"] == verf and haupt(z) and i(z, "delta_in") >= 6:
                punkte[i(z, "delta_in")].append(i(z, "steigungen"))
        if len(punkte) >= 5:
            xs = sorted(punkte)
            ys = [statistics.median(punkte[d]) for d in xs]
            mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
            sxx = sum((a - mx) ** 2 for a in xs)
            sxy = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
            v = "Vier" if verf == "thm4" else "Eins"
            makros[f"MessSteigungssteigung{v}"] = fmt(sxy / sxx)

        # Straffheit: wie oft wird die strikte Schranke erreicht?
        treffer = tot = treffer_h = tot_h = 0
        for z in gut:
            if z["verfahren"] != verf or not haupt(z):
                continue
            tot += 1
            voll = i(z, "steigungen") == i(z, "steigungen_strikt")
            if voll:
                treffer += 1
            if i(z, "delta_in") >= 6:      # ohne die Faelle, in denen die
                tot_h += 1                 # Schranke ohnehin auf 2 liegt
                if voll:
                    treffer_h += 1
        if tot:
            v = "Vier" if verf == "thm4" else "Eins"
            makros[f"MessStraff{v}"] = fmt(100 * treffer / tot, 1)
            makros[f"MessStraff{v}Absolut"] = fmt_gross(treffer)
            if tot_h:
                makros[f"MessStraff{v}Hoch"] = fmt(100 * treffer_h / tot_h, 1)
                makros[f"MessStraff{v}HochAnzahl"] = fmt_gross(tot_h)
            # Wie weit unter der strikten Schranke bleibt das Verfahren?
            aus = [i(z, "steigungen") / max(1, i(z, "steigungen_strikt"))
                   for z in gut
                   if z["verfahren"] == verf and haupt(z) and i(z, "delta_in") >= 6]
            if aus:
                makros[f"MessSteigungsquote{v}"] = fmt(100 * statistics.median(aus))

    # -----------------------------------------------------------------
    # 3. k-Sweep
    # -----------------------------------------------------------------
    ks = defaultdict(list)
    for z in gut:
        if z["familie"] != "ksweep":
            continue
        ks[z["instanz"]].append(z)
    # Dateinamen duerfen Ziffern tragen, LaTeX-Makronamen nicht.
    kurz = {"Rad W8": "w8", "Antiprisma A8": "a8",
            "Triangulierung n=32 s=4242": "tri32", "Paper Abb. 1": "paper"}
    tags = {"w8": "Rad", "a8": "Antiprisma", "tri32": "Triang", "paper": "Paper"}
    for inst, zl in ks.items():
        zl.sort(key=lambda z: int(z["k"]))
        rows = []
        for z in zl:
            b, h, _, _, f, _ = kennzahlen_der_zeile(z)
            rows.append([int(z["k"]), b, h, f])
        schreibe(f"ksweep-{kurz.get(inst, 'x')}.csv", ["k", "breite", "hoehe", "flaeche"], rows)
        if len(zl) >= 2:
            k0, k1 = int(zl[0]["k"]), int(zl[-1]["k"])
            h0, h1 = i(zl[0], "hoehe"), i(zl[-1], "hoehe")
            b0, b1 = i(zl[0], "breite"), i(zl[-1], "breite")
            tag = tags.get(kurz.get(inst, "x"), "X")
            makros[f"MessKMin{tag}"] = fmt_gross(k0)
            makros[f"MessKPapier{tag}"] = fmt_gross(k1)
            makros[f"MessKFaktor{tag}"] = fmt_gross(k1 / k0)
            makros[f"MessKHoeheFaktor{tag}"] = fmt_gross(h1 / h0)
            f0 = flaeche(b0, h0)
            f1 = flaeche(i(zl[-1], "breite"), h1)
            makros[f"MessKFlaecheFaktor{tag}"] = fmt_gross(f1 / f0)
    # Wie stark schwankt die Breite ueber den Sweep?
    schwank = []
    for zl in ks.values():
        bw = [i(z, "breite") for z in zl]
        if bw and max(bw) > 0:
            schwank.append((max(bw) - min(bw)) / max(bw))
    if schwank:
        makros["MessKBreiteSchwankung"] = fmt(100 * max(schwank), 1)
    # Linearitaet der Hoehe in k: Steigung der oberen Haelfte
    lin = []
    for zl in ks.values():
        hal = zl[len(zl) // 2:]
        if len(hal) >= 3:
            b, r2 = regression([int(z["k"]) for z in hal],
                               [i(z, "hoehe") for z in hal])
            lin.append((b, r2))
    if lin:
        makros["MessKHoeheExponent"] = fmt(statistics.median(x for x, _ in lin))
        makros["MessKHoeheRSQ"] = fmt(min(r for _, r in lin), 3)

    # -----------------------------------------------------------------
    # 3b. Wahl von k: Modellprobe und Faustregel
    # -----------------------------------------------------------------
    kw = defaultdict(dict)
    for z in gut:
        if z["familie"] == "kwahl":
            kw[z["instanz"]][z["strategie"]] = z
    if kw:
        # Modell H(k) = (p-2)*k + b, geprueft am oberen Ende des Bereichs
        best = abw = 0
        for d in kw.values():
            if "papier" not in d or "modellprobe" not in d:
                continue
            p_teile = i(d["papier"], "teile")
            dh = i(d["papier"], "hoehe") - i(d["modellprobe"], "hoehe")
            if dh == p_teile - 2:
                best += 1
            else:
                abw += 1
        makros["MessModellBestaetigt"] = fmt_gross(best)
        makros["MessModellAbweichend"] = fmt_gross(abw)
        makros["MessModellInstanzen"] = fmt_gross(len(kw))

        def seiten(z):
            return (i(z, "breite") + 1) / (i(z, "hoehe") + 1)

        tagm = {"papier": "Papier", "minimal": "Minimal",
                "quadratisch": "Quadratisch"}
        for strat, tag in tagm.items():
            v = [seiten(d[strat]) for d in kw.values() if strat in d]
            if not v:
                continue
            med = statistics.median(v)
            makros[f"MessSeiten{tag}"] = fmt(med)
            makros[f"MessSeitenKehr{tag}"] = fmt_gross(1 / med) if med < 1 \
                else fmt_gross(med)
            makros[f"MessSeitenBand{tag}"] = fmt(
                100 * sum(1 for x in v if 0.5 <= x <= 2) / len(v), 1)
            makros[f"MessSeitenEngBand{tag}"] = fmt(
                100 * sum(1 for x in v if 2 / 3 <= x <= 1.5) / len(v), 1)
            if strat != "papier":
                r = [flaeche(i(d["papier"], "breite"), i(d["papier"], "hoehe"))
                     / flaeche(i(d[strat], "breite"), i(d[strat], "hoehe"))
                     for d in kw.values() if strat in d and "papier" in d]
                makros[f"MessSpar{tag}"] = fmt_gross(statistics.median(r))
                makros[f"MessSpar{tag}Min"] = fmt_gross(min(r))
                makros[f"MessSpar{tag}Max"] = fmt_gross(max(r))
        preis = [flaeche(i(d["quadratisch"], "breite"), i(d["quadratisch"], "hoehe"))
                 / flaeche(i(d["minimal"], "breite"), i(d["minimal"], "hoehe"))
                 for d in kw.values() if "quadratisch" in d and "minimal" in d]
        if preis:
            makros["MessPreisQuadrat"] = fmt(statistics.median(preis))
            makros["MessPreisQuadratMax"] = fmt(max(preis))
        geklemmt = sum(1 for d in kw.values()
                       if "quadratisch" in d and "minimal" in d
                       and int(d["quadratisch"]["k"]) == int(d["minimal"]["k"]))
        makros["MessGeklemmt"] = fmt_gross(geklemmt)

        # Diagramm: Seitenverhaeltnis je Instanz, nach n sortiert
        ordn = sorted(kw.items(), key=lambda kv: (i(list(kv[1].values())[0], "n_in"),
                                                  kv[0]))
        zeilen = []
        for idx, (inst, d) in enumerate(ordn, start=1):
            r = [idx, i(list(d.values())[0], "n_in")]
            for strat in ("papier", "minimal", "quadratisch"):
                r.append(f"{seiten(d[strat]):.6g}" if strat in d else "nan")
            for strat in ("minimal", "quadratisch"):
                if strat in d and "papier" in d:
                    r.append(flaeche(i(d[strat], "breite"), i(d[strat], "hoehe"))
                             / flaeche(i(d["papier"], "breite"), i(d["papier"], "hoehe")))
                else:
                    r.append("nan")
            zeilen.append(r)
        schreibe("kwahl.csv",
                 ["idx", "n", "papier", "minimal", "quadratisch",
                  "fl_minimal", "fl_quadratisch"], zeilen)

    # -----------------------------------------------------------------
    # 4. Laufzeit
    # -----------------------------------------------------------------
    proN = defaultdict(lambda: defaultdict(list))
    for z in gut:
        if z["familie"] != "maximal_planar":
            continue
        proN[z["verfahren"]][i(z, "n_in")].append(float(z["zeit_ms"]))
    ns = sorted({n for v in proN for n in proN[v]})
    rows = []
    for n in ns:
        r = [n]
        for verf in ("thm4", "thm1"):
            w = proN[verf].get(n)
            r += [f"{x:.3f}" for x in mmm(w)] if w else ["nan"] * 3
        rows.append(r)
    schreibe("zeit.csv", ["n", "thm4", "thm4_min", "thm4_max",
                          "thm1", "thm1_min", "thm1_max"], rows)
    for verf in ("thm4", "thm1"):
        punkte = sorted((n, statistics.median(v)) for n, v in proN[verf].items()
                        if statistics.median(v) > 0)
        if len(punkte) >= 3:
            b, _ = regression([p[0] for p in punkte], [p[1] for p in punkte])
            makros["MessZeitExp" + ("Vier" if verf == "thm4" else "Eins")] = fmt(b)
        if proN[verf]:
            nmax = max(proN[verf])
            makros["MessZeitMax" + ("Vier" if verf == "thm4" else "Eins")] = \
                fmt(statistics.median(proN[verf][nmax]) / 1000, 2)
            makros["MessNMax" + ("Vier" if verf == "thm4" else "Eins")] = fmt_gross(nmax)

    # -----------------------------------------------------------------
    # 5. Tabellen fuer Anhang B: Ausnutzungsgrad je Familie
    # -----------------------------------------------------------------
    NAMEN = {
        "prisma": "Prisma ($\\Deg=3$)", "antiprisma": "Antiprisma ($\\Deg=4$)",
        "rad": "Rad", "doppelrad": "Doppelrad",
        "maximal_planar": "Triangulierung", "dichte": "Dichtesweep",
        "stern": "Stern", "pfad": "Pfad", "spinne": "Spinne",
        "gitter": "Gitter", "referenz": "Referenzinstanzen",
    }
    tab = defaultdict(lambda: defaultdict(list))
    spanne = defaultdict(list)
    for z in gut:
        if not haupt(z):
            continue
        schl = (z["verfahren"], z["familie"])
        b, h, bs, hs, f, fs = kennzahlen_der_zeile(z)
        tab[schl]["b"].append((b + 1) / (bs + 1))
        tab[schl]["h"].append((h + 1) / (hs + 1))
        tab[schl]["f"].append(f / fs)
        tab[schl]["s"].append(i(z, "steigungen") / max(1, i(z, "steigungen_strikt")))
        spanne[schl].append((i(z, "n_in"), i(z, "delta_in")))
    for verf in ("thm4", "thm1"):
        zeilen = []
        for fam in NAMEN:
            schl = (verf, fam)
            if schl not in tab:
                continue
            d = tab[schl]
            ns = [x for x, _ in spanne[schl]]
            ds = [y for _, y in spanne[schl]]
            zeilen.append(" & ".join([
                NAMEN[fam],
                str(len(d["f"])),
                f"{min(ns)}--{max(ns)}" if min(ns) != max(ns) else str(min(ns)),
                f"{min(ds)}--{max(ds)}" if min(ds) != max(ds) else str(min(ds)),
                fmt(100 * statistics.median(d["b"])),
                fmt(100 * statistics.median(d["h"])),
                fmt(100 * statistics.median(d["f"])),
                fmt(100 * statistics.median(d["s"])),
            ]) + " \\\\")
        # Die vollstaendige Tabelle, nicht nur der Rumpf: \input in einen
        # tabularx-Koerper hinein scheitert, weil tabularx den Koerper
        # mehrfach liest.
        with open(os.path.join(HIER, f"tabelle-{verf}.tex"), "w", encoding="utf-8") as f:
            f.write("\\begin{tabular}{@{}lrllrrrr@{}}\n\\toprule\n")
            f.write("Familie & L\\\"aufe & $n$ & $\\Deg$ & Breite & H\\\"ohe"
                    " & Fl\\\"ache & Steig. \\\\\n\\midrule\n")
            f.write("\n".join(zeilen) + "\n")
            f.write("\\bottomrule\n\\end{tabular}\n")

    # -----------------------------------------------------------------
    with open(os.path.join(HIER, "kennzahlen.tex"), "w", encoding="utf-8") as f:
        f.write("% Automatisch erzeugt von auswerten.py -- nicht von Hand aendern.\n")
        for k in sorted(makros):
            f.write(f"\\newcommand{{\\{k}}}{{{makros[k]}}}\n")

    print(f"{gesamt} Zeilen, {len(gut)} verifiziert, {gesamt - len(gut)} nicht.")
    print(f"{len(makros)} Makros in kennzahlen.tex.")


if __name__ == "__main__":
    main()
