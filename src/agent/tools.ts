import Anthropic from "@anthropic-ai/sdk";
import { Toolchain, validate } from "./allowlist";
import { ToolName } from "./protocol";
import { ToolBridge } from "./rpc";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description:
      "Read a file from the project. Always read a file before editing it — never guess its contents.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to the project root." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "write_file",
    description:
      "Create a new file, or completely replace an existing one. Prefer edit_file when changing part of a file that already exists.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to the project root." },
        content: { type: "string", description: "Complete file content." },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "edit_file",
    description:
      "Replace an exact string in an existing file. old_string must match the file exactly once, including whitespace. Read the file first.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to the project root." },
        old_string: { type: "string", description: "Exact text to replace." },
        new_string: { type: "string", description: "Replacement text." },
      },
      required: ["path", "old_string", "new_string"],
      additionalProperties: false,
    },
  },
  {
    name: "list_dir",
    description: "List the entries of a directory in the project.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory relative to the project root. Use \".\" for the root.",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "run_command",
    description:
      "Run one shell command in the project directory. No shell syntax: no pipes, redirects, semicolons, or command substitution. Only a fixed set of commands is permitted; a refusal explains why.",
    input_schema: {
      type: "object",
      properties: {
        cmd: { type: "string", description: "A single command, e.g. \"pnpm build\"." },
      },
      required: ["cmd"],
      additionalProperties: false,
    },
  },
  {
    name: "ask_user",
    description:
      "Ask the user for values you cannot determine yourself, such as API keys or secrets. Use sparingly — never ask for anything you can read from the project.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "What you need, in one sentence." },
        fields: {
          type: "array",
          description: "The values being requested.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              secret: { type: "boolean" },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["question", "fields"],
      additionalProperties: false,
    },
  },
];

export interface ToolOutcome {
  content: string;
  isError: boolean;
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  bridge: ToolBridge,
  toolchain: Toolchain,
): Promise<ToolOutcome> {
  if (name === "run_command") {
    const cmd = typeof input.cmd === "string" ? input.cmd : "";
    const check = validate(cmd, toolchain);
    if (!check.ok) {
      return { content: `Refused: ${check.reason}`, isError: true };
    }
    const reply = await bridge.call("run_command", { argv: check.argv });
    return { content: reply.result, isError: !reply.ok };
  }

  const reply = await bridge.call(name as ToolName, input);
  return { content: reply.result, isError: !reply.ok };
}
