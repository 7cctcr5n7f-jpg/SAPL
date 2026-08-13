"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ReactNode } from "react"

export function SeasonsSectionsTabs({
  setupContent,
  exportsContent,
  checkerContent,
}: {
  setupContent: ReactNode
  exportsContent: ReactNode
  checkerContent: ReactNode
}) {
  return (
    <Tabs defaultValue="setup">
      <TabsList>
        <TabsTrigger value="setup">Season setup</TabsTrigger>
        <TabsTrigger value="exports">Exports</TabsTrigger>
        <TabsTrigger value="checker">Fixture checker</TabsTrigger>
      </TabsList>
      <TabsContent value="setup">{setupContent}</TabsContent>
      <TabsContent value="exports">{exportsContent}</TabsContent>
      <TabsContent value="checker">{checkerContent}</TabsContent>
    </Tabs>
  )
}
