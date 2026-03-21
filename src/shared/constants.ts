import type { CitationSettings, PageMetadata, WidgetState } from "./types";

export const SETTINGS_STORAGE_KEY = "citationSettings";
export const WIDGET_STORAGE_KEY = "widgetState";
export const CONTENT_HOST_ID = "citer-extension-root";

export const DEFAULT_SETTINGS: CitationSettings = {
  style: "mla",
  customTemplate:
    "{{author}}[[. ]][[{{titleQuoted}}. ]][[{{siteName}}, ]][[{{publishedDate}}, ]][[Accessed {{accessDate}}. ]][[{{url}}]]",
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

export const CUSTOM_TEMPLATE_HELP =
  "Use {{author}}, {{title}}, {{titleQuoted}}, {{siteName}}, {{publishedDate}}, {{accessDate}}, {{url}}. Wrap optional blocks in [[...]] so punctuation disappears when data is missing.";
