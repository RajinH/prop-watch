'use client'

/*
 * Procedural models for the Portfolio Island: house, townhouse row, unit
 * block and a fenced block of land. Each takes a variant
 * (lib/propwatch/island/variants.ts) so properties of the same type still
 * look like different places. Everything is built from boxes and a couple of
 * roof prisms — cheap to draw, and every model fits within its plot
 * (±half, the plot's half-side, which grows with the property's land area).
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import {
  DOOR_COLOURS,
  HOUSE_STOREY,
  TOWNHOUSE_STOREY,
  UNIT_STOREY,
  ROOF_COLOURS,
  UNIT_TRIM_COLOURS,
  WALL_COLOURS,
  type HouseVariant,
  type LandVariant,
  type TownhouseVariant,
  type UnitVariant,
} from '@/lib/propwatch/island/variants'
import { Smoke, Sway } from './motion'

/** Thickness of the plot pad every model stands on. */
export const PAD = 0.03

export interface ModelPalette {
  /** Window glow at night (dark theme). */
  lit: string
  /** Window glass by day (light theme). */
  unlit: string
  frame: string
  hedge: string
  soil: string
  trunk: string
  path: string
  garageDoor: string
  /** Chimney smoke. */
  smoke: string
  /** Darkens a variant colour for the dark theme; identity in light. */
  tone: (hex: string) => string
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Gable roof prism: eaves at y = 0, ridge along x. */
export function gableGeometry(width: number, depth: number, rise: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-depth / 2, 0)
  shape.lineTo(depth / 2, 0)
  shape.lineTo(0, rise)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false })
  g.translate(0, 0, -width / 2)
  g.rotateY(Math.PI / 2)
  return g
}

/**
 * Hip roof: all four sides slope, meeting at a short ridge along the longer
 * axis (a pyramid when the plan is square). Eaves at y = 0.
 */
export function hipGeometry(width: number, depth: number, rise: number) {
  const w = width / 2
  const d = depth / 2
  const ridge = Math.max(0, w - d)
  const v = [
    [-w, 0, -d],
    [w, 0, -d],
    [w, 0, d],
    [-w, 0, d],
    [-ridge, rise, 0],
    [ridge, rise, 0],
  ]
  const tris = [
    [3, 2, 5],
    [3, 5, 4], // front
    [1, 0, 4],
    [1, 4, 5], // back
    [2, 1, 5], // right
    [0, 3, 4], // left
  ]
  const positions = tris.flatMap((t) => t.flatMap((i) => v[i]))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.computeVertexNormals()
  return g
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number]

export function Box({
  size,
  position,
  color,
  shadow = true,
}: {
  size: Vec3
  position: Vec3
  color: string
  shadow?: boolean
}) {
  return (
    <mesh position={position} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  )
}

/**
 * A flat strip lying on the plot (paths, driveways). A plane rather than a
 * thin box: a box's side faces catch light and shadow, and on a long path
 * they read as seams. Polygon offset keeps it from fighting the plot surface.
 */
