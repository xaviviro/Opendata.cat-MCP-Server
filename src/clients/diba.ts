/**
 * Consulta l'API REST de la Diputació de Barcelona (do.diba.cat).
 * Format: /api/dataset/{name}/format/json/pag-ini/{start}/pag-fi/{end}
 * Filtres: /camp-filtre/{field}/valor-filtre/{value}
 * Relacions: /camp-rel/{field}/valor-rel/{value}
 */
export async function queryDiba(
  endpoint: string,
  filters?: Record<string, string>,
  search?: string,
  limit = 20,
  offset = 0,
): Promise<{ elements: Record<string, unknown>[]; total: number }> {
  let url = endpoint;

  // Assegurar format JSON
  if (!url.includes("/format/")) {
    url += "/format/json";
  }

  // Paginació
  url += `/pag-ini/${offset}/pag-fi/${offset + limit}`;

  // Filtres
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      url += `/camp-filtre/${encodeURIComponent(key)}/valor-filtre/${encodeURIComponent(value)}`;
    }
  }

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Diba error ${resp.status}: ${resp.statusText}`);

  const data = await resp.json();
  return {
    elements: data.elements ?? [],
    total: data.entitats ?? 0,
  };
}
