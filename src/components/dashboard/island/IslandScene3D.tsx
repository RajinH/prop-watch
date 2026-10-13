'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { IslandPlot, IslandScene } from '@/lib/propwatch/island/scene'
import { growOutline } from '@/lib/propwatch/island/outline'
import { hashString } from '@/lib/propwatch/island/variants'
import {
  Box,
  HouseModel,
  LandModel,
  PAD,
  TownhouseModel,
  UnitModel,
  type ModelPalette,
} from './models'
import { MotionProvider, Sway, useMoving } from './motion'

interface Props {
  scene: IslandScene
  /** Id of the property to highlight. */
  active: string | null
  /** Pointer entered, moved over, or left a property (null). */
  onHover: (plot: IslandPlot | null, clientX?: number, clientY?: number) => void
  onOpen: (plot: IslandPlot) => void
}

/*
 * The Portfolio Island in 3D: one small model per property — house, townhouse
 * row, unit block or a fenced block of land, each varied per property (see
 * models.tsx and lib/propwatch/island/variants.ts) — on a grassy island in a
 * calm sea. It shows what you own, not a chart of it; figures are read from
 * the hover tooltip. The scene follows the theme like a time of day: daylight
 * with dark windows in the light theme, night with every window lit in the
 * dark one.
 *
 * The camera is constrained to an orthographic view at a fixed elevation that
 * only turns about the vertical axis, by dragging. No zoom, no pan. Rendering is on demand, so an idle dashboard costs no GPU.
 *
 * Every material is opaque Lambert: nothing transparent to sort and no
 * specular highlight, so no surface washes out at any angle. One soft shadow
 * pass grounds the models.
 */

const ELEVATION = THREE.MathUtils.degToRad(30)
const DEFAULT_AZIMUTH = Math.PI / 4
const DRAG_SPEED = 0.008

// ---------------------------------------------------------------------------
// Palette — resolved from the CSS tokens in globals.css
// ---------------------------------------------------------------------------

const TOKENS = {
  sea: '--island-sea',
  seaDeep: '--island-sea-deep',
  foam: '--island-foam',
  card: '--color-white',
  sand: '--island-sand',
  grass: '--island-grass',
  soil: '--island-soil',
  plot: '--island-plot',
  plotActive: '--island-plot-active',
  lit: '--island-window-lit',
  unlit: '--island-window-dark',
  tree: '--island-tree',
  trunk: '--island-trunk',
  frame: '--island-frame',
  path: '--island-path',
} as const

type Palette = Record<keyof typeof TOKENS, string>

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}
const getTheme = () => document.documentElement.dataset.theme ?? 'light'

/**
 * WebGL can't read CSS variables, so resolve the tokens to concrete colours,
 * re-resolving whenever the theme flips. globals.css stays the single source.
 */
function usePalette(): { palette: Palette; dark: boolean } {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'light')
  const palette = useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    return Object.fromEntries(
      Object.entries(TOKENS).map(([k, v]) => [k, css.getPropertyValue(v).trim() || '#888'])
    ) as Palette
    // The tokens' values change with the theme attribute, not with any input
    // React can see, so the theme is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])
  return { palette, dark: theme === 'dark' }
}

/**
 * A flat slab in the shape of the coastline, spanning y = 0..thickness,
 * pushed `grow` further out all round (the beach is the grass, grown).
 */
function coastSlab(points: [number, number][], grow: number, thickness: number) {
  const shape = new THREE.Shape(
    points.map(([x, z]) => {
      const r = Math.hypot(x, z)
      const k = r > 0 ? (r + grow) / r : 1
      // Shape space is x/y; laid flat below, y becomes -z.
      return new THREE.Vector2(x * k, -z * k)
    })
  )
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  return g
}

// ---------------------------------------------------------------------------
// Plots and scenery
// ---------------------------------------------------------------------------

/**
 * A plot's pop, shared with the compositor: the group that lifts, and how far
 * it is through its pop (0 at rest, 1 fully up; the spring overshoots a touch).
 */
interface Popped {
  group: THREE.Group
  amount: number
}
type PopRegistry = { current: Map<string, Popped> }

