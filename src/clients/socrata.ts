export async function querySocrata(
  endpoint: string,
  filters?: Record<string, string>,
  search?: string,
  limit = 20,
  offset = 0,
): Promise<Record<string, unknown>[]> {
  const url = new URL(endpoint);

  if (filters && Object.keys(filters).length > 0) {
    const clauses = Object.entries(filters)
      .filter(([key]) => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key))
      .map(([key, value]) => `\`${key}\`='${value.replace(/'/g, "''")}'`);
    if (clauses.length > 0) {
      url.searchParams.set("$where", clauses.join(" AND "));
    }
  }

  if (search) url.searchParams.set("$q", search);
  url.searchParams.set("$limit", String(Math.min(limit, 100)));
  url.searchParams.set("$offset", String(offset));

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`Socrata error ${resp.status}: ${resp.statusText}`);
  const rows = (await resp.json()) as Record<string, unknown>[];
  // Simplify geo fields: replace heavy polygon coords with centroid
  return rows.map((row) => {
    const simplified: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      if (val && typeof val === "object" && "type" in (val as Record<string, unknown>)) {
        const geo = val as { type: string; coordinates?: unknown };
        if (geo.type === "Point") {
          simplified[key] = val;
        } else if (geo.type === "MultiPolygon" || geo.type === "Polygon" || geo.type === "MultiLineString" || geo.type === "LineString") {
          // Extract centroid from coordinates
          const coords = _flattenCoords(geo.coordinates);
          if (coords.length > 0) {
            const lats = coords.map((c) => c[1]);
            const lngs = coords.map((c) => c[0]);
            simplified[key] = {
              type: geo.type,
              centroid: { lat: _avg(lats), lng: _avg(lngs) },
              bbox: { min_lat: Math.min(...lats), max_lat: Math.max(...lats), min_lng: Math.min(...lngs), max_lng: Math.max(...lngs) },
              vertex_count: coords.length,
              _note: "Geometria simplificada a centroide+bbox per no saturar el context. Usa l'endpoint .geojson de Socrata per obtenir les coordenades completes.",
            };
          } else {
            simplified[key] = val;
          }
        } else {
          simplified[key] = val;
        }
      } else {
        simplified[key] = val;
      }
    }
    return simplified;
  });
}

function _flattenCoords(coords: unknown): number[][] {
  if (!Array.isArray(coords)) return [];
  if (coords.length === 0) return [];
  if (typeof coords[0] === "number") return [coords as number[]];
  return coords.flatMap((c) => _flattenCoords(c));
}

function _avg(nums: number[]): number {
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10000) / 10000;
}
