import { SERVICE_REGIONS, type ServiceRegion } from '../../../shared/model/serviceRegions.ts'

export type MapSearchRegion = ServiceRegion
export const MAP_SEARCH_REGIONS = SERVICE_REGIONS

export function searchMapRegions(query: string): MapSearchRegion[] {
  const normalizedQuery = query.trim().slice(0, 10).replace(/\s+/g, '')
  if (!normalizedQuery) return []
  return MAP_SEARCH_REGIONS.filter(({ label, fullName, aliases = [] }) => (
    label.replace(/\s+/g, '').includes(normalizedQuery) ||
    fullName.replace(/\s+/g, '').includes(normalizedQuery) ||
    aliases.some((alias) => alias.replace(/\s+/g, '').includes(normalizedQuery))
  ))
}
