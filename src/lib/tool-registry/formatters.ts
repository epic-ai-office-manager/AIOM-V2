/**
 * Tool Registry Response Formatters
 * Format tool results for Claude consumption
 */

import type {
  ToolResult,
  ToolContext,
  FormattedResponse,
  ResponseFormatter,
} from "./types";

// ============================================================================
// Default Formatter
// ============================================================================

/**
 * Default response formatter that handles common result types
 */
export const defaultFormatter: ResponseFormatter = (
  result: ToolResult,
  _context: ToolContext
): FormattedResponse => {
  if (!result.success) {
    return formatErrorResponse(result);
  }

  return formatSuccessResponse(result);
};

/**
 * Format a successful result
 */
function formatSuccessResponse(result: ToolResult): FormattedResponse {
  const { data, metadata } = result;

  // Handle null/undefined data
  if (data === null || data === undefined) {
    return {
      content: "Operation completed successfully with no data returned.",
      isError: false,
    };
  }

  // Handle primitive types
  if (typeof data === "string") {
    return {
      content: data,
      isError: false,
    };
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return {
      content: String(data),
      isError: false,
    };
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return formatArrayResponse(data, metadata);
  }

  // Handle objects
  if (typeof data === "object") {
    return formatObjectResponse(data as Record<string, unknown>, metadata);
  }

  // Fallback
  return {
    content: JSON.stringify(data, null, 2),
    isError: false,
    structuredData: { data },
  };
}

/**
 * Format an error result
 */
function formatErrorResponse(result: ToolResult): FormattedResponse {
  const error = result.error;

  if (!error) {
    return {
      content: "An unknown error occurred.",
      isError: true,
    };
  }

  let content = `Error: ${error.message}`;

  if (error.code) {
    content = `[${error.code}] ${content}`;
  }

  if (error.retryable) {
    content += " (This error may be temporary - you can retry the operation)";
  }

  return {
    content,
    isError: true,
    structuredData: {
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    },
  };
}

/**
 * Format array data
 */
function formatArrayResponse(
  data: unknown[],
  metadata?: ToolResult["metadata"]
): FormattedResponse {
  if (data.length === 0) {
    return {
      content: "No results found.",
      isError: false,
      structuredData: { items: [], count: 0 },
    };
  }

  // Check if array contains simple primitives
  if (data.every((item) => typeof item === "string" || typeof item === "number")) {
    const content =
      data.length <= 10
        ? `Results (${data.length} items):\n${data.map((item, i) => `${i + 1}. ${item}`).join("\n")}`
        : `Results (${data.length} items, showing first 10):\n${data.slice(0, 10).map((item, i) => `${i + 1}. ${item}`).join("\n")}\n... and ${data.length - 10} more`;

    return {
      content,
      isError: false,
      structuredData: { items: data, count: data.length },
    };
  }

  // Array of objects
  const content = formatObjectArray(data as Record<string, unknown>[]);
  return {
    content,
    isError: false,
    structuredData: { items: data, count: data.length },
  };
}

/**
 * Format an array of objects into readable text
 */
function formatObjectArray(items: Record<string, unknown>[]): string {
  const count = items.length;
  const displayItems = items.slice(0, 10);

  let content = `Results (${count} items):\n\n`;

  displayItems.forEach((item, index) => {
    content += `--- Item ${index + 1} ---\n`;
    content += formatObjectToText(item);
    content += "\n";
  });

  if (count > 10) {
    content += `\n... and ${count - 10} more items`;
  }

  return content.trim();
}

/**
 * Format object data
 */
function formatObjectResponse(
  data: Record<string, unknown>,
  metadata?: ToolResult["metadata"]
): FormattedResponse {
  const content = formatObjectToText(data);

  return {
    content,
    isError: false,
    structuredData: data,
  };
}

/**
 * Format an object to readable text
 */
