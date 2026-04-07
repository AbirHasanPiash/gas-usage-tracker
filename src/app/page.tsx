"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useCallback, useRef } from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

const formatTimer = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

const formatLabel = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const FlameIcon = ({
  active,
  className = "",
  style,
}: {
  active: boolean;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <svg
    viewBox="0 0 32 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
  >
    <path
      d="M16 2C16 2 10 10 10 18C10 22.418 12.686 26 16 26C19.314 26 22 22.418 22 18C22 10 16 2 16 2Z"
      style={{
        fill: active ? "#fb923c" : "#475569",
        transition: "fill 0.4s ease",
      }}
    >
      {active && (
        <animate
          attributeName="d"
          dur="1.4s"
          repeatCount="indefinite"
          values="M16 2C16 2 10 10 10 18C10 22.418 12.686 26 16 26C19.314 26 22 22.418 22 18C22 10 16 2 16 2Z;M16 3C16 3 9 11 9 18C9 22.8 12.4 26.5 16 26.5C19.6 26.5 23 22.8 23 18C23 11 16 3 16 3Z;M16 2C16 2 10 10 10 18C10 22.418 12.686 26 16 26C19.314 26 22 22.418 22 18C22 10 16 2 16 2Z"
        />
      )}
    </path>
    <path
      d="M16 12C16 12 13 16 13 20C13 22.209 14.343 24 16 24C17.657 24 19 22.209 19 20C19 16 16 12 16 12Z"
      style={{
        fill: active ? "#fbbf24" : "#334155",
        transition: "fill 0.4s ease",
      }}
    />
    <ellipse
      cx="16"
      cy="36"
      rx="8"
      ry="3"
      style={{
        fill: active ? "rgba(251,146,60,0.2)" : "transparent",
        transition: "fill 0.4s ease",
      }}
    />
  </svg>
);

const TimerDisplay = ({
  value,
  isActive,
}: {
  value: string;
  isActive: boolean;
}) => {
  const prev = useRef(value);
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      setFlip(true);
      const t = setTimeout(() => setFlip(false), 100);
      prev.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <span
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: "clamp(3rem, 14vw, 6.5rem)",
        fontWeight: 500,
        letterSpacing: "-0.02em",
        display: "inline-block",
        color: isActive ? "#fb923c" : "#f1f5f9",
        textShadow: isActive ? "0 0 40px rgba(251,146,60,0.45)" : "none",
        transform: flip ? "scaleY(0.91)" : "scaleY(1)",
        transition:
          "color 0.5s ease, text-shadow 0.5s ease, transform 0.08s ease",
      }}
    >
      {value}
    </span>
  );
};

