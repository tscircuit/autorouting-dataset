export type SimplifiedPcbTrace = {
  type: "pcb_trace"
  pcb_trace_id: string
  route: Array<
    | {
        route_type: "wire"
        x: number
        y: number
        width: number
        layer: string
      }
    | {
        route_type: "via"
        from_layer: string
        to_layer: string
        x: number
        y: number
      }
  >
}

export interface Point {
  x: number
  y: number
}

export type Obstacle = {
  // TODO include ovals
  type: "rect" // NOTE: most datasets do not contain ovals
  layers: string[]
  center: { x: number; y: number }
  width: number
  height: number
  connectedTo: string[]
}

export interface ObstacleWithEdges extends Obstacle {
  top: number
  bottom: number
  left: number
  right: number
}

export type Edge = "top" | "bottom" | "left" | "right"
