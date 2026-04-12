<p align="center">
  <img src="banner.png" alt="Opendata.cat MCP Server — Connecta el teu LLM amb les dades obertes de Catalunya" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@opendata.cat/mcp-server"><img src="https://img.shields.io/npm/v/@opendata.cat/mcp-server?color=c44536&label=npm" alt="npm"></a>
  <a href="https://github.com/xaviviro/Opendata.cat-MCP-Server"><img src="https://img.shields.io/github/v/tag/xaviviro/Opendata.cat-MCP-Server?label=github&color=1a1a1a" alt="github"></a>
  <a href="https://opendata.cat/mcp"><img src="https://img.shields.io/badge/web-opendata.cat%2Fmcp-c9a227" alt="web"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green" alt="license"></a>
</p>

# Opendata.cat MCP Server

Servidor [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) que connecta els models de llenguatge (Claude, ChatGPT, Gemini...) amb les **dades obertes publiques de Catalunya**. Cerca datasets, explora metadades i consulta dades reals de la Generalitat, l'Ajuntament de Barcelona i la Diputacio de Barcelona directament des del teu assistent d'IA.

Un projecte d'**[opendata.cat](https://opendata.cat)** — associacio sense anim de lucre fundada el 2012 que promou la transparencia, la difusio i l'estandarditzacio de les dades obertes a Catalunya.

## Portals disponibles

| Portal | Datasets | API | Dades |
|--------|----------|-----|-------|
| [Generalitat de Catalunya](https://analisi.transparenciacatalunya.cat) | ~1.058 | Socrata | Medi ambient, salut, educacio, economia, transport... |
| [Ajuntament de Barcelona](https://opendata-ajuntament.barcelona.cat) | ~555 | CKAN | Urbanisme, mobilitat, cultura, demografia, pressupostos... |
| [Diputacio de Barcelona](https://dadesobertes.diba.cat) | ~90 | CKAN | Municipis, equipaments, patrimoni, energia, territori... |

El cataleg s'actualitza automaticament cada setmana.

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

## Tools disponibles

| Tool | Descripcio |
|------|-----------|
| `search_datasets` | Cerca datasets per text lliure al cataleg |
| `get_dataset_info` | Retorna metadades completes: camps, tipus, llicencia, endpoint |
| `list_dataset_fields` | Llista els camps d'un dataset amb nom, tipus i descripcio |
| `query_dataset` | Consulta dades reals directament al portal origen |
| `list_portals` | Llista els portals disponibles amb estadistiques |
| `list_categories` | Llista categories i temes disponibles amb comptadors |

### search_datasets

Cerca datasets per text lliure.

```
query: "qualitat aire"
portal: "barcelona"        # opcional: generalitat, barcelona, diba
category: "Medi Ambient"   # opcional
limit: 20                  # opcional (defecte: 20)
```

### get_dataset_info

Retorna totes les metadades d'un dataset.

```
dataset_id: "generalitat:gn9e-3qhr"
```

### list_dataset_fields

Llista els camps d'un dataset amb nom, tipus i descripcio.

```
dataset_id: "generalitat:gn9e-3qhr"
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

### list_portals

Llista els portals disponibles amb el nombre de datasets de cadascun. No requereix parametres.

### list_categories

Llista totes les categories i temes de datasets disponibles amb comptadors per portal. Ideal per descobrir quins tipus de dades hi ha.

## Exemples d'us

Un cop configurat, pots fer preguntes al teu LLM com:

- *"Quins datasets hi ha sobre mobilitat a Barcelona?"*
- *"Mostra'm les dades de qualitat de l'aire d'ahir"*
- *"Quants equipaments culturals te Girona?"*
- *"Dona'm les ultimes dades de pressupostos municipals"*
- *"Quin es l'estat dels embassaments de Catalunya?"*
- *"Quines dades obertes hi ha sobre educacio a Catalunya?"*
- *"Quins tipus de dades teniu disponibles?"*

## Com funciona

```
Usuari → LLM → MCP opendata.cat → API opendata.cat (cataleg)
                                 → Portal origen (dades reals)
```

1. L'MCP consulta l'[API d'opendata.cat](https://opendata.cat) per descobrir datasets rellevants
2. Quan l'usuari vol dades concretes, l'MCP fa la consulta directament al portal origen (Socrata o CKAN)
3. Les dades tornen a l'LLM, que les interpreta i presenta a l'usuari

No emmagatzema ni fa de proxy de dades. Cada consulta va directament a la font oficial.

## Sobre opendata.cat

[opendata.cat](https://opendata.cat) es una associacio catalana sense anim de lucre fundada el 2012 (registre 47468) dedicada a promoure la transparencia i l'acces a la informacio publica. Treballa en tres eixos: **estandarditzacio** de formats i protocols, **formacio** especialitzada per a professionals i administracions, i **collaboracio** publico-privada per a l'obertura de dades.

## Contribuir

Les contribucions son benvingudes! Per afegir un nou portal de dades obertes:

1. Obre una [issue](https://github.com/xaviviro/Opendata.cat-MCP-Server/issues) amb la URL del portal i el tipus d'API
2. O envia un pull request

## Llicencia

MIT
