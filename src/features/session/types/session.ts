export type CardValue = string;

export interface Deck {
  id: string;
  name: string;
  values: CardValue[];
  builtIn?: boolean;
}

export interface Participant {
  id: string;
  name: string;
  avatar: string;
  isModerator?: boolean;
  isActive?: boolean;
}

export interface PokerSession {
  id: string;
  creatorId?: string;
  sessionEnded?: boolean;
  revealHistory?: { participantCount: number; votes: Record<string, string> }[];
  title: string;
  story: string;
  deckId: string;
  participants: Participant[];
  votes: Record<string, CardValue | null>;
  revealed: boolean;
  round: number;
}
