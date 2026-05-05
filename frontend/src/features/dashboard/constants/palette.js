/**
 * Multi-series charts use Viridis-style steps; sentiment uses fixed brand hues
 * (positive / neutral / negative).
 */
export const VIRIDIS = {
  indigo: '#440154',
  indigoMid: '#482878',
  teal: '#21918c',
  tealDeep: '#31688e',
  green: '#35b779',
  lime: '#5ec962',
  limeLight: '#6ece58',
  yellowGreen: '#90d743',
  yellow: '#fde725',
}

export const SENTIMENT_COLORS = {
  Positive: '#6FBF73',
  Neutral: '#E6C76B',
  Negative: '#D96C6C',
  'No Data': '#d1d5db',
}

/** Multi-series: steps along Viridis (teals / greens / indigo mid-tones). */
export const CHART_PALETTE = [
  VIRIDIS.teal,
  VIRIDIS.indigoMid,
  VIRIDIS.green,
  VIRIDIS.yellowGreen,
  VIRIDIS.tealDeep,
  VIRIDIS.limeLight,
]
