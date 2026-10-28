import { create } from "zustand";
import {
  type Bets,
  type FaceTriple,
  type SymbolId,
  START_BALANCE,
  breakdown,
  emptyBets,
  returnedOf,
  rollDice,
  stakeOf,
} from "@/game/logic";

const KEY = "bau-cua-v1";

export type Phase = "bet" | "shake" | "result";

type Pending = { dice: FaceTriple; bets: Bets; stake: number };

type Save = {
  balance: number;
  history: FaceTriple[];
  sound: boolean;
  rounds: number;
  wins: number;
  lastBets: Bets;
  pending: Pending | null;
  dice: FaceTriple;
};

type Game = {
  balance: number;
  chip: number;
  bets: Bets;
  phase: Phase;
  dice: FaceTriple;
  shakeId: number;
  lastNet: number;
  lastDetail: ReturnType<typeof breakdown>;
  history: FaceTriple[];
  sound: boolean;
  rounds: number;
  wins: number;
  lastBets: Bets;
  pending: Pending | null;
  hydrated: boolean;
  hydrate: () => void;
  setChip: (n: number) => void;
  addBet: (id: SymbolId) => "ok" | "broke" | "busy";
  removeBet: (id: SymbolId) => void;
  clearBets: () => void;
  repeatBets: () => "ok" | "broke" | "empty" | "busy";
  toggleSound: () => void;
  xinVon: () => void;
  xoc: (free?: boolean) => "ok" | "nobet" | "busy";
  settled: () => void;
};

const DEFAULT_DICE: FaceTriple = ["nai", "cua", "bau"];

function persist(state: Game) {
  const save: Save = {
    balance: state.balance,
    history: state.history,
    sound: state.sound,
    rounds: state.rounds,
    wins: state.wins,
    lastBets: state.lastBets,
    pending: state.pending,
    dice: state.dice,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode */
  }
}

function applyPayout(balance: number, pending: Pending) {
  return balance + returnedOf(pending.bets, pending.dice);
}

export const useGame = create<Game>((set, get) => ({
  balance: START_BALANCE,
  chip: 10_000,
  bets: emptyBets(),
  phase: "bet",
  dice: DEFAULT_DICE,
  shakeId: 0,
  lastNet: 0,
  lastDetail: [],
  history: [],
  sound: true,
  rounds: 0,
  wins: 0,
  lastBets: emptyBets(),
  pending: null,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        set({ hydrated: true });
        return;
      }
      const data = JSON.parse(raw) as Partial<Save>;
      let balance = typeof data.balance === "number" ? data.balance : START_BALANCE;
      const pending = data.pending ?? null;
      let dice = Array.isArray(data.dice) && data.dice.length === 3 ? (data.dice as FaceTriple) : DEFAULT_DICE;
      let history = (Array.isArray(data.history) ? data.history : [])
        .filter((row): row is FaceTriple => Array.isArray(row) && row.length === 3)
        .slice(0, 10);
      let rounds = data.rounds ?? 0;
      let wins = data.wins ?? 0;
      if (pending && Array.isArray(pending.dice) && pending.dice.length === 3 && pending.bets) {
        const pay = returnedOf(pending.bets, pending.dice);
        const net = pay - pending.stake;
        balance += pay;
        dice = pending.dice;
        history = [pending.dice, ...history].slice(0, 10);
        rounds += 1;
        if (net > 0) wins += 1;
      }
      set({
        balance,
        dice,
        history,
        rounds,
        wins,
        sound: data.sound !== false,
        lastBets: data.lastBets ?? emptyBets(),
        pending: null,
        bets: emptyBets(),
        phase: "bet",
        hydrated: true,
      });
      persist(get());
    } catch {
      set({ hydrated: true });
    }
  },

  setChip: (n) => set({ chip: n }),

  addBet: (id) => {
    const g = get();
    if (g.phase === "shake") return "busy";
    if (g.balance < g.chip) return "broke";
    const bets = { ...g.bets, [id]: g.bets[id] + g.chip };
    set({
      bets,
      balance: g.balance - g.chip,
      phase: "bet",
    });
    persist(get());
    return "ok";
  },

  removeBet: (id) => {
    const g = get();
    if (g.phase === "shake") return;
    const cur = g.bets[id];
    if (cur <= 0) return;
    const cut = Math.min(g.chip, cur);
    set({
      bets: { ...g.bets, [id]: cur - cut },
      balance: g.balance + cut,
    });
    persist(get());
  },

  clearBets: () => {
    const g = get();
    if (g.phase === "shake") return;
    const stake = stakeOf(g.bets);
    if (stake <= 0) return;
    set({ bets: emptyBets(), balance: g.balance + stake });
    persist(get());
  },

  repeatBets: () => {
    const g = get();
    if (g.phase === "shake") return "busy";
    const stake = stakeOf(g.lastBets);
    if (stake <= 0) return "empty";
    if (stakeOf(g.bets) > 0) return "busy";
    if (g.balance < stake) return "broke";
    set({
      bets: { ...g.lastBets },
      balance: g.balance - stake,
      phase: "bet",
    });
    persist(get());
    return "ok";
  },

  toggleSound: () => {
    set({ sound: !get().sound });
    persist(get());
  },

  xinVon: () => {
    const g = get();
    if (g.phase === "shake") return;
    set({ balance: g.balance + 1_000_000 });
    persist(get());
  },

  xoc: (free) => {
    const g = get();
    if (g.phase === "shake") return "busy";
    const stake = stakeOf(g.bets);
    if (stake <= 0 && !free) return "nobet";
    const dice = rollDice();
    const pending: Pending = { dice, bets: { ...g.bets }, stake };
    set({
      phase: "shake",
      dice,
      pending,
      shakeId: g.shakeId + 1,
    });
    persist(get());
    return "ok";
  },

  settled: () => {
    const g = get();
    const pending = g.pending;
    if (!pending) return;
    const pay = returnedOf(pending.bets, pending.dice);
    const net = pay - pending.stake;
    set({
      pending: null,
      balance: applyPayout(g.balance, pending),
      phase: "result",
      lastNet: net,
      lastDetail: breakdown(pending.bets, pending.dice),
      history: [pending.dice, ...g.history].slice(0, 10),
      rounds: g.rounds + 1,
      wins: g.wins + (net > 0 ? 1 : 0),
      bets: emptyBets(),
      lastBets: pending.bets,
      dice: pending.dice,
    });
    persist(get());
  },
}));
