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
  // ACT-I-003 «Край гоблинов»: 18 stages. `arena` = library/catalog id; seeds from tools/ld007-scan.mjs.
  { id: 'act1-stage-1', brief: 'a1-patrol', size: 6, profile: 'short', seed: 11, presentationFrom: 'act1-stage-1' },
  { id: 'act1-stage-2', brief: 'a2-caster', size: 6, profile: 'short', seed: 126, arena: 'goblin-arena-dusk' },
  { id: 'act1-stage-3', brief: 'a3-rock', size: 7, profile: 'short', seed: 21, arena: 'goblin-arena-hills' },
  { id: 'act1-stage-4', brief: 'a3b-scout', size: 7, profile: 'short', seed: 53, arena: 'goblin-arena-bridge' },
  { id: 'act1-stage-5', brief: 'b5-drunk', size: 6, profile: 'short', seed: 27, arena: 'goblin-outpost-sunset' },
  { id: 'act1-stage-6', brief: 'b6-wolves', size: 7, profile: 'short', seed: 108, arena: 'elven-podiums-day' },
  { id: 'act1-stage-7', brief: 'a4-three', size: 7, profile: 'short', seed: 50, arena: 'goblin-fortress-banners' },
  { id: 'act1-stage-8', brief: 'b8-matron', size: 7, profile: 'short', seed: 71, arena: 'fae-podiums' },
  { id: 'act1-stage-9', brief: 'b9-family', size: 7, profile: 'short', seed: 118, arena: 'goblin-camp-podium' },
  { id: 'act1-stage-10', brief: 'a5-captain', size: 7, profile: 'mixed', seed: 54, arena: 'goblin-camp-podium' },
  { id: 'act1-stage-11', brief: 'b11-wagon', size: 7, profile: 'short', seed: 67, arena: 'elven' },
  { id: 'act1-stage-12', brief: 'b12-spiders', size: 7, profile: 'short', seed: 53, arena: 'cemetery' },
  { id: 'act1-stage-13', brief: 'b13-circle', size: 8, profile: 'short', seed: 44, arena: 'moon-podium-shrine' },
  { id: 'act1-stage-14', brief: 'b14-shieldwall', size: 8, profile: 'short', seed: 9, arena: 'alliance-dark' },
  { id: 'act1-stage-15', brief: 'a6-gate', size: 8, profile: 'short', seed: 65, presentationFrom: 'act1-stage-1' },
  { id: 'act1-stage-16', brief: 'b16-nighthunt', size: 8, profile: 'short', seed: 75, arena: 'night-podiums-moon' },
  { id: 'act1-stage-17', brief: 'b17-royal', size: 8, profile: 'short', seed: 76, arena: 'frost-podiums' },
  { id: 'act1-stage-18', brief: 'a7-king', size: 8, profile: 'short', seed: 73, arena: 'goblin-fortress-banners' },
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
