#!/usr/bin/env bun
import { autoroute } from "algos/simple-grid"
import { startDevServer } from "server"
import { AVAILABLE_DATASETS } from "../module/lib/server/available-datasets"
import { AVAILABLE_SOLVERS } from "../module/lib/server/available-solvers"
import Path from "node:path"
import fs from "node:fs/promises"

const SLOW_OR_OLD_SOLVERS: Array<(typeof AVAILABLE_SOLVERS)[number]> = [
  "infgrid-astar",
  "jump-point-grid",
]

const solversForBuild = AVAILABLE_SOLVERS.filter(
  (solver) => !SLOW_OR_OLD_SOLVERS.includes(solver),
)

// 1. Run the server
const devServer = await startDevServer({
  solver: autoroute,
  solverName: "simple-grid",
  solverLink:
    "https://github.com/tscircuit/autorouting-dataset/blob/main/algos/simple-grid/index.ts",
  port: 3081,
})

const outputDir = "./static-server"

await fs.mkdir(outputDir, { recursive: true })

const downloadAndSave = async (path: string) => {
  const url = `http://localhost:3081${path}`
  const filepath = Path.join(outputDir, path)
  console.log(`Downloading ${url} to ${filepath}`)
  const content = await fetch(url).then((res) => res.text())
  await fs.writeFile(filepath, content)
}

// Download all the relevant urls
const sampleCount = 10

await downloadAndSave(`/available-datasets.json`)
await downloadAndSave(`/index.html`)
await fs.mkdir(Path.join(outputDir, "assets"), { recursive: true })
await downloadAndSave(`/assets/index.js`)
for (const problemType of AVAILABLE_DATASETS) {
  for (let i = 0; i < sampleCount; i++) {
    const problemDir = Path.join(
      outputDir,
      "problem",
      problemType,
      (i + 1).toString(),
    )
    await fs.mkdir(problemDir, { recursive: true })
    await downloadAndSave(`/problem/${problemType}/${i + 1}/index.html`)
    await downloadAndSave(`/problem/${problemType}/${i + 1}.json`)
    await downloadAndSave(`/problem/${problemType}/${i + 1}.solution.json`)

    for (const solver of AVAILABLE_SOLVERS) {
      await fs.mkdir(Path.join(problemDir, solver), { recursive: true })
      await downloadAndSave(
        `/problem/${problemType}/${i + 1}/${solver}/index.html`,
      )
      await downloadAndSave(
        `/problem/${problemType}/${i + 1}/${solver}/problem.json`,
      )
      await downloadAndSave(
        `/problem/${problemType}/${i + 1}/${solver}/solution.json`,
      )
    }
  }
}

// Clean up
devServer.close()
