"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Palette & helpers ────────────────────────────────────────────────────────
const CAT = {
  ibadah:   { label: "Ibadah",   color: "#C9A84C", bg: "rgba(201,168,76,0.10)"  },
  work:     { label: "Work",     color: "#61AFEF", bg: "rgba(97,175,239,0.10)"  },
  learning: { label: "Learning", color: "#56B6C2", bg: "rgba(86,182,194,0.10)"  },
  family:   { label: "Family",   color: "#E06C75", bg: "rgba(224,108,117,0.10)" },
  health:   { label: "Health",   color: "#98C379", bg: "rgba(152,195,121,0.10)" },
  meal:     { label: "Meal",     color: "#E5C07B", bg: "rgba(229,192,123,0.10)" },
  planning: { label: "Planning", color: "#C678DD", bg: "rgba(198,120,221,0.10)" },
  rest:     { label: "Rest",     color: "#5C6370", bg: "rgba(92,99,112,0.15)"   },
  chores:   { label: "Chores",   color: "#4EC9B0", bg: "rgba(78,201,176,0.10)"  },
} as const;

type CategoryKey = keyof typeof CAT;

type SundayVisibility = boolean | "only";

interface Block {
  id: number;
  time: string;
  title: string;
  cat: CategoryKey;
  dur: number;
  sunday: SundayVisibility;
  desc: string;
  tip?: string;
}

interface EditableBlock extends Omit<Block, "id"> {
  id: number | null;
}

interface LogEntry {
  id: number;
  blockId: number;
  title: string;
  cat: CategoryKey;
  seconds: number;
  day: string;
  time: string;
}

