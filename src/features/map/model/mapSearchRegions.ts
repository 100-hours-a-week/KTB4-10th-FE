import { SERVICE_REGIONS, type ServiceRegion } from '../../../shared/model/serviceRegions.ts'

export type MapSearchRegion = Pick<
  ServiceRegion,
  'code' | 'label' | 'fullName' | 'latitude' | 'longitude' | 'level'
>
export const MAP_SEARCH_REGIONS = SERVICE_REGIONS

function normalizedRegionName(value: string): string {
  return value.replace(/\s+/g, '')
}

export function searchMapRegions(query: string): MapSearchRegion[] {
  const normalizedQuery = query.trim().slice(0, 10).replace(/\s+/g, '')
  if (!normalizedQuery) return []
  return MAP_SEARCH_REGIONS.filter(({ label, fullName, aliases = [] }) => (
    label.replace(/\s+/g, '').includes(normalizedQuery) ||
    fullName.replace(/\s+/g, '').includes(normalizedQuery) ||
    aliases.some((alias) => alias.replace(/\s+/g, '').includes(normalizedQuery))
  ))
}

export function mergeMapRegions(
  primary: readonly MapSearchRegion[],
  secondary: readonly MapSearchRegion[],
): MapSearchRegion[] {
  const merged = new Map<string, MapSearchRegion>()
  for (const region of [...primary, ...secondary]) {
    const key = normalizedRegionName(region.fullName)
    if (!merged.has(key)) merged.set(key, region)
  }
  return [...merged.values()]
}