function formatObjectToText(
  obj: Record<string, unknown>,
  indent: number = 0
): string {
  const lines: string[] = [];
  const prefix = "  ".repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    const formattedKey = formatKey(key);

    if (value === null || value === undefined) {
      lines.push(`${prefix}${formattedKey}: (not set)`);
    } else if (typeof value === "object" && !Array.isArray(value)) {
      lines.push(`${prefix}${formattedKey}:`);
      lines.push(formatObjectToText(value as Record<string, unknown>, indent + 1));
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${prefix}${formattedKey}: (empty list)`);
      } else if (value.length <= 5 && value.every((v) => typeof v !== "object")) {
        lines.push(`${prefix}${formattedKey}: ${value.join(", ")}`);
      } else {
        lines.push(`${prefix}${formattedKey}: (${value.length} items)`);
      }
    } else {
      lines.push(`${prefix}${formattedKey}: ${value}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format a camelCase or snake_case key to readable text
 */
function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;

  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

// ============================================================================
// Specialized Formatters
// ============================================================================

/**
 * Create a table formatter for array data
 */
export function createTableFormatter<T extends object>(
  columns: Array<{ key: string; label: string; width?: number }>
): ResponseFormatter<T[]> {
  return (result: ToolResult<T[]>, _context: ToolContext): FormattedResponse => {
    if (!result.success || !result.data) {
      return defaultFormatter(result as ToolResult, _context);
    }

    const data = result.data;
    if (data.length === 0) {
      return {
        content: "No data to display.",
        isError: false,
        structuredData: { items: [], count: 0 },
      };
    }

    // Build header
    const header = columns.map((col) => col.label).join(" | ");
    const separator = columns.map((col) => "-".repeat(col.width ?? col.label.length)).join("-+-");

    // Build rows
    const rows = data.slice(0, 50).map((item) =>
      columns
        .map((col) => String(getValueAtPath(item, String(col.key)) ?? ""))
        .join(" | ")
    );

    let content = `${header}\n${separator}\n${rows.join("\n")}`;

    if (data.length > 50) {
      content += `\n\n... and ${data.length - 50} more rows`;
    }

    return {
      content,
      isError: false,
      structuredData: { items: data, count: data.length },
    };
  };
}

/**
 * Create a JSON formatter
 */
export function createJsonFormatter<T>(): ResponseFormatter<T> {
  return (result: ToolResult<T>, _context: ToolContext): FormattedResponse => {
    if (!result.success) {
      return formatErrorResponse(result);
    }

    return {
      content: JSON.stringify(result.data, null, 2),
      isError: false,
      structuredData:
        typeof result.data === "object" && result.data !== null
          ? (result.data as Record<string, unknown>)
          : { value: result.data },
    };
  };
}

/**
 * Create a summary formatter that shows key metrics
 */
export function createSummaryFormatter<T extends object>(
  summaryKeys: Array<{ key: string; label: string }>
): ResponseFormatter<T> {
  return (result: ToolResult<T>, _context: ToolContext): FormattedResponse => {
    if (!result.success || !result.data) {
      return defaultFormatter(result as ToolResult, _context);
    }

    const data = result.data;
    const lines = summaryKeys
      .map(({ key, label }) => `${label}: ${getValueAtPath(data, String(key)) ?? "N/A"}`)
      .filter(Boolean);

    return {
      content: lines.join("\n"),
      isError: false,
      structuredData: data as Record<string, unknown>,
    };
  };
}

/**
 * Create a markdown formatter
 */
export function createMarkdownFormatter<T>(): ResponseFormatter<T> {
  return (result: ToolResult<T>, _context: ToolContext): FormattedResponse => {
    if (!result.success) {
      return {
        content: `**Error:** ${result.error?.message ?? "Unknown error"}`,
        isError: true,
      };
    }

    const data = result.data;

    if (typeof data === "string") {
      return { content: data, isError: false };
    }

    if (Array.isArray(data)) {
      const items = data
        .slice(0, 20)
        .map((item, i) => {
          if (typeof item === "object" && item !== null) {
            return `### Item ${i + 1}\n${formatObjectToMarkdown(item as Record<string, unknown>)}`;
          }
          return `- ${item}`;
        })
        .join("\n\n");

      let content = items;
      if (data.length > 20) {
        content += `\n\n*... and ${data.length - 20} more items*`;
      }

      return {
        content,
        isError: false,
        structuredData: { items: data, count: data.length },
      };
    }

    if (typeof data === "object" && data !== null) {
      return {
        content: formatObjectToMarkdown(data as Record<string, unknown>),
        isError: false,
        structuredData: data as Record<string, unknown>,
      };
    }

    return {
      content: String(data),
      isError: false,
    };
  };
}

/**
 * Format object to markdown
 */
function formatObjectToMarkdown(obj: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const formattedKey = formatKey(key);

    if (value === null || value === undefined) {
      lines.push(`- **${formattedKey}:** _Not set_`);
    } else if (typeof value === "object" && !Array.isArray(value)) {
      lines.push(`- **${formattedKey}:**`);
      const nested = formatObjectToMarkdown(value as Record<string, unknown>);
      lines.push(nested.split("\n").map((l) => "  " + l).join("\n"));
    } else if (Array.isArray(value)) {
      lines.push(`- **${formattedKey}:** ${value.length} items`);
    } else {
      lines.push(`- **${formattedKey}:** ${value}`);
    }
  }

  return lines.join("\n");
}

// ============================================================================
// Formatter Utilities
// ============================================================================

/**
 * Combine multiple formatters with fallback
 */
export function combineFormatters<T>(
  formatters: ResponseFormatter<T>[]
): ResponseFormatter<T> {
  return (result: ToolResult<T>, context: ToolContext): FormattedResponse => {
    for (const formatter of formatters) {
      try {
        return formatter(result, context);
      } catch {
        // Continue to next formatter
      }
    }
    // Fallback to default
    return defaultFormatter(result as ToolResult, context);
  };
}

/**
 * Add metadata to formatted response
 */
export function withMetadata<T>(
  formatter: ResponseFormatter<T>,
  getMetadata: (result: ToolResult<T>, context: ToolContext) => Record<string, unknown>
): ResponseFormatter<T> {
  return (result: ToolResult<T>, context: ToolContext): FormattedResponse => {
    const formatted = formatter(result, context);
    return {
      ...formatted,
      structuredData: {
        ...formatted.structuredData,
        ...getMetadata(result, context),
      },
    };
  };
}
