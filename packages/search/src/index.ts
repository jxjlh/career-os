export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  sourceName?: string;
  provider: string;
  resourceType: string;
  language?: string;
  difficulty?: string;
  durationMinutes?: number;
  isOfficial?: boolean;
  isFree?: boolean;
  publishedAt?: string;
  score?: number;
}

export interface SearchFilters {
  types?: string[];
  language?: string;
  difficulty?: string;
  freeOnly?: boolean;
  officialFirst?: boolean;
  publishedAfter?: string;
}

export interface SearchProvider {
  readonly name: string;
  readonly capabilities: string[];
  search(query: string, limit: number, filters?: SearchFilters): Promise<SearchResult[]>;
  healthcheck(): Promise<boolean>;
}
