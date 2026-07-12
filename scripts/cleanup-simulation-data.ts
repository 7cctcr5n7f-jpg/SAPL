import { cleanupSimulationData } from "@/scripts/simulation-cleanup"

async function main() {
  const runId = process.argv[2]
  const result = await cleanupSimulationData({ runId, includeHistorical: !runId })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

