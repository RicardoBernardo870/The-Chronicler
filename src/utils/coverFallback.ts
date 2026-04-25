export const coverFallback = (e: Event): void => {
  ;(e.target as HTMLImageElement).style.display = 'none'
}
