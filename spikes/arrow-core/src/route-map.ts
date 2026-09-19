// MAP-001: Data-driven Route Graph and map topology for roguelite campaign progression.
// Supports battle, shop, and boss nodes, branching paths, visited/available state, and graph validation.

export type RouteNodeType = 'battle' | 'shop' | 'boss'

export interface RouteNode {
  /** Unique id within the map graph, e.g. "node-1a" */
  id: string
  /** Node archetype */
  type: RouteNodeType
  /** Human-readable title */
  title: string
  /** For 'battle' | 'boss': references a RunStep id (e.g. "act1-stage-1") */
  stepId?: string
  /** Outgoing connections: node IDs reachable from this node */
  next: string[]
  /** Visual tier / column (0-indexed layer, e.g. 0 to 6) */
  layer?: number
  /** Visual row / lane (0-indexed vertical offset) */
  row?: number
  /** Optional narrative or tactical brief */
  description?: string
}

export interface RouteGraph {
  /** Unique identifier for the act / map, e.g. "act1-goblin-country" */
  id: string
  /** Map title */
  title: string
  /** Entry node IDs available at the beginning of the route */
  entryNodeIds: string[]
  /** All nodes in the graph keyed by node id */
  nodes: Record<string, RouteNode>
}

export interface RouteGraphValidation {
  ok: boolean
  errors: string[]
}

/** Validates graph connectivity, node integrity, and step linkages. */
export function validateRouteGraph(graph: RouteGraph, validStepIds?: Set<string>): RouteGraphValidation {
  const errors: string[] = []
  if (!graph.id) errors.push('Route graph missing id')
  if (!graph.entryNodeIds || graph.entryNodeIds.length === 0) {
    errors.push('Route graph must have at least one entry node')
  }
  if (!graph.nodes || Object.keys(graph.nodes).length === 0) {
    errors.push('Route graph must contain nodes')
  }
  for (const entryId of graph.entryNodeIds ?? []) {
    if (!graph.nodes[entryId]) {
      errors.push(`Entry node "${entryId}" not found in nodes dictionary`)
    }
  }
  let hasBossNode = false
  for (const [id, node] of Object.entries(graph.nodes ?? {})) {
    if (node.id !== id) {
      errors.push(`Node key "${id}" does not match node.id "${node.id}"`)
    }
    if (node.type === 'boss') {
      hasBossNode = true
    }
    if ((node.type === 'battle' || node.type === 'boss') && node.stepId && validStepIds) {
      if (!validStepIds.has(node.stepId)) {
        errors.push(`Node "${id}" references unknown stepId "${node.stepId}"`)
      }
    }
    for (const nextId of node.next ?? []) {
      if (!graph.nodes[nextId]) {
        errors.push(`Node "${id}" points to non-existent next node "${nextId}"`)
      }
    }
  }
  if (!hasBossNode) {
    errors.push('Route graph must contain at least one boss node')
  }
  return { ok: errors.length === 0, errors }
}

/**
 * Returns the nodes currently reachable given current location and visited history.
 * If current is null, returns all entry nodes.
 */
export function getAvailableRouteNodes(
  graph: RouteGraph,
  currentNodeId: string | null,
  visitedNodeIds: readonly string[] = [],
): RouteNode[] {
  if (!currentNodeId) {
    return graph.entryNodeIds.map((id) => graph.nodes[id]).filter(Boolean)
  }
  const curr = graph.nodes[currentNodeId]
  if (!curr) return []
  return (curr.next ?? []).map((id) => graph.nodes[id]).filter(Boolean)
}

/**
 * Canonical Act I «Страна гоблинов» Route Graph.
 * Organizes the 18 Act I stages with multiple genuine forks, 2 shop beats, and the final boss.
 */
