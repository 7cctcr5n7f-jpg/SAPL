"use client"

import { useState } from "react"
import { updatePlayerSettings } from "@/lib/actions/player-settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface MarketplaceSettingsProps {
  isPlayer: boolean
  onMarketplace: boolean
  isOnTeam: boolean
}

export function MarketplaceSettings({ isPlayer, onMarketplace, isOnTeam }: MarketplaceSettingsProps) {
  const [localIsPlayer, setLocalIsPlayer] = useState(isPlayer)
  const [localOnMarketplace, setLocalOnMarketplace] = useState(onMarketplace)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      const result = await updatePlayerSettings({
        isPlayer: localIsPlayer,
        onMarketplace: localOnMarketplace,
      })

      if (!result.ok) {
        toast.error(result.error || "Failed to update settings")
        setLocalIsPlayer(isPlayer)
        setLocalOnMarketplace(onMarketplace)
      } else {
        toast.success("Settings updated successfully")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = localIsPlayer !== isPlayer || localOnMarketplace !== onMarketplace

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Marketplace Settings</CardTitle>
        <CardDescription>Control your player status and marketplace visibility</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Player Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="is-player" className="font-medium">
              I am a player
            </Label>
            <Switch
              id="is-player"
              checked={localIsPlayer}
              onCheckedChange={(checked) => {
                setLocalIsPlayer(checked)
                // If turning off player status, also turn off marketplace
                if (!checked) {
                  setLocalOnMarketplace(false)
                }
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground ml-6">
            Mark yourself as a player if you want to join teams or search for opportunities.
          </p>
        </div>

        {/* Marketplace Visibility */}
        <div className="space-y-3" style={{ opacity: localIsPlayer ? 1 : 0.5 }}>
          <div className="flex items-center justify-between">
            <Label htmlFor="on-marketplace" className="font-medium">
              Show me on the marketplace
            </Label>
            <Switch
              id="on-marketplace"
              checked={localOnMarketplace}
              onCheckedChange={(checked) => {
                if (localIsPlayer) {
                  setLocalOnMarketplace(checked)
                }
              }}
              disabled={!localIsPlayer || isOnTeam}
            />
          </div>
          <p className="text-sm text-muted-foreground ml-6">
            {isOnTeam
              ? "You cannot be on the marketplace while you&apos;re part of a team. Leave your team first."
              : "Allow captains to discover your profile when looking for players to join their team."}
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || loading || (!localIsPlayer && localOnMarketplace)}
          className="mt-4"
        >
          {loading ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  )
}
