export async function queryOpendatasoft(
  endpoint: string,
  filters?: Record<string, string>,
  search?: string,
  limit = 20,
  offset = 0,
): Promise<{ records: Record<string, unknown>[]; total: number }> {
  const url = new URL(endpoint);

  if (filters && Object.keys(filters).length > 0) {
    for (const [key, value] of Object.entries(filters)) {
      url.searchParams.set(`refine.${key}`, value);
    }
  }

  if (search) url.searchParams.set("q", search);
  url.searchParams.set("rows", String(Math.min(limit, 100)));
  url.searchParams.set("start", String(offset));

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`Opendatasoft error ${resp.status}: ${resp.statusText}`);
  const data = (await resp.json()) as { nhits: number; records: { fields: Record<string, unknown> }[] };
  return {
    records: data.records.map((r) => r.fields),
    total: data.nhits,
  };
}
