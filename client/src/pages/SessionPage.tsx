import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Moon, Share2, Sun, Wifi, WifiOff } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ModeratorPanel } from "../features/session/components/ModeratorPanel";
import { ParticipantList } from "../features/session/components/ParticipantList";
import { RoundAnnouncement } from "../features/session/components/RoundAnnouncement";
import { RoomTitle } from "../features/session/components/RoomTitle";
import { SessionEndedOverlay } from "../features/session/components/SessionEndedOverlay";
import { VoteCard } from "../features/session/components/VoteCard";
import { usePokerStore } from "../features/session/store/usePokerStore";
import {
  fireConsensusConfetti,
  fireMatchConfetti
} from "../features/session/utils/confetti-bursts";
import { computeRoundedUpAverage } from "../features/session/utils/vote-average";
import { analyzeRevealedVotes } from "../features/session/utils/vote-analysis";
import { buildVoteGroupMap } from "../features/session/utils/vote-group-colors";
import { computeSyncLeaders } from "../features/session/utils/session-stats";
import { useSession } from "../hooks/useSession";
import { Button } from "../shared/components/ui/button";
import { Card } from "../shared/components/ui/card";
import { Input } from "../shared/components/ui/input";

export function SessionPage({ admin }: { admin?: boolean }) {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const ui = usePokerStore();
  const revealEffectsFiredForRound = useRef<number | null>(null);
  const prevRoundRef = useRef<number | null>(null);
  const [announcedRound, setAnnouncedRound] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState("");
  const nameFocused = useRef(false);
  const {
    session,
    me,
    connected,
    connecting,
    castVote,
    revealVotes,
    clearVotes,
    nextRound,
    setStory,
    setTitle,
    setDeck,
    removeParticipant,
    leaveRoom,
    updateUsername,
    endSession,
    closeRoom
  } = useSession(sessionId, { autoReconnect: true });

  const showConsensus =
    session?.revealed &&
    session.consensusReached &&
    session.consensusRound === session.round;

  const voteAnalysis = useMemo(() => {
    if (!session?.revealed || !me) return null;
    return analyzeRevealedVotes(session.participants, session.votes, me.id);
  }, [session, me]);

  const voteGroupColors = useMemo(() => {
    if (!voteAnalysis || showConsensus) return {};
    return buildVoteGroupMap(voteAnalysis.groups);
  }, [voteAnalysis, showConsensus]);

  const showCloseOne = Boolean(
    session?.revealed && voteAnalysis?.closeOne && !showConsensus && !session?.sessionEnded
  );

  const syncLeaders = useMemo(() => {
    if (!session) return { mostInSyncGroups: [], leastInSync: [] };
    return computeSyncLeaders(
      session.participants,
      session.stats.matchCounts,
      session.stats.pairCounts
    );
  }, [session]);

  const voteAverage = useMemo(() => {
    if (!session?.revealed) return null;
    return computeRoundedUpAverage(session.participants, session.votes);
  }, [session]);

  useEffect(() => {
    if (!connecting && !session && sessionId) {
      const timer = setTimeout(() => navigate(`/?roomCode=${encodeURIComponent(sessionId)}`, { replace: true }), 1500);
      return () => clearTimeout(timer);
    }
  }, [session, connecting, sessionId, navigate]);

  useEffect(() => {
    if (!session) return;

    const round = session.round;
    if (prevRoundRef.current !== null && round > prevRoundRef.current) {
      setAnnouncedRound(round);
    }
    prevRoundRef.current = round;
  }, [session]);

  useEffect(() => {
    if (!me) return;
    if (!nameFocused.current) setDisplayName(me.name);
  }, [me]);

  useEffect(() => {
    if (!session?.revealed || !me || session.sessionEnded) {
      revealEffectsFiredForRound.current = null;
      return;
    }
    if (revealEffectsFiredForRound.current === session.round) return;
    revealEffectsFiredForRound.current = session.round;

    const analysis = analyzeRevealedVotes(session.participants, session.votes, me.id);

    if (showConsensus) {
      const streak = session.consensusStreak || 1;
      fireConsensusConfetti(streak);
      if (streak >= 2) {
        toast.success(`Consensus streak: ${streak}!`, {
          description: `${streak} rounds in a row with full agreement.`
        });
      } else {
        toast.success("Consensus reached!", {
          description: "Everyone picked the same estimate."
        });
      }
      return;
    }

    if (analysis.closeOne && analysis.dominantVote != null) {
      toast("Close one!", {
        description: `${Math.round(analysis.dominantShare * 100)}% voted ${analysis.dominantVote}.`
      });
    }

    if (analysis.myMatchGroup) {
      fireMatchConfetti();
      const others = analysis.myMatchGroup.length - 1;
      const myVote = session.votes[me.id];
      toast("Matching vote", {
        description: `You and ${others} other${others > 1 ? "s" : ""} picked ${myVote}.`
      });
    }
  }, [
    session?.revealed,
    session?.round,
    session?.consensusStreak,
    session?.sessionEnded,
    session?.participants,
    session?.votes,
    showConsensus,
    me
  ]);

  const votedCount = useMemo(() => {
    if (!session) return 0;
    return session.participants.filter((p) => session.votes[p.id] != null).length;
  }, [session]);

  if (!session || !me || session.cardSet.length === 0) {
    return (
      <main className="grid min-h-screen place-content-center text-slate-600 dark:text-slate-300">
        {connecting ? "Connecting to room…" : "Loading session…"}
      </main>
    );
  }

  const reveal = () => {
    revealVotes();
    toast("Revealing votes…");
  };

  const myVote = session.votes[me.id];
  const displayVote = myVote === "__voted__" ? null : myVote;
  const consensusStreak = session.consensusStreak || 0;

  const handleLeave = () => {
    if (window.confirm("Leave this room?")) {
      leaveRoom();
    }
  };

  const commitDisplayName = () => {
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      setDisplayName(me.name);
      return;
    }
    if (trimmed !== me.name) updateUsername(trimmed);
  };

  const handleEndSession = () => {
    if (window.confirm("End this session for everyone?")) {
      endSession();
    }
  };

  const sessionEnded = session.sessionEnded;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl space-y-6 px-4 py-5 md:px-8 md:py-8">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 md:p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Round {session.round} · Room {session.id}
            {consensusStreak >= 2 && (
              <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-200">
                {consensusStreak} streak
              </span>
            )}
          </p>
          <RoomTitle title={session.title} editable={me.id === session.creatorId && !sessionEnded} onSave={setTitle} />
          {session.story ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{session.story}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-600 dark:text-slate-300"
            title={connected ? "Connected" : "Reconnecting…"}
          >
            {connected ? <Wifi size={14} /> : <WifiOff size={14} className="text-amber-500" />}
            {connected ? "Live" : "Offline"}
          </span>
          <Button variant="ghost" onClick={() => ui.toggleTheme()} aria-label="Toggle theme">
            {ui.darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const url = `${window.location.origin}/session/${session.id}`;
              await navigator.clipboard.writeText(url);
              toast.success("Room link copied");
            }}
          >
            <Share2 size={16} className="mr-2" />
            Share
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-6">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {votedCount}/{session.participants.length} voted
                </p>
                {session.revealed && voteAverage != null && (
                  <p className="text-sm font-semibold text-violet-700 dark:text-violet-200">
                    Average estimate: {voteAverage}
                  </p>
                )}
                {session.revealed && voteAverage == null && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Average unavailable (non-numeric cards)
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {me.isModerator && !sessionEnded && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => clearVotes()}>
                      Reset
                    </Button>
                    <Button variant="secondary" onClick={() => nextRound()}>
                      New Round
                    </Button>
                    <Button size="lg" className="min-w-32 text-base font-semibold" disabled={session.revealed} onClick={reveal}>
                      Reveal
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {session.cardSet.map((value) => (
                <VoteCard
                  key={value}
                  value={value}
                  selected={displayVote === value}
                  disabled={session.revealed || sessionEnded}
                  onClick={() => castVote(value)}
                />
              ))}
            </div>
          </Card>

          <ParticipantList
            participants={session.participants}
            votes={session.votes}
            revealed={session.revealed}
            voteGroupColors={voteGroupColors}
            canRemoveParticipants={me.isModerator}
            onRemoveParticipant={(id) => {
              if (window.confirm("Remove this participant from the room?")) {
                removeParticipant(id);
              }
            }}
          />
        </section>

        <section className="space-y-4">
          {me.isModerator && admin && !sessionEnded && (
            <ModeratorPanel
              me={me}
              session={session}
              decks={ui.decks}
              onClose={() => navigate(`/session/${session.id}`)}
              onStory={(v) => setStory(v)}
              onDeck={(v) => setDeck(v)}
              onReveal={reveal}
              onClear={() => clearVotes()}
              onNextRound={() => nextRound()}
              onEndSession={handleEndSession}
              onRemove={(id) => {
                if (window.confirm("Remove this participant from the room?")) {
                  removeParticipant(id);
                }
              }}
              onAddDeck={(name, values) => {
                const deck = ui.addCustomDeck(name, values);
                setDeck(deck.id);
              }}
            />
          )}

          <Card className="p-4">
            <p className="mb-3 text-xs uppercase text-slate-500 dark:text-slate-400">Quick actions</p>
            <div className="grid gap-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Display name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onFocus={() => {
                    nameFocused.current = true;
                  }}
                  onBlur={() => {
                    nameFocused.current = false;
                    commitDisplayName();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Your name"
                />
              </div>
              {me.isModerator && !sessionEnded && (
                <Button
                  variant="secondary"
                  aria-expanded={Boolean(admin)}
                  onClick={() => navigate(`/session/${session.id}${admin ? "" : "/admin"}`)}
                >
                  {admin ? "Close Moderator Dashboard" : "Open Moderator Dashboard"}
                </Button>
              )}
              {me.isModerator && !sessionEnded && (
                <Button variant="ghost" onClick={() => nextRound()}>
                  New Round
                </Button>
              )}
              {me.isModerator && !sessionEnded && (
                <Button variant="secondary" onClick={handleEndSession}>
                  End session
                </Button>
              )}
              {!sessionEnded && (
                <Button variant="ghost" className="text-red-600 dark:text-red-300" onClick={handleLeave}>
                  <LogOut size={16} className="mr-2" />
                  Leave room
                </Button>
              )}
            </div>
          </Card>
        </section>
      </div>

      <RoundAnnouncement round={announcedRound} onComplete={() => setAnnouncedRound(null)} />

      <AnimatePresence>
        {showConsensus && !sessionEnded && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-5 py-2 text-sm font-semibold text-emerald-800 backdrop-blur dark:border-emerald-300/40 dark:text-emerald-100"
          >
            {consensusStreak >= 2
              ? `Consensus streak: ${consensusStreak}!`
              : "Consensus reached!"}
          </motion.div>
        )}
        {showCloseOne && voteAnalysis?.dominantVote != null && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-amber-400/50 bg-amber-500/20 px-5 py-2 text-sm font-semibold text-amber-900 backdrop-blur dark:border-amber-300/40 dark:text-amber-100"
          >
            Close one! {Math.round(voteAnalysis.dominantShare * 100)}% voted{" "}
            {voteAnalysis.dominantVote}
          </motion.div>
        )}
      </AnimatePresence>

      {sessionEnded && (
        <SessionEndedOverlay
          title={session.title}
          stats={session.stats}
          syncLeaders={syncLeaders}
          onCloseRoom={closeRoom}
        />
      )}
    </main>
  );
}
