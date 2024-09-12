import { GeneralizedAstarAutorouter } from "algos/infinite-grid-ijump-astar/v2/lib/GeneralizedAstar"
import { getDistanceToOvercomeObstacle } from "algos/infinite-grid-ijump-astar/v2/lib/getDistanceToOvercomeObstacle"
import type {
  Direction,
  Point,
  PointWithObstacleHit,
  Node,
  DirectionWithCollisionInfo,
} from "algos/infinite-grid-ijump-astar/v2/lib/types"
import {
  distAlongDir,
  manDist,
} from "algos/infinite-grid-ijump-astar/v2/lib/util"
import type {
  Direction3d,
  DirectionWithCollisionInfo3d,
  Node3d,
  Point3dWithObstacleHit,
} from "./types"
import { dirFromAToB, getLayerIndex, indexToLayer } from "./util"
import type {
  SimpleRouteConnection,
  SimpleRouteJson,
} from "autorouting-dataset/lib/solver-utils/SimpleRouteJson"
import { ObstacleList3d } from "./ObstacleList3d"
import type { Obstacle } from "autorouting-dataset/lib/types"

export class IJumpMultiLayer extends GeneralizedAstarAutorouter {
  MAX_ITERATIONS: number = 20
  VIA_COST: number = 10 // Define the cost for changing layers
  allowLayerChange: boolean = true // Flag to allow layer changes
  layerCount: number
  obstacles: ObstacleList3d

  /**
   * For a multi-margin autorouter, we penalize traveling close to the wall
   *
   * The best way to compute cost is to multiple the travelMargin cost factor by
   * the distance traveled by along the wall and add the enterMargin cost factor
   * whenever we enter a new margin
   *
   * MUST BE ORDERED FROM HIGHEST MARGIN TO LOWEST (TODO sort in constructor)
   */
  marginsWithCosts: Array<{
    margin: number
    enterCost: number
    travelCostFactor: number
  }> = [
    {
      margin: 1,
      enterCost: 0,
      travelCostFactor: 1,
    },
    {
      margin: 0.15,
      enterCost: 10,
      travelCostFactor: 2,
    },
  ]

  get largestMargin() {
    return this.marginsWithCosts[0].margin
  }

  constructor(opts: {
    input: SimpleRouteJson
    startNode?: Node
    goalPoint?: Point
    GRID_STEP?: number
    OBSTACLE_MARGIN?: number
    MAX_ITERATIONS?: number
    layerCount?: number
    isRemovePathLoopsEnabled?: boolean
    debug?: boolean
  }) {
    super(opts)
    this.layerCount = opts.layerCount ?? 2

    // obstacle lists are created when solving currently
    this.obstacles = null as any // new ObstacleList3d(this.layerCount, this.allObstacles)
  }

  createObstacleList({
    dominantLayer,
    connection,
    obstaclesFromTraces,
  }: {
    dominantLayer?: string
    connection: SimpleRouteConnection
    obstaclesFromTraces: Obstacle[]
  }): ObstacleList3d {
    return new ObstacleList3d(
      this.layerCount,
      this.allObstacles
        .filter((obstacle) => !obstacle.connectedTo.includes(connection.name))
        .concat(obstaclesFromTraces ?? []),
    )
  }

  computeG(current: Node3d, neighbor: Node3d): number {
    let cost =
      current.g +
      manDist(current, neighbor) * (current.travelMarginCostFactor ?? 1) +
      (neighbor.enterMarginCost ?? 0)
    if (neighbor.l ?? -1 !== current.l ?? -1) {
      cost += this.VIA_COST
    }
    return cost
  }

  computeH(node: Node3d): number {
    const dx = Math.abs(node.x - this.goalPoint!.x)
    const dy = Math.abs(node.y - this.goalPoint!.y)
    const dl = Math.abs(node.l - (this.goalPoint as any).l)
    return dx + dy + dl * this.VIA_COST
  }

  getStartNode(connection: SimpleRouteConnection): Node3d {
    return {
      ...super.getStartNode(connection),
      l: this.layerToIndex(connection.pointsToConnect[0].layer),
    } as any
  }

  layerToIndex(layer: string): number {
    return getLayerIndex(this.layerCount, layer)
  }
  indexToLayer(index: number): string {
    return indexToLayer(this.layerCount, index)
  }

