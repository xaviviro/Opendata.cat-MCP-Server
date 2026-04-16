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

const INSTRUCTIONS = `Catalan open data MCP server. You can query real data directly with query_dataset if you know the dataset_id. Always respond in the user's language.

FEATURED DATASETS (use query_dataset directly, no search needed):
- generalitat:gn9e-3qhr → Embassaments (reservoirs): fields dia, estaci, volum_embassat, percentatge_volum_embassat, nivell_absolut
- generalitat:i5n8-43cw → Estat de sequera per municipi (drought status by municipality)
- generalitat:rmgc-ncpb → Accidents de trànsit amb morts o ferits greus (traffic accidents with deaths/serious injuries)
- generalitat:jq8m-d7cw → Incidents operatius gestionats pel CAT 112 (112 emergency incidents)
- generalitat:mfqb-sbx4 → Trucades operatives gestionades pel CAT 112 (112 emergency calls)
- generalitat:g2ay-3vnj → Actuacions dels Bombers de la Generalitat (firefighter operations)
- generalitat:j6ii-t3w2 → Certificats d'eficiència energètica d'edificis (building energy certificates)
- fgc:vehicle-positions-gtfs_realtime → FGC train GPS positions (real-time)
- fgc:alerts-gtfs_realtime → FGC service alerts (real-time, in Catalan)
- fgc:trip-updates-gtfs_realtime → FGC train delays (real-time)
- renfe:vehicle-positions-gtfsrt → Rodalies Barcelona train GPS positions (real-time)
- renfe:trip-updates-gtfsrt → Rodalies Barcelona train delays (real-time)
- renfe:alerts-gtfsrt → Rodalies Barcelona service alerts (real-time, in Spanish)
- aemet:observacio-convencional → Real-time weather: temperature, rain, wind (~80 stations in Catalonia)
- aemet:prediccio-municipis → 7-day weather forecast for any municipality (filter by codiINE)
- ine:poblacio-municipis → Population by municipality from INE (national census)
- ine:epa-atur-ocupacio → Employment/unemployment by region (EPA survey)
- ine:turisme-ocupacio-hotelera → Hotel occupancy by province/tourist destination
- ree:generacio-espanya → Electricity generation mix in Spain (solar, wind, nuclear...)
- ree:preus-electricitat → Real-time electricity prices (PVPC)
- cnmc:preus-carburants → Fuel prices at every gas station in Spain
- idescat:m10328 → Població de Catalunya (population)
- idescat:m10234 → Confiança empresarial (business confidence)
- barcelona:accidents-gu-bcn → Accidents gestionats per la Guàrdia Urbana BCN (police-managed accidents)

MUNICIPAL DATA (filter by NOM_ENS with query_dataset):
- aoc:ge-ge-cost-efectiu-serveis-minhap → Cost dels serveis de +1,000 municipis (municipal service costs)
- aoc:ge-p-pressupostos-i-plantilles → Pressupostos i plantilles municipals (budgets & staffing)
- aoc:ge-ge-endeutament → Endeutament municipal (municipal debt)
- aoc:ge-p-liquidacions-per-programes-detallat → Budget execution by program
- aoc:ge-ge-termini-pagament-proveidors → Payment terms to suppliers

AVAILABLE PORTALS:
generalitat (Socrata, ~1059), aoc (CKAN, ~887), barcelona (CKAN, ~555), idescat (API, ~138), reus (CKAN, ~119), diba (REST+CIDO, ~90), girona (CKAN, ~53), fgc (ODS+GTFS-RT, ~50), renfe (CKAN+GTFS-RT, ~6), aemet (weather API, ~4), ine (statistics API, ~6), ree (energy API, ~4), sepe (employment, ~2), cnmc (fuel prices, ~1)

COMMON SEARCH KEYWORDS:
embassament, sequera, aigua, qualitat aire, contaminació, transport, trànsit, pressupost, educació, salut, població, habitatge, turisme, energia, residus, comerç, seguretat, bombers, accidents, 112, emergència, trens, rodalies, renfe, meteorologia, temps, temperatura, pluja, atur, ocupació, gasolina, carburants, PIB, IPC, electricitat, preu llum

MAIN CATEGORIES:
Medi Ambient, Economia, Educació, Salut, Seguretat, Societat-benestar, Urbanisme-infraestructures, Transport, Territori, Població, Treball, Turisme, Ciència i Tecnologia

NOTES:
- Socrata: filter by any field. Ex: filters: {"estaci": "Embassament de Sau"}
- CKAN AOC municipal: filter by NOM_ENS (e.g., "Ajuntament de Tiana"). Field names often in Spanish.
- Idescat: each dataset_id returns 1 specific indicator with value, unit, period, and time series.
- FGC GTFS-RT: auto-decoded protobuf. vehicle-positions → GPS, alerts → Catalan text.
- Renfe GTFS-RT: JSON real-time data for Rodalies de Catalunya. Auto-filtered to Barcelona commuter routes. Content in Spanish.
- AEMET: weather data auto-filtered to Catalonia (~80 stations). Use filters: {"codiINE": "08019"} for Barcelona forecast.
- INE: national statistics auto-filtered to Catalunya/Barcelona/Girona/Lleida/Tarragona series.
- REE: electricity data (national level). Generation, demand, balance, real-time prices.
- CNMC fuel prices: all Spanish gas stations, filter by province/municipality in results.
- Dataset names and field names are in Catalan or Spanish — use them as-is in queries.
- Use search_datasets only when you don't know which dataset you need.`;

