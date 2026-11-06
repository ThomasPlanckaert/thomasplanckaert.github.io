import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "../shared/components/ui/button";
import { Card } from "../shared/components/ui/card";
import { Input } from "../shared/components/ui/input";
import { loadIdentity } from "../services/storage";
import { useSession } from "../hooks/useSession";
import { generateRoomCode } from "../firebase/firestore";

export function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitedRoomCode = searchParams.get("roomCode");
  const stored = loadIdentity();
  const [username, setUsername] = useState(stored.username ?? "");
  const [roomCode, setRoomCode] = useState(() => invitedRoomCode ?? stored.roomCode ?? generateRoomCode());
  const { createRoom, joinRoom, connecting } = useSession(undefined, {
    autoReconnect: false
  });

  const canContinue = useMemo(() => username.trim().length >= 2, [username]);
  const normalizedCode = useMemo(
    () => roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""),
    [roomCode]
  );

  useEffect(() => {
    if (!invitedRoomCode && stored.roomCode && stored.username) {
      navigate(`/session/${stored.roomCode.toUpperCase()}`);
    }
  }, [navigate, invitedRoomCode, stored.roomCode, stored.username]);

  const enter = async (asModerator: boolean) => {
    if (!canContinue || !normalizedCode) return;

    if (asModerator) {
      const created = await createRoom(username.trim());
      if (created) navigate(`/session/${created}/admin`);
    } else {
      const joined = await joinRoom(username.trim(), normalizedCode);
      if (joined) navigate(`/session/${normalizedCode}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void enter(false);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
      <Card className="grid w-full gap-8 overflow-hidden border-violet-200/60 bg-gradient-to-br from-violet-100/80 via-white/90 to-cyan-50/80 p-8 lg:grid-cols-2 dark:border-white/20 dark:from-violet-500/10 dark:via-slate-900/70 dark:to-cyan-500/10">
        <section className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-500/20 dark:text-violet-100">
            <Sparkles className="h-3.5 w-3.5" />
            Collaborative Estimation
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl dark:text-white">
            Planning Poker for modern teams
          </h1>
          <p className="max-w-lg text-slate-600 dark:text-slate-300">
            Join instantly, estimate together, reveal with confidence, and celebrate consensus with
            polished collaborative UX.
          </p>
        </section>

        <Card className="space-y-4 border-slate-200/80 bg-white/70 p-6 dark:border-white/10 dark:bg-slate-950/40">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              placeholder="Your display name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              placeholder="Room code (e.g. AB12CD)"
              value={roomCode}
              onChange={(e) =>
                setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              className="uppercase"
              maxLength={12}
              autoCapitalize="characters"
              spellCheck={false}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="submit" disabled={!canContinue || connecting}>
                Join Room
              </Button>
              <Button
                type="button"
                disabled={!canContinue || connecting}
                variant="secondary"
                onClick={() => void enter(true)}
              >
                Create Room
              </Button>
            </div>
          </form>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Share the room code with your team. Your name and identity are saved locally for
            reconnection.
          </p>
        </Card>
      </Card>
    </main>
  );
}
