"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CSSProperties } from "react";

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
    <span style={{
      display:"inline-block", padding: small ? "2px 7px" : "3px 10px",
      borderRadius:20, fontSize: small ? "0.62rem" : "0.68rem",
      fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase",
      background: c.bg, color: c.color, border:`1px solid ${c.color}33`,
      whiteSpace:"nowrap", flexShrink:0,
    }}>{c.label}</span>
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
    <div style={{
      background: isActive ? c.bg : "#1a1e2e",
      borderStyle: "solid",
      borderTopWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderLeftWidth: 3,
      borderTopColor: isActive ? (c.color + "66") : "#252a3d",
      borderRightColor: isActive ? (c.color + "66") : "#252a3d",
      borderBottomColor: isActive ? (c.color + "66") : "#252a3d",
      borderLeftColor: c.color,
      borderRadius:10, padding:"13px 16px",
      transition:"all 0.25s", position:"relative", overflow:"hidden",
    }}>
      {/* Progress bar */}
      {isActive && (
        <div style={{
          position:"absolute", bottom:0, left:0, height:2,
          width:`${pct}%`, background: c.color, transition:"width 1s linear",
          boxShadow:`0 0 8px ${c.color}`,
        }}/>
      )}

      <div style={{display:"flex", alignItems:"flex-start", gap:10, flexWrap:"wrap"}}>
        {/* Time */}
        <div style={{
          fontSize:"0.68rem", color:"#4a5070", fontWeight:600,
          minWidth:70, paddingTop:3, letterSpacing:"0.03em", flexShrink:0,
        }}>{block.time}</div>

        {/* Content */}
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4}}>
            <span style={{fontSize:"0.92rem", fontWeight:600, color: isActive ? "#fff" : "#d4d8e8"}}>
              {block.title}
            </span>
            <CatBadge cat={block.cat} small />
            <span style={{fontSize:"0.68rem", color:"#3d4460", marginLeft:"auto"}}>
              {fmtMin(block.dur)}
            </span>
          </div>
          <div style={{fontSize:"0.78rem", color:"#6a7090", lineHeight:1.55, fontWeight:300}}>
            {block.desc}
          </div>
          {block.tip && (
            <div style={{
              marginTop:7, fontSize:"0.73rem", color:"#4a5070",
              borderTop:"1px solid #1e2338", paddingTop:6,
            }}>
              <span style={{color: c.color, fontWeight:600}}>Tip · </span>{block.tip}
            </div>
          )}
          {/* Timer display */}
          {isActive && (
            <div style={{
              marginTop:8, fontSize:"1.1rem", fontFamily:"'Courier New', monospace",
              color: c.color, fontWeight:700, letterSpacing:"0.05em",
            }}>⏱ {fmtSec(elapsed)}</div>
          )}
        </div>

        {/* Controls */}
        <div style={{display:"flex", gap:5, flexShrink:0, alignItems:"center"}}>
          {!isActive ? (
            <button onClick={() => onStart(block.id)} style={{
              background: c.bg, border:`1px solid ${c.color}55`, color: c.color,
              borderRadius:6, padding:"5px 12px", fontSize:"0.72rem", cursor:"pointer",
              fontWeight:600, letterSpacing:"0.04em",
            }}>▶ Start</button>
          ) : (
            <button onClick={() => onStop(block.id)} style={{
              background:"rgba(224,108,117,0.12)", border:"1px solid #E06C7566",
              color:"#E06C75", borderRadius:6, padding:"5px 12px",
              fontSize:"0.72rem", cursor:"pointer", fontWeight:600,
            }}>■ Stop</button>
          )}
          <button onClick={() => onEdit(block)} style={{
            background:"transparent", border:"1px solid #252a3d",
            color:"#4a5070", borderRadius:6, padding:"5px 8px",
            fontSize:"0.72rem", cursor:"pointer",
          }}>✎</button>
        </div>
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
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000,
      backdropFilter:"blur(4px)",
    }} onClick={onClose}>
      <div style={{
        background:"#1a1e2e", border:"1px solid #252a3d", borderRadius:14,
        padding:28, width:"min(520px,95vw)", maxHeight:"90vh", overflowY:"auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          fontSize:"1rem", fontWeight:700, color:"#d4d8e8",
          marginBottom:20, letterSpacing:"-0.01em",
        }}>Edit Block</div>

        {[
          ["title","Title","text"],
          ["time","Time","text"],
          ["dur","Duration (minutes)","number"],
          ["desc","Description","textarea"],
          ["tip","Tip (optional)","textarea"],
        ].map(([k, label, type]) => (
          <div key={k} style={{marginBottom:14}}>
            <label style={{fontSize:"0.72rem", color:"#4a5070", fontWeight:600,
              letterSpacing:"0.06em", textTransform:"uppercase", display:"block", marginBottom:5}}>
              {label}
            </label>
            {type === "textarea" ? (
              <textarea value={(form as any)[k] || ""} onChange={e => set(k as keyof EditableBlock, e.target.value)}
                rows={2} style={inputStyle} />
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
                style={inputStyle} />
            )}
          </div>
        ))}

        <div style={{marginBottom:18}}>
          <label style={{fontSize:"0.72rem", color:"#4a5070", fontWeight:600,
            letterSpacing:"0.06em", textTransform:"uppercase", display:"block", marginBottom:5}}>
            Category
          </label>
          <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
            {Object.keys(CAT).map(k => (
              <button key={k} onClick={() => set("cat", k as CategoryKey)} style={{
                padding:"4px 12px", borderRadius:20, fontSize:"0.72rem",
                fontWeight:600, cursor:"pointer", letterSpacing:"0.04em",
                background: form.cat===k ? CAT[k as CategoryKey].bg : "transparent",
                border:`1px solid ${form.cat===k ? CAT[k as CategoryKey].color : "#252a3d"}`,
                color: form.cat===k ? CAT[k as CategoryKey].color : "#4a5070",
              }}>{CAT[k as CategoryKey].label}</button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:20}}>
          <label style={{fontSize:"0.72rem", color:"#4a5070", fontWeight:600,
            letterSpacing:"0.06em", textTransform:"uppercase", display:"block", marginBottom:5}}>
            Show on
          </label>
          <div style={{display:"flex", gap:6}}>
            {[["true","All days (Mon–Sat)"],["only","Sunday only"],["false","Weekdays only (Mon–Sat)"]].map(([v,l]) => (
              <button
                key={v}
                onClick={() =>
                  set(
                    "sunday",
                    v==="true" ? true : v==="false" ? false : "only",
                  )
                }
                style={{
                padding:"4px 12px", borderRadius:6, fontSize:"0.72rem",
                fontWeight:600, cursor:"pointer",
                background: String(form.sunday)===v ? "rgba(78,201,176,0.12)" : "transparent",
                border:`1px solid ${String(form.sunday)===v ? "#4EC9B0" : "#252a3d"}`,
                color: String(form.sunday)===v ? "#4EC9B0" : "#4a5070",
              }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{display:"flex", gap:8, justifyContent:"space-between"}}>
          <button onClick={() => onDelete(block.id)} style={{
            background:"rgba(224,108,117,0.1)", border:"1px solid #E06C7544",
            color:"#E06C75", borderRadius:7, padding:"8px 14px",
            fontSize:"0.78rem", cursor:"pointer", fontWeight:600,
          }}>Delete</button>
          <div style={{display:"flex", gap:8}}>
            <button onClick={onClose} style={{
              background:"transparent", border:"1px solid #252a3d",
              color:"#4a5070", borderRadius:7, padding:"8px 16px",
              fontSize:"0.78rem", cursor:"pointer",
            }}>Cancel</button>
            <button onClick={() => onSave(form)} style={{
              background:"rgba(201,168,76,0.15)", border:"1px solid #C9A84C88",
              color:"#C9A84C", borderRadius:7, padding:"8px 20px",
              fontSize:"0.78rem", cursor:"pointer", fontWeight:700,
            }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width:"100%", background:"#0f1117", border:"1px solid #252a3d",
  borderRadius:7, padding:"8px 12px", color:"#d4d8e8",
  fontSize:"0.83rem", fontFamily:"inherit", resize:"vertical",
  outline:"none",
};

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
  const visible = blocks.filter(b => {
    if (b.sunday === "only") return isSunday;
    if (b.sunday === false) return !isSunday;
    return true;
  });

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
  const todayLog = log.filter(l => l.day === DAYS[dayIdx]);
  const catTotals = todayLog.reduce<Record<string, number>>((acc, l) => {
    acc[l.cat] = (acc[l.cat] || 0) + l.seconds;
    return acc;
  }, {});
  const totalTracked = Object.values(catTotals).reduce((a,b)=>a+b,0);

  return (
    <div style={{
      minHeight:"100vh", background:"#0f1117", color:"#d4d8e8",
      fontFamily:"'Segoe UI', system-ui, sans-serif",
      paddingBottom:80,
    }}>
      {/* Ambient glow */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        background:`
          radial-gradient(ellipse 70% 40% at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 90% 80%, rgba(78,201,176,0.04) 0%, transparent 60%)
        `,
      }}/>

      <div style={{position:"relative", zIndex:1, maxWidth:820, margin:"0 auto", padding:"0 16px"}}>

        {/* ── Header ── */}
        <div style={{
          textAlign:"center", padding:"44px 0 28px",
          borderBottom:"1px solid #1e2235", marginBottom:28,
        }}>
          <div style={{
            fontFamily:"serif", fontSize:"1.15rem", color:"#C9A84C",
            opacity:0.8, marginBottom:12, letterSpacing:"0.05em",
          }}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>
          <h1 style={{
            fontSize:"1.9rem", fontWeight:700, color:"#fff",
            letterSpacing:"-0.025em", margin:0,
          }}>
            My <span style={{color:"#C9A84C"}}>Routine</span> Tracker
          </h1>
          <div style={{
            fontSize:"0.78rem", color:"#3d4460", marginTop:6,
            fontWeight:400, letterSpacing:"0.05em",
          }}>Freelance Web Developer · Structured around Salah</div>

          {/* Live tracking badge */}
          {tracking && (
            <div style={{
              display:"inline-flex", alignItems:"center", gap:8,
              marginTop:14, background:"rgba(201,168,76,0.1)",
              border:"1px solid #C9A84C44", borderRadius:20,
              padding:"5px 14px", fontSize:"0.78rem",
            }}>
              <span style={{
                width:7, height:7, borderRadius:"50%", background:"#C9A84C",
                display:"inline-block",
                animation:"pulse 1.2s ease-in-out infinite",
              }}/>
              <span style={{color:"#C9A84C", fontWeight:600}}>
                {blocks.find(b=>b.id===tracking)?.title} · {fmtSec(elapsed)}
              </span>
            </div>
          )}
        </div>

        {/* ── Day selector ── */}
        <div style={{
          display:"flex", gap:5, marginBottom:22, overflowX:"auto",
          paddingBottom:4, flexWrap:"wrap",
        }}>
          {DAYS.map((d, i) => {
            const isSun = i === 6;
            const active = dayIdx === i;
            return (
              <button key={d} onClick={() => setDayIdx(i)} style={{
                padding:"6px 14px", borderRadius:7, fontSize:"0.78rem",
                fontWeight:600, cursor:"pointer", transition:"all 0.15s",
                background: active ? (isSun ? "rgba(78,201,176,0.12)" : "rgba(201,168,76,0.12)") : "#1a1e2e",
                border: active ? `1px solid ${isSun ? "#4EC9B0" : "#C9A84C"}` : "1px solid #1e2235",
                color: active ? (isSun ? "#4EC9B0" : "#C9A84C") : "#4a5070",
              }}>{d}{isSun ? " ✦" : ""}</button>
            );
          })}
        </div>

        {/* ── View tabs + actions ── */}
        <div style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          gap:12,
          marginBottom:22,
          flexWrap:"wrap",
        }}>
          <div style={{display:"flex", gap:0, background:"#1a1e2e",
            borderRadius:8, padding:3, border:"1px solid #1e2235", width:"fit-content"}}>
            {[["schedule","📋 Schedule"],["log","📊 Today's Log"]].map(([v,l])=>(
              <button key={v} onClick={() => setView(v as "schedule" | "log")} style={{
                padding:"6px 18px", borderRadius:6, fontSize:"0.78rem",
                fontWeight:600, cursor:"pointer", transition:"all 0.15s",
                background: view===v ? "#252a3d" : "transparent",
                border:"none", color: view===v ? "#d4d8e8" : "#4a5070",
              }}>{l}</button>
            ))}
          </div>

          <button
            onClick={handleResetDefaults}
            style={{
              fontSize:"0.72rem",
              padding:"6px 12px",
              borderRadius:6,
              border:"1px solid #E06C7533",
              background:"transparent",
              color:"#E06C75aa",
              cursor:"pointer",
              fontWeight:600,
              letterSpacing:"0.04em",
              textTransform:"uppercase",
            }}
          >
            Reset to defaults
          </button>
        </div>

        {/* ── SCHEDULE VIEW ── */}
        {view === "schedule" && (
          <>
            {isSunday && (
              <div style={{
                background:"rgba(78,201,176,0.07)", border:"1px solid #4EC9B033",
                borderRadius:8, padding:"10px 16px", marginBottom:18,
                fontSize:"0.8rem", color:"#4EC9B0",
              }}>
                🌿 Sunday — Rest, Chores, Weekly Planning & Family Day
              </div>
            )}

            <div style={{display:"flex", flexDirection:"column", gap:6}}>
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
            <button onClick={() => {
              setAddMode(true);
              setEditBlock({
                id: null, time:"", title:"", cat:"work",
                dur:60, desc:"", tip:"", sunday:true,
              });
            }} style={{
              marginTop:14, width:"100%",
              background:"transparent", border:"1px dashed #252a3d",
              color:"#3d4460", borderRadius:10, padding:"12px",
              fontSize:"0.8rem", cursor:"pointer", fontWeight:600,
              transition:"all 0.15s",
            }}>+ Add Block</button>
          </>
        )}

        {/* ── LOG VIEW ── */}
        {view === "log" && (
          <div>
            {/* Category breakdown */}
            {totalTracked > 0 && (
              <div style={{
                background:"#1a1e2e", border:"1px solid #1e2235",
                borderRadius:12, padding:20, marginBottom:20,
              }}>
                <div style={{fontSize:"0.7rem", color:"#3d4460", fontWeight:700,
                  letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14}}>
                  Today's Time Breakdown · {fmtSec(totalTracked)} total
                </div>
                {Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat, secs]) => {
                  const pct = Math.round((secs / totalTracked) * 100);
                  const c = CAT[cat as CategoryKey] || CAT.rest;
                  return (
                    <div key={cat} style={{marginBottom:10}}>
                      <div style={{display:"flex", justifyContent:"space-between",
                        fontSize:"0.76rem", marginBottom:4}}>
                        <span style={{color: c.color, fontWeight:600}}>{c.label}</span>
                        <span style={{color:"#4a5070"}}>{fmtSec(secs)} · {pct}%</span>
                      </div>
                      <div style={{height:5, background:"#0f1117", borderRadius:3}}>
                        <div style={{
                          height:"100%", width:`${pct}%`, background: c.color,
                          borderRadius:3, boxShadow:`0 0 6px ${c.color}66`,
                          transition:"width 0.4s ease",
                        }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Log entries */}
            {todayLog.length === 0 ? (
              <div style={{
                textAlign:"center", padding:"60px 20px",
                color:"#3d4460", fontSize:"0.9rem",
              }}>
                <div style={{fontSize:"2rem", marginBottom:12}}>⏱</div>
                No tracked sessions for {DAYS[dayIdx]} yet.<br/>
                <span style={{fontSize:"0.78rem"}}>Hit ▶ Start on any block to begin tracking.</span>
              </div>
            ) : (
              <div style={{display:"flex", flexDirection:"column", gap:6}}>
                {[...todayLog].reverse().map(entry => {
                  const c = CAT[entry.cat] || CAT.rest;
                  return (
                    <div key={entry.id} style={{
                      background:"#1a1e2e", border:"1px solid #1e2235",
                      borderLeft:`3px solid ${c.color}`,
                      borderRadius:9, padding:"11px 14px",
                      display:"flex", alignItems:"center", gap:12,
                    }}>
                      <div style={{flex:1}}>
                        <div style={{
                          fontSize:"0.85rem", fontWeight:600, color:"#d4d8e8",
                        }}>{entry.title}</div>
                        <div style={{fontSize:"0.72rem", color:"#3d4460", marginTop:2}}>
                          {entry.day} · {entry.time}
                        </div>
                      </div>
                      <CatBadge cat={entry.cat} small />
                      <div style={{
                        fontSize:"0.85rem", fontFamily:"monospace",
                        color: c.color, fontWeight:700, minWidth:60, textAlign:"right",
                      }}>{fmtSec(entry.seconds)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {todayLog.length > 0 && (
              <button onClick={() => setLog(l => l.filter(x => x.day !== DAYS[dayIdx]))}
                style={{
                  marginTop:14, background:"transparent",
                  border:"1px solid #E06C7533", color:"#E06C7566",
                  borderRadius:8, padding:"8px 16px", fontSize:"0.74rem",
                  cursor:"pointer", fontWeight:600,
                }}>Clear Today's Log</button>
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        button:hover { opacity: 0.85; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0f1117; }
        ::-webkit-scrollbar-thumb { background: #252a3d; border-radius: 2px; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}