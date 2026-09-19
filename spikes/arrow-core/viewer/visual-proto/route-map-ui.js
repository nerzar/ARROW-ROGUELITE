// MAP-001: Route Map UI and topology presentation for Act I «Страна гоблинов».
// Renders tiers, branching paths, node archetypes (battle / shop / boss),
// visited/available/locked visual states, and placeholder merchant screen.

export function createRouteMapModal(options = {}) {
  const { onSelectNode, onClose, onLeaveShop } = options

  // Main map overlay element
  const overlay = document.createElement('div')
  overlay.className = 'route-map-modal hidden'
  overlay.id = 'routeMapModal'

  overlay.innerHTML = `
    <div class="route-map-panel">
      <header class="route-map-header">
        <div class="route-map-title-group">
          <div class="route-map-badge">АКТ I · СТРАНА ГОБЛИНОВ</div>
          <h2 class="route-map-title" id="rmTitle">Карта маршрута</h2>
          <div class="route-map-subtitle" id="rmSubtitle">Выберите следующий узел для продолжения похода</div>
        </div>
        <div class="route-map-header-stats" id="rmStats"></div>
        <button class="route-map-close-btn" id="rmCloseBtn" title="Вернуться в бой">✕</button>
      </header>
      <div class="route-map-scroll-area">
        <div class="route-map-canvas-container" id="rmCanvasContainer">
          <svg class="route-map-svg-lines" id="rmSvgLines"></svg>
          <div class="route-map-columns" id="rmColumns"></div>
        </div>
      </div>
      <footer class="route-map-footer">
        <div class="route-map-legend">
          <span class="legend-item"><span class="legend-icon battle">⚔️</span> Бой</span>
          <span class="legend-item"><span class="legend-icon shop">🛒</span> Лавка (SHOP-001)</span>
          <span class="legend-item"><span class="legend-icon boss">👑</span> Босс Акта</span>
          <span class="legend-separator">|</span>
          <span class="legend-item"><span class="legend-dot current"></span> Текущий</span>
          <span class="legend-item"><span class="legend-dot available"></span> Доступен</span>
          <span class="legend-item"><span class="legend-dot visited"></span> Пройден</span>
        </div>
        <div class="route-map-actions" id="rmActions"></div>
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
  const elSvg = overlay.querySelector('#rmSvgLines')
  const elColumns = overlay.querySelector('#rmColumns')
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
    elTitle.textContent = graph.title ?? 'Карта Страны гоблинов'
    if (isMandatoryPick) {
      elSubtitle.textContent = 'Выберите один из доступных узлов для следующего этапа'
      elClose.style.display = 'none' // mandatory step
    } else {
      elSubtitle.textContent = `Текущий этап: ${run.currentNode?.title ?? 'В походе'}`
      elClose.style.display = 'block'
    }

    // Stats bar
    elStats.innerHTML = `
      <span class="stat-pill hp">❤️ ${run.encounter?.playerHp ?? run.hpAtEntry}/${run.maxHp}</span>
      <span class="stat-pill rotate">🔄 ${run.rotateCharges}</span>
      <span class="stat-pill gold">🪙 ${run.gold}</span>
      <span class="stat-pill items">🎒 ${run.inventory.length} предм.</span>
    `

    // Group nodes by layer/tier
    const layers = new Map()
    for (const node of Object.values(graph.nodes)) {
      const l = node.layer ?? 0
      if (!layers.has(l)) layers.set(l, [])
      layers.get(l).push(node)
    }

    // Sort layer numbers
    const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b)

    // Build columns
    elColumns.innerHTML = ''
    const nodeElements = new Map()

    for (const layerIdx of sortedLayers) {
      const colDiv = document.createElement('div')
      colDiv.className = 'route-map-column'
      colDiv.dataset.layer = String(layerIdx)

      const colHeader = document.createElement('div')
      colHeader.className = 'column-header'
      colHeader.textContent = layerIdx === 0 ? 'Старт' : layerIdx === sortedLayers[sortedLayers.length - 1] ? 'Босс' : `Уровень ${layerIdx}`
      colDiv.appendChild(colHeader)

      const colNodes = layers.get(layerIdx) || []
      // Sort nodes inside layer by row
      colNodes.sort((a, b) => (a.row ?? 0) - (b.row ?? 0))

      for (const node of colNodes) {
        const isVisited = visitedIds.has(node.id)
        const isCurrent = currentNodeId === node.id && !isMandatoryPick
        const isAvailable = availableIds.has(node.id) && (isMandatoryPick || !currentNodeId)
        const isLocked = !isVisited && !isCurrent && !isAvailable

        const nodeCard = document.createElement('div')
        nodeCard.className = `route-node-card type-${node.type}`
        nodeCard.dataset.nodeId = node.id

        if (isVisited) nodeCard.classList.add('state-visited')
        if (isCurrent) nodeCard.classList.add('state-current')
        if (isAvailable) nodeCard.classList.add('state-available')
        if (isLocked) nodeCard.classList.add('state-locked')

        let icon = '⚔️'
        let typeBadge = 'Бой'
        if (node.type === 'shop') {
          icon = '🛒'
          typeBadge = 'Лавка'
        } else if (node.type === 'boss') {
          icon = '👑'
          typeBadge = 'Босс'
        }

        let stateLabel = ''
        if (isCurrent) stateLabel = '<span class="badge-status current">Вы здесь</span>'
        else if (isVisited) stateLabel = '<span class="badge-status visited">Пройдено</span>'
        else if (isAvailable) stateLabel = '<span class="badge-status available">Доступен</span>'

        nodeCard.innerHTML = `
          <div class="node-icon-wrap">${icon}</div>
          <div class="node-info">
            <div class="node-type-row">
              <span class="node-type-badge ${node.type}">${typeBadge}</span>
              ${stateLabel}
            </div>
            <div class="node-title">${node.title}</div>
            ${node.description ? `<div class="node-desc">${node.description}</div>` : ''}
          </div>
          ${isAvailable ? `<button class="node-select-btn" data-pick="${node.id}">Выбрать путь →</button>` : ''}
        `

        if (isAvailable) {
          nodeCard.onclick = (e) => {
            e.stopPropagation()
            if (onSelectNode) onSelectNode(node.id)
          }
          const btn = nodeCard.querySelector('.node-select-btn')
          if (btn) {
            btn.onclick = (e) => {
              e.stopPropagation()
              if (onSelectNode) onSelectNode(node.id)
            }
          }
        }

        colDiv.appendChild(nodeCard)
        nodeElements.set(node.id, nodeCard)
      }

      elColumns.appendChild(colDiv)
    }

    // Draw connecting lines via SVG
    requestAnimationFrame(() => {
      drawConnections(graph, nodeElements, visitedIds, availableIds, currentNodeId, isMandatoryPick)
    })
  }

  function drawConnections(graph, nodeElements, visitedIds, availableIds, currentNodeId, isMandatoryPick) {
    elSvg.innerHTML = ''
    const containerRect = overlay.querySelector('#rmCanvasContainer').getBoundingClientRect()
    elSvg.setAttribute('width', String(containerRect.width))
    elSvg.setAttribute('height', String(containerRect.height))

    for (const [fromId, node] of Object.entries(graph.nodes)) {
      const fromEl = nodeElements.get(fromId)
      if (!fromEl) continue
      const fromRect = fromEl.getBoundingClientRect()
      const x1 = fromRect.right - containerRect.left
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top

      for (const toId of node.next ?? []) {
        const toEl = nodeElements.get(toId)
        if (!toEl) continue
        const toRect = toEl.getBoundingClientRect()
        const x2 = toRect.left - containerRect.left
        const y2 = toRect.top + toRect.height / 2 - containerRect.top

        // Determine line visual class
        const isFromVisited = visitedIds.has(fromId)
        const isToVisited = visitedIds.has(toId)
        const isCurrentStepBranch = (fromId === currentNodeId || (!currentNodeId && graph.entryNodeIds.includes(toId))) && availableIds.has(toId)

        let lineClass = 'rm-line-locked'
        if (isFromVisited && isToVisited) {
          lineClass = 'rm-line-visited'
        } else if (isCurrentStepBranch && isMandatoryPick) {
          lineClass = 'rm-line-available'
        }

        // Smooth cubic bezier curve
        const dx = x2 - x1
        const cx1 = x1 + dx * 0.5
        const cy1 = y1
        const cx2 = x1 + dx * 0.5
        const cy2 = y2

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`)
        path.setAttribute('class', `rm-path ${lineClass}`)
        elSvg.appendChild(path)
      }
    }
  }

  // Redraw lines on window resize
  window.addEventListener('resize', () => {
    if (isVisible() && currentRun) {
      render(currentRun)
    }
  })

  return {
    show,
    hide,
    render,
    showShop,
    isVisible,
    element: overlay,
  }
}
