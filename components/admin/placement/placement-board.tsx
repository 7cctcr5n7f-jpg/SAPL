"use client"

import { useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
  type CollisionDetection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TeamCardContent } from "./team-card"
import { RosterPanel } from "./roster-panel"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { reindexDivisionColumn } from "@/lib/actions/placement"
import { adjustDivisionFixtures } from "@/lib/actions/admin"
import { PLACEMENT_SLOTS, type BoardTeam, type BoardDivision } from "@/lib/placement-types"
import { SAPL_REGIONS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Wand2 } from "lucide-react"

const UNASSIGNED = "unassigned"

type Containers = Record<string, number[]>

// Pointer-first collision detection. The wide "Unassigned" column sits directly
// left of the first division, so a card dragged into that first column still
// overlaps Unassigned. Distance-based strategies (closestCorners) then snap the
// target back to Unassigned, making the first league feel "undroppable". Using
// the pointer position as the primary signal makes the column actually under the
// cursor win, with rect/corner strategies only as fallbacks.
const collisionDetectionStrategy: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return pointerCollisions
  const rectCollisions = rectIntersection(args)
  if (rectCollisions.length > 0) return rectCollisions
  return closestCorners(args)
}

function divContainerId(divisionId: number) {
  return `div-${divisionId}`
}

