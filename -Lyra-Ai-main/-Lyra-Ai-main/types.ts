export type Role = 'user' | 'assistant';
export type MessageType = 'text' | 'image';

export interface Message {
  id: number;
  role: Role;
  type: MessageType;
  content: string;
}

export type Mode = 'architect' | 'master' | 'reskin';

export interface ViewAngle {
  label: string;
  value: string;
}