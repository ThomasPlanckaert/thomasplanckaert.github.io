import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Deck } from "../types/session";
import { defaultDecks, uid } from "../utils/session-utils";

interface PokerState {
  decks: Deck[];
  darkMode: boolean;
  celebrationRound: number | null;
  selectedDeckId: string;
  addCustomDeck: (name: string, values: string[]) => Deck;
  setCelebrationRound: (round: number | null) => void;
  toggleTheme: () => void;
  setSelectedDeckId: (deckId: string) => void;
}

export const usePokerStore = create<PokerState>()(
  persist(
    (set) => ({
      decks: defaultDecks,
      darkMode: true,
      celebrationRound: null,
      selectedDeckId: defaultDecks[0].id,
      addCustomDeck: (name, values) => {
        const deck: Deck = { id: uid(), name, values: values.filter(Boolean) };
        set((state) => ({ decks: [...state.decks, deck] }));
        return deck;
      },
      setCelebrationRound: (round) => set({ celebrationRound: round }),
      toggleTheme: () => set((state) => ({ darkMode: !state.darkMode })),
      setSelectedDeckId: (deckId) => set({ selectedDeckId: deckId })
    }),
    {
      name: "planning-poker-ui",
      merge: (persistedState, currentState) => {
        const saved = persistedState as Partial<PokerState> | undefined;
        return {
          ...currentState,
          ...saved,
          decks: [
            ...defaultDecks,
            ...(saved?.decks ?? []).filter((deck) => !defaultDecks.some((builtIn) => builtIn.id === deck.id))
          ]
        };
      },
      partialize: (state) => ({
        decks: state.decks,
        darkMode: state.darkMode,
        selectedDeckId: state.selectedDeckId
      })
    }
  )
);

export function findDeckForCardSet(decks: Deck[], cardSet: string[]): Deck | undefined {
  const key = cardSet.join("|");
  return decks.find((d) => d.values.join("|") === key);
}
