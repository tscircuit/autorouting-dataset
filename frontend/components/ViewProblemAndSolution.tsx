import { PCBViewer } from "@tscircuit/pcb-viewer"
import type { AnySoupElement } from "@tscircuit/soup"
import { useState } from "react"
import { DatasetNavigation } from "./DatasetNavigation"
import { ErrorBoundary } from "react-error-boundary"

declare global {
  interface Window {
    PROBLEM_SOUP: AnySoupElement[]
    SOLUTION_SOUP: AnySoupElement[]
    HAS_CUSTOM_SOLVER?: string
    USER_MESSAGE?: string
  }
}

export default () => {
  const hasPreloadedSoup = Boolean(window.PROBLEM_SOUP || window.SOLUTION_SOUP)
  const hasSolver = Boolean(window.HAS_CUSTOM_SOLVER)
  const [pastedSoup, setPastedSoup] = useState<AnySoupElement[]>()
  // Derive problem from url (if present)
  const [, , selectedProblemType, seedStr] = window.location.pathname.split("/")
  const seed = seedStr ? Number.parseInt(seedStr) : 0
  const problemSoup = window.PROBLEM_SOUP
  const solutionSoup = window.SOLUTION_SOUP

  if (!hasPreloadedSoup) {
    return (
      <div>
        {!pastedSoup ? (
          <>
            <DatasetNavigation />
            <h2>No soup preloaded, paste soup json below to display it</h2>
            <textarea
              style={{ minWidth: "50vw", minHeight: "50vh" }}
              onChange={(e) => {
                if (e.target.value.length > 10) {
                  try {
                    setPastedSoup(JSON.parse(e.target.value))
                  } catch (e) {
                    console.log("Error parsing soup json", e)
                  }
                }
              }}
            />
          </>
        ) : (
          <div style={{ width: "100vw", height: "100vh" }}>
            <ErrorBoundary
              fallbackRender={({ error }) => (
                <div>Error rendering problem: {error.message}</div>
              )}
            >
              <PCBViewer soup={pastedSoup} />
            </ErrorBoundary>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <DatasetNavigation />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ flex: 1, marginRight: "10px" }}>
          <h2>Problem</h2>
          {problemSoup ? (
            <PCBViewer soup={problemSoup} />
          ) : (
            "No problem preloaded"
          )}
        </div>
        <div style={{ flex: 1, marginLeft: "10px" }}>
          <h2>
            Solution {hasSolver ? "" : "(tscircuit solver)"}{" "}
            <a href={`/problem/${selectedProblemType}/${seed}.solution.json`}>
              download (json)
            </a>
          </h2>
          <ErrorBoundary
            fallbackRender={({ error }) => (
              <div>Error rendering solution: {error.message}</div>
            )}
          >
            {solutionSoup ? (
              <PCBViewer soup={solutionSoup} />
            ) : (
              "No solution preloaded"
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}