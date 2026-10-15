import type { MapContentItem } from '../api/map.ts'

export type MapSheetLevel = 'collapsed' | 'default' | 'expanded'

export type MapViewport = {
  center: {
    latitude: number
    longitude: number
  }
  level: number
}

export type MapNavigationState = {
  viewport: MapViewport
  selectedItem: MapContentItem | null
  sheetLevel: MapSheetLevel
}

const navigationStates = new Map<number, MapNavigationState>()

export function getMapNavigationState(memberId: number): MapNavigationState | null {
  return navigationStates.get(memberId) ?? null
}

export function saveMapNavigationState(
  memberId: number,
  state: MapNavigationState,
): void {
  navigationStates.set(memberId, state)
}

export function clearMapNavigationStates(): void {
  navigationStates.clear()
}
