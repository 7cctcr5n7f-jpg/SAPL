"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { updatePlayoffBoard, type PlayoffBoardEdit } from "@/lib/actions/playoff-board"
import {
  BOARD_CATEGORY_LABELS,
  normalizeBoardTime,
  sortBoardFixtures,
  type BoardFixture,
  type BoardMatch,
  type BoardTeam,
  type PlayoffBoardData,
} from "@/lib/playoff-board"

const POLL_MS = 2500
const DESIGN_WIDTH = 1600
const TV_MIN_DESIGN_WIDTH = 1600
const TV_MAX_DESIGN_WIDTH = 2000
const WIDE_BREAKPOINT = 1280
const HEADER_DESIGN_HEIGHT = 180

const ACCENTS = [
  "from-red-500 via-red-400 to-transparent",
  "from-blue-500 via-sky-400 to-transparent",
  "from-amber-400 via-yellow-300 to-transparent",
  "from-orange-500 via-orange-300 to-transparent",
]

type BoardContext = {
  canEdit: boolean
  setEditing: (editing: boolean) => void
  commit: (edit: PlayoffBoardEdit, apply: (match: BoardMatch) => BoardMatch) => void
}

const Ctx = createContext<BoardContext>({ canEdit: false, setEditing: () => {}, commit: () => {} })

function useViewport() {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])
  return size
}

export function PlayoffBoard({ initial, canEdit, tv }: { initial: PlayoffBoardData; canEdit: boolean; tv: boolean }) {
  const [data, setData] = useState(initial)
  const pending = useRef(0)
  const editing = useRef(0)
  const etag = useRef<string | null>(null)
  const dataJson = useRef(JSON.stringify(initial))

  const apply = useCallback((next: PlayoffBoardData) => {
    const json = JSON.stringify(next)
    if (json === dataJson.current) return
    dataJson.current = json
    setData(next)
  }, [])

  // Polling keeps every open board (TV and phones) in sync with the database.
  // Updates are skipped while the admin is typing or a save is in flight.
  const refresh = useCallback(
    async (force = false) => {
      if (!force && (pending.current > 0 || editing.current > 0)) return
      try {
        const res = await fetch("/api/playoffs-board", {
          headers: !force && etag.current ? { "If-None-Match": etag.current } : undefined,
        })
        if (res.status === 304 || !res.ok) return
        const next = (await res.json()) as PlayoffBoardData
        if (pending.current > 0 || (!force && editing.current > 0)) return
        etag.current = res.headers.get("ETag")
        apply(next)
      } catch {
        // Network blips are retried on the next tick.
      }
    },
    [apply],
  )

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void refresh()
    }
    const timer = window.setInterval(tick, POLL_MS)
    document.addEventListener("visibilitychange", tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [refresh])

  const setEditing = useCallback((on: boolean) => {
    editing.current = Math.max(0, editing.current + (on ? 1 : -1))
  }, [])

  const commit = useCallback(
    (edit: PlayoffBoardEdit, applyLocal: (match: BoardMatch) => BoardMatch) => {
      pending.current += 1
      setData((prev) => {
        const next = { ...prev, matches: prev.matches.map((m) => (m.playoffId === edit.playoffId ? applyLocal(m) : m)) }
        dataJson.current = JSON.stringify(next)
        return next
      })
      updatePlayoffBoard(edit)
        .then((res) => {
          if (!res.ok) toast.error(res.error)
        })
        .catch(() => toast.error("Could not save. Please try again."))
        .finally(() => {
          pending.current -= 1
          etag.current = null
          if (pending.current === 0) void refresh(true)
        })
    },
    [refresh],
  )

  const viewport = useViewport()
  const innerRef = useRef<HTMLDivElement>(null)
  const [naturalHeight, setNaturalHeight] = useState(900)
  // TV mode always shows all four cards on one screen, scaled to fit any display size.
  const wide = viewport ? tv || viewport.w >= WIDE_BREAKPOINT : false

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el || !wide) return
    const measure = () => setNaturalHeight(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [wide])

  // On wide screens the board is laid out at a design width and scaled to fit the display.
  // TV mode fits the full height and stretches the design width to the screen's aspect ratio,
  // so the board fills a 16:9 TV edge to edge instead of leaving side margins.
  let designWidth = DESIGN_WIDTH
  let scale = 1
  if (viewport && wide) {
    if (tv) {
      designWidth = Math.min(TV_MAX_DESIGN_WIDTH, Math.max(TV_MIN_DESIGN_WIDTH, Math.round((viewport.w / viewport.h) * naturalHeight)))
      scale = Math.min(viewport.w / designWidth, viewport.h / naturalHeight)
    } else {
      scale = viewport.w / DESIGN_WIDTH
    }
  }

  const body = <BoardBody data={data} canEdit={canEdit} tv={tv} wide={wide} designWidth={designWidth} />

  return (
    <Ctx.Provider value={{ canEdit, setEditing, commit }}>
      <div
        className="fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden bg-[#eef2f9]"
        style={{
          opacity: viewport ? 1 : 0,
          background: wide
            ? `linear-gradient(115deg,#07122b 0%,#0d2350 55%,#0a1a3c 100%) top / 100% ${HEADER_DESIGN_HEIGHT * scale}px no-repeat, #eef2f9`
            : "#eef2f9",
        }}
      >
        {wide ? (
          <div style={{ width: designWidth * scale, height: naturalHeight * scale, margin: "0 auto" }}>
            <div
              ref={innerRef}
              style={{ width: designWidth, transform: `scale(${scale})`, transformOrigin: "top left" }}
            >
              {body}
            </div>
          </div>
        ) : (
          body
        )}
      </div>
    </Ctx.Provider>
  )
}

