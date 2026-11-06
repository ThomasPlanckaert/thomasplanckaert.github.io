import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { ensureAnonymousAuth, subscribeToAuth } from "../firebase/auth";
import { participantRef, participantsRef, sessionRef, votesRef } from "../firebase/firestore";
import type { FirestoreParticipant, FirestoreSession, FirestoreVote } from "../firebase/types";
import {
  findDeckForCardSet,
  usePokerStore
} from "../features/session/store/usePokerStore";
import type { Participant, PokerSession } from "../features/session/types/session";
import { PRESENCE_INTERVAL_MS } from "../features/session/utils/presence";
import { mapFirestoreToPokerSession } from "../features/session/utils/session-mapper";
import * as sessionService from "../services/sessionService";
import { clearIdentity, loadIdentity, saveIdentity } from "../services/storage";

interface UseSessionResult {
  session: PokerSession | null;
  me: Participant | null;
  participantId: string | null;
  connected: boolean;
  connecting: boolean;
  createRoom: (username: string) => Promise<string | null>;
  joinRoom: (username: string, roomCode: string) => Promise<boolean>;
  castVote: (vote: string) => void;
  revealVotes: () => void;
  clearVotes: () => void;
  nextRound: () => void;
  setStory: (story: string) => void;
  setTitle: (title: string) => void;
  setDeck: (deckId: string) => void;
  removeParticipant: (userId: string) => void;
  leaveRoom: () => void;
  updateUsername: (username: string) => void;
  endSession: () => void;
  closeRoom: () => void;
}

