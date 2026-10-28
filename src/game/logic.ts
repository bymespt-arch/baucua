export const SYMBOLS = [
  { id: "nai", name: "Nai", tone: "#e2a84a" },
  { id: "bau", name: "Bầu", tone: "#d23b2f" },
  { id: "ga", name: "Gà", tone: "#c0392b" },
  { id: "ca", name: "Cá", tone: "#2f7eb0" },
  { id: "cua", name: "Cua", tone: "#2a62d0" },
  { id: "tom", name: "Tôm", tone: "#e07a2f" },
] as const;

export type SymbolId = (typeof SYMBOLS)[number]["id"];

export const SYMBOL_IDS: SymbolId[] = SYMBOLS.map((s) => s.id);

export type FaceTriple = [SymbolId, SymbolId, SymbolId];

export type Bets = Record<SymbolId, number>;

export const CHIPS = [10_000, 20_000, 50_000, 100_000, 500_000] as const;

export const START_BALANCE = 5_000_000;

export const SHAKE_MS = 1750;
export const SETTLE_MS = 820;

export function emptyBets(): Bets {
  return { nai: 0, bau: 0, ga: 0, ca: 0, cua: 0, tom: 0 };
}

export function stakeOf(bets: Bets): number {
  let n = 0;
  for (const id of SYMBOL_IDS) n += bets[id];
  return n;
}

export function rollDice(): FaceTriple {
  const pick = () => SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]!;
  return [pick(), pick(), pick()];
}

export function countsOf(dice: FaceTriple): Bets {
  const counts = emptyBets();
  for (const id of dice) counts[id] += 1;
  return counts;
}

/** Tiền nhận lại (gồm vốn mặt trúng). Mặt không ra thì mất. */
export function returnedOf(bets: Bets, dice: FaceTriple): number {
  const counts = countsOf(dice);
  let pay = 0;
  for (const id of SYMBOL_IDS) {
    const n = counts[id];
    if (n > 0 && bets[id] > 0) pay += bets[id] * (n + 1);
  }
  return pay;
}

export type SymbolResult = {
  id: SymbolId;
  name: string;
  bet: number;
  count: number;
  net: number;
};

export function breakdown(bets: Bets, dice: FaceTriple): SymbolResult[] {
  const counts = countsOf(dice);
  return SYMBOLS.map((s) => {
    const bet = bets[s.id];
    const count = counts[s.id];
    const net = bet === 0 ? 0 : count > 0 ? bet * count : -bet;
    return { id: s.id, name: s.name, bet, count, net };
  }).filter((row) => row.bet > 0);
}

export function formatDong(n: number): string {
  return `${Math.round(n).toLocaleString("vi-VN")}đ`;
}

export function formatK(n: number): string {
  const sign = n < 0 ? "−" : "";
  const v = Math.abs(Math.round(n));
  if (v >= 1000) return `${sign}${Math.round(v / 1000)}k`;
  return `${sign}${v}`;
}

export function formatChip(n: number): string {
  return n.toLocaleString("vi-VN");
}

export function roundMs(reduce: boolean): number {
  return reduce ? 720 : SHAKE_MS + SETTLE_MS;
}

export function symbolName(id: SymbolId): string {
  return SYMBOLS.find((s) => s.id === id)?.name ?? id;
}