const MAX_NAME_SIZE = 19
const MIN_NAME_SIZE = 12
const NameSizeCtx = createContext<number | null>(null)

function BoardBody({
  data,
  canEdit,
  tv,
  wide,
  designWidth,
}: {
  data: PlayoffBoardData
  canEdit: boolean
  tv: boolean
  wide: boolean
  designWidth: number
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [nameSize, setNameSize] = useState(MAX_NAME_SIZE)

  // Team names stay on one line: pick the largest shared font size at which the longest name still fits.
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid || !wide) return
    const fit = () => {
      let size = MAX_NAME_SIZE
      grid.querySelectorAll<HTMLElement>("[data-team-name]").forEach((el) => {
        const text = el.firstElementChild as HTMLElement | null
        if (!text || text.offsetWidth <= 0 || el.clientWidth <= 0) return
        const current = parseFloat(el.style.fontSize) || MAX_NAME_SIZE
        size = Math.min(size, (current * el.clientWidth) / text.offsetWidth)
      })
      const next = Math.max(MIN_NAME_SIZE, Math.floor(size * 2) / 2)
      setNameSize((prev) => (prev === next ? prev : next))
    }
    fit()
    void document.fonts?.ready.then(fit)
  }, [data, wide, designWidth, nameSize])

  return (
    <NameSizeCtx.Provider value={wide ? nameSize : null}>
    <div className="pb-3">
      <Header data={data} canEdit={canEdit} tv={tv} wide={wide} />
      <div
        ref={gridRef}
        className={
          wide
            ? "-mt-2 grid grid-cols-4 gap-[14px] px-6"
            : "mx-auto -mt-1 grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-4 px-3 md:grid-cols-[repeat(2,minmax(0,1fr))] md:px-6"
        }
      >
        {data.matches.length === 0 ? (
          <p className="col-span-full rounded-xl bg-white p-10 text-center text-slate-500">
            Quarter-finals have not been set up yet.
          </p>
        ) : (
          data.matches.map((match, index) => (
            <MatchCard key={match.playoffId} match={match} accent={ACCENTS[index % ACCENTS.length]} />
          ))
        )}
      </div>
    </div>
    </NameSizeCtx.Provider>
  )
}

