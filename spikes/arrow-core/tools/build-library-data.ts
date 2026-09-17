import { writeFileSync } from 'node:fs'
import {
  analyzeSeed,
  BoardTopology,
  BoardState,
  DIR_NAMES,
  type Dir,
  generateLevel,
  type Level,
  levelHash,
  peelLayers,
  PRESETS,
  type PresetName,
} from '../src/index.js'
import { playtestBoard, type CandidatePlaytest } from './playtest-candidates.js'

export function renderAsciiCustom(level: Level): string {
  const { width: w, height: h } = level
  const grid: string[] = new Array(w * h).fill(' .')
  const heads = ['^', '>', 'v', '<']
  const step = new Map(level.solution.map((id, i) => [id, i + 1]))
  for (const a of level.arrows) {
    const label = (step.get(a.id) ?? 0).toString(36).slice(-1)
    for (const c of a.cells) grid[c] = ' ' + label
    grid[a.cells[a.cells.length - 1]] = label + heads[a.dir]
  }
  const rows: string[] = []
  for (let y = 0; y < h; y++) rows.push(grid.slice(y * w, (y + 1) * w).join(' '))
  return rows.join('\n')
}

const CANDIDATE_DEFS: {
  preset: PresetName
  seed: number
  pattern: string
  title: string
  pairing: string
  boss: string
}[] = [
  // 1. CHAIN UNLOCK
  {
    preset: 'easy',
    seed: 1,
    pattern: 'CHAIN UNLOCK',
    title: 'Домино-каскад (The Domino Cascade)',
    pairing: 'Swarm / Multi-Grunt: один ход вскрывает 3 выстрела под залп по таймерам',
    boss: 'None',
  },
  {
    preset: 'medium',
    seed: 7,
    pattern: 'CHAIN UNLOCK',
    title: 'Каменный обвал (Rock Avalanche)',
    pairing: 'Caster N (CAST 3) + Rock Thrower W (THROW 3): ход 3 срывает каст и дает залп',
    boss: 'Act I Mid-Boss Candidate',
  },
  {
    preset: 'easy',
    seed: 10,
    pattern: 'CHAIN UNLOCK',
    title: 'Спусковой крючок (Trigger Release)',
    pairing: 'Solo Thrower W: разблокировка 2 стрел одним ходом опережает бросок камня',
    boss: 'None',
  },

  // 2. BOTTLENECK
  {
    preset: 'easy',
    seed: 2,
    pattern: 'BOTTLENECK',
    title: 'Замковый клин (The Keystone Wedge)',
    pairing: 'Solo Tank E (HP 4): убрать центральный замок до дедлайна',
    boss: 'None',
  },
  {
    preset: 'medium',
    seed: 3,
    pattern: 'BOTTLENECK',
    title: 'Сердцевина башни (Tower Core)',
    pairing: 'Caster N (CAST 4) + Grunt E (IN 3): замок открывает доступ к северным стрелам',
    boss: 'Mid-Boss / Elite',
  },

  // 3. FALSE TEMPTATION
  {
    preset: 'easy',
    seed: 4,
    pattern: 'FALSE TEMPTATION',
    title: 'Ложный фасад (The False Façade)',
    pairing: 'Grunt W (IN 2) + Grunt E (IN 4): жадный выстрел в E ведет к урону от W',
    boss: 'None',
  },
  {
    preset: 'medium',
    seed: 4,
    pattern: 'FALSE TEMPTATION',
    title: 'Приманка авангарда (Vanguard Trap)',
    pairing: 'Dire Wolf W (IN 3, Dmg 3): открытая стрела E не спасает от смертельного укуса слева',
    boss: 'Elite Candidate',
  },

  // 4. DIRECTION SCARCITY
  {
    preset: 'easy',
    seed: 22,
    pattern: 'DIRECTION SCARCITY',
    title: 'Одинокий шпиль (The Solitary Spire)',
    pairing: 'Caster N (CAST 3) + Grunt W (IN 3): ровно 1 стрела North, промах фатален',
    boss: 'Act I Canonical E1',
  },
  {
    preset: 'medium',
    seed: 11,
    pattern: 'DIRECTION SCARCITY',
    title: 'Голодный восток (Starving East)',
    pairing: 'Grunt E (HP 2, IN 4) + Rock Thrower W: всего 2 стрелы East на 16 стрел',
    boss: 'None',
  },

  // 5. DIRECTION FLOOD
  {
    preset: 'easy',
    seed: 3,
    pattern: 'DIRECTION FLOOD',
    title: 'Восточный ливень (Eastern Deluge)',
    pairing: 'Tank E (HP 5, IN 5): 6 из 10 стрел направлены на восток',
    boss: 'None',
  },
  {
    preset: 'hard',
    seed: 9,
    pattern: 'DIRECTION FLOOD',
    title: 'Шквал стрел (The Arrow Torrent)',
    pairing: 'Goblin King Shield: 10 из 21 стрелы смотрят на East; Rotate превращает их в South',
    boss: 'Goblin King / Act I Boss Candidate',
  },

  // 6. CROSS-LOCK
  {
    preset: 'easy',
    seed: 112,
    pattern: 'CROSS-LOCK',
    title: 'Перекрёстный узел (Canonical Cross-Lock)',
    pairing: 'Grunt E (HP 2, IN 3) + Grunt N (HP 2, IN 4): взаимное отпирание E и N',
    boss: 'Act I Canonical E2',
  },
  {
    preset: 'medium',
    seed: 5,
    pattern: 'CROSS-LOCK',
    title: 'Четверной переплёт (Quad Lock)',
    pairing: 'Dual Grunts (W + S) с рассинхроном таймеров: W отпирает S, S отпирает W',
    boss: 'None',
  },

  // 7. LAYERED GATES
  {
    preset: 'medium',
    seed: 6,
    pattern: 'LAYERED GATES',
    title: 'Крепостные валы (Fortress Ramparts)',
    pairing: 'Goblin Shaman (Phase 1 outer, Phase 2 core): 5 четких слоев зачистки',
    boss: 'Goblin Shaman / Prologue Boss',
  },
  {
    preset: 'hard',
    seed: 4,
    pattern: 'LAYERED GATES',
    title: 'Шесть контуров (Six Circuits)',
    pairing: 'Goblin King (Multi-Stage): 6 peel layers, фазовый переход на 3-м слое',
    boss: 'Goblin King / Act I Boss Candidate',
  },

  // 8. CHOICE OF OPENING
  {
    preset: 'easy',
    seed: 8,
    pattern: 'CHOICE OF OPENING',
    title: 'Развилка четырёх дорог (Four-Way Fork)',
    pairing: 'Grunt E (IN 3) + Thrower N (IN 5): выбор первого удара определяет темп всего боя',
    boss: 'Act I E5 Candidate',
  },
  {
    preset: 'medium',
    seed: 1,
    pattern: 'CHOICE OF OPENING',
    title: 'Открытый горизонт (Open Horizon)',
    pairing: 'Grunt W + Caster N: 5 доступных стартовых ходов в 3 разных стороны',
    boss: 'None',
  },

  // 9. FORCED OPENING
  {
    preset: 'easy',
    seed: 35,
    pattern: 'FORCED OPENING',
    title: 'Игольное ушко (The Needle Eye)',
    pairing: 'Telegraphed Enrage: ровно 1 легальный первый ход, взрывающий веер вариантов',
    boss: 'Prologue / Early Act I Elite',
  },
  {
    preset: 'medium',
    seed: 442,
    pattern: 'FORCED OPENING',
    title: 'Запечатанная гробница (Sealed Tomb)',
    pairing: 'Boss Entrance: единственный стартовый ключ раскручивает 16 заблокированных стрел',
    boss: 'Boss Candidate (Unique Opening)',
  },

  // 10. DELAYED PAYOFF
  {
    preset: 'easy',
    seed: 6,
    pattern: 'DELAYED PAYOFF',
    title: 'Погребённый клинок (Buried Blade)',
    pairing: 'Caster N (CAST 4): нужные стрелы North появляются только на 4-м ходу',
    boss: 'None',
  },
  {
    preset: 'medium',
    seed: 14,
    pattern: 'DELAYED PAYOFF',
    title: 'Задержка возмездия (Delayed Retribution)',
    pairing: 'Rock Thrower W (THROW 3): пережить 3 хода подготовки ради мощного финиша',
    boss: 'None',
  },

  // 11. SACRIFICE / SETUP
  {
    preset: 'easy',
    seed: 25,
    pattern: 'SACRIFICE / SETUP',
    title: 'Зов Бездны (Sacrifice Opening)',
    pairing: 'Caster N (CAST 3) + Grunt E (IN 4): выстрелы в E служат сетапом для срыва каста N',
    boss: 'Act I Canonical E3',
  },
  {
    preset: 'medium',
    seed: 17,
    pattern: 'SACRIFICE / SETUP',
    title: 'Холостой размен (Tempo Gambit)',
    pairing: 'Shaman N (CAST 3): два стартовых выстрела уходят в пустой South ради North',
    boss: 'None',
  },

  // 12. DIRECTION SWITCH
  {
    preset: 'easy',
    seed: 9,
    pattern: 'DIRECTION SWITCH',
    title: 'Двуликий янус (Two-Faced Janus)',
    pairing: 'Flank Switch: первая половина строго West, вторая половина строго East',
    boss: 'Mini-Boss Candidate',
  },
  {
    preset: 'medium',
    seed: 2,
    pattern: 'DIRECTION SWITCH',
    title: 'Смена флангов (Flank Pivot)',
    pairing: 'Goblin Taunter (прыжок слева направо): естественный перелом направления',
    boss: 'Taunter / Shaman Boss',
  },

  // 13. ROTATE BAIT
  {
    preset: 'easy',
    seed: 16,
    pattern: 'ROTATE BAIT',
    title: 'Искушение вихря (Whirlwind Temptation)',
    pairing: 'Rock Thrower W (HP 3, IN 4): 0-Rotate чистый путь, но Rotate CW стирает врага за 1 ход',
    boss: 'Act I E4 Candidate',
  },
  {
    preset: 'medium',
    seed: 7,
    pattern: 'ROTATE BAIT',
    title: 'Великое вращение (The Grand Rotation)',
    pairing: 'Thrower W (HP 2) + Caster N: поворот CW превращает 7 South стрел в 7 West стрел!',
    boss: 'Act I E6 Candidate / Boss',
  },

  // 14. RECOVERY BOARD
  {
    preset: 'easy',
    seed: 18,
    pattern: 'RECOVERY BOARD',
    title: 'Сеть спасения (Safety Net)',
    pairing: 'Twin Grunts (W + E): при любой ошибке первого хода всегда остаются 2+ выхода',
    boss: 'None',
  },
  {
    preset: 'medium',
    seed: 8,
    pattern: 'RECOVERY BOARD',
    title: 'Разветвлённый лабиринт (Branching Maze)',
    pairing: 'Multi-Enemy (3 стороны): высокая эластичность дерева решений',
    boss: 'None',
  },

  // 15. PUNISHING BOARD
  {
    preset: 'easy',
    seed: 12,
    pattern: 'PUNISHING BOARD',
    title: 'Шаг в пропасть (Edge of the Abyss)',
    pairing: 'Dire Wolf W (IN 2): один неверный клик на старте откладывает West на 3 хода',
    boss: 'Elite Encounter',
  },
  {
    preset: 'medium',
    seed: 16,
    pattern: 'PUNISHING BOARD',
    title: 'Капкан берсерка (Berserker Snare)',
    pairing: 'Fast Caster N (CAST 3): ошибка первого хода гарантирует пропуск срыва каста',
    boss: 'None',
  },

  // 16. SYMMETRIC / ASYMMETRIC
  {
    preset: 'easy',
    seed: 387,
    pattern: 'SYMMETRIC / ASYMMETRIC',
    title: 'Зеркальные близнецы (Mirror Twins)',
    pairing: 'Twin Grunts (E + W): симметричная доска, требующая асимметричного решения',
    boss: 'Special Puzzle Encounter',
  },
  {
    preset: 'medium',
    seed: 1463,
    pattern: 'SYMMETRIC / ASYMMETRIC',
    title: 'Ложное отражение (False Reflection)',
    pairing: 'Mirror Boss: визуальная ось симметрии разбивается скрытым ключевым ходом',
    boss: 'Boss Candidate (Puzzle Focus)',
  },

  // 17. LONG-PATH REVEAL
  {
    preset: 'medium',
    seed: 23,
    pattern: 'LONG-PATH REVEAL',
    title: 'Хребет титана (Spine of the Titan)',
    pairing: 'Bow Weapon Synergy: стрела длиной 7 клеток эффектно рассекает доску пополам',
    boss: 'Boss Candidate / Visual Showcase',
  },
]

async function runPlaytests() {
  console.log(`Running in-depth playtests for ${CANDIDATE_DEFS.length} candidates...`)
  const results: CandidatePlaytest[] = []

  for (const def of CANDIDATE_DEFS) {
    const pt = playtestBoard(def.preset, def.seed, def.pattern, def.title, def.pairing, def.boss)
    results.push(pt)
  }

  console.log(`Successfully verified ${results.length} boards across 17 patterns!`)
  writeFileSync('encounters/playtested-candidates.json', JSON.stringify(results, null, 2), 'utf-8')
  console.log(`Saved playtest data to encounters/playtested-candidates.json`)
}

runPlaytests().catch(console.error)