const Avatar = ({
  src,
  name,
  size = "sm",
}: {
  src?: string | null;
  name?: string | null;
  size?: "sm" | "md";
}) => {
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  const initials =
    name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";
  if (src)
    return (
      <img
        src={src}
        alt={name ?? ""}
        className={`${dim} rounded-full border-2 border-[#1e2535] object-cover flex-shrink-0`}
      />
    );
  return (
    <div
      className={`${dim} rounded-full border-2 border-[#1e2535] flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ background: "linear-gradient(135deg,#f97316,#eab308)" }}
    >
      {initials}
    </div>
  );
};

const LoadingDots = () => (
  <div className="flex items-center gap-2">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-2 h-2 rounded-full bg-orange-400"
        style={{ animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
      />
    ))}
  </div>
);

// ─── Types ──────────────────────────────────────────────────────────────────

type ViewMode = "mine" | "team";

interface Session {
  _id: string;
  startTime: string;
  endTime: string;
  durationInSeconds: number;
  userEmail?: string;
  userName?: string;
  userImage?: string;
}
interface UserSummary {
  userEmail: string;
  userName: string;
  userImage?: string;
  formattedTotal: string;
  totalSeconds: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Home() {
  const { data: session, status } = useSession();

  const [activeStartTime, setActiveStartTime] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [history, setHistory] = useState<Session[]>([]);
  const [teamHistory, setTeamHistory] = useState<Session[]>([]);
  const [summary, setSummary] = useState({
    totalSeconds: 0,
    formattedTotal: "0m 0s",
  });
  const [teamSummaries, setTeamSummaries] = useState<UserSummary[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("mine");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [btnPressed, setBtnPressed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!session?.user?.email) return;
    let url = `/api/gas?userEmail=${session.user.email}`;
    if (startDate && endDate)
      url += `&startDate=${startDate}&endDate=${endDate}`;
    const res = await fetch(url);
    const data = await res.json();
    setHistory(data.sessions || []);
    setSummary(data.summary || { totalSeconds: 0, formattedTotal: "0m 0s" });
  }, [session, startDate, endDate]);

  const fetchTeamHistory = useCallback(async () => {
    if (!session?.user?.email) return;
    let url = `/api/gas/team`;
    if (startDate && endDate)
      url += `?startDate=${startDate}&endDate=${endDate}`;
    const res = await fetch(url);
    const data = await res.json();
    setTeamHistory(data.sessions || []);
    setTeamSummaries(data.userSummaries || []);
  }, [session, startDate, endDate]);

  useEffect(() => {
    if (session?.user?.email) {
      fetch(`/api/gas/active?userEmail=${session.user.email}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.activeSession) setActiveStartTime(d.activeSession.startTime);
        });
      fetchHistory();
      fetchTeamHistory();
    }
  }, [session]);

  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    if (activeStartTime) {
      iv = setInterval(() => {
        setElapsedSeconds(
          Math.floor((Date.now() - new Date(activeStartTime).getTime()) / 1000)
        );
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(iv);
  }, [activeStartTime]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchHistory();
      fetchTeamHistory();
    }
  }, [startDate, endDate]);

  const handleToggleTimer = async () => {
    if (!session?.user || isLoading) return;
    setIsLoading(true);
    setBtnPressed(true);
    setTimeout(() => setBtnPressed(false), 180);
    const action = activeStartTime ? "STOP" : "START";
    const res = await fetch("/api/gas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: session.user.email,
        userName: session.user.name,
        userImage: session.user.image,
        action,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (action === "START") setActiveStartTime(data.startTime);
      else {
        setActiveStartTime(null);
        fetchHistory();
        fetchTeamHistory();
      }
    }
    setIsLoading(false);
  };

  const isActive = !!activeStartTime;
  const todayCount = history.filter(
    (r) => new Date(r.startTime).toDateString() === new Date().toDateString()
  ).length;

  // Sorted and filtered team data
  const sortedTeamSummaries = [...teamSummaries].sort(
    (a, b) => b.totalSeconds - a.totalSeconds
  );
  const filteredTeam =
    selectedUser === "all"
      ? teamHistory
      : teamHistory.filter((r) => r.userEmail === selectedUser);
  const filteredTeamSummaries =
    selectedUser === "all"
      ? sortedTeamSummaries
      : sortedTeamSummaries.filter((u) => u.userEmail === selectedUser);

  // ── Loading
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0a0c12" }}
      >
        <style>{GLOBAL_STYLES}</style>
        <LoadingDots />
      </div>
    );
  }

  // ── Sign in
  if (!session) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-5 py-16"
        style={{ background: "#0a0c12" }}
      >
        <style>{GLOBAL_STYLES}</style>
        <div
          className="flex flex-col items-center gap-7 w-full max-w-xs sm:max-w-sm"
          style={{
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          <div className="relative">
            {isMounted && (
              <div
                className="absolute inset-0 rounded-full blur-3xl scale-[2]"
                style={{ background: "rgba(251,146,60,0.18)" }}
              />
            )}
            <FlameIcon
              active
              className="relative w-14 h-[4.5rem] sm:w-16 sm:h-20"
              style={
                { filter: "drop-shadow(0 0 16px rgba(251,146,60,0.6))" } as any
              }
            />
          </div>

          <div className="text-center space-y-2">
            <h1
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
              className="text-4xl sm:text-5xl text-slate-50"
            >
              Gas<span style={{ color: "#fb923c" }}>Tracker</span>
            </h1>
            <p
              className="text-slate-500 text-sm sm:text-base"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Monitor your apartment stove usage with precision.
            </p>
          </div>

          <button
            onClick={() => signIn("google")}
            className="w-full flex items-center justify-center gap-3 text-white font-semibold text-sm sm:text-base py-4 px-6 rounded-2xl active:scale-95"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              background: "linear-gradient(135deg,#fb923c,#ea580c)",
              boxShadow: "0 8px 32px rgba(251,146,60,0.35)",
              transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 12px 40px rgba(251,146,60,0.52)";
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 8px 32px rgba(251,146,60,0.35)";
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(0)";
            }}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="grid grid-cols-3 gap-4 pt-1 w-full">
            {[
              ["Real-time", "Tracking"],
              ["Usage", "Reports"],
              ["Team", "View"],
            ].map(([a, b]) => (
              <div key={a} className="text-center">
                <p
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 700,
                    color: "#fb923c",
                    fontSize: "0.85rem",
                  }}
                >
                  {a}
                </p>
                <p
                  className="text-slate-600 text-xs mt-0.5"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Main App
  return (
    <div
      className="min-h-screen pb-12 sm:pb-16"
      style={{ background: "#0a0c12", fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{GLOBAL_STYLES}</style>

      <div className="max-w-xl mx-auto px-3 sm:px-5 md:px-6 space-y-3 sm:space-y-4">
        {/* ── Sticky nav */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between py-3 sm:py-4"
          style={{
            opacity: isMounted ? 1 : 0,
            transition: "opacity 0.4s ease 0.05s",
            background: "rgba(10,12,18,0.9)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <div className="flex items-center gap-2">
            <FlameIcon
              active={isActive}
              className="w-5 h-7 sm:w-6 sm:h-8"
              style={
                {
                  filter: isActive
                    ? "drop-shadow(0 0 6px rgba(251,146,60,0.7))"
                    : "none",
                  transition: "filter 0.5s ease",
                } as any
              }
            />
            <span
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: "#f8fafc",
                fontSize: "1.1rem",
              }}
            >
              Gas<span style={{ color: "#fb923c" }}>Tracker</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Avatar src={session.user?.image} name={session.user?.name} />
            <span
              className="hidden sm:block text-slate-400 text-sm truncate max-w-[100px]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {session.user?.name?.split(" ")[0]}
            </span>
            <button
              onClick={() => signOut()}
              className="text-slate-600 hover:text-slate-400 text-xs border border-[#1e2535] hover:border-slate-700 rounded-lg px-2.5 py-1.5 transition-all duration-200"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* ── Timer hero */}
        <section
          className="relative rounded-2xl sm:rounded-3xl overflow-hidden text-center"
          style={{
            background: "#12151f",
            border: "1px solid #1a1f2e",
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? "none" : "translateY(16px)",
            transition: "opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s",
          }}
        >
          {isActive && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(251,146,60,0.08) 0%, transparent 70%)",
                animation: "ambientPulse 3s ease-in-out infinite",
              }}
            />
          )}

          <div className="relative px-4 sm:px-8 pt-8 sm:pt-10 pb-8 sm:pb-10 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 transition-all duration-500"
                style={{
                  background: isActive ? "#34d399" : "#334155",
                  boxShadow: isActive ? "0 0 8px rgba(52,211,153,0.8)" : "none",
                  animation: isActive
                    ? "statusBlink 2s ease-in-out infinite"
                    : "none",
                }}
              />
              <span
                className="text-[0.65rem] sm:text-xs font-medium uppercase tracking-widest transition-colors duration-400"
                style={{ color: isActive ? "#34d399" : "#475569" }}
              >
                {isActive ? "Session active" : "Ready"}
              </span>
            </div>

            <div className="my-2 sm:my-3">
              <TimerDisplay
                value={formatTimer(elapsedSeconds)}
                isActive={isActive}
              />
            </div>

            <div className="h-4 sm:h-5 flex items-center mb-1 sm:mb-2">
              {isActive && (
                <p
                  className="text-[0.65rem] sm:text-xs text-slate-600"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  Started{" "}
                  {new Date(activeStartTime!).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>

            <button
              onClick={handleToggleTimer}
              disabled={isLoading}
              className="flex items-center justify-center gap-2.5 sm:gap-3 px-10 sm:px-14 py-3.5 sm:py-4 rounded-full text-white font-black text-sm sm:text-base tracking-wide disabled:opacity-70 disabled:cursor-wait"
              style={{
                fontFamily: "'Syne', sans-serif",
                background: isActive
                  ? "linear-gradient(135deg,#ef4444,#dc2626)"
                  : "linear-gradient(135deg,#fb923c,#ea580c)",
                boxShadow: isActive
                  ? "0 8px 28px rgba(239,68,68,0.42), 0 2px 8px rgba(0,0,0,0.4)"
                  : "0 8px 28px rgba(251,146,60,0.42), 0 2px 8px rgba(0,0,0,0.4)",
                transform: btnPressed ? "scale(0.94)" : "scale(1)",
                transition:
                  "transform 0.15s ease, box-shadow 0.3s ease, background 0.35s ease",
              }}
              onMouseEnter={(e) =>
                !isLoading &&
                ((e.currentTarget as HTMLElement).style.transform =
                  "scale(1.05)")
              }
              onMouseLeave={(e) =>
                !isLoading &&
                ((e.currentTarget as HTMLElement).style.transform = "scale(1)")
              }
            >
              {isLoading ? (
                <span
                  className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white block"
                  style={{ animation: "spin 0.7s linear infinite" }}
                />
              ) : (
                <span className="text-sm sm:text-base">
                  {isActive ? "⏹" : "▶"}
                </span>
              )}
              <span>{isActive ? "Stop Timer" : "Start Gas"}</span>
            </button>
          </div>
        </section>

        {/* ── Quick stats */}
        <div
          className="grid grid-cols-2 gap-2.5 sm:gap-3"
          style={{
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? "none" : "translateY(12px)",
            transition: "opacity 0.5s ease 0.18s, transform 0.5s ease 0.18s",
          }}
        >
          {[
            {
              label: "Today's Sessions",
              value: todayCount || "—",
              valueColor: "#f1f5f9",
            },
            {
              label: "Total Usage",
              value: summary.formattedTotal,
              valueColor: "#fb923c",
            },
          ].map(({ label, value, valueColor }) => (
            <div
              key={label}
              className="rounded-xl sm:rounded-2xl p-4 sm:p-5"
              style={{ background: "#12151f", border: "1px solid #1a1f2e" }}
            >
              <p className="text-[0.63rem] sm:text-[0.7rem] font-medium text-slate-600 uppercase tracking-widest mb-1.5 sm:mb-2">
                {label}
              </p>
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 500,
                  fontSize: "clamp(1.2rem,4vw,1.6rem)",
                  color: valueColor,
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* ── View switcher */}
        <div
          className="rounded-xl sm:rounded-2xl p-1 flex gap-1"
          style={{
            background: "#12151f",
            border: "1px solid #1a1f2e",
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? "none" : "translateY(12px)",
            transition: "opacity 0.5s ease 0.22s, transform 0.5s ease 0.22s",
          }}
        >
          {(["mine", "team"] as ViewMode[]).map((mode) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  setShowDetails(false);
                  setSelectedUser("all");
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all duration-300"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  background: active
                    ? "linear-gradient(135deg,#f97316,#ea580c)"
                    : "transparent",
                  color: active ? "#fff" : "#64748b",
                  boxShadow: active
                    ? "0 4px 16px rgba(251,146,60,0.3)"
                    : "none",
                }}
              >
                {mode === "mine" ? <PersonIcon /> : <TeamIcon />}
                <span>{mode === "mine" ? "My Usage" : "Other Users"}</span>
              </button>
            );
          })}
        </div>

        {/* ── Report / filters */}
        <section
          className="rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4"
          style={{
            background: "#12151f",
            border: "1px solid #1a1f2e",
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? "none" : "translateY(12px)",
            transition: "opacity 0.5s ease 0.26s, transform 0.5s ease 0.26s",
          }}
        >
          {viewMode === "team" && selectedUser !== "all" ? (
            <button
              onClick={() => setSelectedUser("all")}
              className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors duration-200"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: "-4px",
              }}
            >
              <span>←</span> Back to Team Leaderboard
            </button>
          ) : (
            <h3
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                color: "#f1f5f9",
                fontSize: "0.9rem",
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              {viewMode === "mine" ? "Usage Report" : "Team Leaderboard"}
            </h3>
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {(
              [
                ["From", startDate, setStartDate],
                ["To", endDate, setEndDate],
              ] as const
            ).map(([lbl, val, setter]) => (
              <div key={lbl}>
                <label className="block text-[0.6rem] sm:text-[0.68rem] text-slate-600 font-medium uppercase tracking-widest mb-1.5">
                  {lbl}
                </label>
                <input
                  type="date"
                  value={val}
                  onChange={(e) => setter(e.target.value)}
                  className="w-full rounded-lg sm:rounded-xl px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-200 outline-none transition-all duration-200"
                  style={{
                    background: "#0a0c12",
                    border: "1px solid #1e2535",
                    fontFamily: "'DM Sans', sans-serif",
                    colorScheme: "dark",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(251,146,60,0.5)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "#1e2535")
                  }
                />
              </div>
            ))}
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                fetchHistory();
                fetchTeamHistory();
              }}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-orange-400 transition-colors duration-200"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <span className="text-[0.6rem]">✕</span> Clear filters
            </button>
          )}

          {/* Summary display / Leaderboard */}
          {viewMode === "mine" ? (
            <div
              className="flex items-center justify-between rounded-xl px-4 sm:px-5 py-3 sm:py-4"
              style={{
                background: "rgba(251,146,60,0.07)",
                border: "1px solid rgba(251,146,60,0.15)",
              }}
            >
              <span
                className="text-xs sm:text-sm text-slate-400"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {startDate && endDate
                  ? `${startDate} → ${endDate}`
                  : "All time"}
              </span>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 500,
                  fontSize: "clamp(1rem,4vw,1.3rem)",
                  color: "#fb923c",
                }}
              >
                {summary.formattedTotal}
              </span>
            </div>
          ) : selectedUser === "all" ? (
            <div className="space-y-2 pt-1">
              {sortedTeamSummaries.length === 0 ? (
                <p className="text-center text-slate-600 text-sm py-4">
                  No team data found.
                </p>
              ) : (
                sortedTeamSummaries.map((u) => (
                  <button
                    key={u.userEmail}
                    onClick={() => {
                      setSelectedUser(u.userEmail);
                      setShowDetails(true);
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-all duration-200"
                    style={{
                      background: "#0f1219",
                      border: "1px solid #1a1f2e",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "#252d3f";
                      (e.currentTarget as HTMLElement).style.background =
                        "#111520";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "#1a1f2e";
                      (e.currentTarget as HTMLElement).style.background =
                        "#0f1219";
                    }}
                  >
                    <Avatar src={u.userImage} name={u.userName} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-200 text-xs sm:text-sm truncate">
                        {u.userName}
                      </p>
                      <p className="text-[0.6rem] sm:text-xs text-slate-600 truncate">
                        {u.userEmail}
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontWeight: 500,
                          fontSize: "0.85rem",
                          color: "#fb923c",
                        }}
                      >
                        {u.formattedTotal}
                      </div>
                      <div className="text-[0.6rem] text-slate-500 mt-0.5 font-medium flex items-center justify-end gap-1 group-hover:text-orange-400 transition-colors">
                        View details <span>➔</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {filteredTeamSummaries.map((u) => (
                <div
                  key={u.userEmail}
                  className="flex items-center justify-between rounded-xl px-4 sm:px-5 py-3 sm:py-4"
                  style={{
                    background: "rgba(251,146,60,0.07)",
                    border: "1px solid rgba(251,146,60,0.15)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={u.userImage} name={u.userName} size="md" />
                    <div className="flex flex-col">
                      <span
                        className="font-semibold text-slate-200 text-sm"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        {u.userName?.split(" ")[0]}'s Total
                      </span>
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontWeight: 500,
                      fontSize: "clamp(1rem,4vw,1.3rem)",
                      color: "#fb923c",
                    }}
                  >
                    {u.formattedTotal}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Session history accordion */}
        <section
          className="rounded-xl sm:rounded-2xl overflow-hidden"
          style={{
            background: "#12151f",
            border: "1px solid #1a1f2e",
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? "none" : "translateY(12px)",
            transition: "opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s",
          }}
        >
          {/* Header toggle */}
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="w-full flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 transition-colors duration-200 hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <h3
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 700,
                  color: "#f1f5f9",
                  fontSize: "0.9rem",
                  margin: 0,
                }}
              >
                {viewMode === "mine"
                  ? "Session History"
                  : selectedUser === "all"
                  ? "Team Sessions"
                  : "User Sessions"}
              </h3>
              {(viewMode === "mine" ? history : filteredTeam).length > 0 && (
                <span
                  className="text-[0.6rem] sm:text-[0.65rem] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(251,146,60,0.12)",
                    color: "#fb923c",
                    border: "1px solid rgba(251,146,60,0.2)",
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {(viewMode === "mine" ? history : filteredTeam).length}
                </span>
              )}
            </div>
            <span
              className="text-slate-600 text-[0.6rem] flex-shrink-0 transition-transform duration-300"
              style={{
                transform: showDetails ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▼
            </span>
          </button>

          {/* Collapsible list */}
          <div
            style={{
              maxHeight: showDetails ? "65vh" : "0",
              overflowY: showDetails ? "auto" : "hidden",
              overflowX: "hidden",
              transition: "max-height 0.45s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <div className="px-2.5 sm:px-4 pb-3 sm:pb-4 space-y-1.5 sm:space-y-2">
              {(viewMode === "mine" ? history : filteredTeam).length === 0 ? (
                <div className="text-center py-10">
                  <div
                    style={{
                      fontSize: "2rem",
                      opacity: 0.2,
                      marginBottom: "8px",
                    }}
                  >
                    🔥
                  </div>
                  <p className="text-slate-600 text-sm">No sessions found.</p>
                </div>
              ) : (
                (viewMode === "mine" ? history : filteredTeam).map((r, i) => {
                  const d = new Date(r.startTime);
                  const isToday =
                    d.toDateString() === new Date().toDateString();
                  const startStr = d.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const endStr = new Date(r.endTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isMe = r.userEmail === session.user?.email;

                  return (
                    <div
                      key={r._id}
                      className="flex items-center gap-2.5 sm:gap-3 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 transition-all duration-200"
                      style={{
                        background: "#0f1219",
                        border: "1px solid #1a1f2e",
                        animation: `fadeSlideIn 0.3s ease ${Math.min(
                          i * 0.03,
                          0.35
                        )}s both`,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor =
                          "#252d3f";
                        (e.currentTarget as HTMLElement).style.background =
                          "#111520";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor =
                          "#1a1f2e";
                        (e.currentTarget as HTMLElement).style.background =
                          "#0f1219";
                      }}
                    >
                      {viewMode === "team" && (
                        <Avatar src={r.userImage} name={r.userName} size="sm" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span
                            className="font-semibold text-slate-200 text-xs sm:text-sm"
                            style={{ fontFamily: "'DM Sans', sans-serif" }}
                          >
                            {viewMode === "team"
                              ? isMe
                                ? "You"
                                : r.userName?.split(" ")[0]
                              : isToday
                              ? "Today"
                              : d.toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                          </span>
                          {viewMode === "mine" && isToday && (
                            <span
                              className="text-[0.55rem] sm:text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full tracking-wide"
                              style={{
                                background: "rgba(251,146,60,0.12)",
                                color: "#fb923c",
                                border: "1px solid rgba(251,146,60,0.2)",
                              }}
                            >
                              TODAY
                            </span>
                          )}
                          {viewMode === "team" && (
                            <span
                              className="text-[0.6rem] text-slate-600"
                              style={{ fontFamily: "'DM Mono', monospace" }}
                            >
                              {isToday
                                ? "Today"
                                : d.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[0.6rem] sm:text-[0.68rem] text-slate-600 mt-0.5 truncate"
                          style={{ fontFamily: "'DM Mono', monospace" }}
                        >
                          {startStr} — {endStr}
                        </p>
                      </div>

                      <span
                        className="font-medium text-slate-400 text-xs sm:text-sm flex-shrink-0"
                        style={{ fontFamily: "'DM Mono', monospace" }}
                      >
                        {formatLabel(r.durationInSeconds)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Icon components ─────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#fff"
      fillOpacity="0.9"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#fff"
      fillOpacity="0.9"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#fff"
      fillOpacity="0.9"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#fff"
      fillOpacity="0.9"
    />
  </svg>
);

const PersonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M2.5 13.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const TeamIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="5.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M1 13c0-2.485 2.015-4.5 4.5-4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M8 13c0-2.485 1.343-4.5 3-4.5s3 2.015 3 4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

// ─── Global CSS (injected once) ───────────────────────────────────────────────

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

  body { margin: 0; background: #0a0c12; }

  @keyframes dotBounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
    40%           { transform: translateY(-9px); opacity: 1; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes ambientPulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50%      { opacity: 1; transform: scale(1.1); }
  }
  @keyframes statusBlink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.35; }
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1e2535; border-radius: 4px; }

  input[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(0.4) sepia(1) saturate(2) hue-rotate(330deg);
    cursor: pointer;
    opacity: 0.6;
  }

  @media (max-width: 380px) {
    .compact-hide { display: none !important; }
  }
`;
