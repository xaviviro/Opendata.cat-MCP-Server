---
name: patrimoni-i-hemeroteca
description: Useu quan calgui investigar patrimoni cultural digital i premsa/ràdio catalana amb el servidor MCP opendata.cat — Catalònica (39 subportals de la BNC: MNAC, RACO, tesis, mapes, manuscrits, hemeroteques) i radioteca.cat (~485K episodis). Guia com triar el subportal, com cercar-hi i la disciplina de cites (mai fabricar registres, sempre enllaçar la font).
---

# Patrimoni digital i hemeroteca

## Visió general

Catalònica és l'agregador de la Biblioteca de Catalunya: ~2,2M objectes culturals repartits
en ~39 subportals temàtics, cada un amb el seu comportament. radioteca.cat indexa ~485K
episodis de ràdio. Aquí la **disciplina de cites és tan important com trobar la dada**:
cada registre s'ha d'enllaçar a la seva font, i **mai s'inventa** un registre que l'API no
ha retornat.

## Quan usar-lo

- «Busca obres de Casas al MNAC», «tesis sobre X», «mapes històrics de Barcelona»,
  «manuscrits medievals», «què va dir la ràdio sobre X».
- Per a dades estadístiques/administratives, no és aquesta skill: usa **consulta-dades-obertes**.

## Trii el subportal correcte (Catalònica)

Cada `catalonica:<set>` és una col·lecció temàtica. N'hi ha de dues menes:

- **Native-handler** (retornen registres reals, citables): `catalonica:mnac` (art),
  `catalonica:mdc` (agregador ampli: cartells, fotos, premsa local), `catalonica:arca`
  (premsa històrica), `catalonica:cartoteca` (mapes ICGC), `catalonica:upcommons`,
  `catalonica:tdx` (tesis), `catalonica:ddduab`, i altres repositoris universitaris.
- **Search-guide** (NO tenen API JSON: retornen URL del cercador natiu + pistes): p. ex.
  `catalonica:hcc`, `catalonica:reus`, `catalonica:bipadi`, `catalonica:corpusliterari`…

Per a un tema desconegut, prova el subportal temàtic més probable o cau a `catalonica:mdc`
(el més ampli). `get_dataset_info` d'un `catalonica:<set>` exposa el cercador natiu a
`extra.subportal_url`.

## Com cercar-hi

`query_dataset('catalonica:<set>', search='<text>')` amb `q` lliure sobre
títol/autor/matèria/descripció (molt efectiu: prova noms propis, «Barcelona 1936»,
«manuscrit medieval»). Afina amb `filters`: `type` (Text, Image, MovingImage, Sound),
`language` (cat, spa, eng, lat), `date` (any). `url_resource` = visor institucional;
`url_catalonica` = fitxa de l'agregador BNC.

## Ràdio (radioteca)

`search_radioteca(query=…)` cerca títol, descripció (inclou resum del que es va dir),
programa i subtítol; filtra per `publisher`, `year` (YYYY) o `type` (Episode/Program/Person).
Només s'indexa la data a nivell d'any: per un **dia concret**, filtra per any + paraules i
mira el camí `/YYYY/MM/DD/` de l'URL o el `subheading`.

## Regla d'or: mai fabriquis registres

- En subportals **search-guide** NO hi ha registres: dona a l'usuari l'URL del cercador i
  les pistes, **no inventis títols ni autors**.
- En subportals **native-handler**, cita només el que l'API ha retornat.
- Per a negocis, cases o entitats històriques a la premsa, recorda la lliçó de les
  hemeroteques: sovint no surten pel nom popular sinó pel **cognom del propietari**, i
  l'OCR té errates (prova variants de grafia d'època).

## Citació (obligatòria)

Cada registre amb la seva **font + URL**: per Catalònica, `url_resource` (o `url_catalonica`);
per radioteca, l'**URL absolut** de radioteca.cat — sempre com a enllaç clicable, mai
parafrasejat sense link. Indica la institució d'origen (MNAC, BNC, universitat, emissora).
Si una cerca no dona resultats, digues-ho i suggereix afinar el terme, no omplis el buit.
