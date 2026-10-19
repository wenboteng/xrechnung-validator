#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ApiError, validatePath, validateXml } from "./api.js";

const server = new McpServer({
  name: "xrechnung-validator",
  version: "0.1.0",
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
