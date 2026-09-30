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
  const zoomMaximum = level >= 13 ? 28 : level >= 10 ? 32 : 38
  const countSize = count < 10 ? 24 : count < 100 ? 30 : 38
  const size = Math.min(zoomMaximum, countSize)
  return {
    size,
    fontSize: size <= 24 ? 10 : size <= 30 ? 11 : 13,
    fillOpacity: level >= 13 ? 0.7 : level >= 10 ? 0.8 : 0.9,
  }
}
