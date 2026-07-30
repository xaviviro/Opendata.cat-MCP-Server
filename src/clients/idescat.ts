/**
 * Client per a l'API d'Idescat (Institut d'Estadística de Catalunya).
 * Consulta indicadors estadístics de Catalunya amb sèries temporals.
 */
export async function queryIdescat(
  endpoint: string,
): Promise<{ indicators: Record<string, unknown>[]; count: number }> {
  // Current format: ?i=<id> — the API filters server-side.
  // Legacy format: ?id=basics&n=<id> — Idescat ignores `n` since July 2026, so we
  // have to fetch every indicator (max=200) and filter client-side.
  const byId = endpoint.match(/[?&]i=(m\w+)/);
  let targetId: string | null = null;
  let allUrl: string;

  if (byId) {
    targetId = byId[1];
    allUrl = endpoint;
  } else {
    const legacy = endpoint.match(/[?&]n=m?(\w+)/);
    targetId = legacy ? `m${legacy[1]}` : null;
    allUrl = endpoint.replace(/&?n=m?\w+/, "").replace(/&?max=\d+/, "") + "&max=200";
  }

  const resp = await fetch(allUrl);
  if (!resp.ok) throw new Error(`Idescat error ${resp.status}: ${resp.statusText}`);
  const data = (await resp.json()) as {
    indicadors?: {
      i?: Record<string, unknown> | Record<string, unknown>[];
    };
  };

  const raw = data?.indicadors?.i;
  if (!raw) return { indicators: [], count: 0 };

  let items = Array.isArray(raw) ? raw : [raw];

  // Filter by target indicator if specified
  if (targetId) {
    items = items.filter((item) => item.id === targetId);
  }

  const indicators = items
    .filter((item) => item.id)
    .map((item) => {
      const unit = item.u as { content?: string } | string | undefined;
      const period = item.r as { title?: string } | string | undefined;
      return {
        indicador: (item.c as string) ?? "",
        valor: item.v ?? null,
        unitat: typeof unit === "object" ? (unit?.content ?? "") : (unit ?? ""),
        periode: typeof period === "object" ? (period?.title ?? "") : (period ?? ""),
        font: (item.s as string) ?? "",
        serie_temporal: (item.ts as string) ?? "",
        link: (item.l as string) ?? "",
      };
    });

  return { indicators, count: indicators.length };
}
