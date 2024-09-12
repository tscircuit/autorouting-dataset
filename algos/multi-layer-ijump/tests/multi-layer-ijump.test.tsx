import { getSimpleRouteJson } from "autorouting-dataset"
import { test, expect } from "bun:test"
import { circuitJsonToPcbSvg } from "circuit-to-svg"
import { IJumpAutorouter } from "../v2"
import { Circuit } from "@tscircuit/core"
import { transformPCBElements } from "@tscircuit/soup-util"
import { translate } from "transformation-matrix"
import type { AnySoupElement } from "@tscircuit/soup"
import { getDebugSvg } from "../../infinite-grid-ijump-astar/tests/fixtures/get-debug-svg"
import { IJumpMultiLayer } from "../IJumpMultiLayer"

const OneByOnePad = (props: { name: string; pcbX?: number; pcbY?: number }) => (
  <chip name={props.name} pcbX={props.pcbX} pcbY={props.pcbY}>
    <footprint>
      <smtpad
        pcbX={0}
        pcbY={0}
        shape="rect"
        width="1mm"
        height="1mm"
        portHints={["pin1"]}
      />
    </footprint>
  </chip>
)

test("multimargin-ijump-astar simple", () => {
  const circuit = new Circuit()

  circuit.add(
    <board width="10mm" height="2mm" routingDisabled>
      <OneByOnePad name="U1" pcbX={-3} />
      <OneByOnePad name="U2" pcbX={3} />
      <OneByOnePad name="U_obstacle" pcbX={0} pcbY={0} />
      <trace from=".U1 > .pin1" to=".U2 > .pin1" />
    </board>,
  )

  const inputCircuitJson = circuit.getCircuitJson()

  const input = getSimpleRouteJson(inputCircuitJson)

  const autorouter = new IJumpMultiLayer({
    input,
    layerCount: 2,
    debug: true,
  })

  const solution = autorouter.solveAndMapToTraces()

  expect(
    getDebugSvg({ inputCircuitJson, autorouter, solution }),
  ).toMatchSvgSnapshot(import.meta.path)

  expect(solution).toHaveLength(1)
})
