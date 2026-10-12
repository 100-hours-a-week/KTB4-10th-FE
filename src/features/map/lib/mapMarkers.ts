import type { MapContentItem } from '../api/map.ts'

const GUIDEBOOK_PIN_COLOR = '#f5c542'
const FAVORITE_PIN_COLOR = '#e85d75'
const EVENT_PIN_COLOR = '#5b4b8a'
const PLACE_PIN_COLOR = '#4a6754'

export function pinColor(item: MapContentItem): string {
  if (item.is_in_guidebook) return GUIDEBOOK_PIN_COLOR
  if (item.is_favorite) return FAVORITE_PIN_COLOR
  return item.content_type === 'EVENT' ? EVENT_PIN_COLOR : PLACE_PIN_COLOR
}

export function clusterLabel(size: number): string {
  if (size >= 100) return '99+'
  if (size >= 10) return '9+'
  return String(size)
}

export function serverClusterStyle(level: number, count: number) {
  const countSize = count < 10 ? 42 : count < 100 ? 50 : 58
  const zoomAdjustment = level >= 13 ? -6 : level >= 10 ? -2 : 0
  const size = countSize + zoomAdjustment
  const palette = count < 10
    ? { fill: '#148F77', edge: '#0B6B5A', glow: '#43D7B5' }
    : count < 100
      ? { fill: '#2478FF', edge: '#1559C6', glow: '#77ABFF' }
      : { fill: '#6C4CF1', edge: '#4930B8', glow: '#A795FF' }

  return {
    size,
    fontSize: size <= 40 ? 13 : size <= 48 ? 14 : 16,
    ...palette,
  }
}
