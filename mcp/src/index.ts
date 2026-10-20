#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ApiError, extractPath, validatePath, validateXml, zugferdPath } from "./api.js";

const server = new McpServer({
  name: "xrechnung-validator",
  version: "0.2.0",
});

const errorSchema = z.object({
  rule_id: z.string().optional(),
  severity: z.string().optional(),
  location: z.string().optional(),
  message: z.string().optional(),
  hint: z.string().optional(),
  rule_url: z.string().optional(),
});

server.registerTool(
  "validate_xrechnung",
  {
    title: "Validate XRechnung",
    description:
      "Validate one XRechnung XML document (UBL or CII) or ZUGFeRD PDF. " +
      "The file is uploaded to the free keyless API POST https://checkxrechnung.com/v1/validate. " +
      "Limits: 50 requests per IP per UTC day, 10 per minute, 5 MB. " +
      "The service reports persisted: false. Provide exactly one of file_path or xml. " +
      "Returns valid plus errors with rule_id and rule_url.",
    inputSchema: {
      file_path: z
        .string()
        .optional()
        .describe("Path to an XRechnung XML file or a ZUGFeRD PDF. Resolved by this process."),
      xml: z.string().optional().describe("XRechnung XML (UBL or CII) as a string. Use this or file_path."),
    },
    outputSchema: {
      valid: z.boolean(),
      fileName: z.string().optional(),
      bytes: z.number().optional(),
      hasXml: z.boolean().optional(),
      syntax: z.string().optional(),
      invoiceType: z.string().optional(),
      persisted: z.boolean().optional(),
      summary: z
        .object({
          errors: z.number().optional(),
          warnings: z.number().optional(),
        })
        .optional(),
      versions: z.record(z.string()).optional(),
      errors: z.array(errorSchema),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async ({ file_path, xml }) => {
    const path = file_path?.trim() ?? "";
    const document = xml?.trim() ?? "";
    if (Boolean(path) === Boolean(document)) {
      return toolError("Provide exactly one of file_path or xml.");
    }
    try {
      const result = path ? await validatePath(path) : await validateXml(document);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as { [key: string]: unknown },
      };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      return toolError(message);
    }
  },
);

server.registerTool(
  "validate_zugferd",
  {
    title: "Validate ZUGFeRD / Factur-X",
    description:
      "Validate one ZUGFeRD or Factur-X PDF. " +
      "The file is uploaded to POST https://checkxrechnung.com/v1/zugferd/validate. " +
      "Checks PDF/A-3 basics (veraPDF when installed, otherwise a labelled structure check), " +
      "extracts factur-x.xml, zugferd-invoice.xml or xrechnung.xml, detects the profile " +
      "(MINIMUM, BASIC WL, BASIC, EN16931, EXTENDED, XRECHNUNG) and validates the XML with the EN 16931 CII Schematron. " +
      "Profile XRECHNUNG also runs the XRechnung CII Schematron. " +
      "Same free limit as validate_xrechnung (shared counter): 50 per IP per UTC day, 10 per minute. PDF limit 10 MB. " +
      "Returns valid, profile, and errors with rule_id and rule_url.",
    inputSchema: {
      file_path: z.string().describe("Path to a ZUGFeRD or Factur-X PDF. Resolved by this process."),
    },
    outputSchema: {
      valid: z.boolean(),
      fileName: z.string().optional(),
      profile: z.string().optional(),
      embeddedName: z.string().optional(),
      pdfa: z
        .object({
          engine: z.string().optional(),
          label: z.string().optional(),
          ok: z.boolean().optional(),
        })
        .optional(),
      errors: z.array(errorSchema),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async ({ file_path }) => {
    const path = file_path?.trim() ?? "";
    if (!path) return toolError("Provide file_path.");
    try {
      const result = await zugferdPath(path);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as { [key: string]: unknown },
      };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      return toolError(message);
    }
  },
);

server.registerTool(
  "extract_zugferd",
  {
    title: "Extract ZUGFeRD / Factur-X XML",
    description:
      "Extract the embedded invoice XML and a JSON summary from a ZUGFeRD or Factur-X PDF. " +
      "Uploads the file to POST https://checkxrechnung.com/v1/zugferd/extract. " +
      "Same free limit as validate_xrechnung (shared counter). PDF limit 10 MB. " +
      "ok means an XML attachment was found. The xml field is the raw document.",
    inputSchema: {
      file_path: z.string().describe("Path to a ZUGFeRD or Factur-X PDF. Resolved by this process."),
    },
    outputSchema: {
      ok: z.boolean(),
      fileName: z.string().optional(),
      profile: z.string().optional(),
      embeddedName: z.string().optional(),
      summary: z.record(z.string()).optional(),
      xml: z.string().optional(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async ({ file_path }) => {
    const path = file_path?.trim() ?? "";
    if (!path) return toolError("Provide file_path.");
    try {
      const result = await extractPath(path);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as { [key: string]: unknown },
      };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      return toolError(message);
    }
  },
);

function toolError(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`xrechnung-validator-mcp: ${message}\n`);
  process.exit(1);
});
