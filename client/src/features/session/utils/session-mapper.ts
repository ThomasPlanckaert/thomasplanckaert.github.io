import type { FirestoreParticipant, FirestoreSession, FirestoreVote } from "../../../firebase/types";
import type { PokerSession, Participant } from "../types/session";
import { initials } from "./session-utils";
import { isParticipantOnline } from "./presence";

export function mapFirestoreToPokerSession(
  session: FirestoreSession,
  participants: FirestoreParticipant[],
  votes: FirestoreVote[],
  myUid: string,
  deckId: string
): { session: PokerSession; me: Participant } {
  const now = Date.now();

  const uiParticipants: Participant[] = participants.map((p) => ({
    id: p.uid,
    name: p.username,
    avatar: initials(p.username),
    isModerator: p.isModerator,
    isActive: isParticipantOnline(p.lastSeen?.toMillis() ?? null, now)
  }));

  const voteMap: Record<string, string | null> = {};
  for (const p of participants) {
    const vote = votes.find((v) => v.participantId === p.uid);
    if (!vote) {
      voteMap[p.uid] = null;
    } else if (session.revealed || p.uid === myUid) {
      voteMap[p.uid] = vote.value;
    } else {
      voteMap[p.uid] = "__voted__";
    }
  }

  const meDoc = participants.find((p) => p.uid === myUid);
  const me: Participant = {
    id: myUid,
    name: meDoc?.username ?? "You",
    avatar: initials(meDoc?.username ?? "You"),
    isModerator: meDoc?.isModerator ?? false,
    isActive: meDoc ? isParticipantOnline(meDoc.lastSeen?.toMillis() ?? null, now) : true
  };

  const pokerSession: PokerSession = {
    id: session.roomCode,
    creatorId: session.creatorUid ?? session.moderatorUid,
    title: session.title,
    story: session.currentStory,
    deckId,
    cardSet: session.cardSet,
    participants: uiParticipants,
    votes: voteMap,
    revealed: session.revealed,
    round: session.round,
    consensusReached: session.consensusReached ?? false,
    consensusRound: session.consensusRound ?? null,
    consensusStreak: session.consensusStreak ?? 0,
    sessionEnded: session.sessionEnded ?? false,
    stats: {
      consensuses: session.statsConsensuses ?? 0,
      closeOnes: session.statsCloseOnes ?? 0,
      matchCounts: session.statsMatchCounts ?? {},
      pairCounts: session.statsPairCounts ?? {}
    }
  };

  return { session: pokerSession, me };
}
