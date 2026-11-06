import { Fragment, useEffect } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Link2, Unlink } from "lucide-react";
import type { Participant } from "../types/session";
import type { SessionStats, SyncLeaders } from "../utils/session-stats";
import { Button } from "../../../shared/components/ui/button";
import { Card } from "../../../shared/components/ui/card";
import { cn } from "../../../shared/lib/utils";

interface SessionEndedOverlayProps {
  title: string;
  stats: SessionStats;
  syncLeaders: SyncLeaders;
  onCloseRoom: () => void;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center backdrop-blur">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
    </div>
  );
}

function ParticipantChip({
  participant,
  variant
}: {
  participant: Participant;
  variant: "sync" | "out-of-sync";
}) {
  const isSync = variant === "sync";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
        isSync
          ? "border border-emerald-300/50 bg-emerald-500/20 text-emerald-100"
          : "border border-rose-300/40 bg-rose-500/15 text-rose-100"
      )}
    >
      <span
        className={cn(
          "grid h-6 w-6 place-content-center rounded-full text-[10px] font-bold text-white",
          isSync
            ? "bg-gradient-to-br from-emerald-400 to-cyan-400"
            : "bg-gradient-to-br from-rose-400 to-orange-400"
        )}
      >
        {participant.avatar}
      </span>
      <span>{participant.name}</span>
    </div>
  );
}

function SyncGroupCluster({
  participants,
  variant
}: {
  participants: Participant[];
  variant: "sync" | "out-of-sync";
}) {
  const isSync = variant === "sync";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border p-3",
        isSync
          ? "border-emerald-400/30 bg-emerald-500/10"
          : "border-rose-400/25 bg-rose-500/10"
      )}
    >
      {participants.map((participant, index) => (
        <Fragment key={participant.id}>
          {index > 0 && (
            <span className="flex items-center text-white/50">
              {isSync ? <Link2 size={14} /> : <Unlink size={14} />}
            </span>
          )}
          <ParticipantChip participant={participant} variant={variant} />
        </Fragment>
      ))}
    </div>
  );
}

function SyncSection({
  title,
  groups,
  variant
}: {
  title: string;
  groups: Participant[][];
  variant: "sync" | "out-of-sync";
}) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{title}</p>
      <div className="space-y-2">
        {groups.map((group) => (
          <SyncGroupCluster
            key={group.map((p) => p.id).join("-")}
            participants={group}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

export function SessionEndedOverlay({
  title,
  stats,
  syncLeaders,
  onCloseRoom
}: SessionEndedOverlayProps) {
  useEffect(() => {
    const burst = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 50,
        startVelocity: 18,
        origin: { x: 0.1, y: 0.55 },
        colors: ["#c4b5fd", "#67e8f9", "#fcd34d"],
        scalar: 0.55,
        ticks: 120,
        disableForReducedMotion: true
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 50,
        startVelocity: 18,
        origin: { x: 0.9, y: 0.55 },
        colors: ["#c4b5fd", "#67e8f9", "#fcd34d"],
        scalar: 0.55,
        ticks: 120,
        disableForReducedMotion: true
      });
    };

    burst();
    const interval = window.setInterval(burst, 3200);
    return () => window.clearInterval(interval);
  }, []);

  const leastInSyncGroups =
    syncLeaders.leastInSync.map((participant) => [participant]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm"
    >
      <Card className="relative w-full max-w-lg space-y-6 border-white/15 bg-slate-900/90 p-6 shadow-2xl md:p-8">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300">{title}</p>
          <h2 className="text-3xl font-bold text-white">Thanks for playing!</h2>
          <p className="text-sm text-slate-300">Here&apos;s how your session went.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Consensuses" value={stats.consensuses} />
          <StatCard label="Close ones" value={stats.closeOnes} />
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <SyncSection
            title="Most in sync together"
            groups={syncLeaders.mostInSyncGroups}
            variant="sync"
          />
          {syncLeaders.mostInSyncGroups.length > 0 && (
            <p className="text-xs text-slate-400">
              Every pair in a group shares the highest number of matching reveals. Tied groups can overlap.
            </p>
          )}
          <SyncSection
            title="Fewest reveals matching someone else"
            groups={leastInSyncGroups}
            variant="out-of-sync"
          />
          {syncLeaders.mostInSyncGroups.length === 0 && leastInSyncGroups.length === 0 && (
            <p className="text-center text-sm text-slate-400">No matching votes recorded for these participants.</p>
          )}
        </div>

        <Button className="w-full" onClick={onCloseRoom}>
          Close room
        </Button>
      </Card>
    </motion.div>
  );
}
