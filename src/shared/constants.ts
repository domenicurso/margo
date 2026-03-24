import type { CitationSettings, PageMetadata, WidgetState } from "./types";
import { DEFAULT_CITATION_STYLE, DEFAULT_CITATION_TEMPLATE } from "./citation";

export const SETTINGS_STORAGE_KEY = "citationSettings";
export const WIDGET_STORAGE_KEY = "widgetState";
export const CONTENT_HOST_ID = "citer-extension-root";

export const DEFAULT_SETTINGS: CitationSettings = {
  style: DEFAULT_CITATION_STYLE,
  customTemplate: DEFAULT_CITATION_TEMPLATE,
  includeAuthor: true,
  includeSiteName: true,
  includePublishedDate: true,
  includeAccessDate: true,
  titleQuotes: true,
  preferCanonicalUrl: true,
};

export const DEFAULT_WIDGET_STATE: WidgetState = {
  corner: "bottom-right",
  collapsed: false,
};

export const SAMPLE_METADATA: PageMetadata = {
  title: "How Floating Citation Widgets Improve Research Workflows",
  author: "Jordan Lee",
  siteName: "Signal Atlas",
  url: "https://signalatlas.example.com/research/floating-citations",
  canonicalUrl: "https://signalatlas.example.com/research/floating-citations",
  publishedDate: "2026-02-18T10:30:00.000Z",
  accessedAt: "2026-03-21T09:00:00.000Z",
};
