'use client'

import { useRef, useCallback, useState } from 'react'
import Map, {
  Marker,
  Popup,
  NavigationControl,
  type MapRef,
} from 'react-map-gl'
import type { ParkingRecommendation } from '@/lib/types'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

const LA_CENTER = { latitude: 34.0522, longitude: -118.2437 }

function scoreToColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 50) return '#eab308'
  return '#ef4444'
}

function metersToMinutes(meters: number): string {
  const mins = Math.round(meters / 80)
  return mins <= 1 ? '1 min' : `${mins} min`
}

function PopupSignBadge({
  timeLimitHours,
  ratePerHour,
  enforcedHoursDisplay,
}: {
  timeLimitHours: number
  ratePerHour: number
  enforcedHoursDisplay: string
}) {
  const timeLimitDisplay =
    timeLimitHours < 1
      ? `${Math.round(timeLimitHours * 60)} MIN`
      : `${timeLimitHours} HR`

  return (
    <div className="flex items-stretch rounded overflow-hidden border border-slate-600 w-full mt-2">
      <div className="bg-blue-600 flex items-center justify-center px-3">
        <span className="text-white font-black text-2xl leading-none">P</span>
      </div>
      <div className="bg-slate-700 flex flex-col justify-center px-3 py-2 gap-1 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-white font-bold text-sm leading-none">{timeLimitDisplay}</span>
          <span className="text-green-400 font-semibold text-sm leading-none">${ratePerHour.toFixed(2)}/hr</span>
        </div>
        <span className="text-slate-300 text-xs leading-none">{enforcedHoursDisplay}</span>
      </div>
    </div>
  )
}

interface ParkingMapProps {
  destination: { lat: number; lng: number; label: string } | null
  recommendations: ParkingRecommendation[]
  selectedRec: ParkingRecommendation | null
  hoveredRec: ParkingRecommendation | null
  onMarkerClick: (rec: ParkingRecommendation) => void
}

export default function ParkingMap({
  destination,
  recommendations,
  selectedRec,
  hoveredRec,
  onMarkerClick,
}: ParkingMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [popupRec, setPopupRec] = useState<ParkingRecommendation | null>(null)

  const handleMapLoad = useCallback(() => {
    if (destination && mapRef.current) {
      mapRef.current.flyTo({
        center: [destination.lng, destination.lat],
        zoom: 15,
        duration: 1200,
      })
    }
  }, [destination])

  const handleDestinationFly = useCallback(() => {
    if (destination && mapRef.current) {
      mapRef.current.flyTo({
        center: [destination.lng, destination.lat],
        zoom: 15,
        duration: 1200,
      })
    }
  }, [destination])

  const handleRecFly = useCallback(
    (rec: ParkingRecommendation) => {
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [rec.meter.lng, rec.meter.lat],
          zoom: 16,
          duration: 800,
        })
      }
    },
    []
  )

  return (
    <Map
      ref={mapRef}
      mapboxApiAccessToken={MAPBOX_TOKEN}
      initialViewState={{
        ...LA_CENTER,
        zoom: 13,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      onLoad={handleMapLoad}
    >
      <NavigationControl position="top-right" />

      {destination && (
        <Marker
          latitude={destination.lat}
          longitude={destination.lng}
          anchor="bottom"
        >
          <div
            className="flex flex-col items-center cursor-pointer"
            onClick={handleDestinationFly}
          >
            <div className="bg-indigo-500 text-white text-xs font-semibold px-2 py-1 rounded shadow-lg whitespace-nowrap">
              {destination.label}
            </div>
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-indigo-500" />
          </div>
        </Marker>
      )}

      {recommendations.map((rec, i) => {
        const isSelected = selectedRec?.meter.id === rec.meter.id
        const isHovered = hoveredRec?.meter.id === rec.meter.id
        const color = scoreToColor(rec.score)
        const size = isSelected || isHovered ? 36 : 28

        return (
          <Marker
            key={rec.meter.id}
            latitude={rec.meter.lat}
            longitude={rec.meter.lng}
            anchor="center"
          >
            <div
              className="flex items-center justify-center rounded-full font-bold text-white cursor-pointer transition-all shadow-lg"
              style={{
                width: size,
                height: size,
                backgroundColor: color,
                fontSize: size > 28 ? 14 : 12,
                border: isSelected ? '2px solid white' : '1.5px solid rgba(255,255,255,0.4)',
                zIndex: isSelected ? 10 : isHovered ? 9 : i,
              }}
              onClick={() => {
                onMarkerClick(rec)
                setPopupRec(rec)
                handleRecFly(rec)
              }}
            >
              {i + 1}
            </div>
          </Marker>
        )
      })}

      {popupRec && (
        <Popup
          latitude={popupRec.meter.lat}
          longitude={popupRec.meter.lng}
          anchor="top"
          onClose={() => setPopupRec(null)}
          closeOnClick={false}
          className="parking-popup"
        >
          <div className="bg-slate-800 text-white rounded-lg p-3 min-w-[200px] text-sm">
            <div className="font-semibold text-base mb-1 truncate">{popupRec.meter.blockface}</div>
            <div className="text-slate-400 text-xs mb-2">{popupRec.meter.subArea}</div>
            <div className="flex gap-3 text-xs mb-1">
              <span className="text-slate-300">{metersToMinutes(popupRec.walkMeters)} walk</span>
              <span className="text-slate-300">{popupRec.spacesAvailable} spaces</span>
            </div>
            <PopupSignBadge
              timeLimitHours={popupRec.meter.timeLimitHours}
              ratePerHour={popupRec.meter.ratePerHour}
              enforcedHoursDisplay={popupRec.meter.enforcedHoursDisplay}
            />
          </div>
        </Popup>
      )}
    </Map>
  )
}
