import {
  deleteDoc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ensureAnonymousAuth, getCurrentUid } from "../firebase/auth";
import {
  generateRoomCode,
  normalizeRoomCode,
  participantRef,
  sessionRef,
  voteRef
} from "../firebase/firestore";
import { getFirebaseFunctions } from "../firebase/functions";
import type { FirestoreParticipant, FirestoreSession, FirestoreVote } from "../firebase/types";
import { DEFAULT_CARD_SET } from "../features/session/utils/session-constants";

async function requireUid(): Promise<string> {
  await ensureAnonymousAuth();
  const uid = getCurrentUid();
  if (!uid) throw new Error("Authentication required");
  return uid;
}

function callable<TData, TResult>(name: string) {
  return httpsCallable<TData, TResult>(getFirebaseFunctions(), name);
}

export async function sessionExists(roomCode: string): Promise<boolean> {
  const snap = await getDoc(sessionRef(roomCode));
  return snap.exists();
}

export async function createSession(username: string): Promise<string> {
  const uid = await requireUid();
  let roomCode = generateRoomCode();

  for (let attempt = 0; attempt < 8; attempt++) {
    if (!(await sessionExists(roomCode))) break;
    roomCode = generateRoomCode();
  }

  if (await sessionExists(roomCode)) {
    throw new Error("Could not generate a unique room code. Try again.");
  }

  const code = normalizeRoomCode(roomCode);
  const session: FirestoreSession = {
    id: code,
    roomCode: code,
    title: "Sprint Planning",
    moderatorUid: uid,
    creatorUid: uid,
    currentStory: "",
    cardSet: [...DEFAULT_CARD_SET],
    revealed: false,
    round: 1,
    createdAt: serverTimestamp() as Timestamp,
    consensusReached: false,
    consensusRound: null,
    consensusVote: null,
    consensusStreak: 0,
    sessionEnded: false,
    statsConsensuses: 0,
    statsCloseOnes: 0,
    statsMatchCounts: {},
    statsPairCounts: {}
  };

  await setDoc(sessionRef(code), session);

  const participant: FirestoreParticipant = {
    uid,
    username,
    joinedAt: serverTimestamp() as Timestamp,
    isModerator: true,
    lastSeen: serverTimestamp() as Timestamp
  };

  await setDoc(participantRef(code, uid), participant);
  return code;
}

export async function joinSession(roomCode: string, username: string): Promise<void> {
  const uid = await requireUid();
  const code = normalizeRoomCode(roomCode);

  const sessionSnap = await getDoc(sessionRef(code));
  if (!sessionSnap.exists()) {
    throw new Error("Room not found");
  }

  const pref = participantRef(code, uid);
  const existing = await getDoc(pref);

  if (existing.exists()) {
    await updateDoc(pref, {
      username,
      lastSeen: serverTimestamp()
    });
    return;
  }

  const participant: FirestoreParticipant = {
    uid,
    username,
    joinedAt: serverTimestamp() as Timestamp,
    isModerator: false,
    lastSeen: serverTimestamp() as Timestamp
  };

  await setDoc(pref, participant);
}

export async function updatePresence(roomCode: string): Promise<void> {
  const uid = getCurrentUid();
  if (!uid) return;

  const ref = participantRef(roomCode, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  await updateDoc(ref, { lastSeen: serverTimestamp() });
}

export async function updateUsername(roomCode: string, username: string): Promise<void> {
  const uid = await requireUid();
  const trimmed = username.trim();
  if (trimmed.length < 2) throw new Error("Name must be at least 2 characters");

  const code = normalizeRoomCode(roomCode);
  const ref = participantRef(code, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("You are not in this room");

  await updateDoc(ref, {
    username: trimmed,
    lastSeen: serverTimestamp()
  });
}

export async function castVote(roomCode: string, value: string): Promise<void> {
  const uid = await requireUid();
  const code = normalizeRoomCode(roomCode);

  const sessionSnap = await getDoc(sessionRef(code));
  if (!sessionSnap.exists()) throw new Error("Room not found");
  if (sessionSnap.data()?.revealed) throw new Error("Votes are locked after reveal");

  const vote: FirestoreVote = { participantId: uid, value };
  await setDoc(voteRef(code, uid), vote);
}

export async function revealVotes(roomCode: string): Promise<void> {
  await requireUid();
  await callable<{ roomCode: string }, { ok: boolean }>("revealVotes")({
    roomCode: normalizeRoomCode(roomCode)
  });
}

export async function resetVotes(roomCode: string, newRound = false): Promise<void> {
  await requireUid();
  await callable<{ roomCode: string; newRound?: boolean }, { ok: boolean }>("resetVotes")({
    roomCode: normalizeRoomCode(roomCode),
    newRound
  });
}

export async function updateStory(
  roomCode: string,
  payload: { title?: string; currentStory?: string }
): Promise<void> {
  await requireUid();
  await callable<
    { roomCode: string; title?: string; currentStory?: string },
    { ok: boolean }
  >("updateSessionSettings")({
    roomCode: normalizeRoomCode(roomCode),
    ...payload
  });
}

export async function changeCardSet(roomCode: string, cardSet: string[]): Promise<void> {
  await requireUid();
  if (cardSet.length === 0) throw new Error("Card set cannot be empty");
  await callable<{ roomCode: string; cardSet: string[] }, { ok: boolean }>(
    "updateSessionSettings"
  )({
    roomCode: normalizeRoomCode(roomCode),
    cardSet
  });
}

export async function removeParticipant(roomCode: string, participantId: string): Promise<void> {
  const uid = await requireUid();
  const code = normalizeRoomCode(roomCode);

  const sessionSnap = await getDoc(sessionRef(code));
  if (!sessionSnap.exists()) throw new Error("Room not found");
  if (sessionSnap.data()?.moderatorUid !== uid) {
    throw new Error("Only the room creator can remove participants");
  }
  if (participantId === uid) throw new Error("Cannot remove yourself");
  if (participantId === sessionSnap.data()?.moderatorUid) {
    throw new Error("Cannot remove the room creator");
  }

  const targetSnap = await getDoc(participantRef(code, participantId));
  if (!targetSnap.exists()) throw new Error("Participant not found");

  await deleteDoc(participantRef(code, participantId));
  const voteSnap = await getDoc(voteRef(code, participantId));
  if (voteSnap.exists()) {
    await deleteDoc(voteRef(code, participantId));
  }
}

export async function transferModerator(roomCode: string, newModeratorUid: string): Promise<void> {
  await requireUid();
  await callable<{ roomCode: string; newModeratorUid: string }, { ok: boolean }>(
    "transferModerator"
  )({
    roomCode: normalizeRoomCode(roomCode),
    newModeratorUid
  });
}

export async function endSession(roomCode: string): Promise<void> {
  await requireUid();
  await callable<{ roomCode: string }, { ok: boolean }>("endSession")({
    roomCode: normalizeRoomCode(roomCode)
  });
}

export async function leaveSession(roomCode: string): Promise<void> {
  const uid = getCurrentUid();
  if (!uid) return;
  const code = normalizeRoomCode(roomCode);
  const snap = await getDoc(participantRef(code, uid));
  if (!snap.exists()) return;
  await deleteDoc(participantRef(code, uid));
  const voteSnap = await getDoc(voteRef(code, uid));
  if (voteSnap.exists()) {
    await deleteDoc(voteRef(code, uid));
  }
}
