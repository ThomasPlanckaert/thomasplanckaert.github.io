import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "../../../shared/components/ui/button";
import { Card } from "../../../shared/components/ui/card";
import { Input } from "../../../shared/components/ui/input";
import type { Deck, PokerSession } from "../types/session";
import type { Participant } from "../types/session";

interface ModeratorPanelProps {
  session: PokerSession;
  decks: Deck[];
  me: Participant;
  onClose: () => void;
  onStory: (value: string) => void;
  onDeck: (value: string) => void;
  onReveal: () => void;
  onClear: () => void;
  onNextRound: () => void;
  onRemove: (id: string) => void;
  onAddDeck: (name: string, values: string[]) => void;
}

export function ModeratorPanel(props: ModeratorPanelProps) {
  const { session, decks, onClose, onStory, onDeck, onReveal, onClear, onNextRound, onRemove, onAddDeck } = props;

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Moderator Controls</p>
          <Button size="sm" variant="ghost" aria-label="Close moderator controls" onClick={onClose}><X size={18} /></Button>
        </div>
        <Input value={session.story} onChange={(e) => onStory(e.target.value)} placeholder="Current story" />
        <select
          value={session.deckId}
          onChange={(e) => onDeck(e.target.value)}
          className="h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white"
        >
          {decks.map((deck) => (
            <option className="bg-slate-900" key={deck.id} value={deck.id}>
              {deck.name}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClear}>Reset Votes</Button>
          <Button size="lg" disabled={session.revealed} onClick={onReveal}>Reveal</Button>
          <Button className="col-span-2" onClick={onNextRound}>Start New Round</Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-300">Participants</p>
          {session.participants.map((p) => (
            <div className="flex items-center justify-between text-sm text-slate-100" key={p.id}>
              <span>{p.name}</span>
              {!p.isModerator && (
                <Button variant="ghost" size="sm" onClick={() => onRemove(p.id)}>Remove</Button>
              )}
            </div>
          ))}
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const name = window.prompt("Custom deck name");
            const values = window.prompt("Card values comma separated (e.g. 1,2,3,5)");
            if (name && values) onAddDeck(name, values.split(",").map((v) => v.trim()));
          }}
        >
          Add Custom Deck
        </Button>
      </Card>
    </motion.div>
  );
}
