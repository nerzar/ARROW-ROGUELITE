import {
  testPrologueBossCandidate,
  testAct1E1Candidate,
  testAct1E2Candidate,
  testAct1E3Candidate,
  type CandidateScanResult,
} from './square-migration-scanner.js'
import type { PresetName } from '../src/index.js'

async function main() {
  console.log('=== STARTING SQUARE ENCOUNTER MIGRATION SCAN ===\n')

  // 1. PROLOGUE BOSS
  console.log('--- Scanning Prologue Boss (Goblin Shaman: E 4hp -> N 5hp, Rotate granted) ---')
  const bossPresets: PresetName[] = ['square7', 'square8']
  const bossCandidates: CandidateScanResult[] = []

  for (const p of bossPresets) {
    console.log(`Scanning ${p} for Prologue Boss...`)
    for (let seed = 1; seed <= 500; seed++) {
      const res = testPrologueBossCandidate(p, seed)
      if (res) {
        bossCandidates.push(res)
        if (res.details.rotateDifference) {
          console.log(`  [FOUND DIVERGENT ROTATE] ${p} seed ${seed} (${res.arrows} arrows): N=${res.dirCounts[0]} E=${res.dirCounts[1]} S=${res.dirCounts[2]} W=${res.dirCounts[3]} | CW=${res.details.cwResult} CCW=${res.details.ccwResult}`)
        }
      }
    }
  }
  console.log(`Total Prologue Boss candidates found: ${bossCandidates.length}\n`)

  // 2. ACT I #1 (Two-Front Stand: urgent W hp 2 int 3, slow E hp 3 int 5)
  console.log('--- Scanning Act I #1 (Two-Front Stand: W 2hp int 3, E 3hp int 5) ---')
  const e1Presets: PresetName[] = ['square6', 'square7', 'square8']
  const e1Candidates: CandidateScanResult[] = []

  for (const p of e1Presets) {
    console.log(`Scanning ${p} for Act I #1...`)
    for (let seed = 1; seed <= 400; seed++) {
      const res = testAct1E1Candidate(p, seed)
      if (res && res.details.mistakeDamages) {
        e1Candidates.push(res)
      }
    }
  }
  console.log(`Total Act I #1 candidates (with mistake punishment) found: ${e1Candidates.length}\n`)

  // 3. ACT I #2 (Cross-Lock: urgent E hp 2 int 3, slow N hp 2 int 4)
  console.log('--- Scanning Act I #2 (Cross-Lock: urgent E 2hp int 3, slow N 2hp int 4) ---')
  const e2Presets: PresetName[] = ['square6', 'square7', 'square8']
  const e2Candidates: CandidateScanResult[] = []

  for (const p of e2Presets) {
    console.log(`Scanning ${p} for Act I #2...`)
    for (let seed = 1; seed <= 400; seed++) {
      const res = testAct1E2Candidate(p, seed)
      if (res && res.details.isInterleaved) {
        e2Candidates.push(res)
      }
    }
  }
  console.log(`Total Act I #2 candidates (interleaved lock) found: ${e2Candidates.length}\n`)

  // 4. ACT I #3 (Caster Awakens: Caster N 3hp CAST 3, Grunt E 2hp int 4)
  console.log('--- Scanning Act I #3 (Caster Awakens: Caster N 3hp CAST 3, Grunt E 2hp int 4) ---')
  const e3Presets: PresetName[] = ['square7', 'square8']
  const e3Candidates: CandidateScanResult[] = []

  for (const p of e3Presets) {
    console.log(`Scanning ${p} for Act I #3...`)
    for (let seed = 1; seed <= 400; seed++) {
      const res = testAct1E3Candidate(p, seed)
      if (res && res.details.stepFirstN >= 2) {
        e3Candidates.push(res)
      }
    }
  }
  console.log(`Total Act I #3 candidates (delayed first N hit >= step 2) found: ${e3Candidates.length}\n`)

  console.log('=== TOP PROLOGUE BOSS CANDIDATES ===')
  for (const c of bossCandidates.filter(c => c.details.rotateDifference).slice(0, 10)) {
    console.log(`[BOSS] ${c.preset} seed ${c.seed} (${c.arrows} arr) hash=${c.hash} Dirs(N,E,S,W)=${c.dirCounts.join('/')} Free=${c.initialFree.join('/')} CW=${c.details.cwResult} CCW=${c.details.ccwResult}`)
    console.log(`  Seq: ${c.sequence.join(' -> ')}`)
  }

  console.log('\n=== TOP ACT I #1 CANDIDATES ===')
  for (const c of e1Candidates.slice(0, 10)) {
    console.log(`[ACT1-E1] ${c.preset} seed ${c.seed} (${c.arrows} arr) hash=${c.hash} Dirs=${c.dirCounts.join('/')} Free=${c.initialFree.join('/')} Taps=${c.details.tapsToWin}`)
    console.log(`  Seq: ${c.sequence.join(' -> ')}`)
  }

  console.log('\n=== TOP ACT I #2 CANDIDATES ===')
  for (const c of e2Candidates.slice(0, 10)) {
    console.log(`[ACT1-E2] ${c.preset} seed ${c.seed} (${c.arrows} arr) hash=${c.hash} Dirs=${c.dirCounts.join('/')} Free=${c.initialFree.join('/')} Taps=${c.details.tapsToWin}`)
    console.log(`  Seq: ${c.sequence.join(' -> ')}`)
  }

  console.log('\n=== TOP ACT I #3 CANDIDATES ===')
  for (const c of e3Candidates.slice(0, 10)) {
    console.log(`[ACT1-E3] ${c.preset} seed ${c.seed} (${c.arrows} arr) hash=${c.hash} Dirs=${c.dirCounts.join('/')} Free=${c.initialFree.join('/')} 1stNStep=${c.details.stepFirstN} Taps=${c.details.tapsToWin}`)
    console.log(`  Seq: ${c.sequence.join(' -> ')}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