function Flat({
  size,
  at,
  color,
}: {
  size: [number, number]
  at: [number, number]
  color: string
}) {
  return (
    <mesh position={[at[0], PAD + 0.0005, at[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshLambertMaterial
        color={color}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  )
}

type Side = 'front' | 'back' | 'left' | 'right'

/** A box's footprint: centre and extent on the ground plane. */
interface Footprint {
  x: number
  z: number
  w: number
  d: number
}

/** Where a point `along` a wall (0 = middle) sits, and which way it faces. */
function onWall(f: Footprint, side: Side, along: number, y: number) {
  const e = 0.003 // proud of the wall, so nothing z-fights
  switch (side) {
    case 'front':
      return { pos: [f.x + along, y, f.z + f.d / 2 + e] as Vec3, rotY: 0 }
    case 'back':
      return { pos: [f.x - along, y, f.z - f.d / 2 - e] as Vec3, rotY: Math.PI }
    case 'right':
      return { pos: [f.x + f.w / 2 + e, y, f.z - along] as Vec3, rotY: Math.PI / 2 }
    case 'left':
      return { pos: [f.x - f.w / 2 - e, y, f.z + along] as Vec3, rotY: -Math.PI / 2 }
  }
}

function Window({
  at,
  w,
  h,
  lit,
  palette,
}: {
  at: { pos: Vec3; rotY: number }
  w: number
  h: number
  lit: boolean
  palette: ModelPalette
}) {
  return (
    <group position={at.pos} rotation={[0, at.rotY, 0]}>
      <mesh>
        <boxGeometry args={[w + 0.022, h + 0.022, 0.006]} />
        <meshLambertMaterial color={palette.frame} />
      </mesh>
      <mesh position={[0, 0, 0.0035]}>
        <planeGeometry args={[w, h]} />
        <meshLambertMaterial
          color={lit ? palette.lit : palette.unlit}
          emissive={lit ? palette.lit : '#000000'}
          emissiveIntensity={lit ? 0.9 : 0}
        />
      </mesh>
      {/* Mullion */}
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[0.006, h]} />
        <meshLambertMaterial color={palette.frame} />
      </mesh>
      <mesh position={[0, -h / 2 - 0.008, 0.01]}>
        <boxGeometry args={[w + 0.03, 0.008, 0.02]} />
        <meshLambertMaterial color={palette.frame} />
      </mesh>
    </group>
  )
}

function Door({
  at,
  color,
  palette,
  w = 0.075,
  h = 0.15,
}: {
  at: { pos: Vec3; rotY: number }
  color: string
  palette: ModelPalette
  w?: number
  h?: number
}) {
  return (
    <group position={at.pos} rotation={[0, at.rotY, 0]}>
      <mesh>
        <boxGeometry args={[w + 0.018, h + 0.012, 0.006]} />
        <meshLambertMaterial color={palette.frame} />
      </mesh>
      <mesh position={[0, -0.003, 0.0035]}>
        <planeGeometry args={[w, h]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* Step */}
      <mesh position={[0, -h / 2 - 0.006, 0.025]} receiveShadow>
        <boxGeometry args={[w + 0.04, 0.012, 0.05]} />
        <meshLambertMaterial color={palette.path} />
      </mesh>
    </group>
  )
}

function Shrub({ at, r, color }: { at: Vec3; r: number; color: string }) {
  return (
    <mesh position={at} castShadow scale={[1, 0.85, 1]}>
      <icosahedronGeometry args={[r, 0]} />
      <meshLambertMaterial color={color} flatShading />
    </mesh>
  )
}

function RoundTree({ at, palette }: { at: [number, number]; palette: ModelPalette }) {
  return (
    <Sway at={at} y={PAD} amount={0.06}>
      <Box size={[0.03, 0.14, 0.03]} position={[0, 0.07, 0]} color={palette.trunk} />
      <Shrub at={[0, 0.2, 0]} r={0.095} color={palette.hedge} />
      <Shrub at={[0.04, 0.27, 0.02]} r={0.06} color={palette.hedge} />
    </Sway>
  )
}

// ---------------------------------------------------------------------------
// House
// ---------------------------------------------------------------------------

const FLOOR = HOUSE_STOREY
const WING = 0.2 // L-shaped house: the wing's width and depth

export function HouseModel({
  v,
  lit,
  palette,
  half,
}: {
  v: HouseVariant
  lit: boolean
  palette: ModelPalette
  /** Half the plot's side; yards, paths and fences reach its front edge. */
  half: number
}) {
  const street = half - 0.02 // where paths and driveways meet the plot edge
  const wall = palette.tone(WALL_COLOURS[v.wall])
  const roof = palette.tone(ROOF_COLOURS[v.roof])
  const door = palette.tone(DOOR_COLOURS[v.door])
  const roofDark = palette.tone(
    new THREE.Color(ROOF_COLOURS[v.roof]).multiplyScalar(0.75).getStyle()
  )

  const storeys = v.storeys
  const h = FLOOR * storeys
  // A garage takes the right of the plot, so the house shifts left to make room.
  const body: Footprint = {
    x: v.garage ? -0.1 : 0,
    z: v.form === 'lShape' ? -0.07 : -0.02,
    w: storeys > 1 ? 0.44 : 0.5,
    d: 0.38,
  }
  const wing: Footprint | null =
    v.form === 'lShape' ? { x: body.x + 0.14, z: body.z + 0.24, w: WING, d: WING } : null
  const garage: Footprint | null = v.garage ? { x: 0.26, z: 0.01, w: 0.22, d: 0.34 } : null

  const geo = useMemo(() => {
    const overhang = 0.08
    const main =
      v.form === 'hip'
        ? hipGeometry(body.w + overhang, body.d + overhang, 0.17)
        : gableGeometry(body.w + overhang, body.d + overhang, storeys > 1 ? 0.2 : 0.18)
    // The wing's gable faces the street: ridge front to back.
    const wingRoof =
      v.form === 'lShape'
        ? gableGeometry(WING + 0.06, WING + 0.06, 0.15).rotateY(Math.PI / 2)
        : null
    return { main, wingRoof }
  }, [v.form, storeys, body.w, body.d])

  const doorX = v.form === 'lShape' ? -0.12 : -0.1
  // The door, porch and path belong to the main body. (On an L-shaped house
  // the wing juts further forward, but beside the door, not behind it.)
  const frontZ = body.z + body.d / 2 + 0.002
  const win = { w: 0.085, h: 0.08 }

  const windows: { pos: Vec3; rotY: number }[] = []
  for (let s = 0; s < storeys; s++) {
    const y = PAD + FLOOR * s + FLOOR * 0.55
    // Front: beside the door on the ground floor, a pair upstairs.
    // Ground floor: beside the door, unless an L-shape's wing stands there.
    if (s === 0) {
      if (!wing) windows.push(onWall(body, 'front', 0.1, y))
    } else windows.push(onWall(body, 'front', -0.1, y), onWall(body, 'front', 0.1, y))
    windows.push(onWall(body, 'back', -0.12, y), onWall(body, 'back', 0.12, y))
    windows.push(onWall(body, 'left', 0, y))
    if (!garage || s > 0) windows.push(onWall(body, 'right', 0, y))
  }
  if (wing) {
    const y = PAD + FLOOR * 0.55
    windows.push(onWall(wing, 'front', 0, y), onWall(wing, 'right', 0, y))
  }

  return (
    <group scale={[v.mirrored ? -1 : 1, 1, 1]}>
      {/* Path from the front door to the street */}
      <Flat
        size={[0.08, street - (body.z + body.d / 2)]}
        at={[body.x + doorX, (body.z + body.d / 2 + street) / 2]}
        color={palette.path}
      />

      {/* Main body and roof */}
      <Box size={[body.w, h, body.d]} position={[body.x, PAD + h / 2, body.z]} color={wall} />
      <mesh geometry={geo.main} position={[body.x, PAD + h, body.z]} castShadow receiveShadow>
        <meshLambertMaterial color={roof} flatShading />
      </mesh>

      {wing && geo.wingRoof && (
        <>
          <Box size={[wing.w, h, wing.d]} position={[wing.x, PAD + h / 2, wing.z]} color={wall} />
          <mesh
            geometry={geo.wingRoof}
            position={[wing.x, PAD + h, wing.z]}
            castShadow
            receiveShadow
          >
            <meshLambertMaterial color={roof} flatShading />
          </mesh>
        </>
      )}

      {v.chimney && (
        <>
          <Box
            size={[0.06, 0.2, 0.06]}
            position={[body.x + body.w * 0.28, PAD + h + 0.1, body.z - 0.07]}
            color={roofDark}
          />
          <Box
            size={[0.075, 0.015, 0.075]}
            position={[body.x + body.w * 0.28, PAD + h + 0.205, body.z - 0.07]}
            color={palette.frame}
          />
          <Smoke
            at={[body.x + body.w * 0.28, PAD + h + 0.23, body.z - 0.07]}
            color={palette.smoke}
          />
        </>
      )}

      {garage && (
        <>
          <Box
            size={[garage.w, 0.22, garage.d]}
            position={[garage.x, PAD + 0.11, garage.z]}
            color={wall}
          />
          <Box
            size={[garage.w + 0.03, 0.025, garage.d + 0.03]}
            position={[garage.x, PAD + 0.232, garage.z]}
            color={roofDark}
          />
          {/* Roller door, with a couple of panel lines */}
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[garage.x, PAD + 0.025 + i * 0.05 + 0.024, garage.z + garage.d / 2 + 0.003]}
            >
              <planeGeometry args={[0.16, 0.046]} />
              <meshLambertMaterial color={palette.garageDoor} />
            </mesh>
          ))}
          {/* Driveway */}
          <Flat
            size={[0.18, street - (garage.z + garage.d / 2)]}
            at={[garage.x, (garage.z + garage.d / 2 + street) / 2]}
            color={palette.path}
          />
        </>
      )}

      {v.porch && (
        <>
          <Box
            size={[0.2, 0.012, 0.1]}
            position={[body.x + doorX, PAD + 0.006, frontZ + 0.05]}
            color={palette.path}
            shadow={false}
          />
          {[-0.085, 0.085].map((dx) => (
            <Box
              key={dx}
              size={[0.014, 0.18, 0.014]}
              position={[body.x + doorX + dx, PAD + 0.09, frontZ + 0.09]}
              color={palette.frame}
            />
          ))}
          <Box
            size={[0.22, 0.018, 0.12]}
            position={[body.x + doorX, PAD + 0.19, frontZ + 0.05]}
            color={roof}
          />
        </>
      )}

      <Door
        at={{ pos: [body.x + doorX, PAD + 0.08, frontZ], rotY: 0 }}
        color={door}
        palette={palette}
      />
      {windows.map((at, i) => (
        <Window key={i} at={at} w={win.w} h={win.h} lit={lit} palette={palette} />
      ))}

      <Yard v={v} doorX={body.x + doorX} palette={palette} half={half} />
    </group>
  )
}

