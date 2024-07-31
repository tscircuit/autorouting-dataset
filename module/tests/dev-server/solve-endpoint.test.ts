import { test, expect } from "bun:test"
import { startDevServer } from "../../lib/server/start-dev-server"
import { getDatasetGenerator } from "../../lib/generators"
import type { AnySoupElement } from "@tscircuit/soup"
import { runChecks } from "../../lib/benchmark/run-checks"
import { autoroute } from "algos/simple-grid-based"

test("solve endpoint", async () => {
  const generator = getDatasetGenerator("single-trace")
  const soup = await generator.getExample({ seed: 0 })

  await startDevServer({
    solver: autoroute,
    solverName: "test-solver",
    port: 3082,
  })

  const response = await fetch("http://localhost:3082/solve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      problem_soup: soup,
      simple_route_json: {
        layerCount: 1,
        obstacles: [],
        connections: [],
        bounds: {
          minX: 0,
          maxX: 10,
          minY: 0,
          maxY: 10,
        },
      },
    }),
  })

  expect(response.status).toBe(200)
  const responseJson = await response.json()
  expect(runChecks(soup, soup.concat(responseJson.solution_soup))).toEqual([])
})