import type { Obstacle } from "../types"
import type { ConnectionWithGoalAlternatives } from "./ConnectionWithAlternatives"

export interface PointWithLayer {
  x: number
  y: number
  layer: string
  pcb_port_id?: string
}

export interface SimpleRouteConnection {
  name: string
  pointsToConnect: Array<PointWithLayer>
}

export interface SimpleRouteJson {
  layerCount: number
  minTraceWidth: number
  obstacles: Obstacle[]
  connections: Array<SimpleRouteConnection | ConnectionWithGoalAlternatives>
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
}
