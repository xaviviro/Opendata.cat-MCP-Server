/**
 * Client per a l'API d'Idescat (Institut d'Estadística de Catalunya).
 * Consulta indicadors estadístics de Catalunya amb sèries temporals.
 */
export async function queryIdescat(
  endpoint: string,
): Promise<{ indicators: Record<string, unknown>[]; count: number }> {
  const resp = await fetch(endpoint);
  if (!resp.ok) throw new Error(`Idescat error ${resp.status}: ${resp.statusText}`);
  const data = (await resp.json()) as {
    indicadors?: {
      i?: Record<string, unknown> | Record<string, unknown>[];
    };
  };

  const raw = data?.indicadors?.i;
  if (!raw) return { indicators: [], count: 0 };

  const items = Array.isArray(raw) ? raw : [raw];

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
