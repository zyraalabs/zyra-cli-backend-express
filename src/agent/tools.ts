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
      "Ask the user a question and wait for their answer. Use it for a decision only they can make — a product choice with no obviously right answer, or a secret you cannot read from the project. Do not use it for anything discoverable with list_dir or read_file, and never to confirm work you should simply do. Ask one question at a time, as early as possible, and keep building afterwards.",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The question, in one plain sentence.",
        },
        kind: {
          type: "string",
          enum: ["choice", "secret"],
          description:
            "\"choice\" for a product decision, which shows the options as a picker. \"secret\" for API keys and credentials, which are written to the env file.",
        },
        options: {
          type: "array",
          description:
            "For kind \"choice\": two to four options. Include the one you would pick first.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Two or three words." },
              description: {
                type: "string",
                description: "One line on what this choice means.",
              },
            },
            required: ["label"],
            additionalProperties: false,
          },
        },
        fields: {
          type: "array",
          description: "For kind \"secret\": the environment variables needed.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "The variable name, e.g. STRIPE_SECRET_KEY." },
              description: { type: "string" },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["question", "kind"],
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
