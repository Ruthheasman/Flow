export enum ModeType {
  INTERVIEW = 'INTERVIEW',
  TOPIC_DEEP_DIVE = 'TOPIC_DEEP_DIVE',
  TUTORIAL_GUIDE = 'TUTORIAL_GUIDE',
}

export interface ModeConfig {
  id: ModeType;
  label: string;
  description: string;
  systemInstruction: string;
  color: string;
}

export interface LiveSessionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  currentPrompt: string;
}

export interface SessionFeedback {
  score: number;
  summary: string;
  strengths: string[];
  tips: string[];
}