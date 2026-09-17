import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
import { runPatternMining } from './pattern-miner.js'

async function main() {
  console.log('Starting Arrow Puzzle Pattern Mining across 30,000 seeds...')
  const t0 = performance.now()

  console.log('\n--- Scanning preset "easy" (6x7): 10,000 seeds (1..10000) ---')
  const tEasy = performance.now()
  const easySummary = runPatternMining('easy', 1, 10000, 20)
  console.log(`Easy scan done in ${((performance.now() - tEasy) / 1000).toFixed(2)}s`)
  console.log('Easy Pattern Frequencies:')
  for (const [tag, count] of Object.entries(easySummary.patternCounts)) {
    console.log(`  ${tag.padEnd(22)}: ${count} (${((count / 10000) * 100).toFixed(1)}%)`)
  }

  console.log('\n--- Scanning preset "medium" (8x10): 10,000 seeds (1..10000) ---')
  const tMed = performance.now()
  const medSummary = runPatternMining('medium', 1, 10000, 20)
  console.log(`Medium scan done in ${((performance.now() - tMed) / 1000).toFixed(2)}s`)
  console.log('Medium Pattern Frequencies:')
  for (const [tag, count] of Object.entries(medSummary.patternCounts)) {
    console.log(`  ${tag.padEnd(22)}: ${count} (${((count / 10000) * 100).toFixed(1)}%)`)
  }

  console.log('\n--- Scanning preset "hard" (10x12): 10,000 seeds (1..10000) ---')
  const tHard = performance.now()
  const hardSummary = runPatternMining('hard', 1, 10000, 20)
  console.log(`Hard scan done in ${((performance.now() - tHard) / 1000).toFixed(2)}s`)
  console.log('Hard Pattern Frequencies:')
  for (const [tag, count] of Object.entries(hardSummary.patternCounts)) {
    console.log(`  ${tag.padEnd(22)}: ${count} (${((count / 10000) * 100).toFixed(1)}%)`)
  }

  const totalTime = ((performance.now() - t0) / 1000).toFixed(2)
  console.log(`\nAll 30,000 seeds scanned in ${totalTime}s!`)

  const outData = {
    generatedAt: new Date().toISOString(),
    totalScanned: 30000,
    scanTimeSeconds: totalTime,
    presets: {
      easy: easySummary,
      medium: medSummary,
      hard: hardSummary,
    },
  }

  const outFile = 'encounters/pattern-mining-results.json'
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, JSON.stringify(outData, null, 2), 'utf-8')
  console.log(`Saved detailed pattern results to ${outFile}`)
}

main().catch(console.error)
