#!/usr/bin/env node

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { searchDatasets, getDatasetInfo, getCategories } from "./api.js";
import { querySocrata } from "./clients/socrata.js";
import { queryCkan } from "./clients/ckan.js";
import { queryDiba } from "./clients/diba.js";
import { queryCido } from "./clients/cido.js";
import { queryOpendatasoft } from "./clients/opendatasoft.js";
import { decodeGtfsRt } from "./clients/gtfsrt.js";
import { queryIdescat } from "./clients/idescat.js";

const INSTRUCTIONS = `Servidor MCP de dades obertes de Catalunya. Pots consultar dades reals directament amb query_dataset si coneixes el dataset_id.

DATASETS DESTACATS (pots fer query_dataset directament sense cercar):
- generalitat:gn9e-3qhr → Embassaments: volum, % ple, per estació
- generalitat:i5n8-43cw → Estat de sequera per municipi
- generalitat:rmgc-ncpb → Accidents de trànsit amb morts o ferits greus
- generalitat:jq8m-d7cw → Incidents operatius gestionats pel CAT 112
- generalitat:mfqb-sbx4 → Trucades operatives gestionades pel CAT 112
- generalitat:g2ay-3vnj → Actuacions dels Bombers de la Generalitat
- generalitat:j6ii-t3w2 → Certificats d'eficiència energètica d'edificis
- fgc:vehicle-positions-gtfs_realtime → Posició GPS dels trens FGC en temps real
- fgc:alerts-gtfs_realtime → Alertes de servei FGC en temps real
- fgc:trip-updates-gtfs_realtime → Retards dels trens FGC en temps real
- idescat:m10328 → Població de Catalunya
- idescat:m10234 → Confiança empresarial
- barcelona:accidents-gu-bcn → Accidents gestionats per la Guàrdia Urbana BCN

DADES MUNICIPALS (filtra per NOM_ENS amb query_dataset):
- aoc:ge-ge-cost-efectiu-serveis-minhap → Cost dels serveis de +1.000 municipis
- aoc:ge-p-pressupostos-i-plantilles → Pressupostos i plantilles municipals
- aoc:ge-ge-endeutament → Endeutament municipal
- aoc:ge-p-liquidacions-per-programes-detallat → Liquidació pressupostos per programes
- aoc:ge-ge-termini-pagament-proveidors → Termini pagament a proveïdors

PORTALS: generalitat (Socrata), barcelona (CKAN), diba (REST), aoc (CKAN), reus (CKAN), girona (CKAN), fgc (Opendatasoft+GTFS-RT), idescat (API indicadors)
Usa search_datasets per temes que no siguin als destacats. Fes múltiples cerques amb termes diferents per cobrir temes amplis.`;

const server = new McpServer(
  { name: "opendata-cat", version: "0.1.1" },
  { instructions: INSTRUCTIONS },
);

// Tool 1: search_datasets
server.tool(
  "search_datasets",
  "Cerca datasets per text lliure. Mira primer les instructions del servidor: molts datasets es poden consultar directament amb query_dataset sense cercar. Usa search_datasets només quan no saps quin dataset necessites.",
  {
    query: z.string().describe("Text de cerca (ex: 'qualitat aire', 'pressupostos')"),
    portal: z.string().optional().describe("Filtrar per portal: 'generalitat', 'barcelona', 'diba', 'aoc', 'reus', 'girona', 'fgc', 'idescat'"),
    category: z.string().optional().describe("Filtrar per categoria"),
    limit: z.number().optional().default(20).describe("Nombre màxim de resultats (defecte: 20)"),
  },
  async ({ query, portal, category, limit }) => {
    const result = await searchDatasets(query, portal, category, limit);
    const queryableTypes = new Set(["socrata", "ckan", "opendatasoft", "idescat", "diba", "diba_cido"]);
    const enriched = {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        queryable: queryableTypes.has(item.api_type),
      })),
    };
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(enriched, null, 2),
      }],
    };
  },
);

