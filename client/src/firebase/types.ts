import type { Timestamp } from "firebase/firestore";

export interface FirestoreSession {
  id: string;
  roomCode: string;
  title: string;
  moderatorUid: string;
  creatorUid?: string;
  currentStory: string;
  cardSet: string[];
  revealed: boolean;
  round: number;
  createdAt: Timestamp;
  consensusReached: boolean;
  consensusRound: number | null;
  consensusVote: string | null;
  consensusStreak: number;
  sessionEnded: boolean;
  statsConsensuses: number;
  statsCloseOnes: number;
  statsMatchCounts: Record<string, number>;
  statsPairCounts: Record<string, number>;
}

export interface FirestoreParticipant {
  uid: string;
  username: string;
  joinedAt: Timestamp;
  isModerator: boolean;
  lastSeen: Timestamp;
}

export interface FirestoreVote {
  participantId: string;
  value: string;
}
