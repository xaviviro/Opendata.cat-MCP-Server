export async function querySocrata(
  endpoint: string,
  filters?: Record<string, string>,
  search?: string,
  limit = 20,
  offset = 0,
): Promise<Record<string, unknown>[]> {
  const url = new URL(endpoint);

  if (filters && Object.keys(filters).length > 0) {
    const clauses = Object.entries(filters).map(
      ([key, value]) => `${key}='${value.replace(/'/g, "''")}'`,
    );
    url.searchParams.set("$where", clauses.join(" AND "));
  }

  if (search) url.searchParams.set("$q", search);
  url.searchParams.set("$limit", String(Math.min(limit, 100)));
  url.searchParams.set("$offset", String(offset));

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`Socrata error ${resp.status}: ${resp.statusText}`);
  return (await resp.json()) as Record<string, unknown>[];
}