// Tool 2: get_dataset_info
server.tool(
  "get_dataset_info",
  "Retorna totes les metadades d'un dataset: camps, tipus, descripció, endpoint API, llicència.",
  {
    dataset_id: z.string().describe("ID del dataset (ex: 'generalitat:gn9e-3qhr')"),
  },
  async ({ dataset_id }) => {
    const dataset = await getDatasetInfo(dataset_id);
    if (!dataset) {
      return { content: [{ type: "text" as const, text: `Dataset '${dataset_id}' no trobat.` }] };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(dataset, null, 2) }] };
  },
);

// Tool 3: list_dataset_fields
server.tool(
  "list_dataset_fields",
  "Llista els camps d'un dataset amb el seu nom, tipus i descripció.",
  {
    dataset_id: z.string().describe("ID del dataset"),
  },
  async ({ dataset_id }) => {
    const dataset = await getDatasetInfo(dataset_id);
    if (!dataset) {
      return { content: [{ type: "text" as const, text: `Dataset '${dataset_id}' no trobat.` }] };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(dataset.fields, null, 2) }] };
  },
);

// Tool 4: query_dataset
server.tool(
  "query_dataset",
  "Consulta dades reals d'un dataset. Mira les instructions per dataset_ids destacats. Per dades municipals, usa filters: {\"NOM_ENS\": \"Ajuntament de X\"} amb els datasets aoc:ge-*.",
  {
    dataset_id: z.string().describe("ID del dataset (ex: 'generalitat:gn9e-3qhr' per embassaments, 'aoc:ge-ge-cost-efectiu-serveis-minhap' per cost serveis municipal)"),
    filters: z.record(z.string(), z.string()).optional().describe("Filtres clau-valor (ex: {\"ciutat\": \"Barcelona\"})"),
    search: z.string().optional().describe("Cerca de text lliure dins el dataset"),
    limit: z.number().optional().default(20).describe("Files a retornar (defecte: 20, màxim: 100)"),
    offset: z.number().optional().default(0).describe("Desplaçament per paginació"),
  },
  async ({ dataset_id, filters, search, limit, offset }) => {
    const dataset = await getDatasetInfo(dataset_id);
    if (!dataset) {
      return { content: [{ type: "text" as const, text: `Dataset '${dataset_id}' no trobat.` }] };
    }

    // Datasets no queryables: retornar enllaç directe
    if (dataset.api_type === "file_download" || dataset.api_type === "restricted") {
      const msg = dataset.api_type === "restricted"
        ? `Aquest dataset requereix autenticació (token). Accedeix-hi directament:`
        : `Aquest dataset no té API de consulta. Descarrega'l directament:`;
      return {
        content: [{
          type: "text" as const,
          text: `${msg}\n${dataset.api_endpoint}\n\nFormats disponibles: ${dataset.formats.join(", ")}`,
        }],
      };
    }

    try {
      let results: Record<string, unknown>[];

      if (dataset.api_type === "socrata") {
        results = await querySocrata(dataset.api_endpoint, filters, search, limit, offset);
      } else if (dataset.api_type === "diba") {
        const data = await queryDiba(dataset.api_endpoint, filters, search, limit, offset);
        results = data.elements;
      } else if (dataset.api_type === "diba_cido") {
        const data = await queryCido(dataset.api_endpoint, filters, search, limit, offset);
        results = data.data;
      } else if (dataset.api_type === "ckan") {
        const data = await queryCkan(dataset.api_endpoint, filters, search, limit, offset);
        results = data.records;
      } else if (dataset.api_type === "opendatasoft") {
        const data = await queryOpendatasoft(dataset.api_endpoint, filters, search, limit, offset);
        // Detect and decode GTFS-RT protobuf files
        const first = data.records[0] as Record<string, unknown> | undefined;
        const fileField = first?.file as { filename?: string } | undefined;
        if (fileField?.filename?.endsWith(".pb") || fileField?.filename?.endsWith(".pbf")) {
          const decoded = await decodeGtfsRt(dataset.api_endpoint, limit);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                dataset: dataset.name,
                format: "GTFS Realtime",
                type: decoded.type,
                total_entities: decoded.count,
                count: decoded.data.length,
                data: decoded.data,
              }, null, 2),
            }],
          };
        }
        results = data.records;
      } else if (dataset.api_type === "idescat") {
        const data = await queryIdescat(dataset.api_endpoint);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              dataset: dataset.name,
              portal: "Idescat",
              count: data.count,
              data: data.indicators,
            }, null, 2),
          }],
        };
      } else {
        return {
          content: [{
            type: "text" as const,
            text: `Tipus d'API '${dataset.api_type}' no suportat per consulta directa.\nAccedeix al dataset: ${dataset.api_endpoint}`,
          }],
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ dataset: dataset.name, count: results.length, data: results }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error consultant ${dataset.name}: ${err instanceof Error ? err.message : String(err)}`,
        }],
      };
    }
  },
);

// Tool 5: list_portals
server.tool(
  "list_portals",
  "Llista els portals de dades obertes catalans disponibles amb estadístiques.",
  {},
  async () => {
    const portals = [
      { id: "generalitat", name: "Generalitat de Catalunya", url: "https://analisi.transparenciacatalunya.cat", api: "Socrata" },
      { id: "barcelona", name: "Ajuntament de Barcelona", url: "https://opendata-ajuntament.barcelona.cat", api: "CKAN" },
      { id: "diba", name: "Diputació de Barcelona", url: "https://dadesobertes.diba.cat", api: "CKAN" },
      { id: "aoc", name: "Consorci AOC (diputacions, ajuntaments, consells comarcals)", url: "https://dadesobertes.seu-e.cat", api: "CKAN" },
      { id: "reus", name: "Ajuntament de Reus", url: "https://opendata.reus.cat", api: "CKAN" },
      { id: "girona", name: "Ajuntament de Girona", url: "https://www.girona.cat/opendata/", api: "CKAN" },
      { id: "fgc", name: "Ferrocarrils de la Generalitat de Catalunya", url: "https://dadesobertes.fgc.cat", api: "Opendatasoft" },
      { id: "idescat", name: "Idescat (Institut d'Estadística de Catalunya)", url: "https://www.idescat.cat", api: "Idescat API" },
    ];

    const cats = await getCategories();
    const portalCounts = new Map(cats.portals.map((p) => [p.portal_id, p.total]));

    const result = portals.map((p) => ({
      ...p,
      dataset_count: portalCounts.get(p.id) ?? 0,
    }));

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// Tool 6: list_categories
server.tool(
  "list_categories",
  "Llista totes les categories i temes de datasets disponibles amb comptadors per portal. Útil per saber quins tipus de dades hi ha.",
  {},
  async () => {
    const cats = await getCategories();
    return { content: [{ type: "text" as const, text: JSON.stringify(cats, null, 2) }] };
  },
);

// Tool 7: related_datasets
server.tool(
  "related_datasets",
  "Retorna datasets relacionats d'ALTRES portals. Ideal per descobrir dades complementàries.",
  {
    dataset_id: z.string().describe("ID del dataset del qual vols trobar relacionats"),
  },
  async ({ dataset_id }) => {
    const dataset = await getDatasetInfo(dataset_id);
    if (!dataset) {
      return { content: [{ type: "text" as const, text: `Dataset '${dataset_id}' no trobat.` }] };
    }
    // Fetch related from API (stored in DB by enrichment script)
    const resp = await fetch(`https://opendata.cat/api/dataset.php?id=${encodeURIComponent(dataset_id)}`);
    if (!resp.ok) {
      return { content: [{ type: "text" as const, text: "Error obtenint relacions." }] };
    }
    const full = await resp.json();
    const related = full.related ?? [];
    if (!related.length) {
      return { content: [{ type: "text" as const, text: `No hi ha datasets relacionats per a '${dataset.name}'.` }] };
    }
    // Enrich with names
    const details = await Promise.all(
      related.slice(0, 5).map(async (r: { id: string; score: number }) => {
        const info = await getDatasetInfo(r.id);
        return info ? { dataset_id: r.id, name: info.name, portal: info.portal_id, category: info.category, similarity: r.score } : null;
      }),
    );
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ dataset: dataset.name, related: details.filter(Boolean) }, null, 2),
      }],
    };
  },
);

