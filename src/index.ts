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

const server = new McpServer({
  name: "opendata-cat",
  version: "0.0.10",
});

// Tool 1: search_datasets
server.tool(
  "search_datasets",
  "Cerca datasets de dades obertes catalanes per text lliure. Retorna nom, descripció, portal i formats.",
  {
    query: z.string().describe("Text de cerca (ex: 'qualitat aire', 'pressupostos')"),
    portal: z.string().optional().describe("Filtrar per portal: 'generalitat', 'barcelona', 'diba', 'aoc', 'reus', 'girona', 'fgc'"),
    category: z.string().optional().describe("Filtrar per categoria"),
    limit: z.number().optional().default(20).describe("Nombre màxim de resultats (defecte: 20)"),
  },
  async ({ query, portal, category, limit }) => {
    const result = await searchDatasets(query, portal, category, limit);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
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
  "Executa una consulta contra un dataset i retorna files de dades reals del portal origen.",
  {
    dataset_id: z.string().describe("ID del dataset a consultar"),
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
        results = data.records;
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
        res.end(JSON.stringify({ status: "ok", name: "opendata-cat", version: "0.0.10" }));
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
