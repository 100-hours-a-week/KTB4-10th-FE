import type { MapContentItem } from '../api/map.ts'

const GUIDEBOOK_PIN_COLOR = '#f5c542'
const FAVORITE_PIN_COLOR = '#e85d75'
const EVENT_PIN_COLOR = '#5b4b8a'
const PLACE_PIN_COLOR = '#4a6754'

export function pinColor(item: MapContentItem): string {
  if (item.is_in_guidebook) return GUIDEBOOK_PIN_COLOR
  if (item.is_favorite) return FAVORITE_PIN_COLOR

  return item.content_type === 'EVENT'
    ? EVENT_PIN_COLOR
    : PLACE_PIN_COLOR
}

export function clusterLabel(size: number): string {
  if (size >= 100) return '99+'
  if (size >= 10) return '9+'
  return String(size)
}

export type PastelClusterPalette = {
  core: string
  fill: string
  edge: string
  glow: string
  text: string
}

export function clusterPalette(count: number): PastelClusterPalette {
  if (count < 10) {
    return {
      core: '#E0F2FF',
      fill: '#91CCFF',
      edge: '#5BAAF0',
      glow: '#C4E7FF',
      text: '#263746',
    }
  }

  if (count < 100) {
    return {
      core: '#DCF8F0',
      fill: '#80DED0',
      edge: '#41BFB1',
      glow: '#BAF0E6',
      text: '#24433E',
    }
  }

  return {
    core: '#EAF8D4',
    fill: '#BAE58C',
    edge: '#83C75D',
    glow: '#D8F1B7',
    text: '#34442C',
  }
}

export function serverClusterStyle(level: number, count: number) {
  // 실제 SVG 영역에는 외곽 번짐까지 포함
  const baseSize = count < 10 ? 58 : count < 100 ? 74 : 90

  // 기존 API 줌 정책에 따른 보정
  const zoomAdjustment = level >= 13 ? -6 : level >= 10 ? -2 : 0

  const size = baseSize + zoomAdjustment

  return {
    size,
    fontSize: count < 10 ? 15 : count < 100 ? 17 : 20,
    ...clusterPalette(count),
  }
}

/**
 * 크레파스 질감 SVG 생성
 *
 * 1. 반투명 외곽 번짐
 * 2. 불규칙한 중심 채색
 * 3. 여러 겹의 크레파스 선
 * 4. 중앙 숫자
 */
export function clusterSvg(count: number, size: number): string {
  const palette = clusterPalette(count)
  const label = clusterLabel(count)

  const center = size / 2
  const radius = size * 0.305
  const fontSize = count < 10 ? 15 : count < 100 ? 17 : 20

  // 외곽선이 기계적인 원처럼 보이지 않도록
  // 여러 개의 살짝 어긋난 타원을 겹침
  const crayonStrokes = Array.from({ length: 9 }, (_, index) => {
    const angle = index * 29
    const offsetX = Math.sin(index * 1.8) * 1.8
    const offsetY = Math.cos(index * 2.2) * 1.5

    const rx = radius + (index % 3) * 1.1
    const ry = radius + ((index + 1) % 3) * 0.9

    const opacity = 0.12 + (index % 4) * 0.075
    const strokeWidth = index % 3 === 0 ? 2.1 : 1.15

    return `
      <ellipse
        cx="${center + offsetX}"
        cy="${center + offsetY}"
        rx="${rx}"
        ry="${ry}"
        fill="none"
        stroke="${palette.edge}"
        stroke-width="${strokeWidth}"
        stroke-opacity="${opacity}"
        stroke-linecap="round"
        stroke-dasharray="${index % 2 === 0 ? '14 3 7 2' : '5 2 17 3'}"
        transform="rotate(${angle} ${center} ${center})"
      />
    `
  }).join('')

  // 크레파스가 종이에 조금씩 묻은 듯한 가는 결
  const textureLines = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * 137.5 * Math.PI) / 180
    const distance = radius * (0.67 + (index % 4) * 0.09)

    const x1 = center + Math.cos(angle) * distance
    const y1 = center + Math.sin(angle) * distance

    const x2 = x1 + Math.cos(angle + 0.8) * (size * 0.075)
    const y2 = y1 + Math.sin(angle + 0.8) * (size * 0.075)

    return `
      <path
        d="M ${x1.toFixed(2)} ${y1.toFixed(2)}
           L ${x2.toFixed(2)} ${y2.toFixed(2)}"
        fill="none"
        stroke="${palette.edge}"
        stroke-opacity="0.2"
        stroke-width="1.1"
        stroke-linecap="round"
      />
    `
  }).join('')

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${size}"
      height="${size}"
      viewBox="0 0 ${size} ${size}"
    >
      <defs>
        <radialGradient id="pastel-halo">
          <stop offset="0%" stop-color="${palette.core}" stop-opacity="0.84"/>
          <stop offset="43%" stop-color="${palette.fill}" stop-opacity="0.62"/>
          <stop offset="69%" stop-color="${palette.glow}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0"/>
        </radialGradient>

        <radialGradient id="pastel-center" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stop-color="${palette.core}" stop-opacity="0.95"/>
          <stop offset="72%" stop-color="${palette.core}" stop-opacity="0.75"/>
          <stop offset="100%" stop-color="${palette.fill}" stop-opacity="0.35"/>
        </radialGradient>
      </defs>

      <!-- 넓게 퍼지는 파스텔 번짐 -->
      <circle
        cx="${center}"
        cy="${center}"
        r="${size * 0.49}"
        fill="url(#pastel-halo)"
      />

      <!-- 약간 비대칭인 채색 영역 -->
      <ellipse
        cx="${center - 1}"
        cy="${center + 0.5}"
        rx="${radius * 1.09}"
        ry="${radius * 1.04}"
        fill="${palette.fill}"
        fill-opacity="0.22"
        transform="rotate(-13 ${center} ${center})"
      />

      <!-- 안쪽의 연한 파스텔 중심 -->
      <circle
        cx="${center}"
        cy="${center}"
        r="${radius * 0.9}"
        fill="url(#pastel-center)"
      />

      <!-- 여러 겹의 크레파스 선 -->
      ${crayonStrokes}

      <!-- 불규칙한 크레파스 결 -->
      ${textureLines}

      <!-- 숫자 -->
      <text
        x="${center}"
        y="${center + 1}"
        fill="${palette.text}"
        font-size="${fontSize}"
        font-weight="700"
        font-family="Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
        text-anchor="middle"
        dominant-baseline="middle"
      >${label}</text>
    </svg>
  `
}

/**
 * 카카오 MarkerClusterer에서 사용할 CSS 스타일
 *
 * CSS만으로는 SVG만큼 크레파스 결을 표현하기 어려우므로
 * 동일한 SVG를 배경 이미지로 활용한다.
 */
export function clientClusterStyle(count: number) {
  const { size } = serverClusterStyle(0, count)
  const svg = clusterSvg(count, size)

  const source = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url("${source}")`,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    border: 'none',
    borderRadius: '50%',
    boxShadow: 'none',

    // 텍스트는 SVG 내부에서 직접 그림
    // 클러스터러 기본 텍스트는 투명 처리
    color: 'transparent',
    fontSize: '0px',
    lineHeight: `${size}px`,
    textAlign: 'center',
    cursor: 'pointer',
  }
}