const server = new McpServer(
  { name: "opendata-cat", version: "0.3.0" },
  { instructions: INSTRUCTIONS },
);

// Tool 1: search_datasets
server.tool(
  "search_datasets",
  "Search datasets by free text. Check server instructions first: many datasets can be queried directly with query_dataset. Use search_datasets only when you don't know which dataset you need.",
  {
    query: z.string().describe("Search text in Catalan or Spanish. Examples: 'qualitat aire', 'pressupostos', 'rodalies'"),
    portal: z.string().optional().describe("Filter by portal: 'generalitat', 'barcelona', 'diba', 'aoc', 'reus', 'girona', 'fgc', 'idescat', 'renfe', 'aemet', 'ine', 'ree', 'sepe', 'cnmc'"),
    category: z.string().optional().describe("Filter by thematic category"),
    limit: z.number().optional().default(20).describe("Maximum number of results (default: 20)"),
  },
  async ({ query, portal, category, limit }) => {
    const result = await searchDatasets(query, portal, category, limit);
    const queryableTypes = new Set(["socrata", "ckan", "opendatasoft", "idescat", "diba", "diba_cido", "renfe_gtfsrt_json", "aemet", "ine", "ree"]);
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
  "Get complete metadata for a dataset: fields with types and descriptions, API endpoint, license.",
  {
    dataset_id: z.string().describe("Unique dataset identifier (e.g., 'generalitat:gn9e-3qhr', 'renfe:vehicle-positions-gtfsrt')"),
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
  "List fields of a dataset with name, data type and description.",
  {
    dataset_id: z.string().describe("Dataset identifier"),
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
  "Query real data from a dataset. Check instructions for featured dataset_ids. For municipal data, use filters: {\"NOM_ENS\": \"Ajuntament de X\"} with aoc:ge-* datasets.",
  {
    dataset_id: z.string().describe("Dataset ID (e.g., 'generalitat:gn9e-3qhr' for reservoirs, 'aoc:ge-ge-cost-efectiu-serveis-minhap' for municipal costs)"),
    filters: z.record(z.string(), z.string()).optional().describe("Key-value filters (e.g., {\"ciutat\": \"Barcelona\"})"),
    search: z.string().optional().describe("Free text search within dataset data"),
    limit: z.number().optional().default(20).describe("Rows to return (default: 20, max: 100)"),
    offset: z.number().optional().default(0).describe("Offset for pagination"),
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
      } else if (dataset.api_type === "renfe_gtfsrt_json") {
        // Renfe GTFS-RT in JSON — filtered to Rodalies de Catalunya routes
        const resp = await fetch(dataset.api_endpoint);
        const json = await resp.json() as { entity?: Array<Record<string, unknown>> };
        if (!json.entity) {
          return { content: [{ type: "text" as const, text: "Error fetching Renfe GTFS-RT data" }] };
        }

        // Filter to Rodalies de Catalunya routes
        const rodaliesPattern = /^(R\d|RT\d|RG\d|RL)/i;
        const extractRoute = (entityId: string, tripId: string): string | null => {
          const idMatch = entityId.match(/^(?:VP_|TUUPDATE_|TUADDED_|TUCANCELED_)([A-Z0-9]+)-/i);
          if (idMatch) return idMatch[1];
          const tripMatch = tripId.match(/(R\d\w*|RT\d|RG\d|RL)$/i);
          if (tripMatch) return tripMatch[1].toUpperCase();
          return null;
        };

        const filtered = json.entity.filter((e: Record<string, unknown>) => {
          const entityId = (e.id as string) || "";
          if (e.vehicle) {
            const v = e.vehicle as Record<string, unknown>;
            const trip = v.trip as Record<string, unknown> | undefined;
            const route = extractRoute(entityId, (trip?.tripId as string) || "");
            return route && rodaliesPattern.test(route);
          }
          if (e.tripUpdate) {
            const tu = e.tripUpdate as Record<string, unknown>;
            const trip = tu.trip as Record<string, unknown> | undefined;
            const route = extractRoute(entityId, (trip?.tripId as string) || "");
            return route && rodaliesPattern.test(route);
          }
          if (e.alert) {
            const a = e.alert as Record<string, unknown>;
            const informed = (a.informedEntity as Array<Record<string, unknown>>) || [];
            return informed.some((ie) => rodaliesPattern.test((ie.routeId as string) || ""));
          }
          return false;
        });

        const sliced = filtered.slice(offset, offset + limit);
        const data = sliced.map((e: Record<string, unknown>) => {
          const entityId = (e.id as string) || "";
          if (e.vehicle) {
            const v = e.vehicle as Record<string, unknown>;
            const trip = v.trip as Record<string, unknown> | undefined;
            const pos = v.position as Record<string, unknown> | undefined;
            const veh = v.vehicle as Record<string, unknown> | undefined;
            return {
              trip_id: trip?.tripId ?? null,
              route_id: extractRoute(entityId, (trip?.tripId as string) || ""),
              latitude: pos?.latitude ?? null,
              longitude: pos?.longitude ?? null,
              speed_kmh: pos?.speed != null ? Math.round((pos.speed as number) * 3.6) : null,
              current_status: v.currentStatus ?? null,
              stop_id: v.stopId ?? null,
              vehicle_label: veh?.label ?? null,
              timestamp: v.timestamp ? new Date(Number(v.timestamp) * 1000).toISOString() : null,
            };
          }
          if (e.tripUpdate) {
            const tu = e.tripUpdate as Record<string, unknown>;
            const trip = tu.trip as Record<string, unknown> | undefined;
            const stops = ((tu.stopTimeUpdate as Array<Record<string, unknown>>) || []).map((su) => ({
              stop_id: su.stopId ?? null,
              arrival_delay_seconds: (su.arrival as Record<string, unknown>)?.delay ?? null,
              departure_delay_seconds: (su.departure as Record<string, unknown>)?.delay ?? null,
            }));
            return {
              trip_id: trip?.tripId ?? null,
              route_id: extractRoute(entityId, (trip?.tripId as string) || ""),
              schedule_relationship: trip?.scheduleRelationship ?? "SCHEDULED",
              delay_seconds: tu.delay ?? null,
              stops,
            };
          }
          if (e.alert) {
            const a = e.alert as Record<string, unknown>;
            const informed = (a.informedEntity as Array<Record<string, unknown>>) || [];
            const routes = [...new Set(informed.map((ie) => ie.routeId as string).filter(Boolean))];
            const headerText = a.headerText as Record<string, unknown> | undefined;
            const descText = a.descriptionText as Record<string, unknown> | undefined;
            const headerTranslations = (headerText?.translation as Array<Record<string, unknown>>) || [];
            const descTranslations = (descText?.translation as Array<Record<string, unknown>>) || [];
            return {
              header: headerTranslations[0]?.text ?? null,
              description: descTranslations[0]?.text ?? null,
              routes,
            };
          }
          return e;
        });

        let feedType = "unknown";
        if (data.length > 0 && "latitude" in data[0]) feedType = "vehicle_positions";
        else if (data.length > 0 && "delay_seconds" in data[0]) feedType = "trip_updates";
        else if (data.length > 0 && "header" in data[0]) feedType = "alerts";

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              dataset: dataset.name,
              format: "GTFS Realtime (JSON)",
              type: feedType,
              filter: "Rodalies de Catalunya only",
              total_entities: filtered.length,
              count: data.length,
              data,
            }, null, 2),
          }],
        };
      } else if (dataset.api_type === "ine") {
        // INE JSON API — fetch URL, filter series relevant to Catalunya
        const ineResp = await fetch(dataset.api_endpoint);
        const ineJson = await ineResp.json() as Array<{ Nombre?: string; Data?: Array<{ T3_Periodo?: string; Valor?: number; Anyo?: number }> }>;
        const catKeywords = /catalun|barcelona|girona|lleida|tarragona/i;
        const filtered = ineJson.filter((serie) => catKeywords.test(serie.Nombre ?? ""));
        const rows: Array<Record<string, unknown>> = [];
        for (const serie of (filtered.length > 0 ? filtered : ineJson).slice(0, 10)) {
          const dataPoints = (serie.Data ?? []).slice(0, limit);
          for (const dp of dataPoints) {
            rows.push({
              serie: serie.Nombre ?? "unknown",
              periodo: dp.T3_Periodo ?? dp.Anyo ?? null,
              valor: dp.Valor ?? null,
            });
          }
        }
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              dataset: dataset.name,
              portal: "INE",
              note: filtered.length > 0 ? "Auto-filtered to Catalunya/Barcelona/Girona/Lleida/Tarragona series" : "No Catalunya filter match — showing all series",
              count: rows.length,
              data: rows.slice(0, limit),
            }, null, 2),
          }],
        };
      } else if (dataset.api_type === "ree") {
        // REE API — append date params if not present
        let reeUrl = dataset.api_endpoint;
        if (!reeUrl.includes("start_date")) {
          const now = new Date();
          const end = now.toISOString().slice(0, 10) + "T23:59";
          const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const start = startDate.toISOString().slice(0, 10) + "T00:00";
          const timeTrunc = reeUrl.includes("precios") ? "hour" : "day";
          reeUrl += (reeUrl.includes("?") ? "&" : "?") + `start_date=${start}&end_date=${end}&time_trunc=${timeTrunc}`;
        }
        const reeResp = await fetch(reeUrl);
        const reeJson = await reeResp.json() as { included?: Array<{ attributes?: { title?: string; values?: Array<{ value?: number; percentage?: number; datetime?: string }> } }> };
        const reeData: Array<Record<string, unknown>> = [];
        for (const item of reeJson.included ?? []) {
          const title = item.attributes?.title ?? "unknown";
          for (const v of (item.attributes?.values ?? []).slice(0, limit)) {
            reeData.push({
              indicator: title,
              value: v.value ?? null,
              percentage: v.percentage ?? null,
              datetime: v.datetime ?? null,
            });
          }
        }
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              dataset: dataset.name,
              portal: "REE",
              count: reeData.length,
              data: reeData.slice(0, limit),
            }, null, 2),
          }],
        };
      } else if (dataset.api_type === "aemet") {
        // AEMET requires server-side API key — redirect to HTTP server
        return {
          content: [{
            type: "text" as const,
            text: "AEMET requires an API key. Use the HTTP server at https://opendata.cat/api/mcp for AEMET queries.",
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
  "List all 14 indexed Catalan and Spanish open data portals with dataset counts.",
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
      { id: "renfe", name: "Renfe (Rodalies de Catalunya)", url: "https://data.renfe.com", api: "CKAN + GTFS-RT JSON" },
      { id: "aemet", name: "AEMET (Agència Estatal de Meteorologia)", url: "https://opendata.aemet.es", api: "AEMET OpenData REST" },
      { id: "ine", name: "INE (Institut Nacional d'Estadística)", url: "https://www.ine.es", api: "INE JSON API" },
      { id: "ree", name: "Red Eléctrica de España", url: "https://www.ree.es", api: "REE API REST" },
      { id: "sepe", name: "SEPE (Servicio Público de Empleo Estatal)", url: "https://sepe.es", api: "File download" },
      { id: "cnmc", name: "CNMC / Ministerio Transición Ecológica", url: "https://datos.gob.es", api: "REST JSON" },
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
  "List all dataset categories and themes with counts per portal. Great first step to discover what data types are available.",
  {},
  async () => {
    const cats = await getCategories();
    return { content: [{ type: "text" as const, text: JSON.stringify(cats, null, 2) }] };
  },
);

// Tool 7: related_datasets
server.tool(
  "related_datasets",
  "Find related datasets from OTHER portals. Great for discovering complementary data.",
  {
    dataset_id: z.string().describe("Dataset ID to find related datasets for"),
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
  "Analyze current status of Catalan reservoirs with evolution charts.",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Query the current status of reservoirs in Catalonia's internal basins.\n\n"
          + "1. Use search_datasets with 'embassament' to find the relevant dataset\n"
          + "2. Use query_dataset to get the latest data\n"
          + "3. Present a table for each reservoir: name, current volume (hm³), fill percentage, and variation\n"
          + "4. Generate an ASCII or Markdown chart showing level evolution\n"
          + "5. Highlight reservoirs in critical condition (< 40%) and the best ones\n"
          + "6. Compare with the drought status dataset if available\n\n"
          + "Present data visually and in an easy-to-understand format.",
      },
    }],
  }),
);

