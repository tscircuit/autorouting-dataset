import type { AnySoupElement } from "@tscircuit/soup"
import type { ProblemSolver } from "../solver-utils/ProblemSolver"

export type AppContext = {
  solver?: ProblemSolver
  solverName?: string
  defaultSolverName?: string
  solverLink?: string
}
