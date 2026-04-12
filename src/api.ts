const API_BASE = "https://opendata.cat/api";

export interface DatasetSummary {
  dataset_id: string;
  portal_id: string;
  name: string;
  description: string;
  category: string;
  formats: string[];
  api_type: string;
}

export interface DatasetDetail {
  dataset_id: string;
  portal_id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  api_type: "socrata" | "ckan" | "diba";
  api_endpoint: string;
  formats: string[];
  fields: { name: string; type: string; description: string }[];
  row_count: number | null;
  last_updated: string;
  license: string;
}

export interface SearchResult {
  items: DatasetSummary[];
  total: number;
  limit: number;
  offset: number;
}

export async function searchDatasets(
  query: string,
  portal?: string,
  category?: string,
  limit = 20,
  offset = 0,
): Promise<SearchResult> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (portal) params.set("portal", portal);
  if (category) params.set("category", category);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const resp = await fetch(`${API_BASE}/datasets.php?${params}`);
  if (!resp.ok) throw new Error(`API error ${resp.status}`);
  return (await resp.json()) as SearchResult;
}

export interface CategoriesResult {
  total_datasets: number;
  portals: { portal_id: string; total: number }[];
  categories: { portal_id: string; category: string; total: number }[];
}

export async function getCategories(): Promise<CategoriesResult> {
  const resp = await fetch(`${API_BASE}/categories.php`);
  if (!resp.ok) throw new Error(`API error ${resp.status}`);
  return (await resp.json()) as CategoriesResult;
}

export async function getDatasetInfo(datasetId: string): Promise<DatasetDetail | null> {
  const resp = await fetch(`${API_BASE}/dataset.php?id=${encodeURIComponent(datasetId)}`);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`API error ${resp.status}`);
  return (await resp.json()) as DatasetDetail;
}