export function useSession(
  roomCode?: string,
  options?: { autoReconnect?: boolean }
): UseSessionResult {
  const navigate = useNavigate();
  const decks = usePokerStore((s) => s.decks);
  const setSelectedDeckId = usePokerStore((s) => s.setSelectedDeckId);
  const selectedDeckId = usePokerStore((s) => s.selectedDeckId);

  const [firestoreSession, setFirestoreSession] = useState<FirestoreSession | null>(null);
  const [participants, setParticipants] = useState<FirestoreParticipant[]>([]);
  const [votes, setVotes] = useState<FirestoreVote[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [myUid, setMyUid] = useState<string | null>(null);
  const reconnectAttempted = useRef(false);

  useEffect(() => {
    return subscribeToAuth((user) => {
      setAuthReady(!!user);
      setMyUid(user?.uid ?? null);
    });
  }, []);

  useEffect(() => {
    void ensureAnonymousAuth().catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to sign in");
    });
  }, []);

  useEffect(() => {
    if (!roomCode || !authReady) return;

    const code = roomCode.toUpperCase();
    const unsubSession = onSnapshot(
      sessionRef(code),
      (snap) => {
        if (!snap.exists()) {
          setFirestoreSession(null);
          return;
        }
        setFirestoreSession(snap.data() as FirestoreSession);
      },
      (err) => toast.error(err.message)
    );

    const unsubParticipants = onSnapshot(
      participantsRef(code),
      (snap) => {
        setParticipants(snap.docs.map((d) => d.data() as FirestoreParticipant));
      },
      (err) => toast.error(err.message)
    );

    const unsubVotes = onSnapshot(
      votesRef(code),
      (snap) => {
        setVotes(snap.docs.map((d) => d.data() as FirestoreVote));
      },
      (err) => toast.error(err.message)
    );

    return () => {
      unsubSession();
      unsubParticipants();
      unsubVotes();
    };
  }, [roomCode, authReady]);

  useEffect(() => {
    if (!roomCode || !myUid || !options?.autoReconnect) return;

    const unsubMe = onSnapshot(participantRef(roomCode, myUid), (snap) => {
      if (!snap.exists() && reconnectAttempted.current) {
        toast.error("You were removed from the session");
        clearIdentity();
        navigate("/");
      }
    });

    return unsubMe;
  }, [roomCode, myUid, options?.autoReconnect, navigate]);

  useEffect(() => {
    if (!roomCode || !myUid) return;

    const interval = window.setInterval(() => {
      void sessionService.updatePresence(roomCode);
    }, PRESENCE_INTERVAL_MS);

    void sessionService.updatePresence(roomCode);

    return () => clearInterval(interval);
  }, [roomCode, myUid]);

  useEffect(() => {
    if (!roomCode || !options?.autoReconnect || reconnectAttempted.current || !authReady) {
      return;
    }

    const stored = loadIdentity();
    if (stored.roomCode?.toUpperCase() !== roomCode.toUpperCase() || !stored.username) {
      navigate(`/?roomCode=${encodeURIComponent(roomCode)}`, { replace: true });
      return;
    }

    reconnectAttempted.current = true;
    setConnecting(true);

    void sessionService
      .joinSession(roomCode, stored.username)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to rejoin room");
        navigate(`/?roomCode=${encodeURIComponent(roomCode)}`, { replace: true });
      })
      .finally(() => setConnecting(false));
  }, [roomCode, options?.autoReconnect, authReady, navigate]);

  const deckId = useMemo(() => {
    if (!firestoreSession) return selectedDeckId;
    return findDeckForCardSet(decks, firestoreSession.cardSet)?.id ?? selectedDeckId;
  }, [firestoreSession, decks, selectedDeckId]);

  useEffect(() => {
    if (firestoreSession) {
      const match = findDeckForCardSet(decks, firestoreSession.cardSet);
      if (match) setSelectedDeckId(match.id);
    }
  }, [firestoreSession, decks, setSelectedDeckId]);

  const mapped = useMemo(() => {
    if (!firestoreSession || !myUid || !participants.some((participant) => participant.uid === myUid)) return null;
    return mapFirestoreToPokerSession(
      firestoreSession,
      participants,
      votes,
      myUid,
      deckId
    );
  }, [firestoreSession, participants, votes, myUid, deckId]);

  useEffect(() => {
    if (!mapped?.session || !myUid) return;
    saveIdentity({
      username: mapped.me.name,
      roomCode: mapped.session.id
    });
  }, [mapped, myUid]);

  const runAction = useCallback(
    async (action: () => Promise<void>, errorMessage: string) => {
      try {
        await action();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : errorMessage);
      }
    },
    []
  );

  const createRoom = useCallback(
    async (username: string) => {
      setConnecting(true);
      try {
        await ensureAnonymousAuth();
        const code = await sessionService.createSession(username.trim());
        saveIdentity({ username: username.trim(), roomCode: code });
        return code;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create room");
        return null;
      } finally {
        setConnecting(false);
      }
    },
    []
  );

  const joinRoom = useCallback(async (username: string, code: string) => {
    setConnecting(true);
    try {
      await ensureAnonymousAuth();
      await sessionService.joinSession(code, username.trim());
      saveIdentity({ username: username.trim(), roomCode: code.toUpperCase() });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join room");
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);

  const code = roomCode?.toUpperCase() ?? "";

  return {
    session: mapped?.session ?? null,
    me: mapped?.me ?? null,
    participantId: myUid,
    connected: authReady && !!firestoreSession,
    connecting,
    createRoom,
    joinRoom,
    castVote: (vote) => void runAction(() => sessionService.castVote(code, vote), "Failed to vote"),
    revealVotes: () => void runAction(() => sessionService.revealVotes(code), "Failed to reveal"),
    clearVotes: () => void runAction(() => sessionService.resetVotes(code, false), "Failed to reset"),
    nextRound: () => void runAction(() => sessionService.resetVotes(code, true), "Failed to start round"),
    setStory: (currentStory) =>
      void runAction(() => sessionService.updateStory(code, { currentStory }), "Failed to update story"),
    setTitle: (title) =>
      void runAction(() => sessionService.updateStory(code, { title }), "Failed to update title"),
    setDeck: (deckId) => {
      const deck = decks.find((d) => d.id === deckId);
      if (deck) {
        void runAction(() => sessionService.changeCardSet(code, deck.values), "Failed to change deck");
      }
    },
    removeParticipant: (participantId) =>
      void runAction(
        () => sessionService.removeParticipant(code, participantId),
        "Failed to remove participant"
      ),
    leaveRoom: () => {
      void sessionService.leaveSession(code);
      clearIdentity();
      navigate("/");
    },
    updateUsername: (username) =>
      void runAction(
        () => sessionService.updateUsername(code, username),
        "Failed to update display name"
      ),
    endSession: () =>
      void runAction(() => sessionService.endSession(code), "Failed to end session"),
    closeRoom: () => {
      void sessionService.leaveSession(code);
      clearIdentity();
      navigate("/");
    }
  };
}