function Plot({
  p,
  palette,
  models,
  lit,
  isActive,
  pops,
  hoverable,
  onHover,
  onOpen,
}: {
  p: IslandPlot
  palette: Palette
  models: ModelPalette
  /** Night (the dark theme): every window lit. Day: none. */
  lit: boolean
  isActive: boolean
  pops: PopRegistry
  hoverable: () => boolean
  onHover: Props['onHover']
  onOpen: Props['onOpen']
}) {
  const variant = p.variant
  const lawn = useMemo(() => coastSlab(p.lawn, 0, PAD), [p.lawn])
  const lawnColours = useMemo(
    () => [new THREE.Color(palette.plot), new THREE.Color(palette.plotActive)] as const,
    [palette.plot, palette.plotActive]
  )
  const lawnTop = useRef<THREE.MeshLambertMaterial>(null)

  // Hover pop: the whole plot — lawn and building — springs up and grows,
  // with a little overshoot, then settles back when the pointer leaves. While
  // it's up it joins FOCUS_LAYER, which the compositor draws over the faded
  // scene, veiled in step with the pop so it sinks back in without a jump.
  // Reduced motion snaps straight there instead.
  const lift = useRef<THREE.Group>(null)
  const spring = useRef({ value: 0, velocity: 0 })
  const moving = useMoving()
  useEffect(() => {
    const registry = pops.current
    return () => {
      registry.delete(p.id)
    }
  }, [pops, p.id])
  useFrame(({ gl, invalidate }) => {
    const g = lift.current
    if (!g) return
    const target = isActive ? 1 : 0
    const sp = spring.current
    if (!moving) {
      sp.value = target
      sp.velocity = 0
    } else {
      sp.velocity = (sp.velocity + (target - sp.value) * SPRING_STIFFNESS) * SPRING_DAMPING
      sp.value += sp.velocity
      if (Math.abs(target - sp.value) < 0.001 && Math.abs(sp.velocity) < 0.001) {
        sp.value = target
        sp.velocity = 0
      }
    }
    const before = g.position.y
    g.position.y = POP_LIFT * sp.value
    g.scale.setScalar(1 + (POP_SCALE - 1) * sp.value)
    lawnTop.current?.color.lerpColors(
      lawnColours[0],
      lawnColours[1],
      THREE.MathUtils.clamp(sp.value, 0, 1)
    )
    // In or out of the focus pass, for the whole plot.
    const focused = sp.value > 0.001
    g.traverse((o) => (focused ? o.layers.enable(FOCUS_LAYER) : o.layers.disable(FOCUS_LAYER)))
    const entry = pops.current.get(p.id)
    if (entry) {
      entry.group = g
      entry.amount = focused ? sp.value : 0
    } else {
      pops.current.set(p.id, { group: g, amount: focused ? sp.value : 0 })
    }
    if (g.position.y !== before) {
      // The plot moved, so its shadow must move with it.
      gl.shadowMap.needsUpdate = true
      invalidate()
    }
  })

  const hover = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (hoverable()) onHover(p, e.nativeEvent.clientX, e.nativeEvent.clientY)
  }

  return (
    <group
      position={[p.x, 0, p.z]}
      onPointerOver={hover}
      onPointerMove={hover}
      onPointerOut={() => onHover(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        // A drag that ends over a building is a rotation, not a click.
        if (e.delta > 4) return
        e.stopPropagation()
        onOpen(p)
      }}
    >
      {/* An invisible copy of the lawn that never moves. The pop shifts the
          plot up the screen, which would slide its lower edge out from under
          a pointer resting there and drop it again, over and over. With this
          the plot holds while the pointer is over either its resting lawn or
          the popped plot itself. */}
      <mesh geometry={lawn}>
        <meshBasicMaterial visible={false} />
      </mesh>
      <group ref={lift}>
        {/* The lawn: an organic outline around the square lot the model
            stands in (see outline.ts), raised a touch above the island grass.
            Its colour follows the pop (set each frame above). */}
        <mesh geometry={lawn} receiveShadow>
          <meshLambertMaterial ref={lawnTop} attach="material-0" />
          <meshLambertMaterial attach="material-1" color={palette.soil} />
        </mesh>
        {variant.kind === 'house' && (
          <HouseModel v={variant} lit={lit} palette={models} half={p.half} />
        )}
        {variant.kind === 'townhouse' && (
          <TownhouseModel v={variant} lit={lit} palette={models} half={p.half} />
        )}
        {variant.kind === 'unit' && (
          <UnitModel v={variant} lit={lit} palette={models} half={p.half} />
        )}
        {variant.kind === 'land' && <LandModel v={variant} palette={models} half={p.half} />}
      </group>
    </group>
  )
}

