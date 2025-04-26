import { createContext, useContext, useState } from 'react'

const ZoomArtworkContext = createContext()

export function ZoomArtworkProvider({ children }) {
  const [zoomedArtwork, setZoomedArtwork] = useState(null)

  return (
    <ZoomArtworkContext.Provider value={{ zoomedArtwork, setZoomedArtwork }}>
      {children}
    </ZoomArtworkContext.Provider>
  )
}

export const useZoomArtwork = () => useContext(ZoomArtworkContext)
