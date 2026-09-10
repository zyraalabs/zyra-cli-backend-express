export type ToolName =
  | "read_file"
  | "write_file"
  | "edit_file"
  | "list_dir"
  | "run_command"
  | "ask_user";

export interface ToolCallMessage {
  type: "tool_call";
  id: string;
  tool: ToolName;
  input: Record<string, unknown>;
}

export interface ToolResultMessage {
  type: "tool_result";
  id: string;
  ok: boolean;
  result: string;
}

export interface ProgressMessage {
  type: "progress";
  event: "text" | "tool_start" | "tool_end" | "thinking";
  detail: string;
}

export interface DoneMessage {
  type: "done";
  filesChanged: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export interface StartMessage {
  type: "start";
  prompt: string;
  framework: string;
  wasScaffolded: boolean;
}

export type ServerToClient =
  | ToolCallMessage
  | ProgressMessage
  | DoneMessage
  | ErrorMessage;

export type ClientToServer = StartMessage | ToolResultMessage;

export interface AgentSocket {
  send(msg: ServerToClient): void;
  onMessage(handler: (msg: ClientToServer) => void): void;
  onClose(handler: (reason: string) => void): void;
  close(): void;
}
