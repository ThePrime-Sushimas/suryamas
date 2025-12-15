import { useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapPickerProps {
  latitude: number | null
  longitude: number | null
  onLocationSelect: (lat: number, lng: number) => void
}

const defaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e: any) {
      onLocationSelect(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function MapPicker({ latitude, longitude, onLocationSelect }: MapPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const center: [number, number] = [latitude || -6.2088, longitude || 106.8456]

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full px-3 py-2 border rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
      >
        📍 Pick Location from Map
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">Select Location</h3>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          <MapContainer center={center} zoom={13} style={{ height: '400px', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {latitude && longitude && <Marker position={[latitude, longitude]} icon={defaultIcon} />}
            <MapClickHandler onLocationSelect={onLocationSelect} />
          </MapContainer>
          <p className="text-sm text-gray-600 mt-3">Click on map to select location</p>
          {latitude && longitude && (
            <p className="text-sm text-gray-700 mt-2">
              Selected: {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