// ===== PROMPTS =====

server.prompt(
  "estat_embassaments",
  "Analitza l'estat actual dels embassaments de Catalunya amb gràfiques d'evolució.",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Consulta l'estat actual dels embassaments de les Conques Internes de Catalunya.\n\n"
          + "1. Usa search_datasets amb 'embassament' per trobar el dataset rellevant\n"
          + "2. Usa query_dataset per obtenir les últimes dades\n"
          + "3. Presenta una taula amb cada embassament: nom, volum actual (hm³), percentatge ple, i variació\n"
          + "4. Genera un gràfic ASCII o Markdown amb l'evolució dels nivells\n"
          + "5. Destaca embassaments en situació crítica (< 40%) i els que estan millor\n"
          + "6. Compara amb el dataset d'estat de sequera si n'hi ha\n\n"
          + "Mostra les dades de forma visual i fàcil d'entendre.",
      },
    }],
  }),
);

server.prompt(
  "trens_fgc_temps_real",
  "Consulta l'estat dels trens de FGC en temps real: retards, alertes i posicions.",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Consulta l'estat en temps real dels trens de Ferrocarrils de la Generalitat de Catalunya (FGC).\n\n"
          + "1. Usa search_datasets amb portal 'fgc' per trobar els datasets GTFS Realtime\n"
          + "2. Consulta 'trip-updates' per veure retards actuals\n"
          + "3. Consulta 'vehicle-positions' per veure on són els trens\n"
          + "4. Consulta 'alerts' per veure si hi ha alertes de servei\n\n"
          + "Presenta un resum clar:\n"
          + "- Trens amb retard (quants minuts, quina línia)\n"
          + "- Alertes actives de servei\n"
          + "- Estat general: normal / amb incidències / interromput",
      },
    }],
  }),
);