export const DEFAULT_ACT1_ROUTE_GRAPH: RouteGraph = {
  id: 'act1-goblin-country',
  title: 'Страна гоблинов',
  entryNodeIds: ['node-1a', 'node-1b'],
  nodes: {
    // Tier 0: Entrance (Fork 1)
    'node-1a': {
      id: 'node-1a',
      type: 'battle',
      title: 'Гоблинский патруль',
      stepId: 'act1-stage-1',
      layer: 0,
      row: 0,
      next: ['node-2a', 'node-2b'],
      description: 'Дозорный отряд у границы лесной чащи.',
    },
    'node-1b': {
      id: 'node-1b',
      type: 'battle',
      title: 'Одинокий чародей',
      stepId: 'act1-stage-2',
      layer: 0,
      row: 1,
      next: ['node-2b', 'node-2c'],
      description: 'Гоблин-заклинатель на холме в сумерках.',
    },

    // Tier 1: Foothills & Outposts (Fork 2)
    'node-2a': {
      id: 'node-2a',
      type: 'battle',
      title: 'Камнеметатель',
      stepId: 'act1-stage-3',
      layer: 1,
      row: 0,
      next: ['node-3-shop', 'node-3a'],
      description: 'Укрепленная огневая точка на каменном уступе.',
    },
    'node-2b': {
      id: 'node-2b',
      type: 'battle',
      title: 'Дозорный мост',
      stepId: 'act1-stage-4',
      layer: 1,
      row: 1,
      next: ['node-3-shop', 'node-3b'],
      description: 'Подвесной мост через ущелье.',
    },
    'node-2c': {
      id: 'node-2c',
      type: 'battle',
      title: 'Пьяный аванпост',
      stepId: 'act1-stage-5',
      layer: 1,
      row: 2,
      next: ['node-3b', 'node-3c'],
      description: 'Беспечные часовые у вечернего костра.',
    },

    // Tier 2: Merchant Caravan & Wild Paths (Fork 3)
    'node-3-shop': {
      id: 'node-3-shop',
      type: 'shop',
      title: 'Лавка гоблина-менялы',
      layer: 2,
      row: 0,
      next: ['node-4a', 'node-4b'],
      description: 'Странствующий торговец с диковинками и припасами.',
    },
    'node-3a': {
      id: 'node-3a',
      type: 'battle',
      title: 'Волчья стая',
      stepId: 'act1-stage-6',
      layer: 2,
      row: 1,
      next: ['node-4a'],
      description: 'Прирученные гоблинами свирепые волки.',
    },
    'node-3b': {
      id: 'node-3b',
      type: 'battle',
      title: 'Тройной заслон',
      stepId: 'act1-stage-7',
      layer: 2,
      row: 2,
      next: ['node-4b', 'node-4c'],
      description: 'Крепкий оборонительный редут.',
    },
    'node-3c': {
      id: 'node-3c',
      type: 'battle',
      title: 'Гнездо матроны',
      stepId: 'act1-stage-8',
      layer: 2,
      row: 3,
      next: ['node-4c'],
      description: 'Лекарка гоблинов в окружении защитников.',
    },

    // Tier 3: Heart of the Settlement
    'node-4a': {
      id: 'node-4a',
      type: 'battle',
      title: 'Семейный совет',
      stepId: 'act1-stage-9',
      layer: 3,
      row: 0,
      next: ['node-5a', 'node-5b'],
      description: 'Клановые бойцы защищают святилище предков.',
    },
    'node-4b': {
      id: 'node-4b',
      type: 'battle',
      title: 'Капитан со щитом',
      stepId: 'act1-stage-10',
      layer: 3,
      row: 1,
      next: ['node-5b', 'node-5-shop'],
      description: 'Закаленный капитан в тяжелых латах.',
    },
    'node-4c': {
      id: 'node-4c',
      type: 'battle',
      title: 'Разграбленный обоз',
      stepId: 'act1-stage-11',
      layer: 3,
      row: 2,
      next: ['node-5-shop', 'node-5c'],
      description: 'Остатки торгового каравана среди руин.',
    },

    // Tier 4: Secret Shop & Dark Thickets
    'node-5a': {
      id: 'node-5a',
      type: 'battle',
      title: 'Паучий тупик',
      stepId: 'act1-stage-12',
      layer: 4,
      row: 0,
      next: ['node-6a'],
      description: 'Темное ущелье, затянутое липкой паутиной.',
    },
    'node-5b': {
      id: 'node-5b',
      type: 'battle',
      title: 'Шаманский круг',
      stepId: 'act1-stage-13',
      layer: 4,
      row: 1,
      next: ['node-6a', 'node-6b'],
      description: 'Каменное капище с кругом темных шаманов.',
    },
    'node-5-shop': {
      id: 'node-5-shop',
      type: 'shop',
      title: 'Потайная палатка торговца',
      layer: 4,
      row: 2,
      next: ['node-6b', 'node-6c'],
      description: 'Укрытие торговца перед королевскими владениями.',
    },
    'node-5c': {
      id: 'node-5c',
      type: 'battle',
      title: 'Стена щитов',
      stepId: 'act1-stage-14',
      layer: 4,
      row: 3,
      next: ['node-6c'],
      description: 'Плотный строй щитоносцев прикрывает проход.',
    },

    // Tier 5: Citadel Approaches
    'node-6a': {
      id: 'node-6a',
      type: 'battle',
      title: 'Ритуальные ворота',
      stepId: 'act1-stage-15',
      layer: 5,
      row: 0,
      next: ['node-boss'],
      description: 'Массивные ворота, запечатанные магией крови.',
    },
    'node-6b': {
      id: 'node-6b',
      type: 'battle',
      title: 'Ночная охота',
      stepId: 'act1-stage-16',
      layer: 5,
      row: 1,
      next: ['node-boss'],
      description: 'Элитные королевские следопыты во тьме.',
    },
    'node-6c': {
      id: 'node-6c',
      type: 'battle',
      title: 'Королевская стража',
      stepId: 'act1-stage-17',
      layer: 5,
      row: 2,
      next: ['node-boss'],
      description: 'Гвардейцы короля гоблинов в полных доспехах.',
    },

    // Tier 6: Throne of the Goblin King
    'node-boss': {
      id: 'node-boss',
      type: 'boss',
      title: 'Король гоблинов',
      stepId: 'act1-stage-18',
      layer: 6,
      row: 1,
      next: [],
      description: 'Тронный зал Короля гоблинов. Финальная битва Акта I.',
    },
  },
}
