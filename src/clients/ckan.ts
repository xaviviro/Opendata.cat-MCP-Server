export async function queryCkan(
  endpoint: string,
  filters?: Record<string, string>,
  search?: string,
  limit = 20,
  offset = 0,
): Promise<{ records: Record<string, unknown>[]; total: number }> {
  const url = new URL(endpoint);

  if (filters && Object.keys(filters).length > 0) {
    url.searchParams.set("filters", JSON.stringify(filters));
  }

  if (search) url.searchParams.set("q", search);
  url.searchParams.set("limit", String(Math.min(limit, 100)));
  url.searchParams.set("offset", String(offset));

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`CKAN error ${resp.status}: ${resp.statusText}`);

  const data = await resp.json();
  if (!data.success) throw new Error(`CKAN error: ${JSON.stringify(data.error)}`);

  return {
    records: data.result.records ?? [],
    total: data.result.total ?? 0,
  };
}
