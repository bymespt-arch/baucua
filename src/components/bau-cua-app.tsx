import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from "react";
import { CircleHelp, Settings, Volume2, VolumeX } from "lucide-react";
import {
  CHIPS,
  type FaceTriple,
  type SymbolId,
  SYMBOLS,
  countsOf,
  formatDong,
  formatK,
  roundMs,
  stakeOf,
} from "@/game/logic";
import { playChip, setMuted, startRumble, stopRumble, unlockAudio, playWin, playLose } from "@/game/audio";
import { useGame } from "@/game/store";
import { beatPresence } from "@/lib/presence";

const AUTO_STEPS = [5, 10, 15, 20, 30] as const;
const ORDER: SymbolId[] = ["nai", "bau", "ga", "ca", "cua", "tom"];

const NOTE_TONE: Record<number, string> = {
  10000: "note-10",
  20000: "note-20",
  50000: "note-50",
  100000: "note-100",
  500000: "note-500",
};

type SceneProps = {
  faces: FaceTriple;
  shakeId: number;
  reduce: boolean;
  sound: boolean;
  onSettled: (id: number) => void;
};

function Mai({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="20" cy="20" r="4" />
        <path d="M20 8c2 4 2 8 0 12M20 20c6-2 10 2 12 6M20 20c-6-2-10 2-12 6M20 16c4-6 10-6 14-4M20 16c-4-6-10-6-14-4" />
      </g>
    </svg>
  );
}

function Diamond() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.35">
        <path d="M20 4 36 20 20 36 4 20z" />
        <path d="M20 12 28 20 20 28 12 20z" />
      </g>
    </svg>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
        <path d="M20 4v32M4 20h32M8 8l24 24M32 8 8 32" />
      </g>
    </svg>
  );
}

function Pagoda() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.35">
        <path d="M20 3 8 14h24z" />
        <path d="M6 18c4-3 8-4 14-4s10 1 14 4" />
        <path d="M10 18v14h20V18" />
        <path d="M17 32v-7h6v7" />
      </g>
    </svg>
  );
}

function Lantern() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.35">
        <path d="M20 4v4M14 8h12" />
        <path d="M12 14c2-4 14-4 16 0l-2 14c-1 4-11 4-12 0z" />
        <path d="M16 32h8l-1 4h-6z" />
      </g>
    </svg>
  );
}

function Lotus() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.35">
        <path d="M20 30c-8-2-12-8-12-14 4 2 8 2 12-2 4 4 8 4 12 2 0 6-4 12-12 14z" />
        <path d="M20 14c0 6-2 12-2 16M20 14c0 6 2 12 2 16" />
      </g>
    </svg>
  );
}

function Bowl() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.35">
        <path d="M8 16h24c-1 10-6 16-12 16S9 26 8 16z" />
        <path d="M16 16c0-4 2-7 4-7s4 3 4 7" />
      </g>
    </svg>
  );
}

function DenLong() {
  return (
    <svg viewBox="0 0 48 92" aria-hidden="true">
      <path d="M24 1v8" stroke="#f0d48a" strokeWidth="1.4" />
      <path d="M15 9h18" stroke="#f0d48a" strokeWidth="1.6" />
      <path d="M12 16c1.5-5 22.5-5 24 0l-2.4 38c-1.6 6-17.6 6-19.2 0z" fill="#d3262f" stroke="#f3d27a" strokeWidth="1.3" />
      <path d="M14 20h20M13 32h22M14 44h20" stroke="#f8e7b0" strokeWidth="1.1" />
      <circle cx="24" cy="32" r="3.2" fill="#f3d27a" />
      <path d="M19 54h10l-1.6 7h-6.8z" fill="#f3d27a" />
      <path d="M24 61v8" stroke="#d3262f" strokeWidth="1.4" />
      <path d="M16 72c5 10 11 10 16 0-5 3-11 3-16 0z" fill="#e23b42" />
    </svg>
  );
}

