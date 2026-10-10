"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { setBoardShowPlayers, setLivePlayoffStage, updatePlayoffBoard, type PlayoffBoardEdit } from "@/lib/actions/playoff-board"
import {
  BOARD_CATEGORY_LABELS,
  BOARD_STAGES,
  BOARD_STAGE_LABELS,
  MAX_BOARD_PLAYER_NAME_LENGTH,
  MAX_BOARD_TITLE_LENGTH,
  boardStageSupportsPlayers,
  normalizeBoardTime,
  sortBoardFixtures,
  type BoardFixture,
  type BoardMatch,
  type BoardStage,
  type BoardTeam,
  type BoardTeamOption,
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
  openTeamPicker: (playoffId: number, side: "home" | "away") => void
}

const Ctx = createContext<BoardContext>({ canEdit: false, setEditing: () => {}, commit: () => {}, openTeamPicker: () => {} })

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

export function PlayoffBoard({
  initial,
  canEdit: isAdmin,
  tv,
  teamOptions,
}: {
  initial: PlayoffBoardData
  canEdit: boolean
  tv: boolean
  teamOptions: BoardTeamOption[]
}) {
  const [data, setData] = useState(initial)
  const [preview, setPreview] = useState(false)
  const [picker, setPicker] = useState<{ playoffId: number; side: "home" | "away" } | null>(null)
  const canEdit = isAdmin && !preview
  // Admins edit one stage at a time; the TV and public view follow the stage marked live.
  const stageRef = useRef<BoardStage | null>(isAdmin ? initial.stage : null)
  const [selectedStage, setSelectedStage] = useState<BoardStage>(initial.stage)
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
      const requested = stageRef.current
      try {
        const res = await fetch(`/api/playoffs-board${requested ? `?stage=${requested}` : ""}`, {
          headers: !force && etag.current ? { "If-None-Match": etag.current } : undefined,
        })
        if (res.status === 304 || !res.ok) return
        const next = (await res.json()) as PlayoffBoardData
        if (requested !== stageRef.current) return
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

  const changeStage = useCallback(
    (next: BoardStage) => {
      if (stageRef.current === next) return
      stageRef.current = next
      setSelectedStage(next)
      etag.current = null
      window.history.replaceState(null, "", `?stage=${next}`)
      void refresh(true)
    },
    [refresh],
  )

  const makeLive = useCallback(() => {
    const next = stageRef.current
    if (!next) return
    setLivePlayoffStage(next)
      .then((res) => {
        if (res.ok) toast.success(`${BOARD_STAGE_LABELS[next]} are now showing on the TV`)
        else toast.error(res.error)
      })
      .catch(() => toast.error("Could not update the TV. Please try again."))
      .finally(() => void refresh(true))
  }, [refresh])

  const togglePlayers = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const show = !data.showPlayers
    setData((prev) => {
      const next = { ...prev, showPlayers: show }
      dataJson.current = JSON.stringify(next)
      return next
    })
    setBoardShowPlayers(stage, show)
      .then((res) => {
        if (!res.ok) toast.error(res.error)
      })
      .catch(() => toast.error("Could not update player names. Please try again."))
      .finally(() => {
        etag.current = null
        void refresh(true)
      })
  }, [refresh, data.showPlayers])

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

  const body = (
    <BoardBody
      data={data}
      canEdit={canEdit}
      tv={tv}
      wide={wide}
      designWidth={designWidth}
      inlineNames={wide || (viewport?.w ?? 0) >= INLINE_NAMES_MIN_WIDTH}
    />
  )
  const pickerMatch = picker ? data.matches.find((m) => m.playoffId === picker.playoffId) : undefined

  return (
    <Ctx.Provider value={{ canEdit, setEditing, commit, openTeamPicker: (playoffId, side) => setPicker({ playoffId, side }) }}>
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
      {isAdmin && !tv ? (
        <AdminBar
          stage={selectedStage}
          liveStage={data.liveStage}
          preview={preview}
          showPlayers={data.showPlayers}
          onPlayers={togglePlayers}
          onStage={changeStage}
          onLive={makeLive}
          onPreview={() => setPreview((value) => !value)}
        />
      ) : null}
      {picker && pickerMatch ? (
        <TeamPicker
          options={teamOptions}
          match={pickerMatch}
          side={picker.side}
          onClose={() => setPicker(null)}
          onPick={(team) => {
            const side = picker.side
            setPicker(null)
            commit(
              { playoffId: pickerMatch.playoffId, kind: "team", side, teamId: team ? team.id : null },
              (m) => ({
                ...m,
                ...(side === "home" ? { homeHidden: team == null } : { awayHidden: team == null }),
                ...(team
                  ? side === "home"
                    ? { home: { id: team.id, name: team.name, logoUrl: team.logoUrl } }
                    : { away: { id: team.id, name: team.name, logoUrl: team.logoUrl } }
                  : {}),
              }),
            )
          }}
        />
      ) : null}
    </Ctx.Provider>
  )
}

