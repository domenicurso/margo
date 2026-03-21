import type { CitationSettings, PageMetadata } from "./types";

function formatDate(dateString: string | null, format: "long" | "medium" = "medium") {
  if (!dateString) {
    return null;
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: format === "long" ? "long" : "short",
    day: "numeric",
  }).format(date);
}

function cleanupCitation(text: string) {
  return text
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([(])\s+/g, "$1")
    .replace(/\s+([)\]])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\.\./g, ".")
    .trim();
}

function quoteTitle(title: string, titleQuotes: boolean) {
  return titleQuotes ? `"${title}"` : title;
}

function getCitationUrl(metadata: PageMetadata, settings: CitationSettings) {
  return settings.preferCanonicalUrl && metadata.canonicalUrl ? metadata.canonicalUrl : metadata.url;
}

function getTitle(metadata: PageMetadata) {
  return metadata.title.trim();
}

function formatAuthor(author: string | null, style: CitationSettings["style"]) {
  if (!author) {
    return null;
  }

  const compactAuthor = author.replace(/^by\s+/i, "").trim();
  const parts = compactAuthor.split(/\s+/);
  if (parts.length < 2) {
    return compactAuthor;
  }

  if (style === "apa" || style === "harvard") {
    const lastName = parts.at(-1);
    const initials = parts.slice(0, -1).map(part => `${part.charAt(0).toUpperCase()}.`).join(" ");
    return `${lastName}, ${initials}`;
  }

  return compactAuthor;
}

function renderCitation(metadata: PageMetadata, settings: CitationSettings) {
  const title = getTitle(metadata);
  const tokens: Record<string, string> = {
    author: settings.includeAuthor ? formatAuthor(metadata.author, settings.style) ?? "" : "",
    title,
    titleQuoted: quoteTitle(title, settings.titleQuotes),
    siteName: settings.includeSiteName ? metadata.siteName ?? "" : "",
    publishedDate: settings.includePublishedDate ? formatDate(metadata.publishedDate, "medium") ?? "" : "",
    accessDate: settings.includeAccessDate ? formatDate(metadata.accessedAt, "long") ?? "" : "",
    url: getCitationUrl(metadata, settings),
  };

  const withOptionalBlocks = settings.customTemplate.replace(/\[\[([\s\S]+?)\]\]/g, (_, block: string) => {
    const tokenNames = Array.from(block.matchAll(/{{(\w+)}}/g), match => match[1] ?? "");
    if (tokenNames.length === 0) {
      return block;
    }

    return tokenNames.every(tokenName => tokens[tokenName]?.trim()) ? block : "";
  });

  const rendered = withOptionalBlocks.replace(/{{(\w+)}}/g, (_, tokenName: string) => tokens[tokenName] ?? "");
  return cleanupCitation(rendered);
}

export function generateCitation(metadata: PageMetadata, settings: CitationSettings) {
  return renderCitation(metadata, settings);
}