  getNeighbors(node: Node3d): Array<Point3dWithObstacleHit> {
    const obstacles = this.obstacles!
    const goalPoint: Node3d = this.goalPoint! as any

    /**
     * This is considered "forward" if we were to continue from the parent,
     * through the current node.
     */
    let forwardDir: Direction3d
    if (!node.parent) {
      forwardDir = dirFromAToB(node, goalPoint)
    } else {
      forwardDir = dirFromAToB(node.parent, node)
    }

    /**
     * Get the possible next directions (excluding backwards direction), and
     * excluding the forward direction if we just ran into a wall
     */
    const travelDirs1: Array<Direction3d> = [
      { dx: 0, dy: 1, dl: 0 },
      { dx: 1, dy: 0, dl: 0 },
      { dx: 0, dy: -1, dl: 0 },
      { dx: -1, dy: 0, dl: 0 },
    ]

    if (this.allowLayerChange) {
      // travelDirs1.push({ dx: 0, dy: 0, dl: 1 })
      // travelDirs1.push({ dx: 0, dy: 0, dl: -1 })
    }

    const travelDirs2 = travelDirs1
      .filter((dir) => {
        // If we have a parent, don't go backwards towards the parent
        if (
          dir.dx === forwardDir.dx * -1 &&
          dir.dy === forwardDir.dy * -1 &&
          dir.dl === forwardDir.dl * -1
        ) {
          return false
        } else if (
          dir.dx === forwardDir.dx &&
          dir.dy === forwardDir.dy &&
          dir.dl === forwardDir.dl &&
          node.parent?.obstacleHit
        ) {
          return false
        }
        return true
      })
      .map((dir) => {
        const collisionInfo = obstacles.getOrthoDirectionCollisionInfo(
          node,
          dir,
          {
            margin: this.OBSTACLE_MARGIN,
          },
        )

        return collisionInfo
      })
      // Filter out directions that are too close to the wall
      .filter((dir) => !(dir.wallDistance <= this.OBSTACLE_MARGIN))

    /**
     * Figure out how far to travel. There are a couple reasons we would stop
     * traveling:
     * - A different direction opened up while we were traveling (the obstacle
     *   our parent hit was overcome)
     * - We hit a wall
     * - We passed the goal along the travel direction
     */
    const travelDirs3: Array<
      DirectionWithCollisionInfo3d & {
        travelDistance: number
        travelMarginCostFactor: number
        enterMarginCost: number
      }
    > = []
    for (const travelDir of travelDirs2) {
      let overcomeDistance: number | null = null
      if (node?.obstacleHit) {
        overcomeDistance = getDistanceToOvercomeObstacle({
          node,
          travelDir,
          wallDir: { ...forwardDir, wallDistance: this.OBSTACLE_MARGIN },
          obstacle: node.obstacleHit,
          obstacles,
          OBSTACLE_MARGIN: this.OBSTACLE_MARGIN,
          SHOULD_DETECT_CONJOINED_OBSTACLES: true,
        })
      }

      const goalDistAlongTravelDir = distAlongDir(node, goalPoint, travelDir)
      const isGoalInTravelDir =
        (travelDir.dx === 0 ||
          Math.sign(goalPoint.x - node.x) === travelDir.dx) &&
        (travelDir.dy === 0 || Math.sign(goalPoint.y - node.y) === travelDir.dy)

      if (
        goalDistAlongTravelDir < travelDir.wallDistance &&
        goalDistAlongTravelDir > 0 &&
        isGoalInTravelDir
      ) {
        travelDirs3.push({
          ...travelDir,
          travelDistance: goalDistAlongTravelDir,
          enterMarginCost: 0,
          travelMarginCostFactor: 1,
        })
      } else if (
        overcomeDistance !== null &&
        overcomeDistance < travelDir.wallDistance
      ) {
        for (const { margin, enterCost, travelCostFactor } of this
          .marginsWithCosts) {
          if (
            overcomeDistance - this.OBSTACLE_MARGIN + margin * 2 <
            travelDir.wallDistance
          ) {
            travelDirs3.push({
              ...travelDir,
              travelDistance: overcomeDistance - this.OBSTACLE_MARGIN + margin,
              enterMarginCost: enterCost,
              travelMarginCostFactor: travelCostFactor,
            })
          }
        }
        if (travelDir.wallDistance === Infinity) {
          travelDirs3.push({
            ...travelDir,
            travelDistance: goalDistAlongTravelDir,
            enterMarginCost: 0,
            travelMarginCostFactor: 1,
          })
        } else if (travelDir.wallDistance > this.largestMargin) {
          for (const { margin, enterCost, travelCostFactor } of this
            .marginsWithCosts) {
            if (travelDir.wallDistance > this.largestMargin + margin) {
              travelDirs3.push({
                ...travelDir,
                travelDistance: travelDir.wallDistance - margin,
                enterMarginCost: enterCost,
                travelMarginCostFactor: travelCostFactor,
              })
            }
          }
        }
      } else if (travelDir.wallDistance !== Infinity) {
        for (const { margin, enterCost, travelCostFactor } of this
          .marginsWithCosts) {
          if (travelDir.wallDistance > margin) {
            travelDirs3.push({
              ...travelDir,
              travelDistance: travelDir.wallDistance - margin,
              enterMarginCost: enterCost,
              travelMarginCostFactor: travelCostFactor,
            })
          }
        }
      }
    }

    // for (const travelDir of travelDirs2) {
    //   let travelDistance: number

    //   // For layer changes, the travel distance is always 1
    //   if (travelDir.dl !== 0) {
    //     travelDistance = 1
    //   } else {
    //     travelDistance = travelDir.wallDistance - this.largestMargin
    //   }

    //   if (travelDistance <= 0) continue

    //   // Check for obstacles at the target position
    //   const targetX = node.x + travelDir.dx * travelDistance
    //   const targetY = node.y + travelDir.dy * travelDistance
    //   const targetL = node.l + travelDir.dl

    //   if (obstacles.isObstacleAt(targetX, targetY, targetL)) continue

    //   // Add the neighbor with appropriate costs
    //   travelDirs2.push({
    //     ...travelDir,
    //     travelDistance,
    //     enterMarginCost: 0,
    //     travelMarginCostFactor: 1,
    //   })
    // }

    console.log(this.iterations, { travelDirs2 })

    return travelDirs3.map((dir) => ({
      x: node.x + dir.dx * dir.travelDistance,
      y: node.y + dir.dy * dir.travelDistance,
      l: node.l + dir.dl,
      obstacleHit: dir.obstacle,
      travelMarginCostFactor: dir.travelMarginCostFactor,
      enterMarginCost: dir.enterMarginCost,
    }))
  }
}