server.prompt(
  "qualitat_aire",
  "Analitza la qualitat de l'aire a una estació o municipi de Catalunya.",
  { lloc: z.string().optional().describe("Nom del municipi o estació (ex: 'Barcelona', 'Sabadell')") },
  ({ lloc }) => {
    const filtreText = lloc ? ` a ${lloc}` : " a les principals estacions";
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analitza la qualitat de l'aire${filtreText}.\n\n`
            + "1. Usa search_datasets amb 'qualitat aire contaminació' per trobar els datasets rellevants\n"
            + "2. Consulta les últimes mesures disponibles"
            + (lloc ? ` filtrant per '${lloc}'` : "") + "\n"
            + "3. Presenta els nivells de: NO₂, PM10, PM2.5, O₃, SO₂ (els que hi hagi)\n"
            + "4. Compara amb els llindars de l'OMS i la normativa UE\n"
            + "5. Dona una valoració global: bona / acceptable / dolenta / molt dolenta\n"
            + "6. Si hi ha dades històriques, mostra la tendència recent\n\n"
            + "Usa taules i indicadors visuals per fer-ho entenedor.",
        },
      }],
    };
  },
);

server.prompt(
  "accidents_transit",
  "Analitza les dades d'accidents de trànsit a Catalunya o a un municipi concret.",
  { municipi: z.string().optional().describe("Nom del municipi (ex: 'Barcelona', 'Hospitalet')") },
  ({ municipi }) => {
    const filtreText = municipi ? ` a ${municipi}` : " a Catalunya";
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analitza les dades d'accidents de trànsit${filtreText}.\n\n`
            + "1. Usa search_datasets amb 'accidents trànsit" + (municipi ? ` ${municipi}` : "") + "'\n"
            + "2. Consulta les dades més recents\n"
            + "3. Presenta: nombre total d'accidents, distribució per gravetat (mortals, ferits greus, lleus)\n"
            + "4. Si hi ha dades geolocalitzades, identifica els punts negres\n"
            + "5. Analitza tendències: augmenten o disminueixen?\n"
            + "6. Busca datasets relacionats amb related_datasets per completar l'anàlisi\n\n"
            + "Presenta conclusions clares amb dades concretes.",
        },
      }],
    };
  },
);

