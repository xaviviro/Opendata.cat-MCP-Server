/**
 * Consulta l'API JSON:API CIDO de la Diputació de Barcelona (api.diba.cat).
 *
 * Endpoints: contractacions, convenis, normatives-locals, oposicions, subvencions
 *
 * Filtres: filter[camp]=valor (camps d'atributs directes, NO relacions)
 *   Ex: filter[institucioDesenvolupat]=Ajuntament de Tiana
 *   Ex: filter[any]=2024
 *   Ex: filter[estat]=En termini
 *
 * Ordenació: sort=-maxDataPublicacioDocument (descendent)
 */
export async function queryCido(
  endpoint: string,
  filters?: Record<string, string>,
  search?: string,
  limit = 20,
  offset = 0,
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const url = new URL(endpoint);

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      url.searchParams.set(`filter[${key}]`, value);
    }
  }

  // CIDO no té cerca de text lliure, però podem filtrar per títol
  if (search) {
    url.searchParams.set("filter[titol]", search);
  }

  url.searchParams.set("sort", "-maxDataPublicacioDocument");

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const detail = err.errors?.[0]?.detail ?? resp.statusText;
    throw new Error(`CIDO error ${resp.status}: ${detail}`);
  }

  const result = await resp.json();
  const data = (result.data ?? []).slice(offset, offset + limit).map(
    (item: { attributes?: Record<string, unknown> }) => item.attributes ?? {},
  );

  return { data, total: result.data?.length ?? 0 };
}
