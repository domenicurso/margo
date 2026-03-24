import type { CitationSettings, PageMetadata } from "./types";

import {
  buildCitationTemplateContext,
  CITATION_TEMPLATE_PRESET_DEFINITIONS,
  CITATION_TEMPLATE_PRESETS,
  DEFAULT_CITATION_STYLE,
  DEFAULT_CITATION_TEMPLATE,
  isCitationStyle,
  listCitationTemplateVariableValues,
  parseCitationTemplate,
  renderCitationTemplate,
  stringifyCitationTemplate,
  type CitationTemplateDiagnostic,
} from "./citation-template";

export type {
  CitationTemplateDiagnostic,
  CitationTemplateNode,
  CitationTemplateParseResult,
} from "./citation-template";
export {
  buildCitationTemplateContext,
  CITATION_TEMPLATE_PRESET_DEFINITIONS,
  CITATION_TEMPLATE_PRESETS,
  CITATION_TEMPLATE_VARIABLES,
  CUSTOM_TEMPLATE_HELP,
  DEFAULT_CITATION_STYLE,
  DEFAULT_CITATION_TEMPLATE,
  isCitationStyle,
  listCitationTemplateVariableValues,
  parseCitationTemplate,
  stringifyCitationTemplate,
} from "./citation-template";

export interface CitationGenerationResult {
  citation: string;
  diagnostics: CitationTemplateDiagnostic[];
  usedFallback: boolean;
}

function getFallbackTemplate(settings: CitationSettings) {
  if (settings.style !== "custom") {
    return CITATION_TEMPLATE_PRESETS[settings.style];
  }

  return DEFAULT_CITATION_TEMPLATE;
}

export function generateCitationResult(
  metadata: PageMetadata,
  settings: CitationSettings,
): CitationGenerationResult {
  const context = buildCitationTemplateContext(metadata, settings);
  const primaryResult = renderCitationTemplate(settings.customTemplate, context);

  if (primaryResult.valid) {
    return {
      citation: primaryResult.text,
      diagnostics: primaryResult.diagnostics,
      usedFallback: false,
    };
  }

  const fallbackTemplate = getFallbackTemplate(settings);
  if (fallbackTemplate === settings.customTemplate) {
    return {
      citation: primaryResult.text,
      diagnostics: primaryResult.diagnostics,
      usedFallback: false,
    };
  }

  const fallbackSettings: CitationSettings =
    settings.style === "custom"
      ? { ...settings, style: DEFAULT_CITATION_STYLE }
      : settings;
  const fallbackContext = buildCitationTemplateContext(metadata, fallbackSettings);
  const fallbackResult = renderCitationTemplate(fallbackTemplate, fallbackContext);

  return {
    citation: fallbackResult.text,
    diagnostics: [
      ...primaryResult.diagnostics,
      ...fallbackResult.diagnostics,
      {
        code: "template-fallback",
        severity: "warning",
        message:
          "Current template is invalid. Using the fallback preset for rendering.",
        start: 0,
        end: settings.customTemplate.length,
      },
    ],
    usedFallback: true,
  };
}

export function generateCitation(
  metadata: PageMetadata,
  settings: CitationSettings,
) {
  return generateCitationResult(metadata, settings).citation;
}