const MAX_NAME_SIZE = 19
const MIN_NAME_SIZE = 12
const NameSizeCtx = createContext<number | null>(null)
const ShowPlayersCtx = createContext(false)
// Side-by-side player names need room; narrow phone screens stack them above the scores.
const InlineNamesCtx = createContext(false)
const INLINE_NAMES_MIN_WIDTH = 1000

function BoardBody({
  data,
  canEdit,
  tv,
  wide,
  designWidth,
  inlineNames,
}: {
  data: PlayoffBoardData
  canEdit: boolean
  tv: boolean
  wide: boolean
  designWidth: number
  inlineNames: boolean
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [nameSize, setNameSize] = useState(MAX_NAME_SIZE)
  // Cards with no team selected are dropped from the public board; the rest re-centre.
  // Admins still see them (dimmed) so they can bring them back.
  const visible = data.matches.filter((m) => canEdit || !(m.homeHidden && m.awayHidden))
  const count = visible.length
  // With player names on, two cards are widened so the names have room instead of being cut off.
  const cardWidth =
    count >= 3
      ? "calc((100% - 42px) / 4)"
      : data.showPlayers
        ? "calc((100% - 40px) * 0.4)"
        : "calc((100% - 80px) / 3)"

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
    <ShowPlayersCtx.Provider value={data.showPlayers}>
    <InlineNamesCtx.Provider value={inlineNames}>
    <div className="pb-3">
      <Header data={data} canEdit={canEdit} tv={tv} wide={wide} />
      <div
        ref={gridRef}
        className={
          wide
            ? "-mt-2 flex justify-center px-6"
            : "mx-auto -mt-1 grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-4 px-3 md:grid-cols-[repeat(2,minmax(0,1fr))] md:px-6"
        }
        style={wide ? { gap: count >= 4 ? 14 : count === 3 ? 28 : 40 } : undefined}
      >
        {count === 0 ? (
          <p className="col-span-full rounded-xl bg-white p-10 text-center text-slate-500">
            {data.matches.length === 0
              ? `${BOARD_STAGE_LABELS[data.stage]} have not been set up yet.`
              : "No teams selected for this stage."}
          </p>
        ) : (
          visible.map((match, index) => (
            <div key={match.playoffId} style={wide ? { flex: "none", width: cardWidth } : undefined}>
              <MatchCard match={match} accent={ACCENTS[index % ACCENTS.length]} />
            </div>
          ))
        )}
      </div>
    </div>
    </InlineNamesCtx.Provider>
    </ShowPlayersCtx.Provider>
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
  const { canEdit, commit, openTeamPicker } = useContext(Ctx)
  // Public view only shows selected teams; admins also see empty slots so they can fill them.
  const showHome = canEdit || !match.homeHidden
  const showAway = canEdit || !match.awayHidden
  const both = showHome && showAway
  const dimmed = canEdit && match.homeHidden && match.awayHidden

  return (
    <section
      className="rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(15,30,70,0.35)] ring-1 ring-slate-200/70"
      style={dimmed ? { opacity: 0.55 } : undefined}
    >
      <div className="px-5 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="min-w-0 font-[family-name:var(--font-oswald)] text-[21px] font-semibold uppercase tracking-wide text-[#0b1a3d]">
            <Editable
              value={match.title}
              className="text-left uppercase"
              inputClassName="w-56 uppercase"
              parse={(text) => text.trim().slice(0, MAX_BOARD_TITLE_LENGTH)}
              onCommit={(text) =>
                commit({ playoffId: match.playoffId, kind: "title", value: text }, (m) => ({ ...m, title: text || m.defaultTitle }))
              }
            />
          </h2>
          <span className="shrink-0 text-[15px] font-semibold italic text-slate-400">{match.tag}</span>
        </div>
        <div className={`mt-2 h-[3px] w-3/4 rounded-full bg-gradient-to-r ${accent}`} />
      </div>

      <div
        className="grid items-start px-3 pb-2 pt-3"
        style={{ gridTemplateColumns: both ? "minmax(0,1fr) auto minmax(0,1fr)" : "minmax(0,1fr)" }}
      >
        {showHome ? (
          <TeamBlock
            team={match.home}
            empty={match.homeHidden}
            points={match.homePoints}
            onPick={() => openTeamPicker(match.playoffId, "home")}
            onPoints={(value) =>
              commit({ playoffId: match.playoffId, kind: "points", side: "home", value }, (m) => ({ ...m, homePoints: value }))
            }
          />
        ) : null}
        {both ? (
          <div className="flex h-[88px] items-center justify-center">
            <span className="text-[14px] font-bold tracking-widest text-slate-400">VS</span>
          </div>
        ) : null}
        {showAway ? (
          <TeamBlock
            team={match.away}
            empty={match.awayHidden}
            points={match.awayPoints}
            onPick={() => openTeamPicker(match.playoffId, "away")}
            onPoints={(value) =>
              commit({ playoffId: match.playoffId, kind: "points", side: "away", value }, (m) => ({ ...m, awayPoints: value }))
            }
          />
        ) : null}
      </div>

      <div className="mx-5 border-t border-slate-200/80">
        {match.fixtures.map((fixture) => (
          <FixtureRow key={fixture.category} match={match} fixture={fixture} showHome={showHome} showAway={showAway} />
        ))}
      </div>
      <div className="h-1" />
    </section>
  )
}

function TeamBlock({
  team,
  empty,
  points,
  onPoints,
  onPick,
}: {
  team: BoardTeam
  empty: boolean
  points: number
  onPoints: (value: number) => void
  onPick: () => void
}) {
  const nameSize = useContext(NameSizeCtx)
  const { canEdit } = useContext(Ctx)
  const name = empty ? "No team" : team.name

  const logo = (
    <div
      className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full bg-white shadow ring-1 ring-slate-200"
      style={empty ? { border: "2px dashed #cbd5e1", boxShadow: "none" } : undefined}
    >
      {empty ? (
        <span className="text-4xl font-light text-slate-300">+</span>
      ) : team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt={team.name} className="h-full w-full object-contain" />
      ) : (
        <span className="text-2xl font-bold text-slate-400">{team.id == null ? "?" : team.name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col items-center px-2 text-center">
      {canEdit ? (
        <button type="button" onClick={onPick} title="Change team" className="cursor-pointer rounded-full transition-transform hover:scale-105">
          {logo}
        </button>
      ) : (
        logo
      )}
      {nameSize == null ? (
        <p className="mt-1.5 flex min-h-[46px] items-start justify-center text-[19px] font-semibold leading-tight text-[#0b1a3d]">
          <span className="line-clamp-2">{name}</span>
        </p>
      ) : (
        <p
          data-team-name
          className="mt-1.5 w-full overflow-hidden whitespace-nowrap py-[3px] text-center font-semibold leading-tight text-[#0b1a3d]"
          style={{ fontSize: nameSize, color: empty ? "#94a3b8" : undefined }}
        >
          <span className="inline-block">{name}</span>
        </p>
      )}
      <div className="mt-2 flex flex-col items-center" style={empty ? { visibility: "hidden" } : undefined}>
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

function FixtureRow({
  match,
  fixture,
  showHome,
  showAway,
}: {
  match: BoardMatch
  fixture: BoardFixture
  showHome: boolean
  showAway: boolean
}) {
  const { commit } = useContext(Ctx)
  const showPlayers = useContext(ShowPlayersCtx)
  const wide = useContext(InlineNamesCtx)
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
        <div
          className="mt-1 grid items-stretch"
          style={{ gridTemplateColumns: showHome && showAway ? "minmax(0,1fr) 1px minmax(0,1fr)" : "minmax(0,1fr)" }}
        >
          {(["home", "away"] as const)
            .filter((side) => (side === "home" ? showHome : showAway))
            .map((side) => (
            <div
              key={side}
              className={`row-start-1 flex ${
                showPlayers && wide ? (side === "home" ? "flex-row" : "flex-row-reverse") : "flex-col"
              } items-center ${showPlayers && wide ? "justify-center gap-1.5 px-1" : ""}`}
              style={{ gridColumnStart: side === "home" || !showHome ? 1 : 3 }}
            >
              {showPlayers ? (
                <PlayerNames match={match} fixture={fixture} side={side} wide={wide} patch={patch} />
              ) : null}
              <div className="flex shrink-0 flex-col items-center" style={{ minWidth: 14 }}>
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
            </div>
          ))}
          {showHome && showAway ? <div className="col-start-2 row-start-1 my-1 bg-slate-200" /> : null}
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

function PlayerNames({
  match,
  fixture,
  side,
  wide,
  patch,
}: {
  match: BoardMatch
  fixture: BoardFixture
  side: "home" | "away"
  wide: boolean
  patch: (change: (f: BoardFixture) => BoardFixture) => (m: BoardMatch) => BoardMatch
}) {
  const { canEdit, commit } = useContext(Ctx)
  const names = side === "home" ? fixture.homePlayers : fixture.awayPlayers
  const key = side === "home" ? "homePlayers" : "awayPlayers"
  const align = wide ? (side === "home" ? "text-right" : "text-left") : "text-center"
  return (
    <div className={`min-w-0 flex-1 ${align}`} style={wide ? undefined : { width: "100%", marginBottom: 2 }}>
      {[0, 1].map((slot) => (
        <p
          key={slot}
          className="truncate font-semibold text-slate-800"
          style={{ fontSize: wide ? 14 : 12, lineHeight: wide ? "27px" : "16px", minHeight: wide ? 27 : 16 }}
        >
          <Editable
            value={names[slot] || (canEdit ? "Add name" : "\u00a0")}
            className="max-w-full truncate align-top"
            inputClassName="w-[170px]"
            parse={(text) => {
              const clean = text.replace(/\s+/g, " ").trim()
              return clean === "Add name" ? "" : clean.slice(0, MAX_BOARD_PLAYER_NAME_LENGTH)
            }}
            onCommit={(text) =>
              commit(
                { playoffId: match.playoffId, kind: "player", category: fixture.category, side, slot, value: text },
                patch((f) => ({ ...f, [key]: [0, 1].map((i) => (i === slot ? text : f[key][i] ?? "")) })),
              )
            }
          />
        </p>
      ))}
    </div>
  )
}

function AdminBar({
  stage,
  liveStage,
  preview,
  showPlayers,
  onPlayers,
  onStage,
  onLive,
  onPreview,
}: {
  stage: BoardStage
  liveStage: BoardStage
  preview: boolean
  showPlayers: boolean
  onPlayers: () => void
  onStage: (stage: BoardStage) => void
  onLive: () => void
  onPreview: () => void
}) {
  const isLive = stage === liveStage
  const pill = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    borderRadius: 9999,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    color: active ? "#0b1a3d" : "#e2e8f0",
    background: active ? "#ffffff" : "transparent",
    whiteSpace: "nowrap",
  })
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 14,
        transform: "translateX(-50%)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 6,
        maxWidth: "calc(100vw - 16px)",
        padding: 6,
        borderRadius: 9999,
        background: "rgba(7,18,43,0.94)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      {BOARD_STAGES.map((value) => (
        <button key={value} type="button" style={pill(stage === value)} onClick={() => onStage(value)}>
          {BOARD_STAGE_LABELS[value]}
          {liveStage === value ? " ●" : ""}
        </button>
      ))}
      <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.25)" }} />
      <button
        type="button"
        disabled={isLive}
        onClick={onLive}
        style={{ ...pill(false), background: isLive ? "transparent" : "#dc2626", color: "#fff", opacity: isLive ? 0.7 : 1, cursor: isLive ? "default" : "pointer" }}
      >
        {isLive ? "Live on TV" : "Show on TV"}
      </button>
      {boardStageSupportsPlayers(stage) ? (
        <button type="button" style={pill(showPlayers)} onClick={onPlayers}>
          {showPlayers ? "Player names: On" : "Player names: Off"}
        </button>
      ) : null}
      <button type="button" style={pill(preview)} onClick={onPreview}>
        {preview ? "Back to editing" : "Preview"}
      </button>
    </div>
  )
}

