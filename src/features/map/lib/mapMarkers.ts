import type { MapContentItem, MapMarkerItem } from '../api/map.ts'

const GUIDEBOOK_PIN_COLOR = '#f5c542'
const FAVORITE_PIN_COLOR = '#e85d75'
const EVENT_PIN_COLOR = '#5b4b8a'
const PLACE_PIN_COLOR = '#4a6754'

export function pinColor(item: MapContentItem | MapMarkerItem): string {
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
  const countSize = count < 10 ? 58 : count < 100 ? 74 : 90
  const zoomAdjustment = level >= 13 ? -6 : level >= 10 ? -2 : 0
  const size = countSize + zoomAdjustment
  const palette = count < 10
    ? { core: '#E0F2FF', fill: '#91CCFF', edge: '#5BAAF0', glow: '#C4E7FF', text: '#263746' }
    : count < 100
      ? { core: '#DCF8F0', fill: '#80DED0', edge: '#41BFB1', glow: '#BAF0E6', text: '#24433E' }
      : { core: '#EAF8D4', fill: '#BAE58C', edge: '#83C75D', glow: '#D8F1B7', text: '#34442C' }

  return {
    size,
    fontSize: count < 10 ? 15 : count < 100 ? 17 : 20,
    ...palette,
  }
}

export function clusterSvg(count: number, size: number): string {
  const style = serverClusterStyle(0, count)
  const center = size / 2
  const radius = size * 0.305
  const strokes = Array.from({ length: 9 }, (_, index) => `
    <ellipse cx="${center + Math.sin(index * 1.8) * 1.8}" cy="${center + Math.cos(index * 2.2) * 1.5}"
      rx="${radius + (index % 3) * 1.1}" ry="${radius + ((index + 1) % 3) * 0.9}"
      fill="none" stroke="${style.edge}" stroke-width="${index % 3 === 0 ? 2.1 : 1.15}"
      stroke-opacity="${0.12 + (index % 4) * 0.075}" stroke-linecap="round"
      stroke-dasharray="${index % 2 === 0 ? '14 3 7 2' : '5 2 17 3'}"
      transform="rotate(${index * 29} ${center} ${center})"/>
  `).join('')
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <radialGradient id="halo"><stop offset="0%" stop-color="${style.core}" stop-opacity=".84"/>
          <stop offset="43%" stop-color="${style.fill}" stop-opacity=".62"/>
          <stop offset="69%" stop-color="${style.glow}" stop-opacity=".35"/>
          <stop offset="100%" stop-color="${style.glow}" stop-opacity="0"/></radialGradient>
        <radialGradient id="center" cx="42%" cy="38%" r="70%"><stop offset="0%" stop-color="${style.core}" stop-opacity=".95"/>
          <stop offset="72%" stop-color="${style.core}" stop-opacity=".75"/>
          <stop offset="100%" stop-color="${style.fill}" stop-opacity=".35"/></radialGradient>
      </defs>
      <circle cx="${center}" cy="${center}" r="${size * 0.49}" fill="url(#halo)"/>
      <ellipse cx="${center - 1}" cy="${center + 0.5}" rx="${radius * 1.09}" ry="${radius * 1.04}"
        fill="${style.fill}" fill-opacity=".22" transform="rotate(-13 ${center} ${center})"/>
      <circle cx="${center}" cy="${center}" r="${radius * 0.9}" fill="url(#center)"/>
      ${strokes}
      <text x="${center}" y="${center + 1}" fill="${style.text}" font-size="${style.fontSize}" font-weight="700"
        font-family="Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
        text-anchor="middle" dominant-baseline="middle">${clusterLabel(count)}</text>
    </svg>`
}

export function clientClusterStyle(count: number) {
  const { size } = serverClusterStyle(0, count)
  const source = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(clusterSvg(count, size))}`
  return {
    width: `${size}px`, height: `${size}px`, backgroundImage: `url("${source}")`,
    backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
    border: 'none', borderRadius: '50%', boxShadow: 'none', color: 'transparent',
    fontSize: '0px', lineHeight: `${size}px`, textAlign: 'center', cursor: 'pointer',
  }
}
