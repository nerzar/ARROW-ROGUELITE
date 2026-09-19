// LD-007: assemble the provisional Act I chain into campaigns/campaign.json (design playtest
// tooling, throwaway). Prologue stages are kept byte-for-byte; every `act1-*` stage is replaced
// by the LD-007 list below (brief JSON + chosen board size/profile/seed). Presentation blocks
// are copied from the existing Act I stages so arena calibration stays exactly as calibrated.
//
// usage: node tools/ld007-build-campaign.mjs [--dry]

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const here = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const campaignPath = resolve(here, '../campaigns/campaign.json')
const briefs = resolve(here, '../campaigns/ld007-briefs')
const dry = process.argv.includes('--dry')
const { findArena } = await import(pathToFileURL(resolve(here, '../viewer/visual-proto/asset-catalog.js')).href)

/** The provisional chain. `size`/`profile`/`seed` are the LD-007 picks (see the LD-007 report). */
export const LD007_ACT1 = [
  { id: 'act1-stage-1', brief: 'a1-patrol', size: 6, profile: 'short', seed: 11, presentationFrom: 'act1-stage-1' },
  { id: 'act1-stage-2', brief: 'a2-caster', size: 6, profile: 'short', seed: 126, presentationFrom: 'act1-stage-3' },
  { id: 'act1-stage-3', brief: 'a3-rock', size: 7, profile: 'short', seed: 21, presentationFrom: 'act1-stage-4' },
  { id: 'act1-stage-4', brief: 'a3b-scout', size: 7, profile: 'short', seed: 53, presentationFrom: 'act1-stage-2' },
  { id: 'act1-stage-5', brief: 'a4-three', size: 7, profile: 'short', seed: 50, presentationFrom: 'act1-stage-5' },
  // LD-007: user asked for a scene with a centre podium here -> library arena (see arena-library.js TUNED).
  { id: 'act1-stage-6', brief: 'a5-captain', size: 7, profile: 'mixed', seed: 54, arena: 'goblin-camp-podium' },
  { id: 'act1-stage-7', brief: 'a6-gate', size: 8, profile: 'short', seed: 65, presentationFrom: 'act1-stage-7' },
  { id: 'act1-stage-8', brief: 'a7-king', size: 8, profile: 'short', seed: 73, presentationFrom: 'act1-stage-8' },
]

const campaign = JSON.parse(readFileSync(campaignPath, 'utf8'))
const oldById = new Map(campaign.levels.map((l) => [l.id, l]))
const prologue = campaign.levels.filter((l) => !l.id.startsWith('act1-'))

const act1 = LD007_ACT1.map((c) => {
  const brief = JSON.parse(readFileSync(resolve(briefs, `${c.brief}.json`), 'utf8'))
  const from = oldById.get(c.presentationFrom) ?? oldById.get('act1-stage-1')
  const presentation = c.arena
    ? (() => {
        const a = findArena(c.arena)
        return { arena: a.id, background: a.path, calibration: JSON.parse(JSON.stringify(a.defaultCalibration)) }
      })()
    : JSON.parse(JSON.stringify(from.presentation))
  return {
    id: c.id,
    title: brief.title,
    board: { preset: `square-${c.size}`, size: c.size, seed: c.seed, profile: c.profile },
    presentation,
    encounter: {
      ...brief,
      notes: `LD-007 provisional playtest stage (branch design/LD-007-act1-gameplay-pass). ${brief.notes ?? ''}`.trim(),
    },
  }
})

campaign.levels = [...prologue, ...act1]
campaign.title = 'Пролог + Акт I (LD-007 provisional)'
if (dry) console.log(JSON.stringify(act1.map((l) => ({ id: l.id, title: l.title, board: l.board })), null, 1))
else {
  // The checked-in file uses CRLF; keep it so the diff stays readable.
  writeFileSync(campaignPath, (JSON.stringify(campaign, null, 2) + '\n').replace(/\n/g, '\r\n'), 'utf8')
  console.log(`wrote ${campaignPath}: ${prologue.length} prologue + ${act1.length} LD-007 Act I stages`)
}
