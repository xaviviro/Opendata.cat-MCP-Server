/**
 * Client per a l'API d'Idescat (Institut d'Estadística de Catalunya).
 * Consulta indicadors estadístics de Catalunya amb sèries temporals.
 */
export async function queryIdescat(
  endpoint: string,
): Promise<{ indicators: Record<string, unknown>[]; count: number }> {
  // Extract indicator ID from endpoint (n=XXXXX or n=mXXXXX)
  const idMatch = endpoint.match(/[?&]n=m?(\d+)/);
  const targetId = idMatch ? `m${idMatch[1]}` : null;

  // Fetch ALL indicators (max=200) and filter client-side
  const allUrl = endpoint.replace(/&?n=m?\d+/, "").replace(/&?max=\d+/, "") + "&max=200";
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