function Pine({ at, palette }: { at: [number, number]; palette: Palette }) {
  return (
    <Sway at={at} amount={0.045}>
      <Box size={[0.04, 0.14, 0.04]} position={[0, 0.07, 0]} color={palette.trunk} />
      <mesh position={[0, 0.24, 0]} castShadow>
        <coneGeometry args={[0.13, 0.26, 7]} />
        <meshLambertMaterial color={palette.tree} flatShading />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <coneGeometry args={[0.095, 0.2, 7]} />
        <meshLambertMaterial color={palette.tree} flatShading />
      </mesh>
    </Sway>
  )
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

/** One ripple's life, in seconds: born at the beach, gone a little way out. */
const RIPPLE_PERIOD = 5
/** How far a ripple travels out from the beach before it fades. */
const RIPPLE_TRAVEL = 0.26
/** Frames per second while the water moves. Plenty for slow foam. */
const WATER_FPS = 30

/** A thin band following the beach's outer edge, lying on the sea. */
function foamBand(points: [number, number][], from: number, width: number) {
  const ring = (grow: number) =>
    points.map(([x, z]) => {
      const r = Math.hypot(x, z)
      const k = r > 0 ? (r + grow) / r : 1
      return new THREE.Vector2(x * k, -z * k)
    })
  const shape = new THREE.Shape(ring(from + width))
  shape.holes.push(new THREE.Path(ring(from)))
  const g = new THREE.ShapeGeometry(shape)
  g.rotateX(-Math.PI / 2)
  return g
}

/**
 * Foam ripples rolling out from the beach and fading, two at a time, half a
 * cycle apart. Each is the same band, scaled out from the island's centre:
 * cheaper than rebuilding a ring every frame, and at this distance the
 * stretch is invisible.
 */
function Foam({
  coast,
  radius,
  color,
  dark,
}: {
  coast: [number, number][]
  radius: number
  color: string
  dark: boolean
}) {
  const band = useMemo(() => foamBand(coast, BEACH, 0.05), [coast])
  const group = useRef<THREE.Group>(null)
  const peak = dark ? 0.35 : 0.6
  // Scale that carries the furthest point of the beach RIPPLE_TRAVEL out.
  const reach = RIPPLE_TRAVEL / (radius + BEACH)

  const moving = useMoving()

  useFrame(({ clock }) => {
    const ripples = group.current?.children ?? []
    ripples.forEach((child, i) => {
      const mesh = child as THREE.Mesh
      // Reduced motion: hold each ripple at a fixed point in its life.
      const time = moving ? clock.elapsedTime : 0
      const t = (time / RIPPLE_PERIOD + 0.2 + i / ripples.length) % 1
      const s = 1 + reach * t
      mesh.scale.set(s, 1, s)
      // Fade in quickly, then out slowly as it spreads.
      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = peak * Math.min(1, t * 6) * (1 - t)
    })
  })

  return (
    <group ref={group}>
      {[0, 1].map((i) => (
        <mesh key={i} geometry={band} position={[0, SEA_TOP + 0.003, 0]} renderOrder={1}>
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Keeps the water moving. The canvas otherwise only draws when something
 * changes, so this asks for a frame WATER_FPS times a second — and only while
 * the island is on screen, the tab is visible, and the user hasn't asked for
 * reduced motion. Otherwise the scene stays still and costs nothing.
 */
function WaterClock({ running }: { running: boolean }) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') invalidate()
    }, 1000 / WATER_FPS)
    return () => window.clearInterval(id)
  }, [running, invalidate])
  return null
}

/**
 * The shadows never change — the light is fixed in the world and nothing on
 * the island moves — so the shadow map is drawn once rather than every frame,
 * and redrawn only when the scene itself changes.
 */
function ShadowsOnce({ version }: { version: unknown }) {
  const drawn = useRef<unknown>(null)
  const invalidate = useThree((state) => state.invalidate)
  // Make sure a frame runs after the scene changes, so the redraw happens.
  useEffect(() => invalidate(), [invalidate, version])
  useFrame(({ gl }) => {
    gl.shadowMap.autoUpdate = false
    if (drawn.current !== version) {
      gl.shadowMap.needsUpdate = true
      drawn.current = version
    }
  })
  return null
}

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Hover pop: how far the hovered plot rises, and how much it grows. */
const POP_LIFT = 0.12
const POP_SCALE = 1.1
/** Spring for the pop: a little overshoot, settling in about half a second. */
const SPRING_STIFFNESS = 0.14
const SPRING_DAMPING = 0.72
/** How far the rest of the island fades while a plot is popped. */
const FADE_REST = 0.6
/** Render layer the popped plot joins, so it can be drawn over the fade. */
const FOCUS_LAYER = 1

/**
 * Draws each frame in passes, taking over from R3F's own render (useFrame
 * priority 1):
 *
 *   1. the whole scene;
 *   2. a veil the colour of the card, fading everything behind it;
 *   3. each popped plot (FOCUS_LAYER), back to front, on top of the veil —
 *      then veiled again over just its own pixels, by however much it has
 *      sunk back. A plot on its way down fades into the scene as it lands,
 *      rather than jumping from crisp to faded when it touches down.
 *
 * Fading this way keeps every material opaque — no per-object transparency
 * to sort, which is what once washed the water out to white.
 */
function Compositor({
  focused,
  veil,
  pops,
}: {
  focused: boolean
  veil: string
  pops: PopRegistry
}) {
  const overlay = useRef<{
    scene: THREE.Scene
    camera: THREE.Camera
    material: THREE.MeshBasicMaterial
  } | null>(null)
  const fade = useRef(0)
  const moving = useMoving()

  useFrame(({ gl, scene, camera, invalidate }) => {
    if (!overlay.current) {
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        // Exactly the card's colour: tone mapping would shift it (white to
        // grey) and the veil would show as a box.
        toneMapped: false,
      })
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
      // Near the far plane, so the masked pass below can test against it.
      quad.position.z = -0.99
      const veilScene = new THREE.Scene()
      veilScene.add(quad)
      overlay.current = {
        scene: veilScene,
        camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
        material,
      }
    }
    const target = focused ? 1 : 0
    const gap = target - fade.current
    fade.current = !moving || Math.abs(gap) < 0.002 ? target : fade.current + gap * 0.18
    if (fade.current !== target) invalidate()

    gl.autoClear = false
    gl.clear()
    camera.layers.set(0)
    gl.render(scene, camera)
    if (fade.current === 0) return

    const { material } = overlay.current
    material.color.set(veil)
    // The veil over everything.
    material.opacity = FADE_REST * fade.current
    material.depthTest = false
    gl.render(overlay.current.scene, overlay.current.camera)

    const popped = [...pops.current.values()].filter((e) => e.amount > 0)
    if (popped.length === 0) return
    // Back to front, so a nearer plot overlaps a farther one.
    const depth = new Map(
      popped.map((e) => [
        e,
        _v.setFromMatrixPosition(e.group.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z,
      ])
    )
    popped.sort((a, b) => depth.get(a)! - depth.get(b)!)
    camera.layers.set(FOCUS_LAYER)
    for (const e of popped) {
      for (const other of popped) other.group.visible = other === e
      gl.clearDepth()
      gl.render(scene, camera)
      const sunk = 1 - THREE.MathUtils.clamp(e.amount, 0, 1)
      if (sunk > 0) {
        // Only where the plot just drew: those pixels are nearer than the
        // quad; everywhere else the depth was cleared to the far plane.
        material.opacity = FADE_REST * fade.current * sunk
        material.depthTest = true
        material.depthFunc = THREE.GreaterDepth
        gl.render(overlay.current.scene, overlay.current.camera)
        material.depthFunc = THREE.LessEqualDepth
      }
    }
    for (const e of popped) e.group.visible = true
    camera.layers.set(0)
  }, 1)

  return null
}
const _v = new THREE.Vector3()