function TeamPicker({
  options,
  match,
  side,
  onPick,
  onClose,
}: {
  options: BoardTeamOption[]
  match: BoardMatch
  side: "home" | "away"
  onPick: (team: BoardTeamOption | null) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const current = side === "home" ? match.home : match.away
  const currentHidden = side === "home" ? match.homeHidden : match.awayHidden
  const other = side === "home" ? match.away : match.home
  const otherHidden = side === "home" ? match.awayHidden : match.homeHidden
  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((team) => team.name.toLowerCase().includes(q)) : options

  const row = (active: boolean, disabled = false): React.CSSProperties => ({
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    textAlign: "left",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    background: active ? "#e0e7ff" : "transparent",
    color: "#0b1a3d",
    fontSize: 16,
    fontWeight: 600,
  })

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(7,18,43,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Select team"
        onClick={(event) => event.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, maxHeight: "80vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 16, boxShadow: "0 25px 60px rgba(0,0,0,0.4)", overflow: "hidden" }}
      >
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #e2e8f0" }}>
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", marginBottom: 8 }}>
            {match.title} · {side === "home" ? "Left" : "Right"} team
          </p>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search teams…"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 16, outline: "none" }}
          />
        </div>
        <div style={{ overflowY: "auto", padding: 8 }}>
          <button type="button" style={row(currentHidden)} onClick={() => onPick(null)}>
            <span style={{ width: 36, height: 36, borderRadius: 9999, border: "2px dashed #cbd5e1", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>–</span>
            No team (hide)
          </button>
          {filtered.map((team) => {
            const taken = !otherHidden && other.id === team.id
            return (
              <button
                key={team.id}
                type="button"
                disabled={taken}
                style={row(!currentHidden && current.id === team.id, taken)}
                onClick={() => onPick(team)}
              >
                <span style={{ width: 36, height: 36, borderRadius: 9999, overflow: "hidden", border: "1px solid #e2e8f0", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff", flexShrink: 0 }}>
                  {team.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={team.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>{team.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </span>
                <span style={{ flex: 1 }}>{team.name}</span>
                {taken ? <span style={{ fontSize: 12, color: "#64748b" }}>in this match</span> : null}
              </button>
            )
          })}
          {filtered.length === 0 ? <p style={{ padding: 16, textAlign: "center", color: "#64748b" }}>No teams found</p> : null}
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