server.prompt(
  "trens_fgc_temps_real",
  "Check FGC trains real-time status: delays, alerts and positions.",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Query the real-time status of Ferrocarrils de la Generalitat de Catalunya (FGC) trains.\n\n"
          + "1. Use search_datasets with portal 'fgc' to find GTFS Realtime datasets\n"
          + "2. Query 'trip-updates' for current delays\n"
          + "3. Query 'vehicle-positions' to see where trains are\n"
          + "4. Query 'alerts' for active service alerts\n\n"
          + "Present a clear summary:\n"
          + "- Delayed trains (how many minutes, which line)\n"
          + "- Active service alerts\n"
          + "- Overall status: normal / with incidents / disrupted",
      },
    }],
  }),
);

server.prompt(
  "trens_rodalies_temps_real",
  "Check Rodalies de Catalunya (Renfe) trains real-time status: delays, alerts and GPS positions.",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Query the real-time status of Rodalies de Catalunya (Renfe commuter trains in Barcelona area).\n\n"
          + "1. Query renfe:trip-updates-gtfsrt to see current delays on Rodalies lines\n"
          + "2. Query renfe:vehicle-positions-gtfsrt to see GPS positions of active trains\n"
          + "3. Query renfe:alerts-gtfsrt for active service alerts (in Spanish)\n\n"
          + "Present a clear summary:\n"
          + "- Delayed trains (delay in minutes, route: R1, R2, R2S, R3, R4, etc.)\n"
          + "- Active service alerts affecting Rodalies lines\n"
          + "- Number of active trains and their positions\n"
          + "- Overall status: normal / with incidents / disrupted\n\n"
          + "Note: Rodalies routes are R1-R8, R11-R16, RT1, RT2, RG1, RL.",
      },
    }],
  }),
);

