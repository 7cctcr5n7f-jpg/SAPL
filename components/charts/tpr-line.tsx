"use client"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

export function TprLine({ data }: { data: { label: string; tpr: number }[] }) {
  if (data.length < 2) {
    return <p className="text-sm text-muted-foreground">Not enough match history yet to chart a trend.</p>
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={["dataMin - 20", "dataMax + 20"]}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 0,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-muted-foreground)" }}
          />
          <Line
            type="monotone"
            dataKey="tpr"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--color-primary)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
