'use client'

/*
 * Ambient motion for the Portfolio Island: trees swaying, chimney smoke, and
 * the shared on/off switch.
 *
 * All of it rides the water's clock (IslandScene3D's WaterClock), so it only
 * moves while the island is on screen. Under prefers-reduced-motion the
 * switch is off and everything holds a fixed, natural-looking pose — frames
 * still happen on hover, so each piece pins itself rather than just "not
 * advancing", which would make it jump whenever the scene redraws.
 */

import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'

const MotionContext = createContext(true)

/** Provide inside the <Canvas>, so it reaches every scene component. */
export function MotionProvider({ moving, children }: { moving: boolean; children: ReactNode }) {
  return <MotionContext.Provider value={moving}>{children}</MotionContext.Provider>
}

/** False under reduced motion: animate nothing, hold a fixed pose. */
export function useMoving() {
  return useContext(MotionContext)
}

/** A cheap, stable 0..1 phase from a position, so neighbours move out of step. */
function phaseFrom(x: number, z: number) {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return v - Math.floor(v)
}

/**
 * Tilts its children from their base (y = 0 of this group) in a soft breeze:
 * two slow sines on different axes, so the sway never reads as a metronome.
 */
export function Sway({
  at,
  y = 0,
  amount = 0.05,
  children,
}: {
  at: [number, number]
  y?: number
  /** Peak lean, in radians. */
  amount?: number
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null)
  const moving = useMoving()
  const phase = phaseFrom(at[0], at[1]) * Math.PI * 2

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = moving ? clock.elapsedTime : 0
    g.rotation.z = amount * Math.sin(t * 1.1 + phase)
    g.rotation.x = amount * 0.6 * Math.sin(t * 0.8 + phase * 1.7)
  })

  return (
    <group ref={ref} position={[at[0], y, at[1]]}>
      {children}
    </group>
  )
}

/** How long one puff takes to rise and fade, in seconds. */
const PUFF_LIFE = 3.6
const PUFFS = 3
/** How high a puff climbs before it's gone. */
const PUFF_RISE = 0.3

/**
 * Smoke from a chimney: a few puffs rising, swelling and fading in turn,
 * drifting a little with the breeze. Under reduced motion it holds one still,
 * faint wisp.
 */
export function Smoke({ at, color }: { at: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Group>(null)
  const moving = useMoving()
  const phase = phaseFrom(at[0], at[2])

  useFrame(({ clock }) => {
    const puffs = ref.current?.children ?? []
    puffs.forEach((child, i) => {
      const mesh = child as THREE.Mesh
      // Reduced motion: a single puff held a third of the way up.
      const t = moving
        ? (clock.elapsedTime / PUFF_LIFE + phase + i / puffs.length) % 1
        : i === 0
          ? 0.3
          : 0
      const size = 0.02 + 0.035 * t
      mesh.position.set(0.04 * t, PUFF_RISE * t, 0.015 * t)
      mesh.scale.setScalar(size)
      const material = mesh.material as THREE.MeshLambertMaterial
      material.opacity = t === 0 ? 0 : 0.55 * Math.min(1, t * 5) * (1 - t)
    })
  })

  return (
    <group ref={ref} position={at}>
      {Array.from({ length: PUFFS }, (_, i) => (
        <mesh key={i} renderOrder={1}>
          <icosahedronGeometry args={[1, 0]} />
          <meshLambertMaterial
            color={color}
            transparent
            opacity={0}
            depthWrite={false}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}
