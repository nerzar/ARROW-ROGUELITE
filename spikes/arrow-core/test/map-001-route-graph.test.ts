import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ACT1_ROUTE_GRAPH,
  type EncounterDef,
  getAvailableRouteNodes,
  type Level,
  type RouteGraph,
  type RouteNode,
  type RunConfig,
  type RunStep,
  RunState,
  validateRouteGraph,
} from '../src/index.js'
import { levelXY } from './helpers.js'

function dummyLevel(): Level {
  return levelXY(3, 3, [
    [[1, 1], [1, 0]],
  ])
}

function dummyDef(opts: Partial<EncounterDef> = {}): EncounterDef {
  return {
    id: 'enc-test',
    title: 'Test Encounter',
    enemies: [
      {
        id: 'e1',
        label: 'Scout',
        side: 0,
        hp: 1,
      },
    ],
    rotate: { allow: [] },
    blockedTapDamage: 1,
    ...opts,
  }
}

function dummyStep(id: string, defOpts: Partial<EncounterDef> = {}): RunStep {
  return {
    id,
    title: `Step ${id}`,
    level: dummyLevel(),
    def: dummyDef(defOpts),
  }
}

describe('MAP-001: Route Graph & Act I Map Progression', () => {
  describe('Graph Topology & Validation', () => {
    it('DEFAULT_ACT1_ROUTE_GRAPH passes validation with Act I steps', () => {
      const stepIds = new Set(Array.from({ length: 18 }, (_, i) => `act1-stage-${i + 1}`))
      const res = validateRouteGraph(DEFAULT_ACT1_ROUTE_GRAPH, stepIds)
      expect(res.ok).toBe(true)
      expect(res.errors).toEqual([])
    })

    it('detects invalid graphs (missing entries, invalid next, missing boss, unknown stepId)', () => {
      const invalidGraph: RouteGraph = {
        id: 'invalid-test',
        title: 'Broken Graph',
        entryNodeIds: ['missing-entry'],
        nodes: {
          'n1': {
            id: 'n1',
            type: 'battle',
            title: 'N1',
            stepId: 'unknown-step',
            next: ['missing-target'],
          },
        },
      }
      const validStepIds = new Set(['step-1'])
      const res = validateRouteGraph(invalidGraph, validStepIds)
      expect(res.ok).toBe(false)
      expect(res.errors.some((e) => e.includes('Entry node "missing-entry"'))).toBe(true)
      expect(res.errors.some((e) => e.includes('points to non-existent next node'))).toBe(true)
      expect(res.errors.some((e) => e.includes('references unknown stepId'))).toBe(true)
      expect(res.errors.some((e) => e.includes('must contain at least one boss node'))).toBe(true)
    })

    it('getAvailableRouteNodes returns entry nodes when currentNodeId is null', () => {
      const entries = getAvailableRouteNodes(DEFAULT_ACT1_ROUTE_GRAPH, null)
      expect(entries.map((n) => n.id)).toEqual(['node-1a', 'node-1b'])
    })

    it('getAvailableRouteNodes returns reachable next nodes from current position', () => {
      const nextFrom1a = getAvailableRouteNodes(DEFAULT_ACT1_ROUTE_GRAPH, 'node-1a')
      expect(nextFrom1a.map((n) => n.id)).toEqual(['node-2a', 'node-2b'])

      const nextFrom1b = getAvailableRouteNodes(DEFAULT_ACT1_ROUTE_GRAPH, 'node-1b')
      expect(nextFrom1b.map((n) => n.id)).toEqual(['node-2b', 'node-2c'])

      const nextFromBoss = getAvailableRouteNodes(DEFAULT_ACT1_ROUTE_GRAPH, 'node-boss')
      expect(nextFromBoss).toEqual([])
    })
  })

  describe('RunState Route Map Progression', () => {
    const steps: RunStep[] = Array.from({ length: 18 }, (_, i) => dummyStep(`act1-stage-${i + 1}`))

    it('initializes on entryNodeIds[0] by default when routeGraph is provided', () => {
      const run = new RunState({ playerMaxHp: 10, routeGraph: DEFAULT_ACT1_ROUTE_GRAPH }, steps)
      expect(run.hasRouteGraph).toBe(true)
      expect(run.currentNodeId).toBe('node-1a')
      expect(run.currentStep.id).toBe('act1-stage-1')
      expect(run.routeMapPending).toBe(false)
      expect(run.inShop).toBe(false)
      expect(run.isFirstStep).toBe(true)
      expect(run.visitedNodeIds).toEqual([])
    })

    it('allows starting on route map when startOnRouteMap: true', () => {
      const run = new RunState({ playerMaxHp: 10, routeGraph: DEFAULT_ACT1_ROUTE_GRAPH, startOnRouteMap: true }, steps)
      expect(run.hasRouteGraph).toBe(true)
      expect(run.currentNodeId).toBeNull()
      expect(run.routeMapPending).toBe(true)
      expect(run.availableRouteNodeIds).toEqual(['node-1a', 'node-1b'])

      // Select entry fork: choose node-1b
      expect(run.selectRouteNode('node-1b')).toBe(true)
      expect(run.currentNodeId).toBe('node-1b')
      expect(run.currentStep.id).toBe('act1-stage-2')
      expect(run.routeMapPending).toBe(false)
    })

    it('progresses through a real fork: battle 1 -> reward -> route map -> battle 2a or 2b', () => {
      const run = new RunState({ playerMaxHp: 10, routeGraph: DEFAULT_ACT1_ROUTE_GRAPH }, steps)
      expect(run.currentNodeId).toBe('node-1a')

      // Win encounter on node-1a
      run.encounter.tap(0)
      expect(run.encounter.won).toBe(true)
      expect(run.rewardPending).toBe(true)
      run.chooseReward(0) // take gold
      expect(run.rewardPending).toBe(false)

      // Advance transitions to route map
      expect(run.advance()).toBe(true)
      expect(run.routeMapPending).toBe(true)
      expect(run.visitedNodeIds).toEqual(['node-1a'])
      expect(run.availableRouteNodeIds).toEqual(['node-2a', 'node-2b'])

      // Cannot select non-available node
      expect(run.selectRouteNode('node-2c')).toBe(false)
      expect(run.selectRouteNode('node-boss')).toBe(false)

      // Choose branch node-2a
      expect(run.selectRouteNode('node-2a')).toBe(true)
      expect(run.currentNodeId).toBe('node-2a')
      expect(run.currentStep.id).toBe('act1-stage-3')
      expect(run.routeMapPending).toBe(false)

      // Win encounter on node-2a
      run.encounter.tap(0)
      expect(run.encounter.won).toBe(true)
      run.skipReward()
      expect(run.advance()).toBe(true)

      expect(run.routeMapPending).toBe(true)
      expect(run.visitedNodeIds).toEqual(['node-1a', 'node-2a'])
      expect(run.availableRouteNodeIds).toEqual(['node-3-shop', 'node-3a'])
    })

    it('handles shop node flow: select shop -> inShop -> leaveShop -> route map continues', () => {
      const run = new RunState({ playerMaxHp: 10, routeGraph: DEFAULT_ACT1_ROUTE_GRAPH }, steps)
      run.debugJumpToNode('node-2a')
      run.encounter.tap(0)
      run.skipReward()
      run.advance()

      expect(run.availableRouteNodeIds).toContain('node-3-shop')
      expect(run.selectRouteNode('node-3-shop')).toBe(true)
      expect(run.inShop).toBe(true)
      expect(run.currentNodeId).toBe('node-3-shop')
      expect(run.routeMapPending).toBe(false)

      // Leaving shop completes shop node beat and opens route map
      run.leaveShop()
      expect(run.inShop).toBe(false)
      expect(run.routeMapPending).toBe(true)
      expect(run.visitedNodeIds).toContain('node-3-shop')
      expect(run.availableRouteNodeIds).toEqual(['node-4a', 'node-4b'])
    })

    it('boss node finishes the route map and runWon is true on boss victory', () => {
      const run = new RunState({ playerMaxHp: 10, routeGraph: DEFAULT_ACT1_ROUTE_GRAPH }, steps)
      run.debugJumpToNode('node-boss')
      expect(run.currentNodeId).toBe('node-boss')
      expect(run.currentStep.id).toBe('act1-stage-18')
      expect(run.isLastStep).toBe(true)
      expect(run.runWon).toBe(false)

      // Win boss encounter
      run.encounter.tap(0)
      expect(run.encounter.won).toBe(true)
      expect(run.runWon).toBe(true)

      // advance() after boss is a no-op
      expect(run.advance()).toBe(false)
    })

    it('restartStep returns to snapshot of active node; restartRun resets to start', () => {
      const run = new RunState({ playerMaxHp: 10, routeGraph: DEFAULT_ACT1_ROUTE_GRAPH }, steps)
      run.debugJumpToNode('node-2b')
      expect(run.currentNodeId).toBe('node-2b')

      run.restartStep()
      expect(run.currentNodeId).toBe('node-2b')
      expect(run.currentStep.id).toBe('act1-stage-4')

      run.restartRun()
      expect(run.currentNodeId).toBe('node-1a')
      expect(run.visitedNodeIds).toEqual([])
      expect(run.currentStep.id).toBe('act1-stage-1')
    })

    it('save/load faithfully round-trips route node, visited history, and pending states', () => {
      const cfg: RunConfig = { playerMaxHp: 10, routeGraph: DEFAULT_ACT1_ROUTE_GRAPH, runSeed: 5 }
      const run = new RunState(cfg, steps)

      // Beat node 1a
      run.encounter.tap(0)
      run.chooseReward(0) // gold
      run.advance()
      expect(run.routeMapPending).toBe(true)

      // Pick shop
      run.selectRouteNode('node-2a')
      run.encounter.tap(0)
      run.skipReward()
      run.advance()
      run.selectRouteNode('node-3-shop')
      expect(run.inShop).toBe(true)

      // Save in shop
      const saveInShop = JSON.parse(JSON.stringify(run.toJSON()))
      const restoredInShop = RunState.fromJSON(cfg, steps, saveInShop)
      expect(restoredInShop.currentNodeId).toBe('node-3-shop')
      expect(restoredInShop.inShop).toBe(true)
      expect(restoredInShop.visitedNodeIds).toEqual(['node-1a', 'node-2a'])

      // Leave shop and save on map
      restoredInShop.leaveShop()
      expect(restoredInShop.routeMapPending).toBe(true)

      const saveOnMap = JSON.parse(JSON.stringify(restoredInShop.toJSON()))
      const restoredOnMap = RunState.fromJSON(cfg, steps, saveOnMap)
      expect(restoredOnMap.routeMapPending).toBe(true)
      expect(restoredOnMap.currentNodeId).toBe('node-3-shop')
      expect(restoredOnMap.visitedNodeIds).toEqual(['node-1a', 'node-2a', 'node-3-shop'])
      expect(restoredOnMap.availableRouteNodeIds).toEqual(['node-4a', 'node-4b'])
    })
  })

  describe('Linear Fallback Mode (No Route Graph)', () => {
    it('behaves 100% identically to original linear campaign when routeGraph is omitted', () => {
      const linearSteps = [dummyStep('s1'), dummyStep('s2'), dummyStep('s3')]
      const run = new RunState({ playerMaxHp: 10 }, linearSteps)

      expect(run.hasRouteGraph).toBe(false)
      expect(run.currentNodeId).toBeNull()
      expect(run.routeMapPending).toBe(false)
      expect(run.inShop).toBe(false)
      expect(run.stepIndex).toBe(0)
      expect(run.isFirstStep).toBe(true)
      expect(run.isLastStep).toBe(false)

      run.encounter.tap(0)
      run.skipReward()
      expect(run.advance()).toBe(true)
      expect(run.stepIndex).toBe(1)
      expect(run.routeMapPending).toBe(false)

      run.encounter.tap(0)
      run.skipReward()
      expect(run.advance()).toBe(true)
      expect(run.stepIndex).toBe(2)
      expect(run.isLastStep).toBe(true)

      run.encounter.tap(0)
      expect(run.runWon).toBe(true)
      expect(run.advance()).toBe(false)
    })
  })
})
