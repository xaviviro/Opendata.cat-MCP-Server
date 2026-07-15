---
name: consulta-dades-obertes
description: Useu quan calgui respondre una pregunta amb dades obertes catalanes (15 portals — Generalitat, Barcelona, Diba, AOC, Reus, Girona, FGC, Idescat, Renfe, INE, REE, CNMC, CORA, Catalònica) amb les eines del servidor MCP opendata.cat (search_datasets, get_dataset_info, list_dataset_fields, query_dataset, related_datasets). Orienta com decidir el dataset, filtrar, paginar i citar bé.
---

# Consulta de dades obertes catalanes

## Visió general

opendata.cat és un **meta-catàleg**: 15 portals, 3.000+ datasets, cada un amb la seva API
(Socrata, CKAN, Opendatasoft, REST, GTFS-RT, API estadística). La feina no és "buscar i
enganxar": és **triar el dataset correcte, filtrar amb els noms de camp reals, paginar fins
a tenir prou dades i citar la font**. Sovint la millor resposta creua dos o tres datasets.

## Quan usar-lo

- Qualsevol pregunta factual sobre Catalunya que pugui tenir dades: aigua, aire, trànsit,
  emergències, contractes, pressupostos, transport, energia, població, turisme, recerca…
- Per verticals concretes hi ha skills especialitzades: **contractacio-publica**,
  **radar-municipal**, **patrimoni-i-hemeroteca**. Si la pregunta hi encaixa, usa-les.

## L'arbre de decisió

1. **El tema té un `dataset_id` conegut?** Moltes preguntes freqüents ja tenen un dataset
   destacat a les instruccions del servidor (embassaments `generalitat:gn9e-3qhr`, preu
   llum `ree:preus-electricitat`, carburants `cnmc:preus-carburants`, contractes municipals
   `generalitat:hb6v-jcbf`…). Si el saps → **`query_dataset` directe**, sense cercar.
2. **No el saps?** → `search_datasets` amb paraules clau en català/castellà (opcionalment
   `portal` o `category`). Mira el camp `queryable`: si és `false`, el dataset no es pot
   consultar en viu (només enllaç).
3. **Abans de consultar**, si no coneixes els camps → `list_dataset_fields` (o
   `get_dataset_info` per metadades completes: llicència, formats, última actualització).
4. **Consulta** → `query_dataset` amb `filters` i/o `search`, `limit` i `offset`.
5. **Enriqueix** → `related_datasets` per trobar dades complementàries d'altres portals.

## El bucle (bola de neu)

Com als arxius, cada resultat obre noves consultes: un municipi, un nom d'empresa, un any,
un codi de comarca. **No t'aturis a la primera resposta**: segueix les pistes i els
`related_datasets` fins que **dues rondes seguides no aportin res nou**. La llista de
consultes fetes forma part del resultat.

## Mecànica de filtres (per tipus d'API)

| api_type | Filtrar | Ordenar |
| --- | --- | --- |
| Socrata (generalitat, barcelona) | `filters:{"camp":"valor"}` — case-insensitive (`upper(camp)=upper(valor)`) | `filters:{"order":"camp DESC"}` |
| CKAN (aoc, reus, girona, diba, cora) | `filters:{"NOM_ENS":"Ajuntament de X"}` — noms de camp sovint en castellà | `filters:{"order":"camp DESC"}` |
| Opendatasoft (fgc) | `filters` per `refine`; GTFS-RT es descodifica sol | — |
| Idescat / INE / REE / CNMC | cada `dataset_id` retorna un indicador o taula; filtra per província/municipi quan aplica | — |
| Catalònica | `search` (`q`) lliure + `filters` `type`/`language`/`date` | — |

Regla pràctica: si un filtre combinat dona 0 resultats, **relaxa'l** (menys camps, o
`search` lliure) abans de concloure que no hi ha dades.

## Paginació (llegir-ho tot)

`query_dataset` retorna **màxim 100 files per crida**. Per a totals o rànquings, pagina amb
`offset` (0, 100, 200…) fins que una pàgina torni menys de `limit` files. No assumeixis mai
que les primeres 100 són totes. Per sumar imports o comptar, pagina fins al final o ordena
per la mètrica i pren el top explicant que és un top-N.

## Citació

Cada dada citada ha de portar: **nom del dataset + portal + `dataset_id`**, i quan sigui
públic, l'enllaç a opendata.cat (`https://opendata.cat/...`) o a l'API d'origen. Si has
paginat o filtrat, digues quins filtres i quin abast (p. ex. "top 20 per import, exercici
2025"). Mai presentis una xifra sense dir de quin dataset i camp surt.
