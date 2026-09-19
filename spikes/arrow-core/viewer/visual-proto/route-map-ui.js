// MAP-001: Illustrated Route Map UI for Act I «Страна гоблинов».
// Renders the fullscreen panoramic illustrated map (approvedempty.png) with calibrated node hotspots,
// programmatic terrain and title labels, signpost easter-egg ("ТУТ НАЧИНАЮТСЯ ПРОБЛЕМЫ"),
// interactive status beacons, glowing SVG road trails, narrative tooltips, and SHOP-001 placeholder beat.

/** Calibrated pixel coordinates on the 1672x941 illustrated map canvas. */
export const ACT1_MAP_COORDINATES = {
  // Tier 0: Entrance (Fork 1)
  'node-1a': { x: 335, y: 430, label: 'Патруль' },           // Upper branch towards crooked forest
  'node-1b': { x: 305, y: 585, label: 'Чародей' },           // Lower branch towards outpost

  // Tier 1: Foothills & Outposts (Fork 2)
  'node-2a': { x: 465, y: 365, label: 'Камнеметатель' },     // Near "Кривой лес"
  'node-2b': { x: 495, y: 465, label: 'Дозорный мост' },     // Ridge path above "Заброшенный пост"
  'node-2c': { x: 620, y: 580, label: 'Аванпост' },          // Outpost camp by watchtower

  // Tier 2: Merchant Caravan & Wild Paths (Fork 3)
  'node-3-shop': { x: 665, y: 325, label: 'Лавка менялы' },  // Upper trail near mountain pass
  'node-3a': { x: 810, y: 375, label: 'Волчья стая' },       // Upper suspension bridge
  'node-3b': { x: 785, y: 535, label: 'Тройной заслон' },    // Mid gorge crossing
  'node-3c': { x: 840, y: 695, label: 'Гнездо матроны' },    // Lower waterfall suspension bridge

  // Tier 3: Heart of the Settlement
  'node-4a': { x: 980, y: 385, label: 'Семейный совет' },    // Ridge overlooking swamps
  'node-4b': { x: 1025, y: 515, label: 'Капитан' },          // Central valley passage
  'node-4c': { x: 1140, y: 765, label: 'Разграбленный обоз' }, // Wolf cave lair & campfires

  // Tier 4: Secret Shop & Dark Thickets
  'node-5a': { x: 1115, y: 295, label: 'Паучий тупик' },     // North twisted dark forest
  'node-5b': { x: 1205, y: 425, label: 'Шаманский круг' },   // "Шаманские топи" glowing pool
  'node-5-shop': { x: 1260, y: 545, label: 'Палатка менялы' }, // Trail towards citadel
  'node-5c': { x: 1315, y: 620, label: 'Стена щитов' },      // Lower bridge & watchtower

  // Tier 5: Citadel Approaches
  'node-6a': { x: 1375, y: 365, label: 'Ритуальные ворота' }, // Upper northern castle gate
  'node-6b': { x: 1410, y: 480, label: 'Ночная охота' },     // Main ascending castle ramp
  'node-6c': { x: 1465, y: 630, label: 'Королевская стража' }, // Lower fortified drawbridge

  // Tier 6: Throne of the Goblin King
  'node-boss': { x: 1530, y: 235, label: 'Король гоблинов' }, // High burning skull fortress
}

const MAP_WIDTH = 1672
const MAP_HEIGHT = 941