/** Tallest scenery (the corner pines), so they're never clipped either. */
const SCENERY_HEIGHT = 0.46
/** The sea disc's top and bottom faces. */
const SEA_TOP = -0.13
const SEA_BOTTOM = -0.25
/** Width of the beach around the grass. */
const BEACH = 0.28

/**
 * Locked camera: fixed elevation, turns about the vertical axis only, eased
 * toward `azimuth`.
 *
 * Framing is worked out on screen, where a point's height is
 * y·cos(e) − d·sin(e) (d = how far it sits toward the camera). The lowest
 * point is the front rim of the sea; the highest is either the back rim of
 * the sea or the tallest model standing at the back of the island. The camera
 * aims at the middle of that span and zooms to fit it, and since the sea is a
 * disc, the same fit holds at every angle.
 */
function CameraRig({
  azimuth,
  seaRadius,
  islandRadius,
  height,
}: {
  azimuth: React.RefObject<number>
  seaRadius: number
  /** Half the island's diagonal: the furthest back a model can stand. */
  islandRadius: number
  /** Tallest model on the island. */
  height: number
}) {
  const current = useRef(azimuth.current)
  const sin = Math.sin(ELEVATION)
  const cos = Math.cos(ELEVATION)
  const bottom = SEA_BOTTOM * cos - seaRadius * sin
  const top = Math.max(
    SEA_TOP * cos + seaRadius * sin,
    Math.max(height, SCENERY_HEIGHT) * cos + islandRadius * sin
  )
  const span = top - bottom
  const target = useMemo(
    () => new THREE.Vector3(0, (top + bottom) / 2 / cos, 0),
    [top, bottom, cos]
  )

  // R3F redraws on resize, so fitting the zoom per frame tracks the canvas
  // size without a separate effect.
  useFrame(({ camera, size, invalidate }) => {
    const cam = camera as THREE.OrthographicCamera
    const zoom = Math.min(size.width / (2 * seaRadius * 1.04), size.height / (span * 1.06))
    if (cam.zoom !== zoom) {
      cam.zoom = zoom
      cam.updateProjectionMatrix()
    }

    const goal = azimuth.current
    const delta = goal - current.current
    current.current = Math.abs(delta) < 0.0005 ? goal : current.current + delta * 0.15
    const r = 20
    camera.position.set(
      Math.sin(current.current) * cos * r,
      target.y + sin * r,
      Math.cos(current.current) * cos * r
    )
    camera.lookAt(target)
    if (current.current !== goal) invalidate()
  })

  return null
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export default function IslandScene3D({ scene, active, onHover, onOpen }: Props) {
  const { palette, dark } = usePalette()
  const { plots } = scene

  const [cx, cz] = scene.centre
  const { coast } = scene
  // The sea follows the coast at a wandering distance — a patch of sea, not a
  // round plate. Seeded like the coast, so it keeps its shape between visits.
  const sea = useMemo(
    () =>
      growOutline(
        coast.points,
        BEACH + 0.3,
        0.35,
        hashString(
          `sea:${plots
            .map((p) => p.id)
            .sort()
            .join('|')}`
        )
      ),
    [coast.points, plots]
  )
  const seaRadius = sea.radius
  const seaSlab = useMemo(() => coastSlab(sea.points, 0, SEA_TOP - SEA_BOTTOM), [sea.points])

  const grass = useMemo(() => coastSlab(coast.points, 0, 0.14), [coast.points])
  const sand = useMemo(() => coastSlab(coast.points, BEACH, 0.14), [coast.points])

  // Variant colours are authored for the light theme; the dark theme tones
  // them down so the buildings sit in the dimmer scene.
  const models: ModelPalette = useMemo(
    () => ({
      lit: palette.lit,
      unlit: palette.unlit,
      frame: palette.frame,
      hedge: palette.tree,
      soil: palette.soil,
      trunk: palette.trunk,
      path: palette.path,
      garageDoor: dark ? '#9aa1ab' : '#d9dcde',
      smoke: dark ? '#8a96a8' : '#f4f4f2',
      tone: dark
        ? (c: string) => new THREE.Color(c).multiplyScalar(0.62).getStyle()
        : (c: string) => c,
    }),
    [palette, dark]
  )

  // The water only moves while it can be seen, and never for reduced motion.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => true
  )
  const box = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const pops: PopRegistry = useRef(new Map<string, Popped>())
  const azimuth = useRef(DEFAULT_AZIMUTH)
  const invalidateRef = useRef<(() => void) | null>(null)
  // A press only becomes a drag once it has moved, so a plain click still
  // reaches the building under the pointer.
  const press = useRef<{ x: number; dragging: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)

  const turn = (by: number) => {
    azimuth.current += by
    invalidateRef.current?.()
  }
  const endPress = () => {
    press.current = null
    setDragging(false)
  }

  return (
    <div
      ref={box}
      className={`relative h-[360px] w-full select-none ${dragging ? 'cursor-grabbing' : active ? 'cursor-pointer' : 'cursor-grab'}`}
      // Horizontal drags turn the island; vertical ones still scroll the page.
      style={{ touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        press.current = { x: e.clientX, dragging: false }
      }}
      onPointerMove={(e) => {
        const p = press.current
        if (!p) return
        const dx = e.clientX - p.x
        if (!p.dragging) {
          if (Math.abs(dx) < 4) return
          p.dragging = true
          setDragging(true)
          onHover(null)
          e.currentTarget.setPointerCapture(e.pointerId)
        }
        p.x = e.clientX
        turn(-dx * DRAG_SPEED)
      }}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onPointerLeave={() => onHover(null)}
    >
      <Canvas
        orthographic
        shadows="percentage"
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [10, 10, 10], near: 0.1, far: 100 }}
        onCreated={({ invalidate }) => {
          invalidateRef.current = invalidate
        }}
        aria-hidden
      >
        <MotionProvider moving={!reducedMotion}>
          <WaterClock running={onScreen && !reducedMotion} />
          <ShadowsOnce version={scene} />
          <Compositor focused={active !== null} veil={palette.card} pops={pops} />
          <CameraRig
            azimuth={azimuth}
            seaRadius={seaRadius}
            islandRadius={coast.radius}
            height={scene.maxHeight}
          />

          <hemisphereLight
            layers-mask={0b11}
            args={['#ffffff', palette.grass, dark ? 1.15 : 1.05]}
          />
          <directionalLight
            layers-mask={0b11}
            position={[3.5, 8, 5]}
            intensity={dark ? 1.4 : 1.8}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
            shadow-camera-left={-seaRadius}
            shadow-camera-right={seaRadius}
            shadow-camera-top={seaRadius}
            shadow-camera-bottom={-seaRadius}
            shadow-camera-near={1}
            shadow-camera-far={30}
          />
          <directionalLight
            layers-mask={0b11}
            position={[-6, 4, -3]}
            intensity={dark ? 0.4 : 0.35}
          />

          {/* Centre the island on the origin, where the camera and the
            shadow-casting light both aim. */}
          <group position={[-cx, 0, -cz]}>
            {/* Sea: a shallow slab with an organic edge, so it reads as a
              diorama base at any angle. Extrude groups: 0 = caps, 1 = sides. */}
            <mesh geometry={seaSlab} position={[cx, SEA_BOTTOM, cz]} receiveShadow>
              <meshLambertMaterial attach="material-0" color={palette.sea} />
              <meshLambertMaterial attach="material-1" color={palette.seaDeep} />
            </mesh>

            {/* Foam rolling out from the beach. Static (no ripples) for reduced
              motion: the clock never ticks, so they stay at their first frame. */}
            <group position={[cx, 0, cz]}>
              <Foam coast={coast.points} radius={coast.radius} color={palette.foam} dark={dark} />
            </group>

            {/* Beach, then grass, both following the coastline. Extrude groups:
              0 = caps, 1 = sides. */}
            <mesh geometry={sand} position={[cx, -0.21, cz]} receiveShadow>
              <meshLambertMaterial attach="material-0" color={palette.sand} />
              <meshLambertMaterial attach="material-1" color={palette.sand} />
            </mesh>
            <mesh geometry={grass} position={[cx, -0.14, cz]} receiveShadow>
              <meshLambertMaterial attach="material-0" color={palette.grass} />
              <meshLambertMaterial attach="material-1" color={palette.soil} />
            </mesh>

            {coast.trees.map(([x, z], i) => (
              <Pine key={i} at={[cx + x, cz + z]} palette={palette} />
            ))}

            {plots.map((p) => (
              <Plot
                key={p.id}
                p={p}
                palette={palette}
                models={models}
                lit={dark}
                isActive={active === p.id}
                pops={pops}
                hoverable={() => !press.current?.dragging}
                onHover={onHover}
                onOpen={onOpen}
              />
            ))}
          </group>
        </MotionProvider>
      </Canvas>
    </div>
  )
}
