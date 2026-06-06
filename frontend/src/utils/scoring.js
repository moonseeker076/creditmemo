export const getSignalColor = (signal, theme) => {
  const isDark = theme === 'dark'
  if (signal === 'Hot') return '#1D9E75'
  if (signal === 'Rising') return '#378ADD'
  return '#BA7517'
}

export const getSignalBg = (signal) => {
  if (signal === 'Hot') return 'rgba(29,158,117,0.15)'
  if (signal === 'Rising') return 'rgba(55,138,221,0.15)'
  return 'rgba(186,117,23,0.15)'
}

export const getPctColor = (val) => {
  if (val == null) return '#888'
  if (val > 5) return '#1D9E75'
  if (val > 0) return '#378ADD'
  return '#D85A30'
}
