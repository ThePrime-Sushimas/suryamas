// Web Vitals monitoring (optional - install web-vitals package)
export const reportWebVitals = (onPerfEntry?: (metric: any) => void) => {
  if (onPerfEntry && typeof onPerfEntry === 'function') {
    // Uncomment after installing: npm install web-vitals
    // import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
    //   onCLS(onPerfEntry)
    //   onFID(onPerfEntry)
    //   onFCP(onPerfEntry)
    //   onLCP(onPerfEntry)
    //   onTTFB(onPerfEntry)
    // })
  }
}

// Log performance metrics to console in development
if (import.meta.env.DEV) {
  // Performance API available in browser
  if (typeof window !== 'undefined' && window.performance) {
    window.addEventListener('load', () => {
      const perfData = window.performance.timing
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart
      console.log(`[Performance] Page Load Time: ${pageLoadTime}ms`)
    })
  }
}
