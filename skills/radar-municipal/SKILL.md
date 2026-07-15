---
name: radar-municipal
description: Useu quan calgui fer un retrat complet d'un municipi català amb dades obertes (pressupost, deute, cost de serveis, contractes, població, equipaments) creuant portals amb el servidor MCP opendata.cat. Guia com filtrar per NOM_ENS, quins datasets AOC/Generalitat/estadístics usar, i com tancar amb què falta.
---

# Radar municipal

## Visió general

Un municipi deixa rastre en molts portals alhora: pressupostos i deute a l'AOC, contractes
al registre de la Generalitat, població a INE/Idescat, i datasets locals propis. El retrat
surt de **creuar-los tots filtrant pel mateix ens** i de dir honestament **què no té dades**.

## Quan usar-lo

- «Fes un retrat de Manresa / Sabadell / Tiana», «com està econòmicament el municipi X»,
  «compara dos municipis» (executa el radar per cada un i posa'ls en paral·lel).
- Per aprofundir només en contractes, usa **contractacio-publica**.

## El nom de l'ens

Gairebé tot es filtra pel nom oficial: **`Ajuntament de X`** (camp `NOM_ENS` a l'AOC,
`organisme_contractant` al registre de contractes). Respecta accents i article
(`Ajuntament de l'Hospitalet de Llobregat`). Si un filtre dona 0, prova amb `search` lliure
del nom del municipi per veure la forma exacta.

## Els datasets del retrat

| Dimensió | dataset_id | Filtre |
| --- | --- | --- |
| Pressupost i plantilla | `aoc:ge-p-pressupostos-i-plantilles` | `NOM_ENS` |
| Deute | `aoc:ge-ge-endeutament` | `NOM_ENS` |
| Cost efectiu dels serveis | `aoc:ge-ge-cost-efectiu-serveis-minhap` | `NOM_ENS` |
| Liquidacions per programa | `aoc:ge-p-liquidacions-per-programes-detallat` | `NOM_ENS` |
| Terminis de pagament a proveïdors | `aoc:ge-ge-termini-pagament-proveidors` | `NOM_ENS` |
| Contractes | `generalitat:hb6v-jcbf` | `organisme_contractant`, `exercici` |
| Població | `ine:poblacio-municipis` / `idescat:m10328` | municipi |

A més: `search_datasets` amb el **nom del municipi** descobreix datasets locals (equipaments,
padró, pressupost participatiu, qualitat de l'aire local…) que no surten a la taula.

## El bucle

1. **Base econòmica**: pressupost, deute i cost de serveis (AOC, filtre `NOM_ENS`). Dona
   xifres per càpita si tens població.
2. **Contractació**: top adjudicataris i import total via `generalitat:hb6v-jcbf` (veure
   skill contractacio-publica per sumar bé).
3. **Població i context**: INE/Idescat per habitants i evolució.
4. **Local**: `search_datasets` amb el nom del municipi → equipaments, transport, medi
   ambient propis.
5. **Related**: `related_datasets` sobre els datasets trobats per descobrir dades d'altres
   portals sobre el mateix territori.
6. **Bola de neu** fins que dues rondes no aportin res nou.

## Tanca amb "què falta"

Un bon radar és honest: acaba llistant els temes on **no hi ha dades obertes** per aquell
municipi (p. ex. cap dataset de qualitat de l'aire local, o pressupost només d'un any).
Això orienta l'usuari i evita conclusions sobre buits.

## Citació

Cada dada amb **dataset (`dataset_id`) + camp + ens + any**. Si dones ràtios per càpita,
digues la font de la població i l'any. Distingeix pressupost (previst) de liquidació
(executat). Enllaça a opendata.cat quan sigui públic.
