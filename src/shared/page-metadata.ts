import type { PageMetadata } from "./types";

function getMetaContent(doc: Document, selectors: string[]) {
  for (const selector of selectors) {
    const value = doc.querySelector<HTMLMetaElement>(selector)?.content?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function getLinkHref(doc: Document, selector: string) {
  return doc.querySelector<HTMLLinkElement>(selector)?.href?.trim() ?? null;
}

function getHostnameLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function collectJsonLdObjects(doc: Document) {
  const scripts = Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
  const objects: Record<string, unknown>[] = [];

  for (const script of scripts) {
    const parsed = parseJson(script.textContent ?? "");
    if (!parsed) {
      continue;
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === "object") {
          objects.push(item as Record<string, unknown>);
        }
      }
      continue;
    }

    if (typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record["@graph"])) {
        for (const item of record["@graph"]) {
          if (item && typeof item === "object") {
            objects.push(item as Record<string, unknown>);
          }
        }
      } else {
        objects.push(record);
      }
    }
  }

  return objects;
}

function readJsonLdString(doc: Document, candidates: string[]) {
  const records = collectJsonLdObjects(doc);

  for (const record of records) {
    for (const candidate of candidates) {
      const value = record[candidate];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }

      if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        if (typeof nested.name === "string" && nested.name.trim()) {
          return nested.name.trim();
        }
      }
    }
  }

  return null;
}

export function extractPageMetadata(doc = document, currentUrl = location.href): PageMetadata {
  const canonicalUrl = getLinkHref(doc, 'link[rel="canonical"]');
  const title =
    getMetaContent(doc, [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[name="title"]',
    ]) ??
    readJsonLdString(doc, ["headline", "name"]) ??
    doc.title ??
    getHostnameLabel(currentUrl);

  const author =
    getMetaContent(doc, [
      'meta[name="author"]',
      'meta[property="author"]',
      'meta[property="article:author"]',
      'meta[name="parsely-author"]',
    ]) ?? readJsonLdString(doc, ["author", "creator"]);

  const siteName =
    getMetaContent(doc, ['meta[property="og:site_name"]', 'meta[name="application-name"]']) ??
    readJsonLdString(doc, ["publisher"]) ??
    getHostnameLabel(canonicalUrl ?? currentUrl);

  const publishedDate =
    getMetaContent(doc, [
      'meta[property="article:published_time"]',
      'meta[property="og:published_time"]',
      'meta[name="publish-date"]',
      'meta[name="parsely-pub-date"]',
      'meta[itemprop="datePublished"]',
    ]) ?? readJsonLdString(doc, ["datePublished", "dateCreated", "dateModified"]);

  return {
    title,
    author,
    siteName,
    url: currentUrl,
    canonicalUrl,
    publishedDate,
    accessedAt: new Date().toISOString(),
  };
}