function Yard({
  v,
  doorX,
  palette,
  half,
}: {
  v: HouseVariant
  doorX: number
  palette: ModelPalette
  half: number
}) {
  const edge = half - 0.05 // just inside the front edge of the plot
  switch (v.yard) {
    case 'hedge':
      return (
        <>
          <Box
            size={[0.24, 0.06, 0.05]}
            position={[-0.3, PAD + 0.03, edge]}
            color={palette.hedge}
          />
          {!v.garage && (
            <Box
              size={[0.18, 0.06, 0.05]}
              position={[0.3, PAD + 0.03, edge]}
              color={palette.hedge}
            />
          )}
        </>
      )
    case 'picket': {
      const posts: number[] = []
      for (let x = -(half - 0.03); x <= half - 0.03; x += 0.045) {
        // Gaps for the path and, when there is one, the driveway.
        if (Math.abs(x - doorX) < 0.06) continue
        if (v.garage && x > 0.16) continue
        posts.push(x)
      }
      return (
        <>
          {posts.map((x) => (
            <Box
              key={x}
              size={[0.012, 0.06, 0.008]}
              position={[x, PAD + 0.03, edge]}
              color={palette.frame}
              shadow={false}
            />
          ))}
        </>
      )
    }
    case 'garden':
      return (
        <>
          <Box
            size={[0.2, 0.012, 0.08]}
            position={[0.08, PAD + 0.006, 0.34]}
            color={palette.soil}
            shadow={false}
          />
          {[-0.06, -0.02, 0.02, 0.06, 0.1, 0.14].map((dx, i) => (
            <mesh key={dx} position={[0.02 + dx, PAD + 0.025, 0.34 + (i % 2 ? 0.02 : -0.02)]}>
              <icosahedronGeometry args={[0.016, 0]} />
              <meshLambertMaterial
                color={['#e8798a', '#f2c14e', '#ffffff', '#b57edc'][i % 4]}
                flatShading
              />
            </mesh>
          ))}
        </>
      )
    case 'tree':
      return <RoundTree at={[-(half - 0.12), -(half - 0.12)]} palette={palette} />
  }
}