function Header({ data, canEdit, tv, wide }: { data: PlayoffBoardData; canEdit: boolean; tv: boolean; wide: boolean }) {
  return (
    <header
      className="relative overflow-hidden text-white"
      style={{ background: "linear-gradient(115deg,#07122b 0%,#0d2350 55%,#0a1a3c 100%)" }}
    >
      <div
        className={
          wide
            ? "relative flex items-center justify-between px-10 pb-9 pt-4"
            : "relative flex flex-col items-center gap-2 px-4 pb-10 pt-8 text-center"
        }
      >
        <SaplMark width={wide ? 260 : 170} />
        <div className="flex flex-col items-center">
          <h1
            className={`font-[family-name:var(--font-oswald)] font-bold uppercase italic leading-none tracking-wide ${
              wide ? "text-[78px]" : "text-5xl"
            }`}
          >
            Playoffs
          </h1>
          {(data.dateLabel || data.venue) && (
            <p
              className={`mt-2 flex items-center gap-3 font-semibold uppercase tracking-wider text-slate-200 ${
                wide ? "text-lg" : "text-xs"
              }`}
            >
              {data.dateLabel && <span>{data.dateLabel}</span>}
              {data.dateLabel && data.venue && <span className="h-4 w-px bg-white/40" />}
              {data.venue && <span>{data.venue}</span>}
            </p>
          )}
        </div>
        {wide ? (
          <div className="w-64 text-left">
            <p className="text-xl font-bold uppercase leading-tight tracking-[0.18em]">
              Play
              <br />
              Compete
              <br />
              Promote
            </p>
            <span className="mt-2 block h-1 w-12 rounded bg-red-600" />
          </div>
        ) : null}
        {canEdit && !tv ? (
          <p className="absolute right-3 top-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
            Admin · tap a value to edit
          </p>
        ) : null}
      </div>
    </header>
  )
}

// The brand PNG has large transparent margins, so crop to the visible mark.
function SaplMark({ width }: { width: number }) {
  const imgW = (width * 1536) / 815
  const imgH = (imgW * 1024) / 1536
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ width, height: (imgH * 270) / 1024 }} role="img" aria-label="SAPL — South African Padel League">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/sapl-logo.png"
        alt=""
        className="absolute max-w-none"
        style={{ width: imgW, height: imgH, left: -(width * 300) / 815, top: -(imgH * 385) / 1024 }}
      />
    </div>
  )
}

function MatchCard({ match, accent }: { match: BoardMatch; accent: string }) {
  const { commit } = useContext(Ctx)
  return (
    <section className="rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(15,30,70,0.35)] ring-1 ring-slate-200/70">
      <div className="px-5 pt-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-[family-name:var(--font-oswald)] text-[21px] font-semibold uppercase tracking-wide text-[#0b1a3d]">
            Quarter-final {match.position}
          </h2>
          <span className="text-[15px] font-semibold italic text-slate-400">QF{match.position}</span>
        </div>
        <div className={`mt-2 h-[3px] w-3/4 rounded-full bg-gradient-to-r ${accent}`} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start px-3 pb-2 pt-3">
        <TeamBlock
          team={match.home}
          points={match.homePoints}
          onPoints={(value) =>
            commit({ playoffId: match.playoffId, kind: "points", side: "home", value }, (m) => ({ ...m, homePoints: value }))
          }
        />
        <div className="flex h-[88px] items-center justify-center">
          <span className="text-[14px] font-bold tracking-widest text-slate-400">VS</span>
        </div>
        <TeamBlock
          team={match.away}
          points={match.awayPoints}
          onPoints={(value) =>
            commit({ playoffId: match.playoffId, kind: "points", side: "away", value }, (m) => ({ ...m, awayPoints: value }))
          }
        />
      </div>

      <div className="mx-5 border-t border-slate-200/80">
        {match.fixtures.map((fixture) => (
          <FixtureRow key={fixture.category} match={match} fixture={fixture} />
        ))}
      </div>
      <div className="h-1" />
    </section>
  )
}