server.prompt(
  "qualitat_aire",
  "Analyze air quality at a Catalan station or municipality.",
  { lloc: z.string().optional().describe("Municipality or station name (e.g., 'Barcelona', 'Sabadell')") },
  ({ lloc }) => {
    const filtreText = lloc ? ` in ${lloc}` : " at major stations";
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze air quality${filtreText}.\n\n`
            + "1. Use search_datasets with 'qualitat aire contaminació' to find relevant datasets\n"
            + "2. Query the latest available measurements"
            + (lloc ? ` filtering by '${lloc}'` : "") + "\n"
            + "3. Present levels of: NO₂, PM10, PM2.5, O₃, SO₂ (whichever available)\n"
            + "4. Compare with WHO thresholds and EU regulations\n"
            + "5. Give an overall assessment: good / acceptable / poor / very poor\n"
            + "6. If historical data exists, show recent trends\n\n"
            + "Use tables and visual indicators to make it understandable.",
        },
      }],
    };
  },
);

server.prompt(
  "accidents_transit",
  "Analyze traffic accident data in Catalonia or a specific municipality.",
  { municipi: z.string().optional().describe("Municipality name (e.g., 'Barcelona', 'Hospitalet')") },
  ({ municipi }) => {
    const filtreText = municipi ? ` in ${municipi}` : " in Catalonia";
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze traffic accident data${filtreText}.\n\n`
            + "1. Use search_datasets with 'accidents trànsit" + (municipi ? ` ${municipi}` : "") + "'\n"
            + "2. Query the most recent data\n"
            + "3. Present: total accidents, distribution by severity (fatal, serious injuries, minor)\n"
            + "4. If geolocated data exists, identify hotspots\n"
            + "5. Analyze trends: increasing or decreasing?\n"
            + "6. Look for related datasets with related_datasets to enrich the analysis\n\n"
            + "Present clear conclusions with concrete data.",
        },
      }],
    };
  },
);