// ---------------------------------------------------------------------------
// Townhouse row
// ---------------------------------------------------------------------------

export function TownhouseModel({
  v,
  lit,
  palette,
  half,
}: {
  v: TownhouseVariant
  lit: boolean
  palette: ModelPalette
  half: number
}) {
  const street = half - 0.02
  const total = 0.8
  const unitW = total / v.units
  const d = 0.4
  const storey = TOWNHOUSE_STOREY
  const h = storey * v.storeys
  const roof = palette.tone(ROOF_COLOURS[v.roof])
  const door = palette.tone(DOOR_COLOURS[v.door])
  const roofGeo = useMemo(
    () => gableGeometry(d + 0.06, unitW + 0.01, 0.13).rotateY(Math.PI / 2),
    [unitW]
  )
  const row: Footprint = { x: 0, z: -0.02, w: total, d }
  // Window line of each storey, ground floor first.
  const levels = Array.from({ length: v.storeys }, (_, k) => PAD + storey * k + storey * 0.58)

  return (
    <group>
      {Array.from({ length: v.units }, (_, i) => {
        const x = -total / 2 + unitW * (i + 0.5)
        const unit: Footprint = { x, z: row.z, w: unitW, d }
        const wall = palette.tone(WALL_COLOURS[v.walls[i]])
        return (
          <group key={i}>
            <Box size={[unitW - 0.004, h, d]} position={[x, PAD + h / 2, row.z]} color={wall} />
            <mesh geometry={roofGeo} position={[x, PAD + h, row.z]} castShadow receiveShadow>
              <meshLambertMaterial color={roof} flatShading />
            </mesh>
            <Door
              at={onWall(unit, 'front', -unitW * 0.2, PAD + 0.08)}
              color={door}
              palette={palette}
              w={0.065}
            />
            {levels.map((y, k) => (
              <group key={k}>
                {k === 0 ? (
                  // Ground floor: a window beside the door, where it fits.
                  unitW > 0.22 && (
                    <Window
                      at={onWall(unit, 'front', unitW * 0.2, y)}
                      w={0.07}
                      h={0.08}
                      lit={lit}
                      palette={palette}
                    />
                  )
                ) : (
                  <>
                    <Window
                      at={onWall(unit, 'front', 0, y)}
                      w={Math.min(0.1, unitW * 0.45)}
                      h={0.09}
                      lit={lit}
                      palette={palette}
                    />
                    {v.balconies && (
                      <>
                        <Box
                          size={[unitW * 0.7, 0.014, 0.07]}
                          position={[x, y - 0.062, row.z + d / 2 + 0.035]}
                          color={palette.frame}
                        />
                        <Box
                          size={[unitW * 0.7, 0.04, 0.006]}
                          position={[x, y - 0.035, row.z + d / 2 + 0.068]}
                          color={palette.frame}
                          shadow={false}
                        />
                      </>
                    )}
                  </>
                )}
                <Window
                  at={onWall(unit, 'back', 0, y)}
                  w={0.07}
                  h={0.08}
                  lit={lit}
                  palette={palette}
                />
              </group>
            ))}
            {/* Front garden strip */}
            <Box
              size={[unitW * 0.45, 0.04, 0.05]}
              position={[x + unitW * 0.2, PAD + 0.02, half - 0.07]}
              color={palette.hedge}
            />
            <Flat
              size={[0.06, street - (row.z + d / 2)]}
              at={[x - unitW * 0.2, (row.z + d / 2 + street) / 2]}
              color={palette.path}
            />
          </group>
        )
      })}
      {(['left', 'right'] as const).flatMap((side) =>
        levels.map((y, k) => (
          <Window
            key={`${side}${k}`}
            at={onWall(row, side, 0, y)}
            w={0.08}
            h={0.08}
            lit={lit}
            palette={palette}
          />
        ))
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Unit block
// ---------------------------------------------------------------------------

const UNIT_FLOOR = UNIT_STOREY

export function UnitModel({
  v,
  lit,
  palette,
  half,
}: {
  v: UnitVariant
  lit: boolean
  palette: ModelPalette
  half: number
}) {
  const wall = palette.tone(WALL_COLOURS[v.wall])
  const trim = palette.tone(UNIT_TRIM_COLOURS[v.trim])
  const f: Footprint = { x: 0, z: -0.03, w: 0.62, d: 0.5 }
  const h = UNIT_FLOOR * v.floors
  const win = { w: 0.09, h: 0.1 }

  const windows: { pos: Vec3; rotY: number }[] = []
  for (let k = 0; k < v.floors; k++) {
    const y = PAD + UNIT_FLOOR * k + UNIT_FLOOR * 0.52
    for (const a of [-0.2, 0, 0.2]) {
      if (k === 0 && a === 0) continue // the entry
      windows.push(onWall(f, 'front', a, y), onWall(f, 'back', a, y))
    }
    for (const a of [-0.12, 0.12]) windows.push(onWall(f, 'left', a, y), onWall(f, 'right', a, y))
  }

  return (
    <group>
      <Box size={[f.w, h, f.d]} position={[f.x, PAD + h / 2, f.z]} color={wall} />
      {/* Floor bands and parapet */}
      {Array.from({ length: v.floors - 1 }, (_, k) => (
        <Box
          key={k}
          size={[f.w + 0.012, 0.016, f.d + 0.012]}
          position={[f.x, PAD + UNIT_FLOOR * (k + 1), f.z]}
          color={trim}
          shadow={false}
        />
      ))}
      <Box
        size={[f.w + 0.03, 0.05, f.d + 0.03]}
        position={[f.x, PAD + h + 0.025, f.z]}
        color={trim}
      />
      <Box
        size={[f.w - 0.04, 0.01, f.d - 0.04]}
        position={[f.x, PAD + h + 0.05, f.z]}
        color={palette.path}
        shadow={false}
      />

      {v.rooftopGarden ? (
        <>
          <Box
            size={[0.36, 0.03, 0.26]}
            position={[f.x - 0.06, PAD + h + 0.07, f.z]}
            color={palette.hedge}
          />
          <Shrub at={[f.x + 0.06, PAD + h + 0.11, f.z + 0.06]} r={0.04} color={palette.hedge} />
          <Shrub at={[f.x - 0.16, PAD + h + 0.11, f.z - 0.06]} r={0.035} color={palette.hedge} />
        </>
      ) : (
        <Box
          size={[0.18, 0.1, 0.14]}
          position={[f.x + 0.14, PAD + h + 0.1, f.z - 0.1]}
          color={wall}
        />
      )}

      {/* Entry: glazed doors under an awning */}
      <Door
        at={onWall(f, 'front', 0, PAD + 0.075)}
        color={palette.unlit}
        palette={palette}
        w={0.11}
        h={0.13}
      />
      <Box
        size={[0.2, 0.014, 0.1]}
        position={[f.x, PAD + 0.16, f.z + f.d / 2 + 0.05]}
        color={trim}
      />

      {v.balconies &&
        Array.from({ length: v.floors - 1 }, (_, k) =>
          [-0.2, 0.2].map((a) => (
            <group key={`${k}${a}`}>
              <Box
                size={[0.15, 0.014, 0.08]}
                position={[f.x + a, PAD + UNIT_FLOOR * (k + 1) + 0.007, f.z + f.d / 2 + 0.04]}
                color={trim}
              />
              <Box
                size={[0.15, 0.045, 0.006]}
                position={[f.x + a, PAD + UNIT_FLOOR * (k + 1) + 0.035, f.z + f.d / 2 + 0.078]}
                color={palette.frame}
                shadow={false}
              />
            </group>
          ))
        )}

      {windows.map((at, i) => (
        <Window key={i} at={at} w={win.w} h={win.h} lit={lit} palette={palette} />
      ))}

      {/* Hedges either side of the entry */}
      <Box
        size={[0.16, 0.05, 0.05]}
        position={[-0.22, PAD + 0.025, half - 0.07]}
        color={palette.hedge}
      />
      <Box
        size={[0.16, 0.05, 0.05]}
        position={[0.22, PAD + 0.025, half - 0.07]}
        color={palette.hedge}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Land
// ---------------------------------------------------------------------------

export function LandModel({
  v,
  palette,
  half,
}: {
  v: LandVariant
  palette: ModelPalette
  half: number
}) {
  // The fence runs just inside the plot, so a bigger block reads as bigger.
  const r = half - 0.09
  const posts: [number, number][] = []
  for (const t of [-1, -0.5, 0, 0.5, 1]) {
    posts.push([t * r, -r], [t * r, r])
    if (Math.abs(t) < 1) posts.push([-r, t * r], [r, t * r])
  }
  return (
    <group>
      <Box
        size={[r * 2 - 0.04, 0.012, r * 2 - 0.04]}
        position={[0, PAD + 0.006, 0]}
        color={palette.soil}
        shadow={false}
      />
      {posts.map(([x, z], i) => (
        <Box
          key={i}
          size={[0.025, 0.1, 0.025]}
          position={[x, PAD + 0.05, z]}
          color={palette.trunk}
        />
      ))}
      {(
        [
          [
            [r * 2, 0.015, 0.012],
            [0, -r],
          ],
          [
            [r * 2, 0.015, 0.012],
            [0, r],
          ],
          [
            [0.012, 0.015, r * 2],
            [-r, 0],
          ],
          [
            [0.012, 0.015, r * 2],
            [r, 0],
          ],
        ] as [Vec3, [number, number]][]
      ).map(([size, [x, z]], i) => (
        <Box
          key={i}
          size={size}
          position={[x, PAD + 0.075, z]}
          color={palette.trunk}
          shadow={false}
        />
      ))}
      {v.shrubs.map(([x, z], i) => (
        <Shrub
          key={i}
          at={[x * r * 0.8, PAD + 0.03, z * r * 0.8]}
          r={0.035 + (i % 2) * 0.012}
          color={palette.hedge}
        />
      ))}
      {v.sign && (
        <>
          <Box
            size={[0.02, 0.22, 0.02]}
            position={[-0.2, PAD + 0.11, 0.28]}
            color={palette.trunk}
          />
          <Box size={[0.17, 0.1, 0.012]} position={[-0.2, PAD + 0.2, 0.29]} color={palette.frame} />
          <Box
            size={[0.17, 0.022, 0.014]}
            position={[-0.2, PAD + 0.24, 0.29]}
            color={palette.garageDoor}
            shadow={false}
          />
        </>
      )}
    </group>
  )
}
