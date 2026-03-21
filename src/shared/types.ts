export type CitationStyle = "apa" | "mla" | "chicago" | "harvard" | "custom";

export type WidgetCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface CitationSettings {
  style: CitationStyle;
  customTemplate: string;
  includeAuthor: boolean;
  includeSiteName: boolean;
  includePublishedDate: boolean;
  includeAccessDate: boolean;
  titleQuotes: boolean;
  preferCanonicalUrl: boolean;
}

export interface WidgetState {
  corner: WidgetCorner;
  collapsed: boolean;
}

export interface PageMetadata {
  title: string;
  author: string | null;
  siteName: string | null;
  url: string;
  canonicalUrl: string | null;
  publishedDate: string | null;
  accessedAt: string;
}
