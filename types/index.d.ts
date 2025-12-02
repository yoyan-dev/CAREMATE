// types/index.ts
export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  text: string;
  time: string; // ISO string or human readable
  isThinking?: boolean;
}