server.prompt(
  "pressupostos_municipals",
  "Explore and compare municipal budgets of Catalan municipalities.",
  { municipi: z.string().optional().describe("Municipality name") },
  ({ municipi }) => {
    const filtreText = municipi ? ` for ${municipi}` : "";
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Explore municipal budgets${filtreText}.\n\n`
            + "1. Use search_datasets with 'pressupost" + (municipi ? ` ${municipi}` : " municipal") + "'\n"
            + "2. Query the latest budget data available\n"
            + "3. Break down: revenue vs expenditure, main line items\n"
            + "4. If multi-year data exists, show evolution\n"
            + "5. Highlight the largest items and significant variations\n\n"
            + "Present figures in comprehensible format (millions €) with tables.",
        },
      }],
    };
  },
);

server.prompt(
  "compara_municipis",
  "Compare two Catalan municipalities across all available open data.",
  {
    municipi_a: z.string().describe("First municipality"),
    municipi_b: z.string().describe("Second municipality"),
  },
  ({ municipi_a, municipi_b }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Compare the municipalities of ${municipi_a} and ${municipi_b} across all available open data.\n\n`
          + `1. Use search_datasets to find datasets that include '${municipi_a}'\n`
          + `2. Use search_datasets to find datasets that include '${municipi_b}'\n`
          + "3. For each common topic (population, budget, facilities, transport...), query data for both municipalities\n"
          + "4. Present a comparative table with key data\n"
          + "5. Highlight the most significant differences\n\n"
          + "Organize the comparison by topic and indicate the source of each data point.",
      },
    }],
  }),
);