function TeamBlock({ team, points, onPoints }: { team: BoardTeam; points: number; onPoints: (value: number) => void }) {
  const nameSize = useContext(NameSizeCtx)
  return (
    <div className="flex min-w-0 flex-col items-center px-2 text-center">
      <div className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full bg-white shadow ring-1 ring-slate-200">
        {team.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt={team.name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-2xl font-bold text-slate-400">{team.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      {nameSize == null ? (
        <p className="mt-1.5 flex min-h-[46px] items-start justify-center text-[19px] font-semibold leading-tight text-[#0b1a3d]">
          <span className="line-clamp-2">{team.name}</span>
        </p>
      ) : (
        <p
          data-team-name
          className="mt-1.5 w-full overflow-hidden whitespace-nowrap py-[3px] text-center font-semibold leading-tight text-[#0b1a3d]"
          style={{ fontSize: nameSize }}
        >
          <span className="inline-block">{team.name}</span>
        </p>
      )}
      <div className="mt-2 flex flex-col items-center">
        <Editable
          value={String(points)}
          inputMode="numeric"
          className="font-[family-name:var(--font-oswald)] text-[66px] font-bold leading-[0.95] text-[#0b1a3d]"
          inputClassName="w-24 text-center"
          parse={(text) => (/^\d{1,2}$/.test(text.trim()) ? String(Number(text)) : null)}
          onCommit={(text) => onPoints(Number(text))}
        />
        <span className="mt-1 text-[12px] font-bold tracking-widest text-slate-500">{points === 1 ? "PT" : "PTS"}</span>
      </div>
    </div>
  )
}

function setWinner(fixture: BoardFixture, set: number): "home" | "away" | null {
  const h = fixture.home[set]
  const a = fixture.away[set]
  if (h == null || a == null || h === a) return null
  return h > a ? "home" : "away"
}

const CATEGORY_TEXT_COLORS: Record<string, string> = {
  "Ladies Open": "#e0197d",
  "Mens Beginner": "#0ea5e9",
  "Mens Intermediate": "#1d4ed8",
}

