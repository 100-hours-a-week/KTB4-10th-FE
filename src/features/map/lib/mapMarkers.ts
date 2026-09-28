import type { MapContentItem } from '../api/map.ts'

const GUIDEBOOK_PIN_COLOR = '#b76e42'
const EVENT_PIN_COLOR = '#5b4b8a'
const PLACE_PIN_COLOR = '#4a6754'

export function pinColor(item: MapContentItem): string {
  if (item.is_in_guidebook) return GUIDEBOOK_PIN_COLOR
  return item.content_type === 'EVENT' ? EVENT_PIN_COLOR : PLACE_PIN_COLOR
}