server.prompt(
  "pressupostos_municipals",
  "Explora i compara els pressupostos municipals d'ajuntaments catalans.",
  { municipi: z.string().optional().describe("Nom del municipi") },
  ({ municipi }) => {
    const filtreText = municipi ? ` de ${municipi}` : "";
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Explora els pressupostos municipals${filtreText}.\n\n`
            + "1. Usa search_datasets amb 'pressupost" + (municipi ? ` ${municipi}` : " municipal") + "'\n"
            + "2. Consulta les últimes dades de pressupost disponibles\n"
            + "3. Desglossa: ingressos vs despeses, partides principals\n"
            + "4. Si hi ha dades multi-any, mostra l'evolució\n"
            + "5. Destaca les partides més grans i les variacions significatives\n\n"
            + "Presenta les xifres en format comprensible (milions €) amb taules.",
        },
      }],
    };
  },
);

server.prompt(
  "compara_municipis",
  "Compara dos municipis catalans en totes les dades obertes disponibles.",
  {
    municipi_a: z.string().describe("Primer municipi"),
    municipi_b: z.string().describe("Segon municipi"),
  },
  ({ municipi_a, municipi_b }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Compara els municipis de ${municipi_a} i ${municipi_b} amb totes les dades obertes disponibles.\n\n`
          + `1. Usa search_datasets per trobar datasets que incloguin '${municipi_a}'\n`
          + `2. Usa search_datasets per trobar datasets que incloguin '${municipi_b}'\n`
          + "3. Per cada tema comú (població, pressupost, equipaments, transport...), consulta les dades dels dos municipis\n"
          + "4. Presenta una taula comparativa amb les dades clau\n"
          + "5. Destaca les diferències més significatives\n\n"
          + "Organitza la comparativa per temes i indica la font de cada dada.",
      },
    }],
  }),
);

server.prompt(
  "descobreix_dades",
  "Explora quines dades obertes hi ha disponibles sobre un tema a Catalunya.",
  { tema: z.string().describe("Tema a explorar (ex: 'educació', 'medi ambient', 'turisme')") },
  ({ tema }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Explora totes les dades obertes disponibles sobre '${tema}' a Catalunya.\n\n`
          + `1. Usa search_datasets amb '${tema}' (limit: 50)\n`
          + "2. Agrupa els resultats per portal i categoria\n"
          + "3. Per als 3-5 datasets més rellevants, usa get_dataset_info per mostrar detalls (camps, tipus, actualització)\n"
          + "4. Usa related_datasets per descobrir dades complementàries\n"
          + "5. Suggereix 3 anàlisis interessants que es podrien fer creuant aquests datasets\n\n"
          + "L'objectiu és donar un mapa complet de quines dades existeixen i què es pot fer amb elles.",
      },
    }],
  }),
);

server.prompt(
  "analisi_bombers",
  "Analitza les actuacions dels Bombers de la Generalitat: tipus d'emergències, distribució territorial i tendències.",
  { comarca: z.string().optional().describe("Filtrar per comarca (ex: 'Barcelonès', 'Vallès Occidental')") },
  ({ comarca }) => {
    const filtreText = comarca ? ` a la comarca de ${comarca}` : "";
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analitza les actuacions dels Bombers de la Generalitat${filtreText}.\n\n`
            + "1. Usa search_datasets amb 'bombers actuacions emergències'\n"
            + "2. Consulta els datasets d'actuacions, GRAF i EAIC\n"
            + "3. Presenta: nombre total d'actuacions, distribució per tipus (incendis, rescats, inundacions...)\n"
            + "4. Si hi ha dades temporals, mostra estacionalitat (estiu = incendis?)\n"
            + "5. Identifica les zones amb més actuacions\n"
            + (comarca ? `6. Filtra específicament per la comarca de ${comarca}\n` : "")
            + "\nFes una anàlisi visual amb taules i percentatges.",
        },
      }],
    };
  },
);

