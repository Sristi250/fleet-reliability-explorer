import { parseTables, TABLE_FILES, type CsvTexts } from './parse'
import type { RawTables } from './types'

/**
 * Where the raw tables come from. The public build reads the synthetic CSVs.
 * In production this is where a Snowflake or Fabric query (behind an API)
 * would plug in: return the same RawTables and nothing else changes.
 */
export interface DataSource {
  name: string
  load(): Promise<RawTables>
}

export function csvSource(baseUrl = `${import.meta.env.BASE_URL}data/`): DataSource {
  return {
    name: 'Synthetic CSVs',
    async load() {
      const entries = await Promise.all(
        Object.entries(TABLE_FILES).map(async ([table, file]) => {
          const res = await fetch(baseUrl + file)
          if (!res.ok) throw new Error(`Could not load ${file} (HTTP ${res.status})`)
          return [table, await res.text()] as const
        }),
      )
      return parseTables(Object.fromEntries(entries) as CsvTexts)
    },
  }
}