server.prompt(
  "descobreix_dades",
  "Explore what open data is available about a topic in Catalonia.",
  { tema: z.string().describe("Topic to explore (e.g., 'educació', 'medi ambient', 'turisme')") },
  ({ tema }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Explore all available open data about '${tema}' in Catalonia.\n\n`
          + `1. Use search_datasets with '${tema}' (limit: 50)\n`
          + "2. Group results by portal and category\n"
          + "3. For the 3-5 most relevant datasets, use get_dataset_info to show details (fields, types, update date)\n"
          + "4. Use related_datasets to discover complementary data\n"
          + "5. Suggest 3 interesting analyses that could be done by crossing these datasets\n\n"
          + "The goal is to provide a complete map of what data exists and what can be done with it.",
      },
    }],
  }),
);

server.prompt(
  "analisi_bombers",
  "Analyze Catalan firefighter operations: emergency types, territorial distribution and trends.",
  { comarca: z.string().optional().describe("Filter by comarca (e.g., 'Barcelonès', 'Vallès Occidental')") },
  ({ comarca }) => {
    const filtreText = comarca ? ` in comarca ${comarca}` : "";
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze Catalan firefighter (Bombers de la Generalitat) operations${filtreText}.\n\n`
            + "1. Use search_datasets with 'bombers actuacions emergències'\n"
            + "2. Query operations datasets (GRAF, EAIC)\n"
            + "3. Present: total operations, distribution by type (fires, rescues, floods...)\n"
            + "4. If temporal data exists, show seasonality (summer = fires?)\n"
            + "5. Identify areas with the most operations\n"
            + (comarca ? `6. Filter specifically for comarca ${comarca}\n` : "")
            + "\nProvide a visual analysis with tables and percentages.",
        },
      }],
    };
  },
);

