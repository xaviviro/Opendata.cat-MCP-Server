<p align="center">
  <img src="banner.png" alt="Opendata.cat MCP Server — Connecta el teu LLM amb les dades obertes de Catalunya" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@opendata.cat/mcp-server"><img src="https://img.shields.io/npm/v/@opendata.cat/mcp-server?color=c44536&label=npm" alt="npm"></a>
  <a href="https://www.npmjs.com/package/@opendata.cat/mcp-server"><img src="https://img.shields.io/npm/dm/@opendata.cat/mcp-server?color=c44536&label=downloads" alt="npm downloads"></a>
  <a href="https://github.com/xaviviro/Opendata.cat-MCP-Server"><img src="https://img.shields.io/github/v/tag/xaviviro/Opendata.cat-MCP-Server?label=github&color=1a1a1a" alt="github"></a>
  <a href="https://opendata.cat/mcp"><img src="https://img.shields.io/badge/web-opendata.cat%2Fmcp-c9a227" alt="web"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green" alt="license"></a>
</p>

# Opendata.cat MCP Server

Servidor [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) que connecta els models de llenguatge (Claude, ChatGPT, Gemini...) amb les **dades obertes publiques de Catalunya**. Cerca datasets, explora metadades i consulta dades reals de 13 portals directament des del teu assistent d'IA.