const fmtSec = (s: number): string => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2,"0")}m`;
  return `${m}m ${sec.toString().padStart(2,"0")}s`;
};

const fmtMin = (m: number): string => {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), rem = m % 60;
  return rem === 0 ? `${h} hr` : `${h} hr ${rem} min`;
};

// ─── Default schedule data ────────────────────────────────────────────────────
const DEFAULT_BLOCKS: Block[] = [
  { id:1,  time:"~5:00 AM",  title:"Wake up — Tahajjud",              cat:"ibadah",   dur:30,  sunday:true,  desc:"Rise 30 min before Fajr. Pray Tahajjud (2–8 rak'at). Make sincere du'a — this is the most powerful window of the day.", tip:"Keep a du'a list ready the night before." },
  { id:2,  time:"~5:30 AM",  title:"Fajr Prayer + Quran Study",       cat:"ibadah",   dur:60,  sunday:true,  desc:"Pray Fajr, then spend 1 hour in recitation and reflection. Read at least 1 page of tafsir.", tip:"Target: 1 juz per month = ~1 page/day." },
  { id:3,  time:"6:30 AM",   title:"Breakfast",                       cat:"meal",     dur:60,  sunday:true,  desc:"Eat mindfully. Mentally review yesterday's results and today's intentions.", tip:"No screens during breakfast." },
  { id:4,  time:"7:30 AM",   title:"Morning Planning",                cat:"planning", dur:15,  sunday:true,  desc:"Write your 3 MITs (Most Important Tasks). Block time for each. Open your task manager.", tip:"Never open social media before this step." },
  { id:5,  time:"8:00 AM",   title:"Take Hawa to School",             cat:"family",   dur:30,  sunday:false, desc:"Drive Hawa (~15 min). Use the return commute for dhikr, audiobook, or a learning podcast.", tip:"Be back home by 8:30 AM." },
  { id:6,  time:"8:30 AM",   title:"Deep Work — Block 1 (Freelance)", cat:"work",     dur:150, sunday:false, desc:"Highest-focus client work. Code, deliver, communicate. Pomodoro: 50 min on / 10 min break. Silence all notifications.", tip:"Start with the hardest task, not email." },
  { id:7,  time:"8:30 AM",   title:"Weekly Planning (Sunday)",        cat:"planning", dur:60,  sunday:"only", desc:"Review last week. Set this week's targets. Update project board. Block time for learning, work, and family.", tip:"Sunday only — the compass for the whole week." },
  { id:8,  time:"11:00 AM",  title:"Learning Block",                  cat:"learning", dur:60,  sunday:false, desc:"Structured learning: course, tutorial, or docs. One track at a time.", tip:"Daily: 30–60 min. Weekly: 1 chapter. Monthly: 1 course done." },
  { id:9,  time:"12:00 PM",  title:"Dhuhr Prayer",                    cat:"ibadah",   dur:15,  sunday:true,  desc:"Pray Dhuhr on time. Step away from the screen fully.", tip:"Hard stop — no 'just one more thing'." },
  { id:10, time:"12:15 PM",  title:"Lunch + Rest (Qaylula)",          cat:"meal",     dur:45,  sunday:true,  desc:"Eat lunch. Take a short nap if needed (10–20 min Qaylula is Sunnah). No screens.", tip:"Even a 10-min rest dramatically improves afternoon focus." },
  { id:11, time:"1:00 PM",   title:"Deep Work — Block 2 / Chores",   cat:"work",     dur:120, sunday:false, desc:"Continue client work or shift to freelance admin, proposals, and follow-ups.", tip:"Batch admin tasks here, not during Block 1." },
  { id:12, time:"1:00 PM",   title:"Household Chores (Sunday)",       cat:"chores",   dur:120, sunday:"only", desc:"Clean room. Polish shoes. Laundry. Tidy living spaces. Grocery list prep.", tip:"Sunday only — a clean space = a clear mind." },
  { id:13, time:"3:00 PM",   title:"Learning / Buffer / Admin",       cat:"learning", dur:90,  sunday:false, desc:"Flexible block: learning, client communication, portfolio work, or catching up.", tip:"Don't let this bleed into Asr." },
  { id:14, time:"4:30 PM",   title:"Asr Prayer",                      cat:"ibadah",   dur:15,  sunday:true,  desc:"Pray Asr immediately. Hard stop on all work. The Prophet ﷺ warned strongly about missing it.", tip:"Set an Asr alarm as a non-negotiable trigger." },
  { id:15, time:"5:00 PM",   title:"Walk / Workout / Bazaar",         cat:"health",   dur:60,  sunday:true,  desc:"~1 hour of movement: walk, gym, home workout, or grocery run. Listen to a lecture or podcast.", tip:"Batch groceries on fixed days (e.g. Mon/Thu) to save decision fatigue." },
  { id:16, time:"Maghrib",   title:"Maghrib Prayer + Adhkar",         cat:"ibadah",   dur:20,  sunday:true,  desc:"Pray Maghrib at the adhan. Read evening adhkar and 3 Surahs. A blessed, short window.", tip:"Don't delay — Maghrib time is the shortest of all." },
  { id:17, time:"~7:30 PM",  title:"Dinner + Family Time",            cat:"meal",     dur:90,  sunday:true,  desc:"Eat together. Be present with family. Handle household tasks. Protect this time from work.", tip:"No work talk. This is restoration time." },
  { id:18, time:"Isha",      title:"Isha Prayer + Witr",              cat:"ibadah",   dur:20,  sunday:true,  desc:"Pray Isha and Witr. Read night adhkar. This closes the spiritual frame of the day.", tip:"Recite Ayatul Kursi and the 3 Quls." },
  { id:19, time:"~9:30 PM",  title:"Evening Review + Tomorrow's Plan",cat:"planning", dur:15,  sunday:true,  desc:"What did I complete? What carries over? Write tomorrow's 3 MITs. Close all work tabs.", tip:"Monthly (1st): review income, learning, fitness, and Quran targets." },
  { id:20, time:"10:00 PM",  title:"Wind-Down + Sleep with Intention",cat:"rest",     dur:30,  sunday:true,  desc:"Phone on DND or out of bedroom. Sleep supplications. Make niyyah to wake for Tahajjud.", tip:"Sleep on your right side. Lights out by 10:30 PM." },
];

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CatBadgeProps {
  cat: CategoryKey;
  small?: boolean;
}

function CatBadge({ cat, small = false }: CatBadgeProps) {
  const c = CAT[cat] || CAT.rest;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 font-semibold uppercase tracking-[0.06em]",
        small ? "py-0.5 text-[0.62rem]" : "py-1 text-[0.68rem]",
      )}
      style={{
        backgroundColor: c.bg,
        color: c.color,
        borderColor: `${c.color}33`,
      }}
    >
      {c.label}
    </span>
  );
}

interface BlockCardProps {
  block: Block;
  tracking: number | null;
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  onEdit: (block: EditableBlock | null) => void;
  elapsed: number;
}

function BlockCard({ block, tracking, onStart, onStop, onEdit, elapsed }: BlockCardProps) {
  const c = CAT[block.cat] || CAT.rest;
  const isActive = tracking === block.id;
  const pct = block.dur > 0 ? Math.min(100, (elapsed / (block.dur * 60)) * 100) : 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/70 px-4 py-3.5 transition-colors",
        "flex flex-wrap items-start gap-2.5",
        isActive && "ring-1 ring-primary/40 bg-card/80",
      )}
      style={{
        borderLeftColor: c.color,
        borderLeftWidth: 3,
        borderLeftStyle: "solid",
        backgroundColor: isActive ? c.bg : undefined,
      }}
    >
      {/* Progress bar */}
      {isActive && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full shadow-[0_0_8px_currentColor]"
          style={{ width: `${pct}%`, color: c.color, backgroundColor: c.color }}
        />
      )}

      {/* Time */}
      <div className="min-w-[70px] shrink-0 pt-[3px] text-[0.68rem] font-semibold tracking-[0.03em] text-muted-foreground">
        {block.time}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-[0.92rem] font-semibold",
              isActive ? "text-foreground" : "text-card-foreground",
            )}
          >
            {block.title}
          </span>
          <CatBadge cat={block.cat} small />
          <span className="ml-auto text-[0.68rem] text-muted-foreground">
            {fmtMin(block.dur)}
          </span>
        </div>
        <div className="text-[0.78rem] font-light leading-relaxed text-muted-foreground">
          {block.desc}
        </div>
        {block.tip && (
          <div className="mt-2 border-t border-border/60 pt-1.5 text-[0.73rem] text-muted-foreground">
            <span style={{ color: c.color }} className="font-semibold">
              Tip ·{" "}
            </span>
            {block.tip}
          </div>
        )}
        {/* Timer display */}
        {isActive && (
          <div
            className="mt-2 font-mono text-lg font-bold tracking-[0.05em]"
            style={{ color: c.color }}
          >
            ⏱ {fmtSec(elapsed)}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-1.5">
        {!isActive ? (
          <Button
            size="sm"
            variant="outline"
            className="text-[0.72rem] tracking-[0.04em] uppercase"
            style={{
              backgroundColor: c.bg,
              color: c.color,
              borderColor: `${c.color}55`,
            }}
            onClick={() => onStart(block.id)}
          >
            ▶ Start
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            className="text-[0.72rem] tracking-[0.04em] uppercase"
            onClick={() => onStop(block.id)}
          >
            ■ Stop
          </Button>
        )}
        <Button
          size="icon-xs"
          variant="ghost"
          className="border border-border/70 text-[0.72rem]"
          onClick={() => onEdit(block)}
        >
          ✎
        </Button>
      </div>
    </div>
  );
}

interface EditModalProps {
  block: EditableBlock;
  onSave: (block: EditableBlock) => void;
  onClose: () => void;
  onDelete: (id: number | null) => void;
}

function EditModal({ block, onSave, onClose, onDelete }: EditModalProps) {
  const [form, setForm] = useState<EditableBlock>({ ...block });
  const set = (k: keyof EditableBlock, v: EditableBlock[keyof EditableBlock]) =>
    setForm(f => ({...f, [k]: v}));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-7 shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 text-base font-semibold tracking-tight text-card-foreground">
          Edit Block
        </div>

        {[
          ["title","Title","text"],
          ["time","Time","text"],
          ["dur","Duration (minutes)","number"],
          ["desc","Description","textarea"],
          ["tip","Tip (optional)","textarea"],
        ].map(([k, label, type]) => (
          <div key={k} className="mb-3.5">
            <label
              className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
            >
              {label}
            </label>
            {type === "textarea" ? (
              <textarea
                value={(form as any)[k] || ""}
                onChange={e => set(k as keyof EditableBlock, e.target.value)}
                rows={2}
                className="w-full resize-y rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            ) : (
              <input
                type={type}
                value={(form as any)[k] ?? ""}
                onChange={e =>
                  set(
                    k as keyof EditableBlock,
                    type === "number" ? (+e.target.value as any) : (e.target.value as any),
                  )
                }
                className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
          </div>
        ))}

        <div className="mb-4.5">
          <label className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Category
          </label>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(CAT).map(k => (
              <Button
                key={k}
                type="button"
                size="xs"
                variant={form.cat === k ? "secondary" : "outline"}
                className="rounded-full px-3 text-[0.72rem] tracking-[0.04em] uppercase"
                style={
                  form.cat === k
                    ? {
                        backgroundColor: CAT[k as CategoryKey].bg,
                        color: CAT[k as CategoryKey].color,
                        borderColor: CAT[k as CategoryKey].color,
                      }
                    : undefined
                }
                onClick={() => set("cat", k as CategoryKey)}
              >
                {CAT[k as CategoryKey].label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Show on
          </label>
          <div className="flex gap-1.5">
            {[["true","All days (Mon–Sat)"],["only","Sunday only"],["false","Weekdays only (Mon–Sat)"]].map(([v,l]) => (
              <Button
                key={v}
                type="button"
                size="xs"
                variant={String(form.sunday)===v ? "secondary" : "outline"}
                onClick={() =>
                  set(
                    "sunday",
                    v==="true" ? true : v==="false" ? false : "only",
                  )
                }
              >
                {l}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="text-[0.78rem]"
            onClick={() => onDelete(block.id)}
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-[0.78rem]"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-[0.78rem]"
              onClick={() => onSave(form)}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [blocks, setBlocks] = useState<Block[]>(() => {
    if (typeof window === "undefined") return DEFAULT_BLOCKS;
    try {
      const saved = window.localStorage.getItem("routine-blocks");
      if (!saved) return DEFAULT_BLOCKS;
      const parsed = JSON.parse(saved) as Block[];
      if (!Array.isArray(parsed)) return DEFAULT_BLOCKS;
      return parsed;
    } catch {
      return DEFAULT_BLOCKS;
    }
  });
  const [dayIdx, setDayIdx] = useState<number>(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [tracking, setTracking] = useState<number | null>(null);     // block id being timed
  const [elapsed, setElapsed] = useState<number>(0);                  // seconds
  const [log, setLog] = useState<LogEntry[]>([]);                     // log entries
  const [editBlock, setEditBlock] = useState<EditableBlock | null>(null);
  const [view, setView] = useState<"schedule" | "log">("schedule");
  const [addMode, setAddMode] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number | null>(null);

  // Persist blocks to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("routine-blocks", JSON.stringify(blocks));
    } catch {
      // ignore storage errors
    }
  }, [blocks]);

  const isSunday = dayIdx === 6;

  // Visible blocks for current day
  const visible = useMemo(
    () =>
      blocks.filter(b => {
        if (b.sunday === "only") return isSunday;
        if (b.sunday === false) return !isSunday;
        return true;
      }),
    [blocks, isSunday],
  );

  // Timer tick
  useEffect(() => {
    if (tracking) {
      startRef.current = Date.now() - elapsed * 1000;
      timerRef.current = setInterval(() => {
        if (startRef.current == null) return;
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [tracking]);

  const handleStart = (id: number) => {
    if (tracking && tracking !== id) handleStop(tracking);
    setTracking(id);
    setElapsed(0);
    startRef.current = Date.now();
  };

  const handleStop = useCallback((id: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const secs = elapsed;
    const b = blocks.find(x => x.id === id);
    if (b && secs > 0) {
      setLog(l => [...l, {
        id: Date.now(), blockId: id, title: b.title, cat: b.cat,
        seconds: secs, day: DAYS[dayIdx], time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),
      }]);
    }
    setTracking(null);
    setElapsed(0);
  }, [elapsed, blocks, dayIdx]);

  const handleSave = (updated: EditableBlock) => {
    if (updated.id == null) return;
    setBlocks(bs => bs.map(b => (b.id === updated.id ? { ...b, ...updated, id: updated.id } : b)));
    setEditBlock(null);
  };

  const handleDelete = (id: number | null) => {
    if (id == null) return;
    setBlocks(bs => bs.filter(b => b.id !== id));
    setEditBlock(null);
  };

  const handleAdd = (form: EditableBlock) => {
    const newId = Date.now();
    const { id: _omitId, ...rest } = form;
    setBlocks(bs => [...bs, { ...rest, id: newId } as Block]);
    setEditBlock(null);
    setAddMode(false);
  };

  const handleResetDefaults = () => {
    const next = DEFAULT_BLOCKS;
    setBlocks(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("routine-blocks", JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
    }
  };

  // Daily totals per category from log
  const todayLog = useMemo(
    () => log.filter(l => l.day === DAYS[dayIdx]),
    [log, dayIdx],
  );
  const catTotals = useMemo(
    () =>
      todayLog.reduce<Record<string, number>>((acc, l) => {
        acc[l.cat] = (acc[l.cat] || 0) + l.seconds;
        return acc;
      }, {}),
    [todayLog],
  );
  const totalTracked = useMemo(
    () => Object.values(catTotals).reduce((a, b) => a + b, 0),
    [catTotals],
  );

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground font-sans">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
          radial-gradient(ellipse 70% 40% at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 90% 80%, rgba(78,201,176,0.04) 0%, transparent 60%)
        `,
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl px-4">

        {/* ── Header ── */}
        <div className="border-b border-border py-11 text-center mb-7">
          <div className="mb-3 text-[1.15rem] font-serif tracking-[0.05em] text-primary/80">
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </div>
          <h1 className="m-0 text-[1.9rem] font-bold tracking-[-0.025em] text-foreground">
            My <span className="text-primary">Routine</span> Tracker
          </h1>
          <div className="mt-1.5 text-[0.78rem] font-normal tracking-[0.05em] text-muted-foreground">
            Freelance Web Developer · Structured around Salah
          </div>

          {/* Live tracking badge */}
          {tracking && (
            <div className="mt-3.5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-[0.78rem]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-dot-pulse" />
              <span className="font-semibold text-primary">
                {blocks.find(b=>b.id===tracking)?.title} · {fmtSec(elapsed)}
              </span>
            </div>
          )}
        </div>

        {/* ── Day selector ── */}
        <div className="mb-5 flex flex-wrap gap-1.5 overflow-x-auto pb-1">
          {DAYS.map((d, i) => {
            const isSun = i === 6;
            const active = dayIdx === i;
            return (
              <Button
                key={d}
                type="button"
                size="xs"
                variant={active ? "secondary" : "outline"}
                className="rounded-md px-3 py-1 text-[0.78rem] font-semibold"
                onClick={() => setDayIdx(i)}
              >
                {d}
                {isSun ? " ✦" : ""}
              </Button>
            );
          })}
        </div>

        {/* ── View tabs + actions ── */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-fit gap-0 rounded-lg border border-border bg-card p-0.5">
            {[["schedule","📋 Schedule"],["log","📊 Today's Log"]].map(([v,l])=>(
              <button
                key={v}
                type="button"
                onClick={() => setView(v as "schedule" | "log")}
                className={cn(
                  "rounded-md px-4 py-1.5 text-[0.78rem] font-semibold transition-colors",
                  view === v
                    ? "bg-muted text-foreground"
                    : "bg-transparent text-muted-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="xs"
            className="border-destructive/30 text-[0.72rem] font-semibold tracking-[0.04em] uppercase text-destructive"
            onClick={handleResetDefaults}
          >
            Reset to defaults
          </Button>
        </div>

        {/* ── SCHEDULE VIEW ── */}
        {view === "schedule" && (
          <>
            {isSunday && (
              <div className="mb-4.5 rounded-lg border border-accent bg-accent/15 px-4 py-2.5 text-[0.8rem] text-accent-foreground">
                🌿 Sunday — Rest, Chores, Weekly Planning & Family Day
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {visible.map(block => (
                <BlockCard
                  key={block.id}
                  block={block}
                  tracking={tracking}
                  elapsed={tracking === block.id ? elapsed : 0}
                  onStart={handleStart}
                  onStop={handleStop}
                  onEdit={setEditBlock}
                />
              ))}
            </div>

            {/* Add block */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full border-dashed text-[0.8rem] font-semibold text-muted-foreground"
              onClick={() => {
                setAddMode(true);
                setEditBlock({
                  id: null, time:"", title:"", cat:"work",
                  dur:60, desc:"", tip:"", sunday:true,
                });
              }}
            >
              + Add Block
            </Button>
          </>
        )}

        {/* ── LOG VIEW ── */}
        {view === "log" && (
          <div>
            {/* Category breakdown */}
            {totalTracked > 0 && (
              <div className="mb-5 rounded-xl border border-border bg-card p-5">
                <div className="mb-3.5 text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">
                  Today's Time Breakdown · {fmtSec(totalTracked)} total
                </div>
                {Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat, secs]) => {
                  const pct = Math.round((secs / totalTracked) * 100);
                  const c = CAT[cat as CategoryKey] || CAT.rest;
                  return (
                    <div key={cat} className="mb-2.5">
                      <div className="mb-1 flex justify-between text-[0.76rem]">
                        <span style={{ color: c.color }} className="font-semibold">
                          {c.label}
                        </span>
                        <span className="text-muted-foreground">
                          {fmtSec(secs)} · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded bg-muted">
                        <div
                          className="h-full rounded shadow-[0_0_6px_currentColor] transition-[width] duration-400 ease-out"
                          style={{ width: `${pct}%`, color: c.color, backgroundColor: c.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Log entries */}
            {todayLog.length === 0 ? (
              <div className="px-5 py-16 text-center text-[0.9rem] text-muted-foreground">
                <div className="mb-3 text-3xl">⏱</div>
                No tracked sessions for {DAYS[dayIdx]} yet.<br/>
                <span className="text-[0.78rem]">
                  Hit ▶ Start on any block to begin tracking.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {[...todayLog].reverse().map(entry => {
                  const c = CAT[entry.cat] || CAT.rest;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5"
                      style={{ borderLeftColor: c.color, borderLeftWidth: 3, borderLeftStyle: "solid" }}
                    >
                      <div className="flex-1">
                        <div className="text-[0.85rem] font-semibold text-foreground">
                          {entry.title}
                        </div>
                        <div className="mt-0.5 text-[0.72rem] text-muted-foreground">
                          {entry.day} · {entry.time}
                        </div>
                      </div>
                      <CatBadge cat={entry.cat} small />
                      <div
                        className="min-w-[60px] text-right font-mono text-[0.85rem] font-bold"
                        style={{ color: c.color }}
                      >
                        {fmtSec(entry.seconds)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {todayLog.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-destructive/30 text-[0.74rem] font-semibold text-destructive/70"
                onClick={() => setLog(l => l.filter(x => x.day !== DAYS[dayIdx]))}
              >
                Clear Today's Log
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Edit / Add Modal ── */}
      {editBlock && (
        <EditModal
          block={editBlock}
          onSave={addMode ? handleAdd : handleSave}
          onClose={() => { setEditBlock(null); setAddMode(false); }}
          onDelete={addMode ? () => { setEditBlock(null); setAddMode(false); } : handleDelete}
        />
      )}

    </div>
  );
}