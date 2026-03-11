"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

const CAT = {
  ibadah:   { label: "Ibadah",   color: "#B8860B", bg: "#FDF6E3" },
  work:     { label: "Work",     color: "#3A7BD5", bg: "#EEF4FD" },
  learning: { label: "Learning", color: "#2A9D8F", bg: "#EAF7F5" },
  family:   { label: "Family",   color: "#C0614A", bg: "#FDF0EE" },
  health:   { label: "Health",   color: "#4A7C59", bg: "#EEF6F0" },
  meal:     { label: "Meal",     color: "#9C7A3C", bg: "#FBF5E9" },
  planning: { label: "Planning", color: "#6B5EA8", bg: "#F3F1FB" },
  rest:     { label: "Rest",     color: "#7A8499", bg: "#F4F5F7" },
  chores:   { label: "Chores",   color: "#3A8FA3", bg: "#EAF4F7" },
} as const;

type CategoryKey = keyof typeof CAT;
type SundayMode  = boolean | "only";
type ViewMode    = "schedule" | "log";

interface Block {
  id: number;
  time: string;
  title: string;
  cat: CategoryKey;
  dur: number;
  sunday: SundayMode;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtSec = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
};

const fmtMin = (m: number): string => {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} hr` : `${h} hr ${rem} min`;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const STORAGE_KEY = "routine-blocks-v1";

// ─── Default data ─────────────────────────────────────────────────────────────

const DEFAULT_BLOCKS: Block[] = [
  { id: 1,  time: "~5:00 AM",  title: "Wake up — Tahajjud",               cat: "ibadah",   dur: 30,  sunday: true,   desc: "Rise 30 min before Fajr. Pray Tahajjud (2–8 rak'at). Make sincere du'a — this is the most powerful window of the day.", tip: "Keep a du'a list ready the night before." },
  { id: 2,  time: "~5:30 AM",  title: "Fajr Prayer + Quran Study",        cat: "ibadah",   dur: 60,  sunday: true,   desc: "Pray Fajr, then spend 1 hour in recitation and reflection. Read at least 1 page of tafsir.", tip: "Target: 1 juz per month = ~1 page/day." },
  { id: 3,  time: "6:30 AM",   title: "Breakfast",                        cat: "meal",     dur: 60,  sunday: true,   desc: "Eat mindfully. Mentally review yesterday's results and today's intentions.", tip: "No screens during breakfast." },
  { id: 4,  time: "7:30 AM",   title: "Morning Planning",                 cat: "planning", dur: 15,  sunday: true,   desc: "Write your 3 MITs (Most Important Tasks). Block time for each. Open your task manager.", tip: "Never open social media before this step." },
  { id: 5,  time: "8:00 AM",   title: "Take Hawa to School",              cat: "family",   dur: 30,  sunday: false,  desc: "Drive Hawa (~15 min). Use the return commute for dhikr, audiobook, or a learning podcast.", tip: "Be back home by 8:30 AM." },
  { id: 6,  time: "8:30 AM",   title: "Deep Work — Block 1",              cat: "work",     dur: 150, sunday: false,  desc: "Highest-focus client work. Code, deliver, communicate. Pomodoro: 50 min on / 10 min break. Silence all notifications.", tip: "Start with the hardest task, not email." },
  { id: 7,  time: "8:30 AM",   title: "Weekly Planning",                  cat: "planning", dur: 60,  sunday: "only", desc: "Review last week. Set this week's targets. Update project board. Block time for learning, work, and family.", tip: "Sunday only — the compass for the whole week." },
  { id: 8,  time: "11:00 AM",  title: "Learning Block",                   cat: "learning", dur: 60,  sunday: false,  desc: "Structured learning: course, tutorial, or docs. One track at a time.", tip: "Daily: 30–60 min. Weekly: 1 chapter. Monthly: 1 course done." },
  { id: 9,  time: "12:00 PM",  title: "Dhuhr Prayer",                     cat: "ibadah",   dur: 15,  sunday: true,   desc: "Pray Dhuhr on time. Step away from the screen fully.", tip: "Hard stop — no 'just one more thing'." },
  { id: 10, time: "12:15 PM",  title: "Lunch + Rest",                     cat: "meal",     dur: 45,  sunday: true,   desc: "Eat lunch. Take a short nap if needed (10–20 min Qaylula is Sunnah). No screens.", tip: "Even a 10-min rest dramatically improves afternoon focus." },
  { id: 11, time: "1:00 PM",   title: "Deep Work — Block 2",              cat: "work",     dur: 120, sunday: false,  desc: "Continue client work or shift to freelance admin, proposals, and follow-ups.", tip: "Batch admin tasks here, not during Block 1." },
  { id: 12, time: "1:00 PM",   title: "Household Chores",                 cat: "chores",   dur: 120, sunday: "only", desc: "Clean room. Polish shoes. Laundry. Tidy living spaces. Grocery list prep.", tip: "A clean space = a clear mind." },
  { id: 13, time: "3:00 PM",   title: "Learning / Buffer / Admin",        cat: "learning", dur: 90,  sunday: false,  desc: "Flexible block: learning, client communication, portfolio work, or catching up.", tip: "Don't let this bleed into Asr." },
  { id: 14, time: "4:30 PM",   title: "Asr Prayer",                       cat: "ibadah",   dur: 15,  sunday: true,   desc: "Pray Asr immediately. Hard stop on all work. The Prophet ﷺ warned strongly about missing it.", tip: "Set an Asr alarm as a non-negotiable trigger." },
  { id: 15, time: "5:00 PM",   title: "Walk / Workout / Bazaar",          cat: "health",   dur: 60,  sunday: true,   desc: "~1 hour of movement: walk, gym, home workout, or grocery run. Listen to a lecture or podcast.", tip: "Batch groceries on fixed days (e.g. Mon/Thu)." },
  { id: 16, time: "Maghrib",   title: "Maghrib Prayer + Adhkar",          cat: "ibadah",   dur: 20,  sunday: true,   desc: "Pray Maghrib at the adhan. Read evening adhkar and 3 Surahs. A blessed, short window.", tip: "Don't delay — Maghrib time is the shortest of all." },
  { id: 17, time: "~7:30 PM",  title: "Dinner + Family Time",             cat: "meal",     dur: 90,  sunday: true,   desc: "Eat together. Be present with family. Handle household tasks. Protect this time from work.", tip: "No work talk. This is restoration time." },
  { id: 18, time: "Isha",      title: "Isha Prayer + Witr",               cat: "ibadah",   dur: 20,  sunday: true,   desc: "Pray Isha and Witr. Read night adhkar. This closes the spiritual frame of the day.", tip: "Recite Ayatul Kursi and the 3 Quls." },
  { id: 19, time: "~9:30 PM",  title: "Evening Review + Tomorrow's Plan", cat: "planning", dur: 15,  sunday: true,   desc: "What did I complete? What carries over? Write tomorrow's 3 MITs. Close all work tabs.", tip: "Monthly (1st): review income, learning, fitness, and Quran targets." },
  { id: 20, time: "10:00 PM",  title: "Wind-Down + Sleep",                cat: "rest",     dur: 30,  sunday: true,   desc: "Phone on DND or out of bedroom. Sleep supplications. Make niyyah to wake for Tahajjud.", tip: "Sleep on your right side. Lights out by 10:30 PM." },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadBlocks(): Block[] {
  if (typeof window === "undefined") return DEFAULT_BLOCKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BLOCKS;
    const parsed = JSON.parse(raw) as Block[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_BLOCKS;
  } catch {
    return DEFAULT_BLOCKS;
  }
}

function saveBlocks(blocks: Block[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks)); } catch { /* noop */ }
}

// ─── CatBadge ─────────────────────────────────────────────────────────────────

const CatBadge = memo(function CatBadge({
  cat,
  small = false,
}: {
  cat: CategoryKey;
  small?: boolean;
}) {
  const c = CAT[cat];
  return (
    <span
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold uppercase tracking-wider"
      style={{
        fontSize: small ? "0.6rem" : "0.65rem",
        padding: small ? "2px 8px" : "3px 10px",
        background: c.bg,
        color: c.color,
      }}
    >
      {c.label}
    </span>
  );
});

// ─── BlockCard ────────────────────────────────────────────────────────────────

const BlockCard = memo(function BlockCard({
  block,
  isActive,
  elapsed,
  onStart,
  onStop,
  onEdit,
}: {
  block: Block;
  isActive: boolean;
  elapsed: number;
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  onEdit: (block: Block) => void;
}) {
  const c = CAT[block.cat];
  const pct = block.dur > 0 ? Math.min(100, (elapsed / (block.dur * 60)) * 100) : 0;

  return (
    <div
      className="group relative rounded-xl border bg-white transition-shadow duration-200 hover:shadow-sm"
      style={{
        borderColor: isActive ? c.color + "60" : "#E8EAF0",
        borderLeftColor: c.color,
        borderLeftWidth: 3,
        boxShadow: isActive ? `0 2px 16px ${c.color}18` : undefined,
      }}
    >
      {/* Progress bar */}
      {isActive && pct > 0 && (
        <div
          className="absolute bottom-0 left-0 h-[2px] rounded-bl-xl transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%`, background: c.color, opacity: 0.5 }}
        />
      )}

      <div className="flex flex-wrap items-start gap-3 px-4 py-3.5">
        {/* Time */}
        <span className="w-[68px] shrink-0 pt-0.5 text-[0.67rem] font-medium text-stone-400 tracking-wide">
          {block.time}
        </span>

        {/* Body */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9rem] font-semibold text-stone-800 leading-snug">
              {block.title}
            </span>
            <CatBadge cat={block.cat} small />
            <span className="ml-auto text-[0.67rem] text-stone-400">{fmtMin(block.dur)}</span>
          </div>

          <p className="text-[0.77rem] leading-relaxed text-stone-500 font-normal">
            {block.desc}
          </p>

          {block.tip && (
            <p className="text-[0.72rem] text-stone-400 border-t border-stone-100 pt-1.5 mt-1.5">
              <span style={{ color: c.color }} className="font-semibold">Tip · </span>
              {block.tip}
            </p>
          )}

          {isActive && (
            <p
              className="text-base font-bold font-mono tracking-wide pt-0.5"
              style={{ color: c.color }}
            >
              ⏱ {fmtSec(elapsed)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
          {isActive ? (
            <button
              onClick={() => onStop(block.id)}
              className="rounded-lg px-3 py-1.5 text-[0.7rem] font-semibold tracking-wide transition-colors"
              style={{ background: "#FEF2F2", color: "#DC2626" }}
            >
              ■ Stop
            </button>
          ) : (
            <button
              onClick={() => onStart(block.id)}
              className="rounded-lg px-3 py-1.5 text-[0.7rem] font-semibold tracking-wide transition-opacity hover:opacity-80"
              style={{ background: c.bg, color: c.color }}
            >
              ▶ Start
            </button>
          )}
          <button
            onClick={() => onEdit(block)}
            className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-[0.7rem] text-stone-400 transition-colors hover:border-stone-300 hover:text-stone-600"
          >
            ✎
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── EditModal ────────────────────────────────────────────────────────────────

const FIELD_ROWS: Array<[keyof EditableBlock, string, "text" | "number" | "textarea"]> = [
  ["title", "Title", "text"],
  ["time",  "Time",  "text"],
  ["dur",   "Duration (minutes)", "number"],
  ["desc",  "Description",        "textarea"],
  ["tip",   "Tip (optional)",     "textarea"],
];

function EditModal({
  block,
  isNew,
  onSave,
  onClose,
  onDelete,
}: {
  block: EditableBlock;
  isNew: boolean;
  onSave: (b: EditableBlock) => void;
  onClose: () => void;
  onDelete: (id: number | null) => void;
}) {
  const [form, setForm] = useState<EditableBlock>({ ...block });
  const setField = <K extends keyof EditableBlock>(k: K, v: EditableBlock[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl shadow-stone-200/60 p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-stone-800 mb-5 tracking-tight">
          {isNew ? "Add Block" : "Edit Block"}
        </h2>

        <div className="space-y-3.5">
          {FIELD_ROWS.map(([k, label, type]) => (
            <div key={k}>
              <label className="block text-[0.67rem] font-bold uppercase tracking-widest text-stone-400 mb-1.5">
                {label}
              </label>
              {type === "textarea" ? (
                <textarea
                  value={String(form[k] ?? "")}
                  onChange={e => setField(k, e.target.value as EditableBlock[typeof k])}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[0.82rem] text-stone-800 outline-none focus:border-stone-400 focus:bg-white transition-colors"
                />
              ) : (
                <input
                  type={type}
                  value={String(form[k] ?? "")}
                  onChange={e =>
                    setField(k, (type === "number" ? +e.target.value : e.target.value) as EditableBlock[typeof k])
                  }
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[0.82rem] text-stone-800 outline-none focus:border-stone-400 focus:bg-white transition-colors"
                />
              )}
            </div>
          ))}
        </div>

        {/* Category */}
        <div className="mt-4">
          <label className="block text-[0.67rem] font-bold uppercase tracking-widest text-stone-400 mb-2">
            Category
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CAT) as CategoryKey[]).map(k => {
              const selected = form.cat === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setField("cat", k)}
                  className="rounded-full px-3 py-1 text-[0.67rem] font-semibold uppercase tracking-wide transition-all"
                  style={{
                    background: selected ? CAT[k].bg : "#F5F5F4",
                    color: selected ? CAT[k].color : "#A8A29E",
                    outline: selected ? `1.5px solid ${CAT[k].color}` : "none",
                  }}
                >
                  {CAT[k].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Visibility */}
        <div className="mt-4">
          <label className="block text-[0.67rem] font-bold uppercase tracking-widest text-stone-400 mb-2">
            Show on
          </label>
          <div className="flex gap-2 flex-wrap">
            {([
              [true,   "All days"],
              [false,  "Mon – Sat only"],
              ["only", "Sunday only"],
            ] as [SundayMode, string][]).map(([v, l]) => {
              const active = String(form.sunday) === String(v);
              return (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setField("sunday", v)}
                  className="rounded-lg border px-3 py-1.5 text-[0.72rem] font-medium transition-all"
                  style={{
                    borderColor: active ? "#A3A3A3" : "#E7E5E4",
                    background:  active ? "#F5F5F4" : "transparent",
                    color:       active ? "#292524" : "#A8A29E",
                  }}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          {!isNew ? (
            <button
              type="button"
              onClick={() => onDelete(block.id)}
              className="rounded-lg px-3.5 py-2 text-[0.75rem] font-semibold text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          ) : <div />}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-4 py-2 text-[0.78rem] font-medium text-stone-500 hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(form)}
              className="rounded-lg bg-stone-900 px-5 py-2 text-[0.78rem] font-semibold text-white hover:bg-stone-700 transition-colors"
            >
              {isNew ? "Add" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LogView ──────────────────────────────────────────────────────────────────

function LogView({
  todayLog,
  catTotals,
  totalTracked,
  dayLabel,
  onClear,
}: {
  todayLog: LogEntry[];
  catTotals: Record<string, number>;
  totalTracked: number;
  dayLabel: string;
  onClear: () => void;
}) {
  if (todayLog.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-stone-400">
        <span className="text-4xl mb-3">⏱</span>
        <p className="text-sm font-medium">No tracked sessions for {dayLabel}</p>
        <p className="text-xs mt-1 text-stone-300">Hit ▶ Start on any block to begin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breakdown */}
      <div className="rounded-xl border border-stone-100 bg-white p-5 shadow-sm">
        <p className="text-[0.67rem] font-bold uppercase tracking-widest text-stone-400 mb-4">
          Time Breakdown · {fmtSec(totalTracked)} total
        </p>
        <div className="space-y-3">
          {Object.entries(catTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, secs]) => {
              const pct = Math.round((secs / totalTracked) * 100);
              const c = CAT[cat as CategoryKey];
              return (
                <div key={cat}>
                  <div className="flex justify-between text-[0.72rem] mb-1">
                    <span style={{ color: c.color }} className="font-semibold">{c.label}</span>
                    <span className="text-stone-400">{fmtSec(secs)} · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: c.color, opacity: 0.75 }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-1.5">
        {[...todayLog].reverse().map(entry => {
          const c = CAT[entry.cat];
          return (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-xl border border-stone-100 bg-white px-4 py-3"
              style={{ borderLeftColor: c.color, borderLeftWidth: 3 }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[0.83rem] font-semibold text-stone-700 truncate">{entry.title}</p>
                <p className="text-[0.68rem] text-stone-400 mt-0.5">{entry.day} · {entry.time}</p>
              </div>
              <CatBadge cat={entry.cat} small />
              <p className="font-mono text-[0.82rem] font-bold shrink-0" style={{ color: c.color }}>
                {fmtSec(entry.seconds)}
              </p>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onClear}
        className="text-[0.72rem] font-medium text-red-300 hover:text-red-500 transition-colors pt-1"
      >
        Clear today's log
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoutinePage() {
  const [blocks,   setBlocks]   = useState<Block[]>(loadBlocks);
  const [dayIdx,   setDayIdx]   = useState<number>(() => {
    const d = new Date().getDay(); // 0=Sun
    return d === 0 ? 6 : d - 1;
  });
  const [tracking, setTracking] = useState<number | null>(null);
  const [elapsed,  setElapsed]  = useState<number>(0);
  const [log,      setLog]      = useState<LogEntry[]>([]);
  const [view,     setView]     = useState<ViewMode>("schedule");
  const [editBlock, setEditBlock] = useState<EditableBlock | null>(null);
  const [isNew,    setIsNew]    = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  // Persist on change
  useEffect(() => { saveBlocks(blocks); }, [blocks]);

  // Timer
  useEffect(() => {
    if (tracking === null) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    startRef.current = Date.now() - elapsed * 1000;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking]);

  const isSunday = dayIdx === 6;

  const visibleBlocks = useMemo(() =>
    blocks.filter(b => {
      if (b.sunday === "only") return isSunday;
      if (b.sunday === false)  return !isSunday;
      return true;
    }),
    [blocks, isSunday],
  );

  const handleStart = useCallback((id: number) => {
    if (tracking !== null && tracking !== id) {
      // auto-stop previous
      commitLog(tracking, elapsed, blocks, dayIdx);
    }
    setTracking(id);
    setElapsed(0);
    startRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking, elapsed, blocks, dayIdx]);

  // Extracted log commit so we can reuse
  const commitLog = (id: number, secs: number, blks: Block[], dIdx: number) => {
    const b = blks.find(x => x.id === id);
    if (b && secs > 0) {
      setLog(l => [...l, {
        id: Date.now(), blockId: id, title: b.title, cat: b.cat,
        seconds: secs, day: DAYS[dIdx],
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    }
  };

  const handleStop = useCallback((id: number) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    commitLog(id, elapsed, blocks, dayIdx);
    setTracking(null);
    setElapsed(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, blocks, dayIdx]);

  const handleSave = useCallback((updated: EditableBlock) => {
    if (isNew) {
      const { id: _, ...rest } = updated;
      setBlocks(bs => [...bs, { ...rest, id: Date.now() } as Block]);
    } else {
      if (updated.id == null) return;
      setBlocks(bs => bs.map(b => b.id === updated.id ? { ...b, ...updated, id: updated.id! } : b));
    }
    setEditBlock(null);
  }, [isNew]);

  const handleDelete = useCallback((id: number | null) => {
    if (id == null) return;
    setBlocks(bs => bs.filter(b => b.id !== id));
    setEditBlock(null);
  }, []);

  const openEdit = useCallback((block: Block) => {
    setIsNew(false);
    setEditBlock({ ...block });
  }, []);

  const openAdd = useCallback(() => {
    setIsNew(true);
    setEditBlock({ id: null, time: "", title: "", cat: "work", dur: 60, desc: "", tip: "", sunday: true });
  }, []);

  const todayLog = useMemo(() => log.filter(l => l.day === DAYS[dayIdx]), [log, dayIdx]);

  const catTotals = useMemo(() =>
    todayLog.reduce<Record<string, number>>((acc, l) => {
      acc[l.cat] = (acc[l.cat] ?? 0) + l.seconds;
      return acc;
    }, {}),
    [todayLog],
  );

  const totalTracked = useMemo(() =>
    Object.values(catTotals).reduce((a, b) => a + b, 0),
    [catTotals],
  );

  const trackingBlock = useMemo(() => blocks.find(b => b.id === tracking), [blocks, tracking]);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-stone-800 antialiased">
      <div className="mx-auto max-w-2xl px-4 pb-24">

        {/* ── Header ── */}
        <header className="pt-10 pb-8 text-center border-b border-stone-100">
          <p className="text-xl mb-2 tracking-widest text-amber-700/70" style={{ fontFamily: "serif" }}>
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Daily Routine
          </h1>
          <p className="mt-1 text-xs text-stone-400 tracking-wide">
            Freelance Web Developer · Structured around Salah
          </p>

          {/* Active timer pill */}
          {trackingBlock && (
            <div
              className="inline-flex items-center gap-2 mt-4 rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{
                background: CAT[trackingBlock.cat].bg,
                color: CAT[trackingBlock.cat].color,
              }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ background: CAT[trackingBlock.cat].color }}
                />
                <span
                  className="relative inline-flex h-1.5 w-1.5 rounded-full"
                  style={{ background: CAT[trackingBlock.cat].color }}
                />
              </span>
              {trackingBlock.title} · {fmtSec(elapsed)}
            </div>
          )}
        </header>

        {/* ── Day tabs ── */}
        <div className="flex items-center gap-1 py-4 overflow-x-auto scrollbar-none">
          {DAYS.map((d, i) => {
            const active = dayIdx === i;
            const isSun  = i === 6;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDayIdx(i)}
                className="shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: active ? (isSun ? "#EAF4F7" : "#F5F5F4") : "transparent",
                  color:      active ? (isSun ? "#3A8FA3" : "#292524") : "#A8A29E",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {d}{isSun ? " ✦" : ""}
              </button>
            );
          })}
        </div>

        {/* ── View toggle + reset ── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex rounded-lg bg-stone-100 p-0.5 gap-0.5">
            {(["schedule", "log"] as ViewMode[]).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className="rounded-md px-4 py-1.5 text-xs font-semibold transition-colors capitalize"
                style={{
                  background: view === v ? "#fff" : "transparent",
                  color:      view === v ? "#292524" : "#A8A29E",
                  boxShadow:  view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {v === "schedule" ? "📋 Schedule" : "📊 Log"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { setBlocks(DEFAULT_BLOCKS); saveBlocks(DEFAULT_BLOCKS); }}
            className="text-[0.67rem] font-medium text-stone-300 hover:text-stone-500 transition-colors uppercase tracking-wider"
          >
            Reset
          </button>
        </div>

        {/* ── Sunday notice ── */}
        {isSunday && view === "schedule" && (
          <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-2.5 text-xs text-teal-700 font-medium">
            🌿 Sunday — Chores, Weekly Planning & Rest
          </div>
        )}

        {/* ── Schedule ── */}
        {view === "schedule" && (
          <div className="space-y-2">
            {visibleBlocks.map(block => (
              <BlockCard
                key={block.id}
                block={block}
                isActive={tracking === block.id}
                elapsed={tracking === block.id ? elapsed : 0}
                onStart={handleStart}
                onStop={handleStop}
                onEdit={openEdit}
              />
            ))}
            <button
              type="button"
              onClick={openAdd}
              className="mt-1 w-full rounded-xl border border-dashed border-stone-200 py-3 text-xs font-semibold text-stone-400 hover:border-stone-300 hover:text-stone-600 transition-colors"
            >
              + Add Block
            </button>
          </div>
        )}

        {/* ── Log ── */}
        {view === "log" && (
          <LogView
            todayLog={todayLog}
            catTotals={catTotals}
            totalTracked={totalTracked}
            dayLabel={DAYS[dayIdx]}
            onClear={() => setLog(l => l.filter(x => x.day !== DAYS[dayIdx]))}
          />
        )}
      </div>

      {/* ── Edit / Add Modal ── */}
      {editBlock && (
        <EditModal
          block={editBlock}
          isNew={isNew}
          onSave={handleSave}
          onClose={() => setEditBlock(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}