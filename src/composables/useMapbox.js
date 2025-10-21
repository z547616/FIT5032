// Minimal Mapbox helper: init map, add markers, fit bounds, fetch APIs
import mapboxgl from 'mapbox-gl'

export function useMapbox() {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) {
    // eslint-disable-next-line no-console
    console.warn('[useMapbox] Missing VITE_MAPBOX_TOKEN')
  }
  mapboxgl.accessToken = token

  function createMap(container, center = [144.9631, -37.8136], zoom = 12, style = 'mapbox://styles/mapbox/streets-v12') {
    return new mapboxgl.Map({ container, style, center, zoom })
  }

  function addMarker(map, lngLat, options = {}) {
    const el = document.createElement('div')
    el.className = 'mb-marker'
    if (options.color) el.style.background = options.color
    el.style.width = '14px'
    el.style.height = '14px'
    el.style.borderRadius = '50%'
    el.style.boxShadow = '0 0 0 2px #fff, 0 1px 6px rgba(0,0,0,.25)'
    const m = new mapboxgl.Marker({ element: el })
      .setLngLat(lngLat)
      .addTo(map)
    if (options.popupHtml) {
      m.setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(options.popupHtml))
    }
    return m
  }

  function fitToPoints(map, points) {
    if (!points || !points.length) return
    const b = new mapboxgl.LngLatBounds()
    points.forEach(p => b.extend(p))
    map.fitBounds(b, { padding: 40, duration: 600 })
  }

  async function geocode(text) {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json`)
    url.searchParams.set('access_token', token)
    url.searchParams.set('country', 'AU')
    url.searchParams.set('limit', '5')
    const res = await fetch(url)
    return res.json()
  }

  async function reverseGeocode(lng, lat) {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`)
    url.searchParams.set('access_token', token)
    url.searchParams.set('country', 'AU')
    url.searchParams.set('limit', '1')
    const res = await fetch(url)
    return res.json()
  }

  async function getDirections(points, mode = 'walking', alternatives = true) {
    // points: [[lng,lat], [lng,lat]]
    const coords = points.map(p => p.join(',')).join(';')
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${mode}/${coords}`)
    url.searchParams.set('access_token', token)
    url.searchParams.set('geometries', 'geojson')
    url.searchParams.set('steps', 'true')
    url.searchParams.set('overview', 'full')
    url.searchParams.set('alternatives', alternatives ? 'true' : 'false')
    const res = await fetch(url)
    return res.json()
  }

  async function getIsochrone(lng, lat, minutes = 15, mode = 'walking') {
    const profile = mode === 'cycling' ? 'cycling' : 'walking'
    const url = new URL(`https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}`)
    url.searchParams.set('access_token', token)
    url.searchParams.set('polygons', 'true')
    url.searchParams.set('contours_minutes', String(minutes))
    url.searchParams.set('contours_colors', '4fd1c5')
    const res = await fetch(url)
    return res.json()
  }

  return { mapboxgl, createMap, addMarker, fitToPoints, geocode, reverseGeocode, getDirections, getIsochrone }
}