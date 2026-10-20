'use client'

import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import { WORLD_HALF, insideWorld } from '@/lib/game/world/settings'
import type { Point2 } from '@/lib/game/world/types'
import type { WorldSession } from '@/lib/game/world/session'

type Props = { session: WorldSession; center: Point2; selected: Point2; onSelect: (point: Point2) => void }

export default function AtlasMap({ session, center, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!container.current) return
    let disposed = false, revision = 0
    let timer: ReturnType<typeof setTimeout>
    const style = getComputedStyle(document.documentElement)
    const primary = style.getPropertyValue('--primary').trim()
    const foreground = style.getPropertyValue('--foreground').trim()
    const background = style.getPropertyValue('--background').trim()
    const map = L.map(container.current, {
      crs: L.CRS.Simple, minZoom: -14, maxZoom: 0, zoomSnap: 0.5,
      preferCanvas: true, attributionControl: false, zoomControl: false,
      maxBounds: [[-WORLD_HALF, -WORLD_HALF], [WORLD_HALF, WORLD_HALF]], maxBoundsViscosity: 1,
    }).setView([-center.z, center.x], -4)
    mapRef.current = map
    L.control.zoom({ zoomInTitle: 'Aproximar mapa', zoomOutTitle: 'Afastar mapa' }).addTo(map)
    L.control.scale({ metric: true, imperial: false, maxWidth: 140 }).addTo(map)
    const features = L.layerGroup().addTo(map)
    const player = L.circleMarker([-center.z, center.x], { radius: 6, color: background, weight: 2, fillColor: foreground, fillOpacity: 1 }).addTo(map)
    player.bindTooltip('Sua posição', { direction: 'top' })
    markerRef.current = L.circleMarker([-selected.z, selected.x], { radius: 8, color: primary, weight: 2, fillColor: primary, fillOpacity: 0.24 }).addTo(map)
    let image: L.ImageOverlay | null = null

    const draw = async () => {
      const current = ++revision
      const view = map.getBounds().pad(0.08)
      const bounds = {
        minX: Math.max(-WORLD_HALF, view.getWest()), maxX: Math.min(WORLD_HALF, view.getEast()),
        minZ: Math.max(-WORLD_HALF, -view.getNorth()), maxZ: Math.min(WORLD_HALF, -view.getSouth()),
      }
      if (bounds.minX >= bounds.maxX || bounds.minZ >= bounds.maxZ) return
      setBusy(true); setError('')
      try {
        const atlas = await session.requestAtlas(bounds, 224)
        if (disposed || current !== revision) return
        const canvas = document.createElement('canvas')
        canvas.width = atlas.size; canvas.height = atlas.size
        const context = canvas.getContext('2d')
        if (!context) throw new Error('O navegador não disponibilizou o desenho do mapa.')
        const pixels = context.createImageData(atlas.size, atlas.size)
        pixels.data.set(atlas.pixels); context.putImageData(pixels, 0, 0)
        const nextImage = L.imageOverlay(canvas.toDataURL('image/png'), [[-atlas.bounds.maxZ, atlas.bounds.minX], [-atlas.bounds.minZ, atlas.bounds.maxX]], { interactive: false, crossOrigin: 'anonymous', alt: 'Relevo calculado a partir da seed atual' }).addTo(map)
        nextImage.bringToBack()
        image?.remove(); image = nextImage
        features.clearLayers()
        for (const road of atlas.roads) L.polyline(road.points.map((p) => [-p.z, p.x] as L.LatLngTuple), {
          color: road.kind === 'street' || road.kind === 'track' ? foreground : primary,
          weight: road.kind === 'highway' ? 2.5 : road.kind === 'street' || road.kind === 'track' ? 1 : 1.6,
          opacity: road.kind === 'street' ? 0.6 : road.kind === 'track' ? 0.45 : 0.85,
          dashArray: road.kind === 'track' ? '4 4' : undefined,
          interactive: false,
        }).addTo(features)
        for (const town of atlas.towns) {
          const label = document.createElement('span'); label.textContent = town.name
          const marker = L.circleMarker([-town.z, town.x], { radius: town.kind === 'city' ? 7 : town.kind === 'town' ? 5 : 3.5, color: background, weight: 1, fillColor: primary, fillOpacity: 1 }).addTo(features)
          marker.bindTooltip(label, { permanent: map.getZoom() > -6, direction: 'top', className: 'atlas-town-label' })
          marker.on('click', (event) => { if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent); onSelect({ x: town.x, z: town.z }) })
        }
        player.bringToFront(); markerRef.current?.bringToFront()
      } catch (cause) {
        if (!disposed && current === revision) setError(cause instanceof Error ? cause.message : 'Não foi possível desenhar o atlas.')
      } finally { if (!disposed && current === revision) setBusy(false) }
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(draw, 180) }
    map.on('moveend', schedule)
    map.on('click', (event: L.LeafletMouseEvent) => {
      const point = { x: event.latlng.lng, z: -event.latlng.lat }
      if (insideWorld(point.x, point.z, 20)) onSelect(point)
    })
    const observer = new ResizeObserver(() => { map.invalidateSize(); schedule() })
    observer.observe(container.current)
    void draw()
    return () => {
      disposed = true; revision++; clearTimeout(timer); observer.disconnect()
      map.remove(); mapRef.current = null; markerRef.current = null
    }
  }, [session, center, onSelect])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const point: L.LatLngTuple = [-selected.z, selected.x]
    markerRef.current?.setLatLng(point)
    if (!map.getBounds().contains(point)) map.setView(point, Math.max(-5, map.getZoom()), { animate: false })
  }, [selected])

  return <div className="relative h-full min-h-64">
    <div ref={container} className="absolute inset-0" role="region" aria-label="Mapa interativo do mundo procedural. Arraste para mover, use os controles para aproximar e clique para selecionar um destino." />
    <div className="atlas-map-status" role="status">{error || (busy ? 'Cartografando terreno…' : 'Clique para escolher um destino')}</div>
    <div className="atlas-north" aria-label="Norte">N ↑</div>
  </div>
}
