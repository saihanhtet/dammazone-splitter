export type MyanmarParagraphConfig = {
  idealCharsPerParagraph: number;
  maxCharsPerParagraph: number;
  minCharsPerParagraph: number;
};

const DEFAULT_CONFIG: MyanmarParagraphConfig = {
  // Tuned for large display text (e.g., NamKhone Grand at 75px)
  idealCharsPerParagraph: 150,
  maxCharsPerParagraph: 210,
  minCharsPerParagraph: 90,
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isAlreadyLabeledParagraphText(text: string): boolean {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return false;
  // Detect "Paragraph 1" style labeling already present in content.
  return /^Paragraph\s+1\b/m.test(normalized);
}

function normalizeLabeledParagraphText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const blocks = normalized
    .split(/\n\s*\n+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  const paragraphs = blocks
    .filter((block) => !/^Paragraph\s+\d+\b$/i.test(block))
    .map((block) => block.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return "";
  return formatLabeledParagraphs(paragraphs);
}

function splitBySentenceBoundary(text: string): string[] {
  // Primary split by Myanmar sentence punctuation "။" while preserving punctuation.
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const units = normalized
    .split(/(။)/)
    .reduce<string[]>((acc, part, index, arr) => {
      if (!part) return acc;
      if (part === "။") {
        const previous = acc.pop() ?? "";
        acc.push(`${previous}။`);
        return acc;
      }

      // If this segment is the final one without trailing "။", keep it as-is.
      if (index === arr.length - 1) {
        acc.push(part.trim());
      } else {
        acc.push(part.trim());
      }
      return acc;
    }, [])
    .map((s) => normalizeWhitespace(s))
    .filter(Boolean);

  return units;
}

function splitLongUnitByComma(unit: string, maxCharsPerParagraph: number): string[] {
  if (unit.length <= maxCharsPerParagraph) return [unit];

  // Secondary split by Myanmar comma "၊" only when needed.
  const parts = unit
    .split(/(၊)/)
    .reduce<string[]>((acc, part) => {
      if (!part) return acc;
      if (part === "၊") {
        const previous = acc.pop() ?? "";
        acc.push(`${previous}၊`);
      } else {
        acc.push(part.trim());
      }
      return acc;
    }, [])
    .map((s) => normalizeWhitespace(s))
    .filter(Boolean);

  if (parts.length <= 1) return [unit];

  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    const candidate = current ? `${current} ${part}` : part;
    if (candidate.length <= maxCharsPerParagraph) {
      current = candidate;
    } else {
      if (current) chunks.push(normalizeWhitespace(current));
      current = part;
    }
  }

  if (current) chunks.push(normalizeWhitespace(current));
  return chunks;
}

function mergeTinyParagraphs(
  paragraphs: string[],
  minCharsPerParagraph: number,
  maxCharsPerParagraph: number
): string[] {
  if (paragraphs.length <= 1) return paragraphs;

  const merged: string[] = [];
  for (const paragraph of paragraphs) {
    const normalized = normalizeWhitespace(paragraph);
    if (!normalized) continue;

    const prev = merged[merged.length - 1];
    if (
      prev &&
      normalized.length < minCharsPerParagraph &&
      `${prev} ${normalized}`.length <= maxCharsPerParagraph
    ) {
      merged[merged.length - 1] = normalizeWhitespace(`${prev} ${normalized}`);
    } else {
      merged.push(normalized);
    }
  }

  return merged;
}

function formatLabeledParagraphs(paragraphs: string[]): string {
  // Required exact structure:
  // Paragraph 1
  //
  // <text>
  //
  // Paragraph 2
  // ...
  return paragraphs
    .map((paragraph, index) => `Paragraph ${index + 1}\n\n${paragraph}`)
    .join("\n\n");
}

export function formatMyanmarParagraphs(
  text: string,
  config: Partial<MyanmarParagraphConfig> = {}
): string {
  if (isAlreadyLabeledParagraphText(text)) {
    return normalizeLabeledParagraphText(text);
  }

  const effectiveConfig: MyanmarParagraphConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const normalizedInput = normalizeWhitespace(text);
  if (!normalizedInput) return "";

  const sentenceUnits = splitBySentenceBoundary(normalizedInput);
  const expandedUnits = sentenceUnits.flatMap((unit) =>
    splitLongUnitByComma(unit, effectiveConfig.maxCharsPerParagraph)
  );

  const paragraphs: string[] = [];
  let current = "";

  for (const unit of expandedUnits) {
    const cleanedUnit = normalizeWhitespace(unit);
    if (!cleanedUnit) continue;

    const candidate = current ? `${current} ${cleanedUnit}` : cleanedUnit;

    // Prefer growing toward ideal size, but enforce max.
    if (candidate.length <= effectiveConfig.idealCharsPerParagraph) {
      current = candidate;
      continue;
    }

    if (current && candidate.length > effectiveConfig.maxCharsPerParagraph) {
      paragraphs.push(normalizeWhitespace(current));
      current = cleanedUnit;
      continue;
    }

    // If candidate passed ideal but still under max, allow one more unit for natural grouping.
    current = candidate;
  }

  if (current) paragraphs.push(normalizeWhitespace(current));

  const mergedParagraphs = mergeTinyParagraphs(
    paragraphs,
    effectiveConfig.minCharsPerParagraph,
    effectiveConfig.maxCharsPerParagraph
  ).filter(Boolean);

  return formatLabeledParagraphs(mergedParagraphs);
}
