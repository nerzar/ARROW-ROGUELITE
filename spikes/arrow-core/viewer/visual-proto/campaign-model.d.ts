import type { GenerateLevelResult, Level, RunStep } from '../../src/index.js'
import type { ArenaCalibration } from './arena-calibration.js'
import type { ArenaCatalogItem } from './asset-catalog.js'

export interface AuthoredEnemyDef {
  id: string
  species: string
  label: string
  side: number | string
  hp: number
  attackTimer?: { interval: number; damage: number } | null
}

export interface AuthoredLevelDef {
  id: string
  title: string
  board: {
    preset: string
    size: number
    seed: number
  }
  presentation: {
    arena: string
    background: string
    calibration?: ArenaCalibration | object | null
  }
  encounter: {
    id: string
    title: string
    enemies?: AuthoredEnemyDef[]
    boss?: {
      id: string
      phases: Array<{ side: number; hpUnits: number; label?: string }>
    }
    rotate: { allow: number[] }
    blockedTapDamage: number
    notes?: string
  }
}

export interface AuthoredCampaign {
  format: 'arrow-campaign'
  v: number
  id: string
  title: string
  levels: AuthoredLevelDef[]
  customArenas?: ArenaCatalogItem[]
  arenaDefaults?: Record<string, any>
}

export interface SaveCampaignResult {
  ok: boolean
  fileSaved: boolean
  storageSaved: boolean
  filePath: string
  error?: string | null
}

export interface LoadCampaignResult {
  source: 'file' | 'storage' | 'default'
  campaign: AuthoredCampaign
}

export declare const STORAGE_CAMPAIGN_KEY: string

export declare function createDefaultLevel(index?: number, size?: number): AuthoredLevelDef
export declare function getArenaBaseline(arena: ArenaCatalogItem, campaign?: AuthoredCampaign | null): ArenaCalibration
export declare function changeLevelArena(levelDef: AuthoredLevelDef, newArenaIdOrPath: string, campaign?: AuthoredCampaign | null): ArenaCalibration
export declare function createDefaultCampaign(): AuthoredCampaign
export declare function generateBoardForLevel(levelDef: AuthoredLevelDef): GenerateLevelResult
export declare function getNextAvailableSide(existingEnemies?: Array<{ side: number | string }>): number
export declare function convertLevelToStep(levelDef: AuthoredLevelDef): RunStep
export declare function saveCampaign(campaign: AuthoredCampaign): Promise<SaveCampaignResult>
export declare function loadCampaign(): Promise<LoadCampaignResult>