Un projecte d'**[opendata.cat](https://opendata.cat)** — associacio sense anim de lucre fundada el 2012 que promou la transparencia, la difusio i l'estandarditzacio de les dades obertes a Catalunya. Inspirat en el projecte [datagouv-mcp](https://github.com/datagouv/datagouv-mcp) del govern frances.

## Portals disponibles

### Portals catalans

| Portal | Datasets | API |
|--------|----------|-----|
| [Generalitat de Catalunya](https://analisi.transparenciacatalunya.cat) | 1.059 | Socrata (SoQL) |
| [Consorci AOC](https://dadesobertes.seu-e.cat) | ~887 | CKAN datastore |
| [Ajuntament de Barcelona](https://opendata-ajuntament.barcelona.cat) | 555 | CKAN datastore |
| [Idescat](https://www.idescat.cat) | 138 | Idescat API |
| [Ajuntament de Reus](https://opendata.reus.cat) | 119 | CKAN datastore |
| [Diputacio de Barcelona](https://dadesobertes.diba.cat) | 90 | REST + JSON:API (CIDO) |
| [Ajuntament de Girona](https://www.girona.cat/opendata/) | 53 | CKAN datastore |
| [FGC (Ferrocarrils)](https://dadesobertes.fgc.cat) | 50 | Opendatasoft + GTFS-RT |
| [Renfe Rodalies](https://data.renfe.com) | 6 | CKAN + GTFS-RT JSON |

### Fonts estatals amb focus Catalunya

| Font | Datasets | Que aporta |
|------|----------|-----------|
| [INE](https://www.ine.es) | 6 | Poblacio, IPC, EPA (atur/ocupacio), turisme, PIB, habitatge — auto-filtrat a Catalunya |
| [Red Electrica (REE)](https://www.ree.es) | 4 | Generacio electrica (mix energetic), demanda, balanc, preus PVPC temps real |
| [SEPE](https://sepe.es) | 2 | Atur registrat i contractes per municipis catalans |
| [CNMC / Ministeri](https://datos.gob.es) | 1 | Preus carburants a ~1.500 gasolineres de Catalunya, filtrables per municipi |

**+2.850 datasets** de 13 portals. La majoria queryables amb filtres, cerca i paginacio.

El cataleg s'actualitza automaticament cada setmana. Crawling incremental amb `--portal` per carregar fonts noves sense re-escanejar tot.

**Tipus d'acces:**
- **Socrata**: consulta SoQL amb filtres i cerca (Generalitat)
- **CKAN**: datastore_search amb filtres i cerca (Barcelona, AOC, Reus, Girona, Renfe)
- **Diba REST**: API do.diba.cat amb paginacio i filtres (Diputacio BCN)
- **CIDO JSON:API**: api.diba.cat per contractacions, normatives, subvencions (Diputacio BCN)
- **Opendatasoft**: API records amb filtres i cerca (FGC)
- **GTFS-RT**: posicions GPS, alertes i retards dels trens FGC i Renfe Rodalies en temps real
- **Idescat**: indicadors estadistics amb series temporals
- **INE**: estadistica oficial d'Espanya filtrada automaticament a Catalunya
- **REE**: generacio electrica, demanda i preus de l'electricitat (PVPC) en temps real
- **CNMC**: preus de carburants per estacio de servei, filtrables per CCAA/provincia/municipi
- **GIS**: simplificacio automatica de geometries (centroide + bbox)
- **Dades municipals AOC**: 9 datasets amb dades de +1.000 municipis, filtrables per NOM_ENS

## Installacio rapida

### Claude Desktop

Afegeix al fitxer de configuracio (`~/Library/Application Support/Claude/claude_desktop_config.json` a macOS o `%APPDATA%\Claude\claude_desktop_config.json` a Windows):

```json
{
  "mcpServers": {
    "opendata-cat": {
      "command": "npx",
      "args": ["-y", "@opendata.cat/mcp-server"]
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add opendata-cat -- npx -y @opendata.cat/mcp-server
```

### VS Code / Cursor

Afegeix al fitxer `.vscode/mcp.json` del teu projecte:

```json
{
  "servers": {
    "opendata-cat": {
      "command": "npx",
      "args": ["-y", "@opendata.cat/mcp-server"]
    }
  }
}
```

### Windsurf / Cline / JetBrains / Gemini CLI / Warp / ChatGPT / Copilot Studio

Consulta la guia completa amb instruccions per a **13 clients MCP** a **[opendata.cat/mcp](https://opendata.cat/mcp)**.

Tambe pots connectar directament via **Streamable HTTP** sense instal·lar res:

```
https://opendata.cat/api/mcp
```

## Tools disponibles

| Tool | Descripcio |
|------|-----------|
| `search_datasets` | Cerca datasets per text lliure al cataleg de +2.850 datasets |
| `get_dataset_info` | Retorna metadades completes: camps, tipus, llicencia, endpoint |
| `list_dataset_fields` | Llista els camps d'un dataset amb nom, tipus i descripcio |
| `query_dataset` | Consulta dades reals directament al portal origen |
| `list_portals` | Llista els 13 portals disponibles amb estadistiques |
| `list_categories` | Llista categories i temes disponibles amb comptadors |
| `related_datasets` | Retorna datasets relacionats d'altres portals |

### search_datasets

Cerca datasets per text lliure.

```
query: "qualitat aire"
portal: "barcelona"        # opcional: generalitat, barcelona, diba, aoc, reus, girona, fgc, idescat, renfe, ine, ree, sepe, cnmc
category: "Medi Ambient"   # opcional
limit: 20                  # opcional (defecte: 20)
```

### query_dataset

Executa una consulta directament contra el portal origen i retorna dades reals.

```
dataset_id: "generalitat:gn9e-3qhr"
filters: {"estaci": "Sau"}   # opcional
search: "embassament"         # opcional
limit: 20                     # opcional (defecte: 20, max: 100)
offset: 0                     # opcional
```

Exemples de filtres per fonts estatals:
- INE: auto-filtrat a Catalunya (poblacio, IPC, turisme...)
- REE: `ree:preus-electricitat` — preus PVPC per hora
- CNMC: `filters: {"municipi": "Sabadell"}` — gasolineres de Sabadell

## Exemples d'us

Un cop configurat, pots fer preguntes al teu LLM com:

- *"Quin es l'estat dels embassaments de Catalunya?"*
- *"Hi ha algun tren de Rodalies o FGC amb retard ara mateix?"*
- *"Quina es la poblacio de Catalunya segons l'INE?"*
- *"Quin es el preu de la gasolina a Sabadell avui?"*
- *"Quant costa l'electricitat ara? (PVPC)"*
- *"Analitza la qualitat de l'aire a Terrassa"*
- *"Quina es la taxa d'atur a Catalunya?"*
- *"Quantes pernoctacions turistiques hi ha a Barcelona?"*
- *"Compara Girona i Tarragona en dades obertes"*
- *"Dona'm les ultimes dades de pressupostos de Reus"*
- *"Quin es l'endeutament de Tiana?"*

## Com funciona

```
Usuari → LLM → MCP opendata.cat → API opendata.cat (cataleg)
                                 → Portal origen (dades reals)
```

1. L'MCP consulta l'[API d'opendata.cat](https://opendata.cat) per descobrir datasets rellevants
2. Quan l'usuari vol dades concretes, l'MCP fa la consulta directament al portal origen
3. Les dades tornen a l'LLM, que les interpreta i presenta a l'usuari

No emmagatzema ni fa de proxy de dades. Cada consulta va directament a la font oficial.

## API REST

A mes del servidor MCP, opendata.cat ofereix una API REST publica:

| Endpoint | Descripcio |
|----------|-----------|
| `GET /api/all-datasets.php` | Llistat complet amb paginacio, filtres i sort |
| `GET /api/datasets.php?q=...` | Cerca datasets per text lliure |
| `GET /api/dataset.php?id=...` | Detall complet d'un dataset |
| `GET /api/categories.php` | Categories i portals amb comptadors |
| `POST /api/mcp` | Servidor MCP (Streamable HTTP) |

Documentacio interactiva (Swagger): **[opendata.cat/api/docs.html](https://opendata.cat/api/docs.html)**

## Sobre opendata.cat

[opendata.cat](https://opendata.cat) es una associacio catalana sense anim de lucre fundada el 2012 (registre 47468) dedicada a promoure la transparencia i l'acces a la informacio publica.

## Changelog

### v0.3.0 (2026-04-16)
- 5 noves fonts estatals espanyoles amb focus Catalunya: INE, REE, SEPE, CNMC
- Handler INE: estadistica oficial (poblacio, IPC, EPA, turisme, PIB, habitatge) auto-filtrat a Catalunya
- Handler REE: generacio electrica, demanda, balanc, preus PVPC en temps real
- Handler CNMC: preus carburants amb filtres per CCAA/provincia/municipi via API REST
- Crawler incremental: flag `--portal` per carregar fonts noves sense re-escanejar tot
- 13 portals, 2.857 datasets

### v0.2.0 (2026-04-15)
- Nou portal Renfe (Rodalies de Catalunya) — 6 datasets (estacions, viatgers, GTFS-RT temps real)
- Handler GTFS-RT JSON amb filtre automatic a rutes Rodalies Barcelona (R1-R16, RT, RG, RL)
- Instruccions reescrites en angles per millorar comprensio dels LLMs
- Llistats de portals, keywords i categories a les instruccions
- Tool descriptions i prompts traduits a angles
- Nou prompt trens_rodalies_temps_real

### v0.1.2 (2026-04-14)
- Instructions integrades: l'LLM rep datasets destacats i pot fer query directe sense cercar
- Fix Idescat: ara retorna l'indicador especific en lloc de 6 aleatoris
- 9 datasets municipals AOC: pressupostos, cost serveis, endeutament de +1.000 municipis

### v0.1.0 (2026-04-14)
- Nou portal Idescat — 138 indicadors estadistics amb series temporals
- Portals Reus i Girona

### v0.0.17 (2026-04-14)
- Decodificador GTFS-RT integrat: trens FGC en temps real
- API REST documentada amb Swagger UI (OpenAPI 3.1)

### v0.0.10 (2026-04-13)
- Portal FGC (50 datasets via Opendatasoft)
- 14 prompts predefinits

### v0.0.1 (2026-04-12)
- Versio inicial: Generalitat, Barcelona, Diba, AOC — 6 tools, npm

## Llicencia

MIT
