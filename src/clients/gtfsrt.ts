import GtfsRealtimeBindings from "gtfs-realtime-bindings";

/**
 * Descarrega i decodifica un fitxer GTFS-RT (.pb) des d'Opendatasoft.
 * Retorna dades estructurades: trip updates, alertes o posicions de vehicles.
 */
export async function decodeGtfsRt(
  endpoint: string,
  limit: number,
): Promise<{ type: string; count: number; data: Record<string, unknown>[] }> {
  // 1. Obtenir file ID del record ODS
  const resp = await fetch(endpoint + (endpoint.includes("?") ? "&" : "?") + "rows=1");
  if (!resp.ok) throw new Error(`ODS error ${resp.status}`);
  const odsData = (await resp.json()) as {
    records: { fields: { file?: { id: string; filename: string } } }[];
  };
  const file = odsData.records?.[0]?.fields?.file;
  if (!file?.id) throw new Error("No s'ha trobat el fitxer .pb");

  // 2. Construir URL de descàrrega
  const dsMatch = endpoint.match(/dataset=([^&]+)/);
  const baseMatch = endpoint.match(/(https?:\/\/[^/]+)/);
  if (!dsMatch || !baseMatch) throw new Error("No s'ha pogut construir la URL de descàrrega");
  const downloadUrl = `${baseMatch[1]}/explore/dataset/${dsMatch[1]}/files/${file.id}/download/`;

  // 3. Descarregar i decodificar protobuf
  const pbResp = await fetch(downloadUrl);
  if (!pbResp.ok) throw new Error(`Error descarregant .pb: ${pbResp.status}`);
  const buf = Buffer.from(await pbResp.arrayBuffer());
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf);

  // 4. Parsejar entitats segons tipus
  const entities = feed.entity.slice(0, limit);

  if (entities.some((e) => e.tripUpdate)) {
    return {
      type: "trip_updates",
      count: feed.entity.length,
      data: entities.filter((e) => e.tripUpdate).map((e) => {
        const tu = e.tripUpdate!;
        const delays = (tu.stopTimeUpdate || []).map((su) => ({
          stop_id: su.stopId,
          arrival_delay_seconds: su.arrival?.delay ?? null,
          departure_delay_seconds: su.departure?.delay ?? null,
        }));
        return {
          trip_id: tu.trip?.tripId ?? null,
          route_id: tu.trip?.routeId ?? null,
          start_date: tu.trip?.startDate ?? null,
          start_time: tu.trip?.startTime ?? null,
          stops: delays,
          max_delay_seconds: Math.max(0, ...delays.map((d) => d.arrival_delay_seconds ?? d.departure_delay_seconds ?? 0)),
        };
      }),
    };
  }

  if (entities.some((e) => e.alert)) {
    return {
      type: "alerts",
      count: feed.entity.length,
      data: entities.filter((e) => e.alert).map((e) => {
        const a = e.alert!;
        return {
          header: a.headerText?.translation?.[0]?.text ?? null,
          description: a.descriptionText?.translation?.[0]?.text ?? null,
          cause: a.cause ?? null,
          effect: a.effect ?? null,
          active_periods: (a.activePeriod || []).map((p) => ({
            start: p.start ? new Date(Number(p.start) * 1000).toISOString() : null,
            end: p.end ? new Date(Number(p.end) * 1000).toISOString() : null,
          })),
          routes: (a.informedEntity || []).map((ie) => ie.routeId).filter(Boolean),
          stops: (a.informedEntity || []).map((ie) => ie.stopId).filter(Boolean),
        };
      }),
    };
  }

  if (entities.some((e) => e.vehicle)) {
    return {
      type: "vehicle_positions",
      count: feed.entity.length,
      data: entities.filter((e) => e.vehicle).map((e) => {
        const v = e.vehicle!;
        return {
          trip_id: v.trip?.tripId ?? null,
          route_id: v.trip?.routeId ?? null,
          latitude: v.position?.latitude ?? null,
          longitude: v.position?.longitude ?? null,
          speed_kmh: v.position?.speed != null ? Math.round(v.position.speed * 3.6) : null,
          bearing: v.position?.bearing ?? null,
          stop_id: v.stopId ?? null,
          timestamp: v.timestamp ? new Date(Number(v.timestamp) * 1000).toISOString() : null,
        };
      }),
    };
  }

  return { type: "unknown", count: feed.entity.length, data: [] };
}
