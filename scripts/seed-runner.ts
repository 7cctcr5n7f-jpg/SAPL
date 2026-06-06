import { runSeed } from "@/lib/seed"

runSeed()
  .then((summary) => {
    console.log("[seed] complete:", JSON.stringify(summary))
    process.exit(0)
  })
  .catch((err) => {
    console.error("[seed] failed:", err)
    process.exit(1)
  })
