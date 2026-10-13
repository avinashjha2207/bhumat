/**
 * Normalized State Vector Silhouettes (ViewBox: 0 0 100 100)
 * Designed for ultra-fast zero-dependency SVG rendering inside Next.js Edge Runtime.
 */

export const STATE_SILHOUETTES: Record<string, string> = {
  // Bihar
  bihar: 'M 18,32 L 35,28 L 52,30 L 68,26 L 82,34 L 84,48 L 78,62 L 64,68 L 52,78 L 38,72 L 24,76 L 16,60 L 14,44 Z',
  // Uttar Pradesh
  uttarpradesh: 'M 12,42 L 28,26 L 44,28 L 56,38 L 74,40 L 88,52 L 86,68 L 70,72 L 54,64 L 42,74 L 28,78 L 18,62 Z',
  // Maharashtra
  maharashtra: 'M 22,24 L 46,26 L 68,34 L 82,46 L 78,68 L 62,82 L 44,80 L 32,70 L 20,54 L 18,36 Z',
  // West Bengal
  westbengal: 'M 48,12 L 62,18 L 56,32 L 66,48 L 74,68 L 60,86 L 46,74 L 48,56 L 38,44 L 42,28 Z',
  // Madhya Pradesh
  madhyapradesh: 'M 18,38 L 36,24 L 62,26 L 82,38 L 84,58 L 72,74 L 48,76 L 30,72 L 14,56 Z',
  // Gujarat
  gujarat: 'M 14,32 L 38,24 L 54,34 L 64,48 L 58,68 L 42,74 L 32,62 L 18,66 L 12,50 Z',
  // Rajasthan
  rajasthan: 'M 24,18 L 52,16 L 76,28 L 84,54 L 68,78 L 42,82 L 22,66 L 14,42 Z',
  // Tamil Nadu
  tamilnadu: 'M 32,18 L 54,26 L 62,46 L 58,74 L 48,86 L 38,76 L 30,52 L 26,34 Z',
  // Karnataka
  karnataka: 'M 34,16 L 52,24 L 56,48 L 62,72 L 48,84 L 36,70 L 28,46 L 26,28 Z',
  // Default Pan-Bharat Silhouette
  default: 'M 46,8 L 56,16 L 52,26 L 64,32 L 78,38 L 84,48 L 74,56 L 68,68 L 54,88 L 44,74 L 36,60 L 22,50 L 24,36 L 34,26 L 42,14 Z'
};

export function getStateSilhouette(stateName?: string): string {
  if (!stateName) return STATE_SILHOUETTES.default;
  const key = stateName.toLowerCase().replace(/[^a-z]/g, '');
  return STATE_SILHOUETTES[key] || STATE_SILHOUETTES.default;
}