// ===== DISCOVERY PROMPTS =====

server.prompt(
  "novetats",
  "Show the most recently updated datasets across Catalan open data portals.",
  { portal: z.string().optional().describe("Filter by portal: generalitat, barcelona, diba, aoc, reus, girona, fgc, idescat, renfe, aemet, ine, ree, sepe, cnmc") },
  ({ portal }) => {
    const filtreText = portal ? ` on portal ${portal}` : "";
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Show the most recently updated Catalan open datasets${filtreText}.\n\n`
            + "1. Use list_portals to see available portals\n"
            + `2. Use search_datasets with general terms${portal ? ` and portal '${portal}'` : ""} to get datasets\n`
            + "3. For the first 10 results, use get_dataset_info to check last_updated date\n"
            + "4. Sort by update date (most recent first)\n"
            + "5. Present a table with: name, portal, category, last update, formats\n"
            + "6. Highlight those updated in the last 7 days\n\n"
            + "The goal is to discover which datasets are actively maintained.",
        },
      }],
    };
  },
);

server.prompt(
  "datasets_populars",
  "Show the most queried datasets by MCP users.",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Show the most popular Catalan open datasets queried by users.\n\n"
          + "1. Use search_datasets with popular terms: 'embassament', 'qualitat aire', 'transport', 'pressupost', 'població', 'rodalies'\n"
          + "2. For each search, take the top result and use get_dataset_info for details\n"
          + "3. Present a ranking of the most relevant datasets with:\n"
          + "   - Name and portal\n"
          + "   - Brief description\n"
          + "   - Available fields\n"
          + "   - Last update\n"
          + "4. For the top 3, run query_dataset (limit: 3) to show a sample of real data\n"
          + "5. Suggest interesting questions that could be asked to each dataset\n\n"
          + "The goal is to inspire the user with open data possibilities.",
      },
    }],
  }),
);

server.prompt(
  "explorar_portal",
  "Explore an open data portal: dataset count, categories, examples of each type.",
  { portal: z.string().describe("Portal to explore: generalitat, barcelona, diba, aoc, reus, girona, fgc, idescat, renfe, aemet, ine, ree, sepe, cnmc") },
  ({ portal }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Perform a complete exploration of the '${portal}' open data portal.\n\n`
          + "1. Use list_portals to get total dataset count\n"
          + "2. Use list_categories to see categories available in the portal\n"
          + `3. Use search_datasets with portal '${portal}' and limit 50 to see all datasets\n`
          + "4. Group by category and present a summary table\n"
          + "5. For each category, pick the most interesting dataset and use get_dataset_info to show its fields\n"
          + "6. Highlight:\n"
          + "   - Real-time or frequently updated datasets\n"
          + "   - Data-rich datasets (many fields)\n"
          + "   - Unique datasets not found in other portals\n\n"
          + "Present the portal as a complete guide for a new user.",
      },
    }],
  }),
);