function HoaDao() {
  return (
    <svg viewBox="0 0 96 120" aria-hidden="true">
      <path d="M10 116C28 90 26 70 46 54c16-12 28-24 40-46" fill="none" stroke="#6a3a28" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M46 54c8-2 16-12 14-24" fill="none" stroke="#6a3a28" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M62 78c10 2 18-6 16-16" fill="none" stroke="#6a3a28" strokeWidth="2" strokeLinecap="round" />
      <g fill="#f7b4c4">
        <circle cx="30" cy="78" r="7" />
        <circle cx="48" cy="62" r="8" />
        <circle cx="40" cy="40" r="7" />
        <circle cx="68" cy="34" r="7.5" />
        <circle cx="78" cy="18" r="6.5" />
        <circle cx="58" cy="86" r="6" />
        <circle cx="74" cy="68" r="6.5" />
      </g>
      <g fill="#fff6ea">
        <circle cx="30" cy="78" r="2.2" />
        <circle cx="48" cy="62" r="2.4" />
        <circle cx="40" cy="40" r="2.1" />
        <circle cx="68" cy="34" r="2.2" />
        <circle cx="78" cy="18" r="2" />
        <circle cx="58" cy="86" r="1.8" />
        <circle cx="74" cy="68" r="2" />
      </g>
    </svg>
  );
}