export function PlacementBoard({
  seasonId,
  seasonName,
  divisions,
  teams,
}: {
  seasonId: number
  seasonName: string
  divisions: BoardDivision[]
  teams: BoardTeam[]
}) {
  const teamsById = useMemo(() => {
    const m: Record<number, BoardTeam> = {}
    for (const t of teams) m[t.id] = t
    return m
  }, [teams])

  // Build initial container state from the teams' saved placement.
  const initial = useMemo<Containers>(() => {
    const c: Containers = { [UNASSIGNED]: [] }
    for (const d of divisions) c[divContainerId(d.id)] = []
    const sorted = [...teams].sort((a, b) => (a.slot ?? a.sortOrder) - (b.slot ?? b.sortOrder))
    for (const t of sorted) {
      const key = t.divisionId ? divContainerId(t.divisionId) : UNASSIGNED
      if (c[key]) c[key].push(t.id)
      else c[UNASSIGNED].push(t.id)
    }
    return c
  }, [teams, divisions])

  const [containers, setContainers] = useState<Containers>(initial)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [panelTeam, setPanelTeam] = useState<BoardTeam | null>(null)
  const [regionFilter, setRegionFilter] = useState<string>("all")

  // Regions that actually appear on this board, in canonical SAPL order.
  const regionOptions = useMemo(() => {
    const present = new Set<string>()
    for (const t of teams) if (t.saplRegion) present.add(t.saplRegion)
    for (const d of divisions) if (d.regionName) present.add(d.regionName)
    return SAPL_REGIONS.filter((r) => present.has(r))
  }, [teams, divisions])
  const dragStartContainer = useRef<string | null>(null)
  // Distinguish a click (open panel) from a drag.
  const movedRef = useRef(false)
  // Mirror of `containers` kept in sync synchronously so drag handlers can read
  // the latest placement without calling server actions inside a state updater.
  const containersRef = useRef<Containers>(initial)

  // Compute the next state from the ref (always current), update the ref
  // synchronously, then push it to React state. This keeps containersRef.current
  // authoritative within a single drag interaction.
  function updateContainers(updater: (prev: Containers) => Containers) {
    const next = updater(containersRef.current)
    containersRef.current = next
    setContainers(next)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Drag logic always reads the ref (authoritative within a drag) so it never
  // operates on a stale render of `containers`.
  function findContainer(id: string | number): string | null {
    const state = containersRef.current
    if (typeof id === "string" && id in state) return id
    const tid = Number(id)
    for (const key of Object.keys(state)) {
      if (state[key].includes(tid)) return key
    }
    return null
  }

  function isDivisionFull(containerId: string, activeTeam: number) {
    if (containerId === UNASSIGNED) return false
    const arr = containersRef.current[containerId] ?? []
    return arr.length >= PLACEMENT_SLOTS && !arr.includes(activeTeam)
  }

  function onDragStart(e: DragStartEvent) {
    const id = Number(e.active.id)
    setActiveId(id)
    dragStartContainer.current = findContainer(id)
    movedRef.current = false
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const activeIdNum = Number(active.id)
    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)
    if (!activeContainer || !overContainer || activeContainer === overContainer) return
    if (isDivisionFull(overContainer, activeIdNum)) return

    movedRef.current = true
    updateContainers((prev) => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer]
      const activeIndex = activeItems.indexOf(activeIdNum)
      if (activeIndex === -1) return prev

      // Determine insertion index in the destination container.
      let overIndex = overItems.indexOf(Number(over.id))
      if (overIndex === -1) overIndex = overItems.length

      const next: Containers = { ...prev }
      next[activeContainer] = activeItems.filter((id) => id !== activeIdNum)
      next[overContainer] = [...overItems.slice(0, overIndex), activeIdNum, ...overItems.slice(overIndex)]
      return next
    })
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    const startContainer = dragStartContainer.current
    setActiveId(null)
    dragStartContainer.current = null
    if (!over) return

    const activeIdNum = Number(active.id)
    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)
    if (!activeContainer || !overContainer) return

    if (activeContainer === overContainer) {
      // Reorder within the same container if needed.
      const items = containersRef.current[activeContainer]
      const oldIndex = items.indexOf(activeIdNum)
      const newIndex = items.indexOf(Number(over.id))
      if (oldIndex !== newIndex && newIndex !== -1) {
        movedRef.current = true
        updateContainers((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex),
        }))
      }
    } else if (!isDivisionFull(overContainer, activeIdNum)) {
      // Safety net: finalize a cross-container move in case onDragOver didn't
      // land it (fast drops onto empty columns). No-op when already moved.
      movedRef.current = true
      updateContainers((prev) => {
        const from = prev[activeContainer].filter((id) => id !== activeIdNum)
        let overIndex = prev[overContainer].indexOf(Number(over.id))
        if (overIndex === -1) overIndex = prev[overContainer].length
        const to = [...prev[overContainer].slice(0, overIndex), activeIdNum, ...prev[overContainer].slice(overIndex)]
        return { ...prev, [activeContainer]: from, [overContainer]: to }
      })
    }

    if (!movedRef.current) return

    // Persist affected columns (auto-save, no Save button). Call the server
    // action directly from this event handler — never inside a state updater,
    // which would trigger a Router update mid-render and break the RSC stream.
    const affected = new Set<string>([activeContainer, overContainer])
    if (startContainer) affected.add(startContainer)
    void persist(containersRef.current, affected)
  }

  async function persist(state: Containers, affected: Set<string>) {
    try {
      const results = await Promise.all(
        [...affected].map((containerId) => {
          const divisionId = containerId === UNASSIGNED ? null : Number(containerId.replace("div-", ""))
          return reindexDivisionColumn({
            seasonId,
            divisionId,
            orderedTeamIds: state[containerId] ?? [],
          })
        }),
      )
      if (results.some((r) => !r.ok)) toast.error("Some placements failed to save")
      else toast.success("Placement saved", { duration: 1200 })
    } catch {
      toast.error("Failed to save placement")
    }
  }

  function handleCardClick(team: BoardTeam) {
    // Only open the panel on a genuine click, not at the end of a drag.
    if (movedRef.current) return
    setPanelTeam(team)
  }

  const [adjustingId, setAdjustingId] = useState<number | null>(null)
  async function handleAdjust(divisionId: number) {
    setAdjustingId(divisionId)
    try {
      const fd = new FormData()
      fd.set("divisionId", String(divisionId))
      const res = await adjustDivisionFixtures(fd)
      if (res.ok) {
        toast.success(`Fixtures adjusted: ${res.teams} teams · ${res.rounds} rounds`)
      } else {
        toast.error(res.error ?? "Could not adjust fixtures")
      }
    } catch {
      toast.error("Could not adjust fixtures")
    } finally {
      setAdjustingId(null)
    }
  }

  const activeTeam = activeId != null ? teamsById[activeId] : null
  const placedCount = divisions.reduce((acc, d) => acc + (containers[divContainerId(d.id)]?.length ?? 0), 0)

  // When a region is selected, only show that region's division columns.
  const visibleDivisions =
    regionFilter === "all" ? divisions : divisions.filter((d) => d.regionName === regionFilter)
  // A region typically has a handful of divisions, so once filtered we fit every
  // column on screen (no horizontal scroll) to make dragging into any easy.
  const fitToViewport = regionFilter !== "all"

  const allUnassigned = containers[UNASSIGNED] ?? []
  // When filtering by region, also keep teams that have no region at all so a
  // region-less team is never hidden and can still be dragged into a division.
  const filteredUnassigned =
    regionFilter === "all"
      ? allUnassigned
      : allUnassigned.filter((id) => {
          const region = teamsById[id]?.saplRegion
          return !region || region === regionFilter
        })
  // Highest LI first so the strongest teams are easiest to spread across divisions.
  const unassignedIds = [...filteredUnassigned].sort(
    (a, b) => (teamsById[b]?.avgLi ?? 0) - (teamsById[a]?.avgLi ?? 0),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{seasonName}</Badge>
          <span>
            {placedCount} placed · {allUnassigned.length} unassigned
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Drag teams between columns · changes save automatically</p>
      </div>

      {regionOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Region</span>
          <RegionChip active={regionFilter === "all"} onClick={() => setRegionFilter("all")}>
            All
          </RegionChip>
          {regionOptions.map((r) => (
            <RegionChip key={r} active={regionFilter === r} onClick={() => setRegionFilter(r)}>
              {r.replace("Tshwane ", "")}
            </RegionChip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="font-medium">Team type</span>
        <LegendDot className="bg-sky-500" label="Club" />
        <LegendDot className="bg-amber-500" label="Company" />
        <LegendDot className="bg-emerald-500" label="Private" />
      </div>

      <DndContext
        id="placement-board"
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className={cn("pb-2", fitToViewport ? "" : "overflow-x-auto")}>
          <div
            className="grid min-h-0 gap-3"
            style={{
              height: "calc(100dvh - 288px)",
              // When a region is selected we always show that region's full set of
              // divisions, sized to fit the screen so you can drag into any column
              // without horizontal scrolling. In "All" mode there can be many
              // divisions, so we fall back to fixed-width columns that scroll.
              gridTemplateColumns: fitToViewport
                ? `minmax(0, 1.3fr) repeat(${Math.max(visibleDivisions.length, 1)}, minmax(0, 1fr))`
                : `minmax(320px, 1.4fr) repeat(${Math.max(visibleDivisions.length, 1)}, minmax(300px, 1fr))`,
              ...(fitToViewport
                ? {}
                : {
                    minWidth: `${320 + Math.max(visibleDivisions.length, 1) * 300 + (visibleDivisions.length + 1) * 12}px`,
                  }),
            }}
          >
          <Column
            containerId={UNASSIGNED}
            title="Unassigned"
            subtitle={
              regionFilter === "all"
                ? `${unassignedIds.length} teams`
                : `${unassignedIds.length} of ${allUnassigned.length}`
            }
            teamIds={unassignedIds}
            teamsById={teamsById}
            activeId={activeId}
            onCardClick={handleCardClick}
            accent="muted"
            wide
          />
          {visibleDivisions.map((d) => {
            const ids = containers[divContainerId(d.id)] ?? []
            return (
              <Column
                key={d.id}
                containerId={divContainerId(d.id)}
                title={d.name}
                subtitle={`${ids.length}/${PLACEMENT_SLOTS}`}
                teamIds={ids}
                teamsById={teamsById}
                activeId={activeId}
                onCardClick={handleCardClick}
                showSlots
                accent="primary"
                onAdjust={ids.length >= 2 && ids.length < PLACEMENT_SLOTS ? () => handleAdjust(d.id) : undefined}
                adjusting={adjustingId === d.id}
              />
            )
          })}
          </div>
        </div>

        <DragOverlay>
          {activeTeam ? <TeamCardContent team={activeTeam} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <RosterPanel team={panelTeam} onClose={() => setPanelTeam(null)} />
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  )
}

function RegionChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Column({
  containerId,
  title,
  subtitle,
  teamIds,
  teamsById,
  activeId,
  onCardClick,
  showSlots,
  accent,
  wide,
  onAdjust,
  adjusting,
}: {
  containerId: string
  title: string
  subtitle: string
  teamIds: number[]
  teamsById: Record<number, BoardTeam>
  activeId: number | null
  onCardClick: (t: BoardTeam) => void
  showSlots?: boolean
  accent: "primary" | "muted"
  wide?: boolean
  onAdjust?: () => void
  adjusting?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: containerId })
  const emptyCount = showSlots ? Math.max(0, PLACEMENT_SLOTS - teamIds.length) : 0

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-0 flex-col rounded-xl border bg-secondary/20 p-3 transition",
        isOver ? "border-primary ring-1 ring-primary/40" : "border-border",
      )}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h3 className="flex items-center gap-2 font-heading text-sm font-semibold">
          <span className={cn("h-2 w-2 rounded-full", accent === "primary" ? "bg-primary" : "bg-muted-foreground")} />
          {title}
        </h3>
        <div className="flex items-center gap-1.5">
          {onAdjust && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-1.5 text-[10px]"
              disabled={adjusting}
              onClick={onAdjust}
              title="Rebuild this division's fixtures for the number of teams assigned"
            >
              <Wand2 className="h-3 w-3" />
              {adjusting ? "Adjusting…" : "Adjust fixtures"}
            </Button>
          )}
          <Badge variant="outline" className="text-[11px]">
            {subtitle}
          </Badge>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        <div className="flex flex-col gap-2">
          <SortableContext items={teamIds} strategy={verticalListSortingStrategy}>
            {teamIds.map((id, idx) => {
              const team = teamsById[id]
              if (!team) return null
              return (
                <SortableTeamCard
                  key={id}
                  team={team}
                  slotNumber={showSlots ? idx + 1 : undefined}
                  isActive={activeId === id}
                  onClick={() => onCardClick(team)}
                />
              )
            })}
          </SortableContext>
        </div>

        {Array.from({ length: emptyCount }).map((_, i) => (
          <EmptySlot key={`empty-${i}`} number={teamIds.length + i + 1} />
        ))}

        {!showSlots && teamIds.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-8 text-xs text-muted-foreground">
            {wide ? "No unassigned teams" : "Drop teams here"}
          </div>
        )}
      </div>
    </div>
  )
}

function SortableTeamCard({
  team,
  slotNumber,
  isActive,
  onClick,
}: {
  team: BoardTeam
  slotNumber?: number
  isActive: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: team.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {slotNumber !== undefined && (
        <span className="absolute -left-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
          {slotNumber}
        </span>
      )}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onClick}
        className="w-full cursor-grab touch-none text-left active:cursor-grabbing"
        aria-label={`${team.name}. Drag to place, or activate to view roster.`}
      >
        <TeamCardContent team={team} dragging={isDragging || isActive} />
      </button>
    </div>
  )
}

function EmptySlot({ number }: { number: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/70 bg-card/40 px-3 py-3 text-xs text-muted-foreground">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[9px] font-bold">
        {number}
      </span>
      Empty slot
    </div>
  )
}