// ===== PROMPTS DE DESCOBRIMENT =====

server.prompt(
  "novetats",
  "Mostra els datasets actualitzats més recentment als portals de dades obertes de Catalunya.",
  { portal: z.string().optional().describe("Filtrar per portal: generalitat, barcelona, diba, aoc, reus, girona, fgc") },
  ({ portal }) => {
    const filtreText = portal ? ` al portal ${portal}` : "";
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Mostra els datasets de dades obertes de Catalunya actualitzats més recentment${filtreText}.\n\n`
            + "1. Usa list_portals per veure els portals disponibles\n"
            + `2. Usa search_datasets amb termes generals${portal ? ` i portal '${portal}'` : ""} per obtenir datasets\n`
            + "3. Per als primers 10 resultats, usa get_dataset_info per veure la data d'última actualització (last_updated)\n"
            + "4. Ordena per data d'actualització (més recent primer)\n"
            + "5. Presenta una taula amb: nom, portal, categoria, última actualització, formats\n"
            + "6. Destaca els que s'han actualitzat en els últims 7 dies\n\n"
            + "L'objectiu és descobrir quines dades es mantenen actives i actualitzades.",
        },
      }],
    };
  },
);

server.prompt(
  "datasets_populars",
  "Mostra els datasets més consultats pels usuaris del MCP.",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Mostra els datasets de dades obertes de Catalunya més consultats pels usuaris.\n\n"
          + "1. Usa search_datasets amb termes populars: 'embassament', 'qualitat aire', 'transport', 'pressupost', 'població'\n"
          + "2. Per cada cerca, agafa el primer resultat i usa get_dataset_info per obtenir detalls\n"
          + "3. Presenta un rànquing dels datasets més rellevants amb:\n"
          + "   - Nom i portal\n"
          + "   - Descripció breu\n"
          + "   - Camps disponibles\n"
          + "   - Última actualització\n"
          + "4. Per al top 3, fes una consulta amb query_dataset (limit: 3) per mostrar una mostra de dades reals\n"
          + "5. Suggereix preguntes interessants que es podrien fer a cada dataset\n\n"
          + "L'objectiu és inspirar l'usuari amb les possibilitats de les dades obertes.",
      },
    }],
  }),
);

server.prompt(
  "explorar_portal",
  "Explora un portal de dades obertes: quants datasets té, categories, exemples de cada tipus.",
  { portal: z.string().describe("Portal a explorar: generalitat, barcelona, diba, aoc, reus, girona, fgc") },
  ({ portal }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Fes una exploració completa del portal de dades obertes '${portal}'.\n\n`
          + "1. Usa list_portals per obtenir el nombre total de datasets\n"
          + "2. Usa list_categories per veure les categories disponibles al portal\n"
          + `3. Usa search_datasets amb portal '${portal}' i limit 50 per veure tots els datasets\n`
          + "4. Agrupa-los per categoria i presenta una taula resum\n"
          + "5. Per a cada categoria, tria el dataset més interessant i usa get_dataset_info per mostrar-ne els camps\n"
          + "6. Destaca:\n"
          + "   - Datasets amb dades en temps real o actualització freqüent\n"
          + "   - Datasets amb molts camps (rics en dades)\n"
          + "   - Datasets únics que no es troben a altres portals\n\n"
          + "Presenta el portal com una guia completa per a un nou usuari.",
      },
    }],
  }),
);

