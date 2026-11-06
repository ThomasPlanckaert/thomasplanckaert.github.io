import type { Deck } from "../types/session";

export const defaultDecks: Deck[] = [
  { id: "modified-fibonacci", name: "Modified Fibonacci", values: ["1", "2", "3", "5", "8", "13", "17", "21", "25", "34", "?"], builtIn: true },
  { id: "fibonacci", name: "Fibonacci", values: ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89"], builtIn: true },
  { id: "tshirt", name: "T-Shirt", values: ["XS", "S", "M", "L", "XL"], builtIn: true },
  { id: "sequential", name: "Sequential", values: ["1", "2", "3", "4", "5", "6", "7", "8"], builtIn: true }
];

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export const uid = () => Math.random().toString(36).slice(2, 10);
