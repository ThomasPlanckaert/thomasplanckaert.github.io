import type { PokerSession } from "../types/session";
import { computeSessionStats } from "../utils/session-stats";
import { Button } from "../../../shared/components/ui/button";
import { Card } from "../../../shared/components/ui/card";

export function SessionSummary({ session, onClose }: { session: PokerSession; onClose: () => void }) {
  const stats = computeSessionStats(session.participants, session.revealHistory ?? []);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="session-summary-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
      <Card className="my-auto w-full max-w-lg space-y-5 bg-slate-900 p-6 text-slate-100">
        <p className="text-sm text-violet-200">{session.title}</p>
        <h2 id="session-summary-title" className="text-3xl font-bold">Thanks for playing!</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/10 p-4"><p className="text-2xl font-bold">{stats.consensuses}</p><p>Consensuses</p></div>
          <div className="rounded-xl bg-white/10 p-4"><p className="text-2xl font-bold">{stats.closeOnes}</p><p>Close ones</p></div>
        </div>
        {stats.mostInSyncPairs.length > 0 && <section className="space-y-2">
          <h3 className="font-semibold">Most in sync pairs</h3>
          <p className="text-xs text-slate-300">Pairs with the most matching reveals. Tied pairs are shown separately.</p>
          {stats.mostInSyncPairs.map((pair) => <p key={pair.participants.map((participant) => participant.id).join("|")} className="rounded-xl bg-emerald-500/15 p-3">
            {pair.participants.map((participant) => participant.name).join(" & ")} · {pair.count} matching {pair.count === 1 ? "reveal" : "reveals"}
          </p>)}
        </section>}
        {stats.leastInSync.length > 0 && <section className="space-y-2">
          <h3 className="font-semibold">Fewest reveals matching someone else</h3>
          {stats.leastInSync.map((participant) => <p key={participant.id}>{participant.name}</p>)}
        </section>}
        {stats.reveals === 0 && <p>No reveal rounds recorded yet.</p>}
        {stats.reveals > 0 && stats.mostInSyncPairs.length === 0 && <p>No matching pairs recorded for these participants.</p>}
        <Button className="w-full" onClick={onClose}>Close room</Button>
      </Card>
    </div>
  );
}