server.prompt(
  "dades_municipi",
  "Descobreix totes les dades obertes disponibles sobre un municipi concret de Catalunya.",
  { municipi: z.string().describe("Nom del municipi (ex: 'Sabadell', 'Girona', 'Manresa')") },
  ({ municipi }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Descobreix totes les dades obertes disponibles sobre el municipi de ${municipi}.\n\n`
          + `1. Usa search_datasets amb '${municipi}' (limit: 50) per trobar tots els datasets\n`
          + "2. Agrupa per portal i categoria\n"
          + "3. Per als datasets més rellevants, usa get_dataset_info per veure detalls\n"
          + "4. Fes query_dataset (limit: 3) als 2-3 datasets més interessants per mostrar dades reals\n"
          + "5. Usa related_datasets per trobar dades complementàries d'altres portals\n"
          + "6. Presenta un resum en format fitxa municipal:\n"
          + "   - Població (si hi ha dades)\n"
          + "   - Pressupost (si hi ha dades)\n"
          + "   - Equipaments, transport, medi ambient...\n"
          + `   - Què falta: quins temes no tenen dades obertes\n\n`
          + `L'objectiu és donar un retrat complet de ${municipi} a través de les dades obertes.`,
      },
    }],
  }),
);

server.prompt(
  "datasets_temps_real",
  "Llista els datasets que ofereixen dades en temps real o actualització freqüent.",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Descobreix quins datasets de dades obertes de Catalunya ofereixen dades en temps real o actualització molt freqüent.\n\n"
          + "1. Usa search_datasets amb termes com 'temps real', 'GTFS', 'realtime' per trobar datasets en viu\n"
          + "2. Usa search_datasets amb portal 'fgc' per trobar dades de transport en temps real\n"
          + "3. Usa search_datasets amb 'qualitat aire estacions' per trobar mesures en directe\n"
          + "4. Usa search_datasets amb 'embassament' i 'cabal' per trobar dades hídriques en viu\n"
          + "5. Per cada dataset trobat, usa get_dataset_info per verificar la freqüència d'actualització\n"
          + "6. Presenta una llista organitzada per tema:\n"
          + "   - Transport: trens FGC, trànsit, bicing...\n"
          + "   - Medi ambient: aire, aigua, meteorologia...\n"
          + "   - Altres en temps real\n"
          + "7. Per als 3 més interessants, fes query_dataset per mostrar les últimes dades\n\n"
          + "L'objectiu és que l'usuari sàpiga quines dades pot consultar 'ara mateix'.",
      },
    }],
  }),
);

server.prompt(
  "resum_portals",
  "Resum general de tots els portals: quants datasets, quins temes, quins formats.",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Fes un resum complet de tots els portals de dades obertes de Catalunya.\n\n"
          + "1. Usa list_portals per obtenir la llista amb comptadors\n"
          + "2. Usa list_categories per veure les categories de cada portal\n"
          + "3. Presenta una taula comparativa:\n"
          + "   - Nom del portal, URL, nombre de datasets\n"
          + "   - Tipus d'API (Socrata, CKAN, REST, Opendatasoft)\n"
          + "   - Categories principals\n"
          + "   - Tipus de dades destacades\n"
          + "4. Per cada portal, destaca el dataset més singular o interessant\n"
          + "5. Indica quins portals tenen dades en temps real\n"
          + "6. Suggereix per a cada portal una pregunta interessant que es podria respondre amb les seves dades\n\n"
          + "L'objectiu és donar una visió panoràmica de l'ecosistema de dades obertes català.",
      },
    }],
  }),
);

async function main() {
  const mode = process.argv.includes("--http") ? "http" : "stdio";
  const port = parseInt(process.env.MCP_PORT || "3100", 10);

  if (mode === "http") {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

      // Health check
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", name: "opendata-cat", version: "0.1.1" }));
        return;
      }

      // MCP endpoint
      if (req.url === "/mcp") {
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    await server.connect(transport);
    httpServer.listen(port, () => {
      console.log(`MCP HTTP server running on port ${port}`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch(console.error);
