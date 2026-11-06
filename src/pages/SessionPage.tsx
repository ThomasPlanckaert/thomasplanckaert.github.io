import { useEffect, useMemo } from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Share2, Sun } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ModeratorPanel } from "../features/session/components/ModeratorPanel";
import { ParticipantList } from "../features/session/components/ParticipantList";
import { VoteCard } from "../features/session/components/VoteCard";
import { RoomTitle } from "../features/session/components/RoomTitle";
import { SessionSummary } from "../features/session/components/SessionSummary";
import { usePokerStore } from "../features/session/store/usePokerStore";
import { Button } from "../shared/components/ui/button";
import { Card } from "../shared/components/ui/card";

export function SessionPage({ admin }: { admin?: boolean }) {
  const { sessionId = "default" } = useParams();
  const navigate = useNavigate();
  const state = usePokerStore();

  const session = state.sessions[sessionId];
  const userId = state.identities[sessionId];
  const me = session?.participants.find((p) => p.id === userId);
  const currentDeck = state.decks.find((d) => d.id === session?.deckId);

  useEffect(() => {
    if (!session || !me) navigate("/");
  }, [session, me, navigate]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.darkMode);
  }, [state.darkMode]);

  useEffect(() => {
    if (session && session.revealed && !session.sessionEnded && state.celebrationRound === session.round) {
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
      toast.success("Consensus reached!", { description: "Everyone picked the same estimate." });
    }
  }, [session, state.celebrationRound]);

  const votedCount = useMemo(
    () => (session ? Object.values(session.votes).filter(Boolean).length : 0),
    [session]
  );

  if (!session || !me || !currentDeck) return null;

  const reveal = () => {
    const consensus = state.revealVotes(sessionId);
    toast(consensus ? "Perfect alignment." : "Votes revealed.");
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl space-y-6 px-4 py-5 md:px-8 md:py-8">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 md:p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-300">Round {session.round}</p>
          <RoomTitle title={session.title} editable={me.id === (session.creatorId ?? session.participants[0]?.id) && !session.sessionEnded} onSave={(title) => state.setTitle(sessionId, title)} />
          <p className="text-sm text-slate-300">{session.story}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => state.toggleTheme()}>{state.darkMode ? <Sun size={16} /> : <Moon size={16} />}</Button>
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.href.replace(/\/admin$/, ""));
              toast.success("Session URL copied");
            }}
          >
            <Share2 size={16} className="mr-2" />Share
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-6">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-300">{votedCount}/{session.participants.length} voted</p>
              <div className="flex flex-wrap items-center gap-2">
                {me.isModerator && !session.sessionEnded && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => state.clearVotes(sessionId)}>Reset</Button>
                    <Button variant="secondary" onClick={() => state.nextRound(sessionId)}>New Round</Button>
                    <Button size="lg" className="min-w-32 text-base font-semibold" disabled={session.revealed} onClick={reveal}>Reveal</Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {currentDeck.values.map((value) => (
                <VoteCard
                  key={value}
                   value={value}
                  selected={session.votes[me.id] === value}
                  disabled={session.revealed || session.sessionEnded}
                  onClick={() => state.castVote(sessionId, me.id, value)}
                />
              ))}
            </div>
          </Card>

          <ParticipantList participants={session.participants} votes={session.votes} revealed={session.revealed} />
        </section>

        <section className="space-y-4">
          {me.isModerator && admin && !session.sessionEnded && (
            <ModeratorPanel
              me={me}
              session={session}
              decks={state.decks}
              onClose={() => navigate(`/session/${sessionId}`)}
              onStory={(v) => state.setStory(sessionId, v)}
              onDeck={(v) => state.setDeck(sessionId, v)}
              onReveal={reveal}
              onClear={() => state.clearVotes(sessionId)}
              onNextRound={() => state.nextRound(sessionId)}
              onRemove={(id) => state.removeParticipant(sessionId, id)}
              onAddDeck={(name, values) => state.addCustomDeck(name, values)}
            />
          )}

          <Card className="p-4">
            <p className="mb-3 text-xs uppercase text-slate-400">Quick actions</p>
            <div className="grid gap-2">
              {me.isModerator && !session.sessionEnded && (
                <Button variant="secondary" aria-expanded={Boolean(admin)} onClick={() => navigate(`/session/${sessionId}${admin ? "" : "/admin"}`)}>
                  {admin ? "Close Moderator Dashboard" : "Open Moderator Dashboard"}
                </Button>
              )}
              {me.isModerator && !session.sessionEnded && <>
                <Button variant="ghost" onClick={() => state.nextRound(sessionId)}>New Round</Button>
                <Button variant="secondary" onClick={() => { if (window.confirm("End this session?")) state.endSession(sessionId); }}>End session</Button>
              </>}
            </div>
          </Card>
        </section>
      </div>

      <AnimatePresence>
        {session.revealed && !session.sessionEnded && state.celebrationRound === session.round && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-5 py-2 text-sm font-semibold text-emerald-100 backdrop-blur"
          >
            Consensus reached!
          </motion.div>
        )}
      </AnimatePresence>
      {session.sessionEnded && <SessionSummary session={session} onClose={() => navigate("/")} />}
    </main>
  );
}