export function createRouteMapModal(options = {}) {
  const { onSelectNode, onClose, onLeaveShop } = options

  // Main map overlay element
  const overlay = document.createElement('div')
  overlay.className = 'route-map-modal hidden'
  overlay.id = 'routeMapModal'

  overlay.innerHTML = `
    <div class="route-map-panel fullscreen-map">
      <!-- Floating HUD Top Bar -->
      <header class="route-map-floating-top">
        <div class="route-map-breadcrumbs">
          <span class="breadcrumb-act">АКТ I</span>
          <span class="breadcrumb-sep">·</span>
          <span class="breadcrumb-map" id="rmTitle">Страна гоблинов</span>
          <span class="breadcrumb-status" id="rmSubtitle">Выберите следующий узел</span>
        </div>
        <div class="route-map-header-stats" id="rmStats"></div>
        <button class="route-map-close-btn" id="rmCloseBtn" title="Вернуться в бой (Esc / M)">✕</button>
      </header>

      <!-- Main Map Viewport & Board -->
      <div class="route-map-viewport" id="rmViewport">
        <div class="route-map-board" id="rmBoard">
          <!-- Clean illustrated panoramic map art without baked-in labels -->
          <img class="route-map-artwork" src="assets/maps/approvedmap.png" alt="Карта Акта I: Страна гоблинов" />

          <!-- Programmatic Terrain and Title Labels Layer -->
          <div class="route-map-labels-layer" aria-hidden="true">
            <!-- Top Left Title Card -->
            <div class="map-title-card" style="left: 3.5%; top: 3.5%;">
              <div class="map-title-badge">── АКТ I ──</div>
              <h1 class="map-title-heading">Страна гоблинов</h1>
              <div class="map-title-prompt">Выберите один из доступных путей для следующего этапа.</div>
            </div>

            <!-- Programmatic Terrain Landmarks -->
            <div class="terrain-label label-crooked-forest" style="left: 22.9%; top: 28.5%;">Кривой лес</div>
            <div class="terrain-label label-stone-gorge" style="left: 45.0%; top: 24.6%;">Каменное ущелье</div>
            <div class="terrain-label label-abandoned-post" style="left: 33.5%; top: 53.4%;">Заброшенный пост</div>
            <div class="terrain-label label-wolf-pack" style="left: 65.5%; top: 76.2%;">Волчья стая</div>
            <div class="terrain-label label-shaman-swamp" style="left: 69.8%; top: 35.5%;">Шаманские топи</div>
            <div class="terrain-label label-goblin-king" style="left: 95.8%; top: 28.5%;">Король гоблинов</div>

            <!-- Wooden Signpost: "ТУТ НАЧИНАЮТСЯ ПРОБЛЕМЫ" -->
            <div class="map-signpost" style="left: 19.7%; top: 80.5%;">
              <div class="signpost-text">
                <span class="sign-line-1">ТУТ</span>
                <span class="sign-line-2">НАЧИНАЮТСЯ</span>
                <span class="sign-line-3">ПРОБЛЕМЫ</span>
              </div>
            </div>
          </div>

          <!-- Scalable SVG Roads Layer -->
          <svg class="route-map-svg-layer" id="rmSvgLines" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" preserveAspectRatio="none"></svg>

          <!-- Interactive Hotspot Pins Layer -->
          <div class="route-map-pins-layer" id="rmPinsLayer"></div>
        </div>
      </div>

      <!-- Floating HUD Bottom Bar -->
      <footer class="route-map-floating-bottom">
        <div class="route-map-legend">
          <span class="legend-item"><span class="legend-icon battle">⚔️</span> Схватка</span>
          <span class="legend-item"><span class="legend-icon shop">🛒</span> Лавка менялы</span>
          <span class="legend-item"><span class="legend-icon boss">👑</span> Король гоблинов</span>
          <span class="legend-separator">|</span>
          <span class="legend-item"><span class="legend-dot current"></span> Вы здесь</span>
          <span class="legend-item"><span class="legend-dot available"></span> Доступный путь</span>
          <span class="legend-item"><span class="legend-dot visited"></span> Пройдено</span>
        </div>
        <div class="route-map-hint" id="rmHint"></div>
      </footer>
    </div>

    <!-- Placeholder Shop Modal (SHOP-001 beat) -->
    <div class="shop-dialog hidden" id="rmShopDialog">
      <div class="shop-panel">
        <div class="shop-badge">ЛАВКА ГОБЛИНА-МЕНЯЛЫ</div>
        <h3 class="shop-title" id="shopTitle">Торговый привал</h3>
        <p class="shop-desc" id="shopDesc">
          «Приветствую, путник! Мои лучшие диковинки и зелья пока в караванном пути (полноценный ассортимент появится в SHOP-001). 
          Отдохни у костра перед следующей схваткой!»
        </p>
        <div class="shop-purse">
          <span>Ваше золото:</span>
          <strong id="shopGoldValue">0</strong> <span class="gold-coin">🪙</span>
        </div>
        <div class="shop-placeholder-items">
          <div class="shop-card disabled">
            <div class="shop-card-icon">🧪</div>
            <div class="shop-card-name">Лечебное зелье</div>
            <div class="shop-card-status">Скоро в SHOP-001</div>
          </div>
          <div class="shop-card disabled">
            <div class="shop-card-icon">🛡️</div>
            <div class="shop-card-name">Гоблинский щит</div>
            <div class="shop-card-status">Скоро в SHOP-001</div>
          </div>
          <div class="shop-card disabled">
            <div class="shop-card-icon">⚡</div>
            <div class="shop-card-name">Кристалл вращения</div>
            <div class="shop-card-status">Скоро в SHOP-001</div>
          </div>
        </div>
        <div class="shop-actions">
          <button class="shop-leave-btn" id="shopLeaveBtn">Продолжить путь →</button>
        </div>
      </div>
    </div>
  `

  document.body.appendChild(overlay)

  const elClose = overlay.querySelector('#rmCloseBtn')
  const elTitle = overlay.querySelector('#rmTitle')
  const elSubtitle = overlay.querySelector('#rmSubtitle')
  const elStats = overlay.querySelector('#rmStats')
  const elHint = overlay.querySelector('#rmHint')
  const elSvg = overlay.querySelector('#rmSvgLines')
  const elPinsLayer = overlay.querySelector('#rmPinsLayer')
  const elShopDialog = overlay.querySelector('#rmShopDialog')
  const elShopTitle = overlay.querySelector('#shopTitle')
  const elShopDesc = overlay.querySelector('#shopDesc')
  const elShopGold = overlay.querySelector('#shopGoldValue')
  const elShopLeave = overlay.querySelector('#shopLeaveBtn')

  let currentRun = null

  elClose.onclick = () => {
    if (currentRun && currentRun.routeMapPending) {
      // Must pick an available node when routeMapPending is true
      return
    }
    hide()
    if (onClose) onClose()
  }

  elShopLeave.onclick = () => {
    elShopDialog.classList.add('hidden')
    if (onLeaveShop) onLeaveShop()
  }

  function show() {
    overlay.classList.remove('hidden')
  }

  function hide() {
    overlay.classList.add('hidden')
    elShopDialog.classList.add('hidden')
  }

  function isVisible() {
    return !overlay.classList.contains('hidden')
  }

  function showShop(node, run) {
    elShopDialog.classList.remove('hidden')
    if (node) {
      elShopTitle.textContent = node.title ?? 'Лавка гоблина-менялы'
      if (node.description) elShopDesc.textContent = node.description
    }
    if (run) {
      elShopGold.textContent = String(run.gold ?? 0)
    }
  }

  /** Resolves pixel coordinates for any graph node, falling back gracefully for custom graphs. */
  function getNodeCoord(node) {
    if (ACT1_MAP_COORDINATES[node.id]) {
      return ACT1_MAP_COORDINATES[node.id]
    }
    // Fallback placement if custom graph or undefined node
    const layer = node.layer ?? 0
    const row = node.row ?? 0
    const x = Math.min(MAP_WIDTH - 120, 260 + layer * 200)
    const y = Math.min(MAP_HEIGHT - 120, 240 + row * 130)
    return { x, y }
  }

  function render(run) {
    currentRun = run
    if (!run || !run.hasRouteGraph || !run.routeGraphDef) {
      hide()
      return
    }

    const graph = run.routeGraphDef
    const visitedIds = new Set(run.visitedNodeIds)
    const availableIds = new Set(run.availableRouteNodeIds)
    const currentNodeId = run.currentNodeId
    const isMandatoryPick = run.routeMapPending

    // If run is currently in a shop node, show shop overlay
    if (run.inShop) {
      show()
      const shopNode = graph.nodes[currentNodeId]
      showShop(shopNode, run)
      return
    } else {
      elShopDialog.classList.add('hidden')
    }

    // Header title & close button visibility
    elTitle.textContent = graph.title ?? 'Страна гоблинов'
    if (isMandatoryPick) {
      elSubtitle.textContent = 'Выберите узел для продолжения'
      elClose.style.display = 'none' // mandatory step
      if (elHint) elHint.innerHTML = '👉 <strong>Выберите подсвеченный узел</strong>, чтобы отправиться в путь'
    } else {
      const curTitle = run.currentNode?.title ?? 'В походе'
      elSubtitle.textContent = `Текущий этап: ${curTitle}`
      elClose.style.display = 'flex'
      if (elHint) elHint.innerHTML = '💡 Нажмите <strong>[M]</strong> или <strong>✕</strong> для возврата к битве'
    }

    // Stats bar
    elStats.innerHTML = `
      <span class="stat-pill hp" title="Здоровье героя">❤️ ${run.encounter?.playerHp ?? run.hpAtEntry}/${run.maxHp}</span>
      <span class="stat-pill rotate" title="Заряды поворота">🔄 ${run.rotateCharges}</span>
      <span class="stat-pill gold" title="Золото">🪙 ${run.gold}</span>
      <span class="stat-pill items" title="Предметы в сумке">🎒 ${run.inventory.length} предм.</span>
    `

    // Draw SVG connection lines
    drawSvgRoads(graph, visitedIds, availableIds, currentNodeId, isMandatoryPick)

    // Render Pin Hotspots
    elPinsLayer.innerHTML = ''
    for (const [id, node] of Object.entries(graph.nodes)) {
      const coord = getNodeCoord(node)
      const isVisited = visitedIds.has(node.id)
      const isCurrent = currentNodeId === node.id && !isMandatoryPick
      const isAvailable = availableIds.has(node.id) && (isMandatoryPick || !currentNodeId)
      const isLocked = !isVisited && !isCurrent && !isAvailable

      const pin = document.createElement('div')
      pin.className = `map-hotspot-pin type-${node.type}`
      pin.dataset.nodeId = node.id

      // Percentage positioning matches the 1672x941 aspect ratio exactly
      const leftPct = (coord.x / MAP_WIDTH) * 100
      const topPct = (coord.y / MAP_HEIGHT) * 100
      pin.style.left = `${leftPct}%`
      pin.style.top = `${topPct}%`

      if (isVisited) pin.classList.add('state-visited')
      if (isCurrent) pin.classList.add('state-current')
      if (isAvailable) pin.classList.add('state-available')
      if (isLocked) pin.classList.add('state-locked')

      // Visual icons & badge text
      let icon = '⚔️'
      let typeBadge = 'Бой'
      if (node.type === 'shop') {
        icon = '🛒'
        typeBadge = 'Лавка'
      } else if (node.type === 'boss') {
        icon = '👑'
        typeBadge = 'Босс Акта'
      }

      let stateText = 'Недоступно'
      let promptText = ''
      if (isCurrent) {
        stateText = 'Вы здесь'
        promptText = 'Текущая локация'
      } else if (isVisited) {
        stateText = 'Пройдено'
        promptText = 'Уже пройдено'
      } else if (isAvailable) {
        stateText = 'Доступно'
        promptText = '👉 Нажмите, чтобы выбрать этот путь'
      }

      // Step badge
      const stepBadge = node.stepId ? `<span class="tooltip-step">${node.stepId.replace('act1-stage-', 'Этап ')}</span>` : ''

      pin.innerHTML = `
        ${isAvailable ? '<div class="pin-pulse-beacon"></div>' : ''}
        ${isCurrent ? '<div class="pin-current-aura"></div>' : ''}
        <div class="pin-token" role="button" aria-label="${node.title}">
          <span class="pin-icon">${icon}</span>
          ${isVisited ? '<span class="pin-check">✓</span>' : ''}
        </div>
        <div class="pin-mini-label ${isAvailable || isCurrent ? 'always-visible' : ''}">${node.title}</div>
        
        <div class="pin-tooltip">
          <div class="tooltip-header">
            <span class="tooltip-type-badge ${node.type}">${typeBadge}</span>
            ${stepBadge}
            <span class="tooltip-state-badge ${isCurrent ? 'current' : isVisited ? 'visited' : isAvailable ? 'available' : 'locked'}">${stateText}</span>
          </div>
          <div class="tooltip-title">${node.title}</div>
          ${node.description ? `<div class="tooltip-desc">${node.description}</div>` : ''}
          <div class="tooltip-prompt ${isAvailable ? 'pickable' : ''}">${promptText}</div>
        </div>
      `

      if (isAvailable) {
        pin.onclick = (e) => {
          e.stopPropagation()
          if (onSelectNode) onSelectNode(node.id)
        }
      }

      elPinsLayer.appendChild(pin)
    }
  }

  function drawSvgRoads(graph, visitedIds, availableIds, currentNodeId, isMandatoryPick) {
    elSvg.innerHTML = ''

    for (const [fromId, node] of Object.entries(graph.nodes)) {
      const fromCoord = getNodeCoord(node)

      for (const toId of node.next ?? []) {
        const toNode = graph.nodes[toId]
        if (!toNode) continue
        const toCoord = getNodeCoord(toNode)

        // Road trail state
        const isFromVisited = visitedIds.has(fromId)
        const isToVisited = visitedIds.has(toId)
        const isCurrentStepBranch = (fromId === currentNodeId || (!currentNodeId && graph.entryNodeIds.includes(toId))) && availableIds.has(toId)

        let lineClass = 'rm-line-locked'
        if (isFromVisited && isToVisited) {
          lineClass = 'rm-line-visited'
        } else if (isCurrentStepBranch && (isMandatoryPick || !currentNodeId)) {
          lineClass = 'rm-line-available'
        }

        // Smooth cubic bezier curving between road points
        const x1 = fromCoord.x
        const y1 = fromCoord.y
        const x2 = toCoord.x
        const y2 = toCoord.y

        const dx = x2 - x1
        const cx1 = x1 + dx * 0.45
        const cy1 = y1
        const cx2 = x2 - dx * 0.45
        const cy2 = y2

        // Background shadow path for contrast against map art
        const bgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        bgPath.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`)
        bgPath.setAttribute('class', 'rm-path-shadow')
        elSvg.appendChild(bgPath)

        // Main colored path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`)
        path.setAttribute('class', `rm-path ${lineClass}`)
        elSvg.appendChild(path)
      }
    }
  }

  return {
    show,
    hide,
    render,
    showShop,
    isVisible,
    element: overlay,
  }
}