function FixtureRow({ match, fixture }: { match: BoardMatch; fixture: BoardFixture }) {
  const { commit } = useContext(Ctx)
  const label = BOARD_CATEGORY_LABELS[fixture.category] ?? fixture.category

  const patch = (change: (f: BoardFixture) => BoardFixture) => (m: BoardMatch): BoardMatch => ({
    ...m,
    fixtures: sortBoardFixtures(m.fixtures.map((f) => (f.category === fixture.category ? change(f) : f))),
  })

  return (
    <div className="grid grid-cols-[66px_1fr_58px] items-center gap-1 border-b border-slate-200/80 py-[8px] last:border-b-0">
      <div className="flex flex-col items-center">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Time</span>
        <div className="mt-1 flex items-center justify-center" style={{ height: 44 }}>
          <Editable
            value={fixture.time ?? "--:--"}
            className="text-[24px] font-semibold tabular-nums text-slate-400"
            inputClassName="w-[64px] text-center"
            inputMode="numeric"
            parse={normalizeBoardTime}
            onCommit={(value) =>
              commit(
                { playoffId: match.playoffId, kind: "time", category: fixture.category, value },
                patch((f) => ({ ...f, time: value })),
              )
            }
          />
        </div>
      </div>
      <div className="min-w-0">
        <p
          className="whitespace-nowrap text-center text-[14.5px] font-extrabold uppercase tracking-wide"
          style={{ color: CATEGORY_TEXT_COLORS[fixture.category] ?? "#0b1a3d" }}
        >
          {label}
        </p>
        <div className="mt-1 grid grid-cols-[1fr_1px_1fr] items-stretch">
          {(["home", "away"] as const).map((side) => (
            <div key={side} className={`flex flex-col items-center ${side === "home" ? "col-start-1" : "col-start-3"} row-start-1`}>
              {[0, 1, 2].map((set) => {
                const value = fixture[side][set]
                const isWinner = setWinner(fixture, set) === side
                return (
                  <Editable
                    key={set}
                    value={value == null ? "-" : String(value)}
                    inputMode="numeric"
                    className={`text-[19px] font-semibold leading-[27px] tabular-nums ${
                      isWinner ? "text-[#17883a]" : "text-slate-700"
                    }`}
                    inputClassName="w-10 text-center"
                    parse={(text) => {
                      const t = text.trim()
                      if (t === "" || t === "-") return "-"
                      return /^\d{1,2}$/.test(t) ? String(Number(t)) : null
                    }}
                    onCommit={(text) => {
                      const next = text === "-" ? null : Number(text)
                      commit(
                        { playoffId: match.playoffId, kind: "set", category: fixture.category, side, set, value: next },
                        patch((f) => ({ ...f, [side]: f[side].map((v, i) => (i === set ? next : v)) })),
                      )
                    }}
                  />
                )
              })}
            </div>
          ))}
          <div className="col-start-2 row-start-1 my-1 bg-slate-200" />
        </div>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Court</span>
        <div
          className="mt-1 flex items-center justify-center"
          style={{ backgroundColor: "#94a3b8", width: 44, height: 44, borderRadius: 9999 }}
        >
          <Editable
            value={fixture.court == null ? "-" : String(fixture.court)}
            inputMode="numeric"
            className="px-0! font-bold leading-none tabular-nums hover:bg-white/20! hover:ring-0!"
            inputClassName="w-10 text-center"
            style={{ color: "#ffffff", fontSize: 26, padding: 0 }}
            parse={(text) => (/^\d{1,2}$/.test(text.trim()) && Number(text) > 0 ? String(Number(text)) : null)}
            onCommit={(text) =>
              commit(
                { playoffId: match.playoffId, kind: "court", category: fixture.category, value: Number(text) },
                patch((f) => ({ ...f, court: Number(text) })),
              )
            }
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Click-to-edit value. `parse` returns the normalised text, or null when the input is invalid
 * (the edit is discarded). Only admins get the interactive affordance.
 */
function Editable({
  value,
  parse,
  onCommit,
  className,
  inputClassName,
  inputMode,
  style,
}: {
  value: string
  parse: (text: string) => string | null
  onCommit: (normalised: string) => void
  className?: string
  inputClassName?: string
  inputMode?: "numeric" | "text"
  style?: React.CSSProperties
}) {
  const { canEdit, setEditing } = useContext(Ctx)
  const [editing, setLocalEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const done = useRef(false)

  if (!canEdit) return <span className={className} style={style}>{value}</span>

  const start = () => {
    done.current = false
    setDraft(value === "-" || value === "--:--" ? "" : value)
    setLocalEditing(true)
    setEditing(true)
  }

  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    setLocalEditing(false)
    setEditing(false)
    if (!save) return
    const normalised = parse(draft)
    if (normalised !== null && normalised !== value) onCommit(normalised)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        inputMode={inputMode}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            finish(true)
          } else if (event.key === "Escape") {
            finish(false)
          }
        }}
        className={`rounded border border-blue-400 bg-white px-1 text-[16px] font-semibold text-[#0b1a3d] outline-none ring-2 ring-blue-200 ${inputClassName ?? ""}`}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      style={style}
      className={`cursor-pointer rounded px-1 transition-colors hover:bg-slate-100 hover:ring-1 hover:ring-slate-300 active:bg-slate-100 ${className ?? ""}`}
    >
      {value}
    </button>
  )
}