server.prompt(
  "dades_municipi",
  "Discover all available open data about a specific Catalan municipality.",
  { municipi: z.string().describe("Municipality name (e.g., 'Sabadell', 'Girona', 'Manresa')") },
  ({ municipi }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Discover all available open data about the municipality of ${municipi}.\n\n`
          + `1. Use search_datasets with '${municipi}' (limit: 50) to find all datasets\n`
          + "2. Group by portal and category\n"
          + "3. For the most relevant datasets, use get_dataset_info for details\n"
          + "4. Run query_dataset (limit: 3) on the 2-3 most interesting datasets to show real data\n"
          + "5. Use related_datasets to find complementary data from other portals\n"
          + "6. Present a municipal profile summary:\n"
          + "   - Population (if data available)\n"
          + "   - Budget (if data available)\n"
          + "   - Facilities, transport, environment...\n"
          + "   - What's missing: topics without open data\n\n"
          + `The goal is to provide a complete portrait of ${municipi} through open data.`,
      },
    }],
  }),
);

server.prompt(
  "datasets_temps_real",
  "List datasets offering real-time or frequently updated data.",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Discover which Catalan open datasets offer real-time or frequently updated data.\n\n"
          + "1. Use search_datasets with 'temps real', 'GTFS', 'realtime' to find live datasets\n"
          + "2. Use search_datasets with portal 'fgc' for FGC real-time transport data\n"
          + "3. Use search_datasets with portal 'renfe' for Rodalies de Catalunya real-time train data\n"
          + "4. Use search_datasets with 'qualitat aire estacions' for live air quality measurements\n"
          + "5. Use search_datasets with 'embassament' and 'cabal' for live water data\n"
          + "6. For each dataset found, use get_dataset_info to check update frequency\n"
          + "7. Present an organized list by topic:\n"
          + "   - Transport: FGC trains, Rodalies Renfe, traffic, bicing...\n"
          + "   - Environment: air, water, weather...\n"
          + "   - Other real-time sources\n"
          + "8. For the 3 most interesting, run query_dataset to show the latest data\n\n"
          + "The goal is to let the user know what data they can query 'right now'.",
      },
    }],
  }),
);

server.prompt(
  "resum_portals",
  "General summary of all portals: dataset counts, topics, formats.",
  () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Provide a complete summary of all Catalan open data portals.\n\n"
          + "1. Use list_portals to get the list with counts\n"
          + "2. Use list_categories to see categories for each portal\n"
          + "3. Present a comparative table:\n"
          + "   - Portal name, URL, dataset count\n"
          + "   - API type (Socrata, CKAN, REST, Opendatasoft, GTFS-RT)\n"
          + "   - Main categories\n"
          + "   - Notable data types\n"
          + "4. For each portal, highlight the most unique or interesting dataset\n"
          + "5. Indicate which portals have real-time data\n"
          + "6. Suggest an interesting question that could be answered with each portal's data\n\n"
          + "The goal is to provide a panoramic view of the Catalan open data ecosystem.",
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
        res.end(JSON.stringify({ status: "ok", name: "opendata-cat", version: "0.3.0" }));
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