function BoardPattern() {
  const id = `tet-${useId().replace(/:/g, "")}`;
  return (
    <svg className="board-pattern" aria-hidden="true">
      <defs>
        <pattern id={id} width="150" height="140" patternUnits="userSpaceOnUse">
          <g color="#ffe7a8">
            <g transform="translate(0,0) scale(0.9)"><Mai /></g>
            <g transform="translate(78,2) scale(0.85)"><Lantern /></g>
            <g transform="translate(4,74) scale(0.85)"><Lotus /></g>
            <g transform="translate(82,72) scale(0.88)"><Diamond /></g>
            <g transform="translate(52,46) scale(0.62)"><Star /></g>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function BauCuaApp() {
  const balance = useGame((s) => s.balance);
  const chip = useGame((s) => s.chip);
  const bets = useGame((s) => s.bets);
  const phase = useGame((s) => s.phase);
  const dice = useGame((s) => s.dice);
  const shakeId = useGame((s) => s.shakeId);
  const lastNet = useGame((s) => s.lastNet);
  const lastDetail = useGame((s) => s.lastDetail);
  const history = useGame((s) => s.history);
  const sound = useGame((s) => s.sound);
  const rounds = useGame((s) => s.rounds);
  const lastBets = useGame((s) => s.lastBets);
  const hydrated = useGame((s) => s.hydrated);
  const hydrate = useGame((s) => s.hydrate);
  const setChip = useGame((s) => s.setChip);
  const addBet = useGame((s) => s.addBet);
  const removeBet = useGame((s) => s.removeBet);
  const clearBets = useGame((s) => s.clearBets);
  const repeatBets = useGame((s) => s.repeatBets);
  const toggleSound = useGame((s) => s.toggleSound);
  const xinVon = useGame((s) => s.xinVon);
  const xoc = useGame((s) => s.xoc);
  const settled = useGame((s) => s.settled);

  const [Scene, setScene] = useState<ComponentType<SceneProps> | null>(null);
  const [reduce, setReduce] = useState(false);
  const [drive, setDrive] = useState<"hand" | "auto">("auto");
  const [secs, setSecs] = useState(10);
  const [autoSec, setAutoSec] = useState(10);
  const [needBet, setNeedBet] = useState(false);
  const autoSecRef = useRef(autoSec);
  const needBetRef = useRef(needBet);
  autoSecRef.current = autoSec;
  needBetRef.current = needBet;
  const [toast, setToast] = useState<string | null>(null);
  const [bannerOut, setBannerOut] = useState(false);
  const nextAt = useRef(0);
  const driveRef = useRef(drive);
  driveRef.current = drive;
  const [sheet, setSheet] = useState<"rules" | "settings" | null>(null);
  const [online, setOnline] = useState<number | null>(null);
  const [displayBal, setDisplayBal] = useState(balance);
  const seenHydrate = useRef(false);
  const toastTimer = useRef(0);
  const settingsReady = useRef(false);
  const fullOnce = useRef(false);

  const fitScreen = useCallback(() => {
    const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
    document.documentElement.style.setProperty("--app-h", `${h}px`);
  }, []);

  const collapseBar = useCallback(() => {
    const extra = 80;
    document.documentElement.style.height = `${window.innerHeight + extra}px`;
    window.scrollTo(0, extra);
    window.setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.style.height = "";
      fitScreen();
    }, 90);
  }, [fitScreen]);

  useEffect(() => {
    hydrate();
    void import("@/components/dice-scene").then((m) => setScene(() => m.DiceScene));
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [hydrate]);

  useEffect(() => {
    fitScreen();
    const desktop = window.matchMedia("(min-width: 720px)").matches;
    if (!desktop) collapseBar();
    const vv = window.visualViewport;
    const onChange = () => fitScreen();
    vv?.addEventListener("resize", onChange);
    vv?.addEventListener("scroll", onChange);
    window.addEventListener("resize", onChange);
    if (!desktop) window.addEventListener("orientationchange", collapseBar);
    return () => {
      vv?.removeEventListener("resize", onChange);
      vv?.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", collapseBar);
    };
  }, [collapseBar, fitScreen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bau-cua-settings");
      if (raw) {
        const data = JSON.parse(raw) as { autoSec?: number; needBet?: boolean };
        if (data.autoSec && AUTO_STEPS.includes(data.autoSec as (typeof AUTO_STEPS)[number])) setAutoSec(data.autoSec);
        if (typeof data.needBet === "boolean") setNeedBet(data.needBet);
      }
    } catch {
      /* keep defaults */
    }
    settingsReady.current = true;
  }, []);

  useEffect(() => {
    if (!settingsReady.current) return;
    localStorage.setItem("bau-cua-settings", JSON.stringify({ autoSec, needBet }));
  }, [autoSec, needBet]);

  useEffect(() => {
    setMuted(!sound);
  }, [sound]);

  useEffect(() => {
    const key = "bau-cua-viewer";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    let stop = false;
    let misses = 0;
    const beat = (leave = false) => {
      void beatPresence({ data: { id, leave } })
        .then((res) => {
          if (stop || leave) return;
          misses = 0;
          setOnline(res.online);
        })
        .catch(() => {
          misses += 1;
          if (misses >= 2) {
            stop = true;
            window.clearInterval(timer);
          }
        });
    };
    beat();
    const timer = window.setInterval(() => beat(), 8000);
    const onHide = () => beat(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      stop = true;
      window.clearInterval(timer);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!seenHydrate.current) {
      seenHydrate.current = true;
      setDisplayBal(balance);
      return;
    }
    const from = displayBal;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / 650);
      const e = 1 - (1 - u) ** 3;
      setDisplayBal(Math.round(from + (balance - from) * e));
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, hydrated]);

  useEffect(() => {
    if (phase !== "shake") {
      stopRumble();
      return;
    }
    if (sound) startRumble();
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(16);
    const t = window.setTimeout(() => settled(), roundMs(reduce) + 800);
    return () => {
      window.clearTimeout(t);
      stopRumble();
    };
  }, [phase, shakeId, sound, reduce, settled]);

  useEffect(() => {
    if (phase !== "result") {
      setBannerOut(false);
      return;
    }
    setBannerOut(false);
    if (sound) {
      if (lastNet > 0) playWin();
      else if (lastNet < 0) playLose();
    }
    if (lastNet > 0 && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([16, 36, 16]);
    }
    const out = window.setTimeout(() => setBannerOut(true), 3160);
    const t = window.setTimeout(() => {
      if (useGame.getState().phase !== "result") return;
      useGame.setState({ phase: "bet" });
      if (driveRef.current === "auto") {
        nextAt.current = performance.now() + autoSecRef.current * 1000;
        setSecs(autoSecRef.current);
      }
    }, 3600);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(t);
    };
  }, [phase, shakeId, lastNet, sound]);

  const ping = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1700);
  }, []);

  const onAdd = (id: SymbolId) => {
    unlockAudio();
    const res = addBet(id);
    if (res === "ok") {
      if (sound) playChip();
      return;
    }
    if (res === "broke") ping("Không đủ tiền cho mệnh giá này");
  };

  const onXoc = useCallback(() => {
    unlockAudio();
    const res = xoc(!needBetRef.current);
    if (res === "nobet") {
      ping("Chạm con vật để đặt cược đã");
      return;
    }
    if (res === "ok" && driveRef.current === "auto") {
      nextAt.current = 0;
      setSecs(0);
    }
  }, [ping, xoc]);

  useEffect(() => {
    if (!hydrated || drive !== "auto") {
      if (drive !== "auto") nextAt.current = 0;
      return;
    }
    const g = useGame.getState();
    if (g.phase === "bet" && !nextAt.current) onXoc();
    const id = window.setInterval(() => {
      if (!nextAt.current) return;
      const left = nextAt.current - performance.now();
      setSecs(Math.max(0, Math.ceil(left / 1000)));
      if (left > 0) return;
      const now = useGame.getState();
      if (now.phase !== "bet") return;
      if (needBetRef.current && stakeOf(now.bets) <= 0) return;
      nextAt.current = 0;
      setSecs(0);
      onXoc();
    }, 200);
    return () => window.clearInterval(id);
  }, [drive, hydrated, onXoc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "5") {
        const next = CHIPS[Number(e.key) - 1];
        if (next) setChip(next);
      }
      if (e.code === "Space" || e.code === "Enter") {
        if (sheet) return;
        e.preventDefault();
        onXoc();
      }
      if (e.key === "Escape") setSheet(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onXoc, setChip, sheet]);

  const stake = stakeOf(bets);
  const counts = countsOf(dice);
  const broke = balance < 10_000 && stake === 0 && phase !== "shake";
  const showHint = hydrated && rounds === 0 && stake === 0 && phase === "bet" && !toast;
  const waitingBet = drive === "auto" && needBet && stake === 0 && phase === "bet";

  const headline =
    lastDetail.some((d) => d.count === 3)
      ? "Nổ ba mặt!"
      : lastDetail.some((d) => d.count === 2)
        ? "Nổ đôi!"
        : lastNet > 0
          ? "Ăn rồi!"
          : lastNet === 0
            ? "Hoà vốn"
            : "Xịt!";

  const openFull = () => {
    unlockAudio();
    if (fullOnce.current) return;
    fullOnce.current = true;
    if (window.matchMedia("(min-width: 720px)").matches) return;
    const el = document.documentElement;
    void el.requestFullscreen?.().catch(() => {});
    collapseBar();
  };

  return (
    <div className="shell" onPointerDown={openFull}>
      <section className="table-wood">
        <div className="col">
          <header className="mast">
            <div className="brand-mini">
              <span className="brand-kicker">Bầu Cua Tôm Cá</span>
              {online != null ? (
                <span className="brand-meta" aria-label={`${online} người đang online`}>
                  <i className="online-dot" aria-hidden="true" />
                  {online}
                </span>
              ) : null}
            </div>
            <div className="balance">
              <p className="balance-num" aria-label={formatDong(balance)}>
                {Math.round(displayBal).toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="tools">
              <button type="button" className={`tool ${sound ? "" : "is-off"}`} aria-label={sound ? "Tắt tiếng" : "Bật tiếng"} aria-pressed={sound} onClick={toggleSound}>
                {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button type="button" className="tool" aria-label="Cài đặt" onClick={() => setSheet("settings")}>
                <Settings size={18} />
              </button>
              <button type="button" className="tool" aria-label="Luật chơi" onClick={() => setSheet("rules")}>
                <CircleHelp size={18} />
              </button>
            </div>
          </header>

          <div className="topbar">
            <div className="chip-row" role="listbox" aria-label="Mệnh giá">
              {CHIPS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={chip === value}
                  className={`note ${NOTE_TONE[value]} ${chip === value ? "is-on" : ""}`}
                  disabled={phase === "shake" || balance < value}
                  aria-label={formatDong(value)}
                  onClick={() => setChip(value)}
                >
                  <span className="note-value">{value / 1000}k</span>
                </button>
              ))}
            </div>
          </div>

          <div className="stage">
            <div className="tet-side" aria-hidden="true">
              <span className="den den-l"><DenLong /></span>
              <span className="den den-r"><DenLong /></span>
              <span className="dao dao-l"><HoaDao /></span>
              <span className="dao dao-r"><HoaDao /></span>
            </div>
            {Scene ? (
              <Scene faces={dice} shakeId={shakeId} reduce={reduce} sound={sound} onSettled={() => settled()} />
            ) : (
              <div className="plate-ghost" />
            )}
            {showHint ? <p className="hint">Chọn tiền, chạm con vật, rồi Tự bấm hoặc bật Tự động</p> : null}
            {toast ? <p className="toast" role="status">{toast}</p> : null}
            {phase === "result" && lastNet > 0
              ? Array.from({ length: 12 }, (_, i) => {
                  const a = (i / 12) * Math.PI * 2;
                  return (
                    <span
                      key={i}
                      className="coin"
                      style={{
                        ["--x" as string]: `${Math.cos(a) * 90}px`,
                        ["--y" as string]: `${Math.sin(a) * 64}px`,
                        ["--d" as string]: `${(i % 4) * 40}ms`,
                      }}
                    />
                  );
                })
              : null}
          </div>
        </div>
      </section>

      <section className="board" aria-label="Bàn cược">
        <BoardPattern />
        <div className="col">
          <div className="recent" aria-label="Ván gần đây">
            <div className="recent-head">
              <p className="recent-label">Ván gần đây</p>
              {stake > 0 ? <p className="recent-stake">Đang cược {formatK(stake)}</p> : <p className="recent-stake is-quiet">{history.length} ván</p>}
            </div>
            <div className="recent-scroller">
              {history.length === 0 ? <p className="recent-empty">Chưa có kết quả</p> : null}
              {history.slice(0, 10).map((row, i) => (
                <div
                  key={`${history.length - i}-${row.join("-")}`}
                  className={i === 0 ? "recent-round is-new" : "recent-round"}
                  aria-label={row.map((id) => SYMBOLS.find((s) => s.id === id)?.name ?? id).join(", ")}
                >
                  <span className="recent-idx">{i === 0 ? "Mới" : i + 1}</span>
                  {row.map((id, k) => (
                    <img key={k} src={`/faces/${id}.jpg`} alt="" />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="sim-note">
            <p>Trò chơi mô phỏng không đặt cược tiền thật</p>
          </div>
          <div className="hoa-row" aria-hidden="true">
            <Mai />
            <Diamond />
            <Bowl />
            <Star />
            <Lantern />
            <Lotus />
            <Pagoda />
          </div>
          <div className="mat">
            <div className="medals">
              {ORDER.map((id) => {
                const meta = SYMBOLS.find((s) => s.id === id)!;
                const bet = bets[id];
                const state = phase === "result" && lastBets[id] > 0 ? (counts[id] > 0 ? "win" : "lose") : undefined;
                return (
                  <div key={id} className="medal" data-state={state}>
                    <button
                      type="button"
                      className="medal-add"
                      disabled={phase === "shake"}
                      onClick={() => onAdd(id)}
                      aria-label={`Đặt ${meta.name}${bet ? `, đang cược ${formatK(bet)}` : ""}`}
                    >
                      <span className="medal-face">
                        <img src={`/faces/cut/${id}.png`} alt="" />
                        {bet > 0 ? <span key={bet} className="medal-ring" /> : null}
                      </span>
                      <span key={bet} className={`medal-stake${bet > 0 ? " is-on" : " is-empty"}`}>
                        {bet > 0 ? formatK(bet) : "Đặt"}
                      </span>
                    </button>
                    {bet > 0 ? (
                      <button type="button" className="medal-sub" aria-label={`Bớt cược ${meta.name}`} onClick={() => removeBet(id)}>
                        −
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="dock">
            <div className="drive" role="group" aria-label="Cách xóc">
              <button
                type="button"
                className={drive === "hand" ? "is-on" : ""}
                aria-pressed={drive === "hand"}
                disabled={drive === "hand" && phase === "shake"}
                onClick={() => {
                  if (drive === "auto") {
                    setDrive("hand");
                    return;
                  }
                  onXoc();
                }}
              >
                <span>Tự bấm</span>
                <small>{phase === "shake" && drive === "hand" ? "…" : stake > 0 ? formatK(stake) : "Xóc"}</small>
              </button>
              <button
                type="button"
                className={drive === "auto" ? "is-on" : ""}
                aria-pressed={drive === "auto"}
                onClick={() => {
                  if (drive === "auto") {
                    setDrive("hand");
                    return;
                  }
                  setDrive("auto");
                  unlockAudio();
                }}
              >
                <span>Tự động</span>
                <small>
                  {drive === "auto" ? (phase === "shake" || secs <= 0 ? (waitingBet ? "chờ cược" : "…") : `${secs}s`) : `${autoSec} giây`}
                </small>
              </button>
            </div>
            <div className="board-actions">
              {stake > 0 && phase !== "shake" ? (
                <button type="button" className="linkish danger" onClick={clearBets}>
                  Thu hết
                </button>
              ) : null}
              {stake === 0 && stakeOf(lastBets) > 0 && phase !== "shake" ? (
                <button
                  type="button"
                  className="linkish"
                  onClick={() => {
                    const res = repeatBets();
                    if (res === "broke") ping("Không đủ tiền để cược lại");
                    else if (res === "ok" && sound) playChip();
                  }}
                >
                  Cược lại
                </button>
              ) : null}
              {broke ? (
                <button type="button" className="linkish" onClick={xinVon}>
                  Xin vốn +1 triệu
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {phase === "result" ? (
        <div className="banner-layer">
          <div className={`banner${bannerOut ? " is-out" : ""}`} role="status">
            <div className="banner-grid">
              <ul className="banner-side">
                {ORDER.slice(0, 3).map((id) => {
                  const meta = SYMBOLS.find((s) => s.id === id)!;
                  const count = counts[id];
                  const bet = lastBets[id];
                  const net = bet === 0 ? 0 : count > 0 ? bet * count : -bet;
                  return (
                    <li key={id} className={count > 0 ? "is-hit" : ""}>
                      <img src={`/faces/cut/${id}.png`} alt="" />
                      <span>
                        {meta.name} ×{count}
                        <em className={bet === 0 ? "flat" : net > 0 ? "up" : "down"}>
                          {bet === 0 ? "—" : `${net > 0 ? "+" : ""}${formatK(net)}`}
                        </em>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="banner-mid">
                <div className="banner-faces">
                  {dice.map((id, i) => (
                    <img key={`${id}-${i}`} src={`/faces/${id}.jpg`} alt={SYMBOLS.find((s) => s.id === id)?.name ?? id} />
                  ))}
                </div>
                <h2>{headline}</h2>
                <p className={`banner-net ${lastNet > 0 ? "up" : lastNet < 0 ? "down" : "flat"}`}>
                  {lastNet > 0 ? "+" : ""}
                  {formatDong(lastNet)}
                </p>
              </div>
              <ul className="banner-side is-right">
                {ORDER.slice(3).map((id) => {
                  const meta = SYMBOLS.find((s) => s.id === id)!;
                  const count = counts[id];
                  const bet = lastBets[id];
                  const net = bet === 0 ? 0 : count > 0 ? bet * count : -bet;
                  return (
                    <li key={id} className={count > 0 ? "is-hit" : ""}>
                      <span>
                        <em className={bet === 0 ? "flat" : net > 0 ? "up" : "down"}>
                          {bet === 0 ? "—" : `${net > 0 ? "+" : ""}${formatK(net)}`}
                        </em>
                        ×{count} {meta.name}
                      </span>
                      <img src={`/faces/cut/${id}.png`} alt="" />
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {drive === "auto" && phase === "bet" && secs > 0 ? (
        <div className="auto-count" aria-live="polite">
          <div className="auto-count-card">
            <span>Tự Động Xóc sau</span>
            <strong key={secs}>{secs}</strong>
          </div>
        </div>
      ) : null}

      {sheet ? (
        <div className="sheet-back" onClick={() => setSheet(null)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={sheet === "rules" ? "Luật chơi" : "Cài đặt"}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="sheet-grab" aria-hidden="true" />
            <button type="button" className="sheet-close" onClick={() => setSheet(null)} aria-label="Đóng">
              ×
            </button>
            {sheet === "rules" ? (
              <>
                <h2>Luật Bầu Cua</h2>
                <ol>
                  <li>Chọn tờ tiền, chạm con vật để đặt. Nút trừ để gỡ đúng mệnh giá đang chọn.</li>
                  <li>Tự bấm để xóc. Tự động thì xóc ngay, hiện kết quả xong mới đếm rồi tới ván sau.</li>
                  <li>Trong Cài đặt có thể đổi thời gian đếm và bật bắt buộc phải cược trước khi xóc.</li>
                  <li>Ba hột xoay trên bàn rồi rơi ra ba chỗ khác nhau.</li>
                  <li>Con nào ra mấy mặt thì ăn bấy nhiêu lần tiền cược, và được trả lại vốn của mặt đó.</li>
                  <li>Ví dụ cược 10.000 vào Nai, ra 2 Nai: nhận 30.000 (lãi 20.000).</li>
                </ol>
                <p>Phím 1–5 chọn tiền, phím cách để xóc. Vốn được nhớ trên máy này.</p>
              </>
            ) : (
              <>
                <h2>Cài đặt</h2>
                <div className="set-block">
                  <p className="set-label">Thời gian quay tự động</p>
                  <div className="set-steps" role="radiogroup" aria-label="Thời gian tự động">
                    {AUTO_STEPS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={autoSec === n}
                        className={autoSec === n ? "is-on" : ""}
                        onClick={() => setAutoSec(n)}
                      >
                        {n}s
                      </button>
                    ))}
                  </div>
                </div>
                <div className="set-block">
                  <div className="set-copy">
                    <p className="set-label">Cược trước khi xóc</p>
                    <p className="set-help">{needBet ? "Phải đặt tiền mới được quay." : "Có thể quay cả khi chưa đặt."}</p>
                  </div>
                  <button
                    type="button"
                    className={`set-switch${needBet ? " is-on" : ""}`}
                    aria-pressed={needBet}
                    onClick={() => setNeedBet((v) => !v)}
                  >
                    <span />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
