/**
 * Utilities for handling different context formats
 */

import type { ContextFormat } from "../types";

/**
 * Convert context data between different formats
 * @param data Content to convert
 * @param sourceFormat Original format
 * @param targetFormat Target format
 * @returns Converted data string
 */
export const convertContext = (
  data: string,
  sourceFormat: ContextFormat,
  targetFormat: ContextFormat,
): string => {
  if (sourceFormat === targetFormat) {
    return data;
  }

  // Parse the input according to source format
  // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
  let parsedData;
  try {
    parsedData = parseContextData(data, sourceFormat);
  } catch (error) {
    console.error(`Error parsing ${sourceFormat} data:`, error);
    return ""; // Return empty string if parsing fails
  }

  // Convert the parsed data to the target format
  try {
    return formatContextData(parsedData, targetFormat);
  } catch (error) {
    console.error(`Error formatting to ${targetFormat}:`, error);
    return ""; // Return empty string if formatting fails
  }
};

/**
 * Parse context data from a string based on format
 * @param data Data string to parse
 * @param format Format of the data
 * @returns Parsed object
 */
export const parseContextData = (
  data: string,
  format: ContextFormat,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
): Record<string, any> => {
  switch (format) {
    case "json":
      return JSON.parse(data);
    case "csv":
      return parseCSV(data);
    case "xml":
      return parseXML(data);
    case "txt":
      // For text formats, we'll create a simple object with the content
      return { content: data };
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
};

/**
 * Format parsed data into a specific context format
 * @param data Parsed data object
 * @param format Target format
 * @returns Formatted string
 */
export const formatContextData = (
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  data: Record<string, any>,
  format: ContextFormat,
): string => {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "csv":
      return formatCSV(data);
    case "xml":
      return formatXML(data);
    case "txt":
      // For text formats, we'll create a simple representation
      return formatPlainText(data);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
};

/**
 * Parse CSV data into an object
 * @param csv CSV string
 * @returns Parsed object
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const parseCSV = (csv: string): Record<string, any> => {
  const lines = csv.split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    return {};
  }

  const headers = lines[0].split(",").map((header) => header.trim());
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const result: Record<string, any> = {};

  // For simple CSV, create a single object with properties
  if (lines.length >= 2) {
    const values = lines[1].split(",").map((value) => value.trim());
    headers.forEach((header, index) => {
      if (index < values.length) {
        result[header] = values[index];
      }
    });
  }

  return result;
};

/**
 * Format data as CSV
 * @param data Data object
 * @returns CSV string
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const formatCSV = (data: Record<string, any>): string => {
  // Flatten nested objects for CSV format
  const flatData: Record<string, string> = {};

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const flattenObject = (obj: Record<string, any>, prefix = "") => {
    for (const key in obj) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        flattenObject(value, newKey);
      } else {
        flatData[newKey] = Array.isArray(value)
          ? value.join(";")
          : String(value);
      }
    }
  };

  flattenObject(data);

  const headers = Object.keys(flatData);
  const values = headers.map((header) => flatData[header]);

  return [headers.join(","), values.join(",")].join("\n");
};

/**
 * Parse XML string into an object (simple implementation)
 * @param xml XML string
 * @returns Parsed object
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const parseXML = (xml: string): Record<string, any> => {
  // This is a very simple implementation
  // For a production app, you would use a proper XML parser
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const result: Record<string, any> = {};

  // Extract content between tags
  const tagRegex = /<([^>]+)>([^<]+)<\/\1>/g;
  // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
  let match;

  // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
  while ((match = tagRegex.exec(xml)) !== null) {
    const [, key, value] = match;
    result[key] = value.trim();
  }

  return result;
};

/**
 * Format data as XML
 * @param data Data object
 * @returns XML string
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const formatXML = (data: Record<string, any>): string => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<UserData>\n';

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const addNode = (obj: Record<string, any>, indent = "  ") => {
    for (const key in obj) {
      const value = obj[key];

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        xml += `${indent}<${key}>\n`;
        // biome-ignore lint/style/useTemplate: <explanation>
        addNode(value, indent + "  ");
        xml += `${indent}</${key}>\n`;
      } else {
        const stringValue = Array.isArray(value)
          ? value.join(", ")
          : String(value);
        xml += `${indent}<${key}>${stringValue}</${key}>\n`;
      }
    }
  };

  addNode(data);
  xml += "</UserData>";

  return xml;
};

/**
 * Format data as plain text
 * @param data Data object
 * @returns Plain text string
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const formatPlainText = (data: Record<string, any>): string => {
  // If data already has a content property, use that
  if (typeof data.content === "string") {
    return data.content;
  }

  let text = "";

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const addText = (obj: Record<string, any>, prefix = "") => {
    for (const key in obj) {
      const value = obj[key];
      const label = prefix ? `${prefix} - ${key}` : key;

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        text += `${label}:\n`;
        addText(value, `  ${label}`);
      } else {
        const stringValue = Array.isArray(value)
          ? value.join(", ")
          : String(value);
        text += `${label}: ${stringValue}\n`;
      }
    }
  };

  addText(data);

  return text;
};
