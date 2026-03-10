'use client'

import { useRef, useCallback, useState } from 'react'
import Map, {
  Marker,
  Popup,
  NavigationControl,
  type MapRef,
} from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
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
      setPopupRec(rec)
      onMarkerClick(rec)
    },
    [onMarkerClick]
  )

  const activeRec = selectedRec ?? hoveredRec

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          ...LA_CENTER,
          zoom: 13,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onLoad={handleMapLoad}
        onClick={() => setPopupRec(null)}
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
              title={destination.label}
            >
              <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
              <div className="w-0.5 h-2 bg-blue-500" />
            </div>
          </Marker>
        )}

        {recommendations.map((rec, idx) => {
          const color = scoreToColor(rec.score)
          const isActive = activeRec?.meter.space_id === rec.meter.space_id
          const rank = idx + 1

          return (
            <Marker
              key={rec.meter.space_id}
              latitude={rec.meter.lat}
              longitude={rec.meter.lng}
              anchor="center"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRecFly(rec)
                }}
                className="relative flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
                style={{ transform: isActive ? 'scale(1.25)' : undefined }}
                title={rec.meter.street_address}
              >
                {isActive && (
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                    style={{ backgroundColor: color }}
                  />
                )}
                <div
                  className="relative w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-[10px]"
                  style={{ backgroundColor: color }}
                >
                  {rank}
                </div>
              </button>
            </Marker>
          )
        })}

        {popupRec && (
          <Popup
            latitude={popupRec.meter.lat}
            longitude={popupRec.meter.lng}
            anchor="bottom"
            offset={20}
            onClose={() => setPopupRec(null)}
            closeOnClick={false}
            className="parking-popup"
          >
            <div className="bg-slate-800 rounded-lg p-3 min-w-[240px] text-white text-sm">
              <p className="font-semibold text-white leading-tight">
                {popupRec.meter.street_address}
              </p>
              <PopupSignBadge
                timeLimitHours={popupRec.meter.time_limit_hours}
                ratePerHour={popupRec.meter.rate_per_hour}
                enforcedHoursDisplay={popupRec.enforced_hours_display}
              />
              <div className="flex justify-between mt-3 text-xs text-slate-300">
                <span>{metersToMinutes(popupRec.walk_distance_meters)} walk</span>
                <span>${popupRec.total_cost.toFixed(2)} est.</span>
              </div>
              {popupRec.risk_flags.length > 0 && (
                <div className="mt-2 space-y-1">
                  {popupRec.risk_flags.map((flag, i) => (
                    <div key={i} className="text-xs text-orange-300 bg-orange-950 rounded px-2 py-1">
                      {flag}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-slate-700">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${popupRec.is_safe ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                  {popupRec.is_safe ? 'Safe to Park' : 'Check Signs'}
                </span>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      <div className="absolute bottom-6 left-4 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg p-3 text-xs text-slate-300 space-y-1.5">
        <p className="font-semibold text-slate-200 mb-2">Score Legend</p>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span>80+ Great</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500" /><span>50-79 OK</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span>&lt;50 Risky</span></div>
        <div className="flex items-center gap-2 pt-1 border-t border-slate-700"><div className="w-3 h-3 rounded-full bg-blue-500" /><span>Destination</span></div>
      </div>
    </div>
  )
}
