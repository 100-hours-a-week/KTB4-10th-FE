export type ServiceRegion = {
  code: string
  label: string
  fullName: string
  aliases?: readonly string[]
  latitude: number
  longitude: number
  level: number
}

// BE 행정구역 계약과 지도 이동에서 함께 사용하는 16개 서비스 광역 권역입니다.
export const SERVICE_REGIONS: readonly ServiceRegion[] = [
  { code: '11', label: '서울', fullName: '서울특별시', aliases: ['서울시'], latitude: 37.5665, longitude: 126.9780, level: 9 },
  { code: '12', label: '전남광주', fullName: '전남광주통합특별시', aliases: ['전남', '광주', '광주시', '전라남도'], latitude: 35.1595, longitude: 126.8526, level: 11 },
  { code: '26', label: '부산', fullName: '부산광역시', aliases: ['부산시'], latitude: 35.1796, longitude: 129.0756, level: 9 },
  { code: '27', label: '대구', fullName: '대구광역시', aliases: ['대구시'], latitude: 35.8714, longitude: 128.6014, level: 9 },
  { code: '28', label: '인천', fullName: '인천광역시', aliases: ['인천시'], latitude: 37.4563, longitude: 126.7052, level: 9 },
  { code: '30', label: '대전', fullName: '대전광역시', aliases: ['대전시'], latitude: 36.3504, longitude: 127.3845, level: 9 },
  { code: '31', label: '울산', fullName: '울산광역시', aliases: ['울산시'], latitude: 35.5395, longitude: 129.3114, level: 9 },
  { code: '36110', label: '세종', fullName: '세종특별자치시', aliases: ['세종시'], latitude: 36.4800, longitude: 127.2890, level: 9 },
  { code: '41', label: '경기', fullName: '경기도', latitude: 37.4138, longitude: 127.5183, level: 11 },
  { code: '43', label: '충북', fullName: '충청북도', latitude: 36.6357, longitude: 127.4917, level: 11 },
  { code: '44', label: '충남', fullName: '충청남도', latitude: 36.5184, longitude: 126.8000, level: 11 },
  { code: '47', label: '경북', fullName: '경상북도', latitude: 36.4919, longitude: 128.8889, level: 11 },
  { code: '48', label: '경남', fullName: '경상남도', latitude: 35.4606, longitude: 128.2132, level: 11 },
  { code: '50', label: '제주', fullName: '제주특별자치도', aliases: ['제주도'], latitude: 33.4996, longitude: 126.5312, level: 10 },
  { code: '51', label: '강원', fullName: '강원특별자치도', aliases: ['강원도'], latitude: 37.8228, longitude: 128.1555, level: 11 },
  { code: '52', label: '전북', fullName: '전북특별자치도', aliases: ['전라북도'], latitude: 35.7175, longitude: 127.1530, level: 11 },
]
