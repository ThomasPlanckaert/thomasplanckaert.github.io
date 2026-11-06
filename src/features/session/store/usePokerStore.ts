import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Deck, PokerSession } from "../types/session";
import { defaultDecks, initials, uid } from "../utils/session-utils";

interface JoinPayload {
  sessionId: string;
  username: string;
  asModerator?: boolean;
}

interface PokerState {
  sessions: Record<string, PokerSession>;
  decks: Deck[];
  identities: Record<string, string>;
  darkMode: boolean;
  celebrationRound: number | null;
  joinSession: (payload: JoinPayload) => { userId: string; created: boolean };
  setStory: (sessionId: string, story: string) => void;
  setTitle: (sessionId: string, title: string) => void;
  setDeck: (sessionId: string, deckId: string) => void;
  addCustomDeck: (name: string, values: string[]) => void;
  removeParticipant: (sessionId: string, userId: string) => void;
  castVote: (sessionId: string, userId: string, vote: string) => void;
  clearVotes: (sessionId: string) => void;
  revealVotes: (sessionId: string) => boolean;
  nextRound: (sessionId: string) => void;
  endSession: (sessionId: string) => void;
  setActive: (sessionId: string, userId: string, active: boolean) => void;
  toggleTheme: () => void;
}

const blankSession = (sessionId: string): PokerSession => ({
  id: sessionId,
  title: "Sprint Planning",
  story: "As a user, I can reset my password using email",
  deckId: defaultDecks[0].id,
  participants: [],
  votes: {},
  revealed: false,
  round: 1
});

export const usePokerStore = create<PokerState>()(
  persist(
    (set, get) => ({
      sessions: {},
      decks: defaultDecks,
      identities: {},
      darkMode: true,
      celebrationRound: null,
      joinSession: ({ sessionId, username, asModerator }) => {
        const state = get();
        const session = state.sessions[sessionId] ?? blankSession(sessionId);
        const existingId = state.identities[sessionId];
        const existingParticipant = existingId
          ? session.participants.find((p) => p.id === existingId)
          : undefined;

        if (existingParticipant) {
          return { userId: existingId, created: false };
        }

        const userId = uid();
        const participant = {
          id: userId,
          name: username,
          avatar: initials(username),
          isModerator: asModerator || session.participants.length === 0,
          isActive: true
        };

        set({
          identities: { ...state.identities, [sessionId]: userId },
          sessions: {
            ...state.sessions,
            [sessionId]: {
              ...session,
              creatorId: session.creatorId ?? session.participants[0]?.id ?? userId,
              participants: [...session.participants, participant],
              votes: { ...session.votes, [userId]: null }
            }
          }
        });

        return { userId, created: true };
      },
      setStory: (sessionId, story) =>
        set((state) => ({
          sessions: { ...state.sessions, [sessionId]: { ...state.sessions[sessionId], story } }
        })),
      setTitle: (sessionId, title) =>
        set((state) => {
          const session = state.sessions[sessionId];
          const creatorId = session.creatorId ?? session.participants[0]?.id;
          if (state.identities[sessionId] !== creatorId || session.sessionEnded || !title.trim() || title.trim().length > 200) return state;
          return { sessions: { ...state.sessions, [sessionId]: { ...session, title: title.trim() } } };
        }),
      setDeck: (sessionId, deckId) =>
        set((state) => ({
          sessions: {
            ...state.sessions,
            [sessionId]: {
              ...state.sessions[sessionId],
              deckId,
              revealed: false,
              votes: Object.fromEntries(state.sessions[sessionId].participants.map((p) => [p.id, null]))
            }
          }
        })),
      addCustomDeck: (name, values) =>
        set((state) => ({
          decks: [...state.decks, { id: uid(), name, values: values.filter(Boolean) }]
        })),
      removeParticipant: (sessionId, userId) =>
        set((state) => {
          const session = state.sessions[sessionId];
          const participants = session.participants.filter((p) => p.id !== userId);
          const votes = Object.fromEntries(participants.map((p) => [p.id, session.votes[p.id] ?? null]));
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...session, participants, votes }
            }
          };
        }),
      castVote: (sessionId, userId, vote) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (session.revealed || session.sessionEnded) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...session, votes: { ...session.votes, [userId]: vote } }
            }
          };
        }),
      clearVotes: (sessionId) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (session.sessionEnded) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                revealed: false,
                votes: Object.fromEntries(session.participants.map((p) => [p.id, null]))
              }
            }
          };
        }),
      revealVotes: (sessionId) => {
        const state = get();
        const session = state.sessions[sessionId];
        if (session.revealed || session.sessionEnded) return false;
        const voteValues = Object.values(session.votes).filter((v): v is string => !!v);
        const everyoneVoted = voteValues.length === session.participants.length && voteValues.length > 0;
        const consensus = everyoneVoted && new Set(voteValues).size === 1;

        set({
          sessions: {
            ...state.sessions,
            [sessionId]: {
              ...session,
              revealed: true,
              revealHistory: [...(session.revealHistory ?? []), { participantCount: session.participants.length, votes: Object.fromEntries(
                session.participants.flatMap((participant) => {
                  const vote = session.votes[participant.id];
                  return vote == null ? [] : [[participant.id, vote]];
                })
              ) }]
            }
          },
          celebrationRound: consensus ? session.round : null
        });

        return consensus;
      },
      nextRound: (sessionId) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (session.sessionEnded) return state;
          return {
            celebrationRound: null,
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                round: session.round + 1,
                revealed: false,
                votes: Object.fromEntries(session.participants.map((p) => [p.id, null]))
              }
            }
          };
        }),
      endSession: (sessionId) => set((state) => {
        const session = state.sessions[sessionId];
        const me = session.participants.find((participant) => participant.id === state.identities[sessionId]);
        if (!me?.isModerator) return state;
        return { celebrationRound: null, sessions: { ...state.sessions, [sessionId]: { ...session, sessionEnded: true } } };
      }),
      setActive: (sessionId, userId, active) =>
        set((state) => ({
          sessions: {
            ...state.sessions,
            [sessionId]: {
              ...state.sessions[sessionId],
              participants: state.sessions[sessionId].participants.map((p) =>
                p.id === userId ? { ...p, isActive: active } : p
              )
            }
          }
        })),
      toggleTheme: () => set((state) => ({ darkMode: !state.darkMode }))
    }),
    {
      name: "planning-poker-state",
      merge: (persistedState, currentState) => {
        const saved = persistedState as Partial<PokerState> | undefined;
        return {
          ...currentState,
          ...saved,
          decks: [...defaultDecks, ...(saved?.decks ?? []).filter((deck) => !defaultDecks.some((builtIn) => builtIn.id === deck.id))]
        };
      }
    }
  )
);
