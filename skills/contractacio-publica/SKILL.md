---
name: contractacio-publica
description: Useu quan calgui investigar contractació pública a Catalunya amb el servidor MCP opendata.cat — qui contracta una empresa, quant ha adjudicat un ens, els contractes d'un municipi o de la Generalitat, rànquings d'adjudicataris. Guia quin dataset triar, com filtrar i sumar imports, com creuar fonts sense duplicar i com citar cada xifra.
---

# Investigació de contractació pública

## Visió general

La contractació pública catalana viu repartida en diversos datasets amb àmbits que se
**solapen parcialment**. La clau és triar el dataset segons la pregunta (empresa? ens?
municipi? Generalitat?), filtrar amb el camp correcte, **ordenar per import i paginar per
sumar**, i **no comptar dues vegades** el mateix contracte quan surt a més d'una font.

## Quan usar-lo

- «Quant ha adjudicat l'empresa X?», «contractes de l'Ajuntament de Y», «top adjudicataris
  de la Generalitat», «qui són els contractistes de Barcelona».
- Per a un retrat integral d'un municipi (no només contractes), combina amb **radar-municipal**.

## Els datasets i quan usar cada un

| dataset_id | Àmbit | Filtra per | Import |
| --- | --- | --- | --- |
| `generalitat:ybgg-dgi6` | **PSCP** — tota la contractació pública de Catalunya | `denominacio_adjudicatari`, `organ` | `import_adjudicacio_sense_iva` |
| `generalitat:hb6v-jcbf` | Registre de contractes de **qualsevol municipi** | `organisme_contractant` (=`Ajuntament de X`), `exercici` | `import_adjudicacio` |
| `generalitat:nn7v-4yxe` | Adjudicacions de la **Generalitat** (últims 5 anys) | `empresa_adjudicataria`, `departament` | `import_adjudicat_sense_iva` |
| `barcelona:relacio-contractistes` | Totals **agregats per empresa** de l'Ajuntament de BCN | nom, NIF | import total + nre. contractes |
| `barcelona:perfil-contractant` | Licitacions/adjudicacions/formalitzacions de BCN i grup | camps de licitació | segons fase |

## El bucle d'investigació

1. **Identifica el subjecte**: empresa (nom exacte tal com surt al registre) o ens
   contractant (`Ajuntament de …`, nom d'organ). Si dubtes del nom exacte, fes primer un
   `query_dataset` amb `search` lliure per veure com s'escriu.
2. **Tria el dataset** segons la taula. Per una empresa a tot Catalunya: `ybgg-dgi6`. Per un
   municipi: `hb6v-jcbf`. Per la Generalitat: `nn7v-4yxe`.
3. **Filtra i ordena**: p. ex. `query_dataset('generalitat:ybgg-dgi6',
   filters={"denominacio_adjudicatari":"...", "order":"import_adjudicacio_sense_iva DESC"})`.
4. **Pagina per sumar**: `query_dataset` torna 100 files màxim. Per un total, pagina amb
   `offset` fins al final i suma; o pren el top-N ordenat i digues que és un top-N.
5. **Creua fonts**: una adjudicació de la Generalitat pot sortir a `ybgg-dgi6` i a
   `nn7v-4yxe`. **No sumis les dues**: usa una font per àmbit i explica quina.
6. **Bola de neu**: de cada contracte surten pistes (altres empreses del mateix organ,
   UTE, exercicis anteriors). Segueix-les fins que dues rondes no aportin res nou.

## Regla d'or: imports i fases

- Els imports solen ser **sense IVA** (`_sense_iva`). No comparis un import sense IVA amb un
  amb IVA. Digues sempre quina base uses.
- Distingeix **licitació** (pressupost de sortida) vs **adjudicació** (import adjudicat) vs
  **formalització** (contracte signat). Per «quant ha guanyat» una empresa, la xifra és
  l'**adjudicació**.
- Un mateix expedient pot tenir diversos lots/anualitats: no confonguis nombre de línies
  amb nombre de contractes.

## Citació

Cada import ha de portar: **dataset (`dataset_id`) + camp exacte** (p. ex.
`import_adjudicacio_sense_iva`), l'ens o empresa filtrats, l'exercici i l'abast (total
paginat o top-N). Si has creuat fonts, indica quina font sustenta cada xifra. Mai donis un
total sense dir de quin dataset surt i si està sumat sobre totes les pàgines.
