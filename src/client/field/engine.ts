/**
 * 字符场引擎：同一套格子、字形图集与墨色分档，跑两种性格完全不同的图案。
 *
 *   field — 等高线拓扑：三维 Perlin 场按等值线切环，字沿等值线排布。
 *           信息密度高、迷幻，适合"开机那一下"。
 *   rain  — 稀疏字符雨：列式下落、长尾渐隐、极淡的网格纸。
 *           安静、干净，适合常驻背景。
 *
 * 两者都由真实指标驱动：CPU 越高越快，内存越满副色越多，网络越忙雨越密。
 *
 * @module dsh-os/field/engine
 */

import type { Pattern } from '../settings'
import { CHAN_COLOR, CHAN_GLYPHS, CHAN_HEIGHT, CHAN_LIGHT, CHAN_WIDTH } from './chan-art'
import { fbm, hash2 } from './noise'

export interface FieldSignal {
	cpu: number
	mem: number
	rx: number
	tx: number
	load: number
	running: number
}

const DEFAULTS: FieldSignal = { cpu: 0, mem: 0, rx: 0, tx: 0, load: 0, running: 0 }

const GLYPHS = [
	'@', '#', '█', '▓', '◤', '◢', '⣿', '▚', '▞', '▒',
	'%', '*', '+', '=', '-', ':', '⣷', '⣯', '░', 'ｱ', 'ｶ', 'ｻ', 'ｼ', 'ﾂ',
	'·', '.', '˙', 'ﾞ', 'ﾟ',
	'0', '1', '7', '9', 'ｳ', 'ｴ', 'ｵ', 'ｷ', 'ｸ', 'ｹ', 'ﾀ', 'ﾁ', 'Z', 'X', '$', '/', '\\', '|', '>', '<',
] as const

const CONTOUR_END = 10
const MID_END = 24
const DEEP_END = 29

/** 墨色分档：白热 → 主色亮/中/暗 → 副色 → 暖色 → 雨底。 */
const DEFAULT_INKS = [
	'rgb(214,255,250)',
	'rgb(46,236,216)',
	'rgb(30,158,158)',
	'rgb(18,84,94)',
	'rgb(255,74,154)',
	'rgb(255,178,78)',
	'rgb(11,48,54)',
]

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((value) => value / 16)

const LEVELS = [-0.46, -0.2, 0.08, 0.36, 0.62]

export interface ClearRect {
	x: number
	y: number
	w: number
	h: number
}

export interface FieldOptions {
	pattern?: Pattern
	reduced?: boolean
}

export interface FieldHandle {
	start: () => void
	stop: () => void
	destroy: () => void
	setSignal: (signal: Partial<FieldSignal>) => void
	setClearRect: (rect: ClearRect | null) => void
	setStage: (rect: ClearRect | null) => void
	setPalette: (inks: string[], accent?: string) => void
	fps: () => number
}

/** 主题色的 rgb 三元组：canvas 不认 CSS 变量，只能自己算。 */
function parseColor(value: string): [number, number, number] {
	const hex = value.replace('#', '')
	const full = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex
	const number = Number.parseInt(full, 16)
	if (!Number.isFinite(number)) return [46, 232, 212]
	return [(number >> 16) & 255, (number >> 8) & 255, number & 255]
}

function surfaceContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const context = canvas.getContext('2d', { alpha: true })
	if (!context) throw new Error('dsh-os: 2d context unavailable')
	return context
}

function cellSize(width: number, height: number): number {
	const short = Math.min(width, height)
	const target = short < 520 ? 15 : short < 780 ? 14 : short < 1100 ? 13 : 12
	return Math.max(9, Math.min(18, Math.round(target)))
}

export function createGlyphField(canvas: HTMLCanvasElement, options: FieldOptions = {}): FieldHandle {
	const context = surfaceContext(canvas)

	const state = {
		signal: { ...DEFAULTS },
		clear: null as ClearRect | null,
		stage: null as ClearRect | null,
		pattern: (options.pattern ?? 'rain') as Pattern,
		running: false,
		raf: 0,
		last: 0,
		time: 0,
		fps: 0,
		frames: 0,
		fpsAt: 0,
		reduced: options.reduced === true,
		inks: DEFAULT_INKS.slice(),
		accent: [46, 232, 212] as [number, number, number],
	}

	let dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
	let width = 0
	let height = 0
	let cell = 12
	let tile = 12
	let cols = 0
	let rows = 0
	let values = new Float32Array(0)
	let atlas: HTMLCanvasElement | null = null
	let portraitAtlas: HTMLCanvasElement | null = null
	let portraitTile = 0
	let gcell = 12
	let gcols = 0
	let grows = 0
	let rain = new Float32Array(0)
	let rainSpeed = new Float32Array(0)
	let rainLength = new Float32Array(0)
	let background: CanvasGradient | null = null

	/** 把字形烘焙成图集：每个墨色一档，行=墨色，列=字形。 */
	function buildAtlas(): void {
		const scale = dpr
		tile = Math.max(8, Math.round(cell * scale))
		const surface = document.createElement('canvas')
		surface.width = GLYPHS.length * tile
		surface.height = state.inks.length * tile
		const paint = surface.getContext('2d')
		if (!paint) throw new Error('dsh-os: atlas context unavailable')
		paint.textAlign = 'center'
		paint.textBaseline = 'middle'
		paint.font = `${Math.round(tile * 0.78)}px ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Noto Sans Mono CJK SC", monospace`
		GLYPHS.forEach((glyph, index) => {
			state.inks.forEach((ink, inkIndex) => {
				paint.fillStyle = ink
				paint.fillText(glyph, index * tile + tile / 2, inkIndex * tile + tile / 2)
			})
		})
		atlas = surface
	}

	/** 人物层用更细的字格渲染，才有脸和发丝的余地。 */
	function buildPortraitAtlas(): void {
		const size = Math.max(6, Math.round(gcell * dpr))
		const surface = document.createElement('canvas')
		surface.width = GLYPHS.length * size
		surface.height = state.inks.length * size
		const paint = surface.getContext('2d')
		if (!paint) throw new Error('dsh-os: portrait atlas unavailable')
		paint.textAlign = 'center'
		paint.textBaseline = 'middle'
		paint.font = `${Math.round(size * 0.82)}px ui-monospace, "JetBrains Mono", Menlo, Consolas, "Noto Sans Mono CJK SC", monospace`
		GLYPHS.forEach((glyph, index) => {
			state.inks.forEach((ink, inkIndex) => {
				paint.fillStyle = ink
				paint.fillText(glyph, index * size + size / 2, inkIndex * size + size / 2)
			})
		})
		portraitAtlas = surface
		portraitTile = size
	}

	function layout(): void {
		const rect = canvas.getBoundingClientRect()
		width = Math.max(320, Math.round(rect.width || window.innerWidth))
		height = Math.max(320, Math.round(rect.height || window.innerHeight))
		dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
		cell = cellSize(width, height)
		canvas.width = Math.round(width * dpr)
		canvas.height = Math.round(height * dpr)
		canvas.style.width = `${width}px`
		canvas.style.height = `${height}px`
		cols = Math.ceil(width / cell) + 1
		rows = Math.ceil(height / cell) + 1
		values = new Float32Array(cols * rows)
		rain = new Float32Array(cols)
		rainSpeed = new Float32Array(cols)
		rainLength = new Float32Array(cols)
		for (let x = 0; x < cols; x += 1) {
			rain[x] = Math.random() * (rows + 30)
			rainLength[x] = 14 + Math.floor(Math.random() * 18)
			rainSpeed[x] = 1.0 + Math.random() * 2.4
		}
		gcell = Math.max(8, cell * 0.72)
		gcols = Math.ceil(width / gcell) + 1
		grows = Math.ceil(height / gcell) + 1
		hitIndex = new Int16Array(gcols * grows)
		hitLight = new Float32Array(gcols * grows)
		hitDepth = new Float32Array(gcols * grows)
		buildAtlas()
		buildPortraitAtlas()
		context.imageSmoothingEnabled = false
		background = context.createLinearGradient(0, 0, width * 0.25, height)
		background.addColorStop(0, '#04070b')
		background.addColorStop(0.55, '#050a0f')
		background.addColorStop(1, '#020407')
	}

	/** hero 周围的椭圆让位系数：0 表示完全退到地纹里，1 表示原样。 */
	function veilAt(px: number, py: number): number {
		const clear = state.clear
		if (!clear) return 1
		const left = clear.x
		const top = clear.y
		const right = clear.x + clear.w
		const bottom = clear.y + clear.h
		const cx = left + (right - left) / 2
		const cy = top + (bottom - top) / 2
		const nx = (px + cell / 2 - cx) / Math.max(120, (right - left) * 0.62)
		const ny = (py + cell / 2 - cy) / Math.max(90, (bottom - top) * 0.78)
		const floor = state.pattern === 'dshchan' ? 0.24 : 0.07
		return Math.min(1, floor + Math.hypot(nx, ny) * 1.05)
	}

	function paintBackground(): void {
		context.setTransform(1, 0, 0, 1, 0, 0)
		context.clearRect(0, 0, canvas.width, canvas.height)
		context.fillStyle = background ?? '#03060a'
		context.fillRect(0, 0, canvas.width, canvas.height)
		context.setTransform(dpr, 0, 0, dpr, 0, 0)
	}

	// ── 等高线拓扑 ───────────────────────────────────────────────────────

	function sampleField(time: number): void {
		const drift = time * 0.05
		const scale = 1 / (cell * 5.4)
		const speed = 0.55 + Math.min(1.6, state.signal.cpu / 55)
		for (let y = 0; y < rows; y += 1) {
			for (let x = 0; x < cols; x += 1) {
				values[y * cols + x] = fbm(x * scale, y * scale, drift * speed)
			}
		}
	}

	function inkFor(x: number, y: number, time: number): { ink: number; ring: number } {
		const index = y * cols + x
		const value = values[index]!
		const left = values[y * cols + Math.max(0, x - 1)]!
		const right = values[y * cols + Math.min(cols - 1, x + 1)]!
		const up = values[Math.max(0, y - 1) * cols + x]!
		const down = values[Math.min(rows - 1, y + 1) * cols + x]!
		const gradient = Math.hypot(right - left, down - up) * 0.5
		const shift = Math.sin(time * 0.35) * 0.035
		let best = 99
		let ring = 0
		for (let level = 0; level < LEVELS.length; level += 1) {
			const distance = Math.abs(value - (LEVELS[level]! + shift)) / Math.max(gradient, 0.035)
			if (distance < best) {
				best = distance
				ring = level
			}
		}
		return { ink: best, ring }
	}

	function drawField(time: number): void {
		const signal = state.signal
		sampleField(time)
		if (!atlas) return

		const glitchChance = 0.014 + Math.min(0.05, signal.load / 40) + (signal.mem > 82 ? 0.02 : 0)
		const bands = new Map<number, number>()
		if (Math.random() < glitchChance) {
			const start = Math.floor(Math.random() * rows)
			const span = 1 + Math.floor(Math.random() * 3)
			for (let row = start; row < Math.min(rows, start + span); row += 1) {
				bands.set(row, Math.round((Math.random() - 0.5) * 6))
			}
		}

		const sweep = ((time * 26) % (cols + 26)) - 13
		const epoch = Math.floor(time * 3)
		const rainDensity = 0.14 + Math.min(0.4, (signal.rx + signal.tx) / 6_000_000)

		for (let y = 0; y < rows; y += 1) {
			const py = y * cell
			const shiftCells = bands.get(y) ?? 0
			for (let x = 0; x < cols; x += 1) {
				const px = x * cell
				const { ink, ring } = inkFor(x, y, time)
				const dither = BAYER[(x & 3) + (y & 3) * 4] ?? 0
				const veil = veilAt(px, py)

				if ((x & 7) === 0 && (y & 7) === 0) {
					context.globalAlpha = 0.35 * veil
					context.drawImage(atlas, 14 * tile, 3 * tile, tile, tile, px, py, cell, cell)
					context.globalAlpha = 1
				}

				const sweepDistance = Math.abs(x - sweep)
				const sweeping = sweepDistance < 9 ? 1 - sweepDistance / 9 : 0

				if (ink < 0.44) {
					if (dither > 0.9 && sweeping < 0.5) continue
					let bucket = ring === 3 ? 4 : ring === 2 ? 2 : 1
					if (ring === 3 && hash2(x, y, epoch + 11) > 0.62) bucket = 2
					if (ink < 0.13 || sweeping > 0.65) bucket = 0
					if (veil < 0.5) bucket = Math.min(bucket, 2)
					const glyphIndex = Math.floor(hash2(x, y, epoch + ring * 7) * CONTOUR_END)
					context.globalAlpha = 0.55 + veil * 0.45
					context.drawImage(atlas, glyphIndex * tile, bucket * tile, tile, tile, px + shiftCells * cell, py, cell, cell)
					context.globalAlpha = 1
					continue
				}

				if (ink < 0.95) {
					if (dither > 0.07 * veil + 0.015) continue
					const glyphIndex = 10 + Math.floor(hash2(x, y, epoch) * 8)
					context.globalAlpha = 0.42 * veil
					context.drawImage(atlas, glyphIndex * tile, 3 * tile, tile, tile, px + shiftCells * cell, py, cell, cell)
					context.globalAlpha = 1
					continue
				}

				const grain = hash2(x, y, epoch + 97)
				if (grain < 0.03 * veil) {
					const glyphIndex = MID_END + Math.floor(hash2(x, y, epoch) * 5)
					context.globalAlpha = 0.5 * veil
					context.drawImage(atlas, glyphIndex * tile, 3 * tile, tile, tile, px, py, cell, cell)
					context.globalAlpha = 1
				}
			}
		}

		for (let x = 1; x < cols; x += 2) {
			if (hash2(x, 0, 7) > rainDensity + 0.45) continue
			const speed = rainSpeed[x]! * (0.6 + Math.min(1.4, (signal.tx + signal.rx) / 4_000_000))
			rain[x] = (rain[x]! + speed * 0.55) % (rows + 8)
			const head = Math.floor(rain[x]!)
			const tail = 4 + Math.floor(hash2(x, 1, 3) * 10)
			for (let offset = 0; offset < tail; offset += 1) {
				const y = head - offset
				if (y < 0 || y >= rows) continue
				const px = x * cell
				const veil = veilAt(px, y * cell)
				if (veil < 0.35 && offset < tail * 0.5) continue
				const glyphIndex = DEEP_END + 1 + Math.floor(hash2(x, y, epoch) * (GLYPHS.length - DEEP_END - 1))
				const bucket = offset === 0 ? 2 : offset < 2 ? 3 : 6
				context.globalAlpha = Math.max(0.25, veil)
				context.drawImage(atlas, glyphIndex * tile, bucket * tile, tile, tile, px, y * cell, cell, cell)
				context.globalAlpha = 1
			}
		}
	}

	// ── 稀疏字符雨 ───────────────────────────────────────────────────────

	function drawRain(time: number): void {
		if (!atlas) return
		const signal = state.signal
		const epoch = Math.floor(time * 4)
		const busy = Math.min(1.6, (signal.rx + signal.tx) / 3_000_000)

		// 极淡的方格纸：每 4 格一个点。
		for (let y = 0; y < rows; y += 4) {
			for (let x = 0; x < cols; x += 4) {
				const veil = veilAt(x * cell, y * cell)
				if (veil < 0.3) continue
				context.globalAlpha = 0.22 * veil
				context.drawImage(atlas, 25 * tile, 6 * tile, tile, tile, x * cell, y * cell, cell, cell)
				context.globalAlpha = 1
			}
		}

		// 一条很慢的竖向扫掠，提醒"屏幕还活着"。
		const sweep = ((time * 9) % (cols + 40)) - 20
		const sweepWidth = 5
		for (let x = 1; x < cols; x += 2) {
			const seed = hash2(x, 0, 11)
			if (seed > 0.72) continue
			const speed = rainSpeed[x]! * (0.75 + busy * 0.6)
			rain[x] = (rain[x]! + speed * 0.34) % (rows + 40)
			const head = Math.floor(rain[x]!) - 10
			const length = rainLength[x]! + 6
			const px = x * cell
			const columnSweep = Math.abs(x - sweep) < sweepWidth ? 1 - Math.abs(x - sweep) / sweepWidth : 0
			for (let offset = 0; offset < length; offset += 1) {
				const y = head - offset
				if (y < 0 || y >= rows) continue
				const veil = veilAt(px, y * cell)
				if (veil < 0.22) continue
				const fade = 1 - offset / length
				let bucket = offset === 0 ? 0 : offset < 3 ? 1 : fade > 0.55 ? 2 : 3
				if (offset >= 3 && hash2(x, y, epoch) > 0.78) bucket = 4
				if (columnSweep > 0 && offset < 6) bucket = Math.min(bucket, 1)
				const glyphIndex = 25 + Math.floor(hash2(x, y, epoch) * (GLYPHS.length - 25))
				context.globalAlpha = Math.min(1, Math.max(0.22, fade * 1.05) * veil + (offset === 0 ? 0.4 : 0))
				context.drawImage(atlas, glyphIndex * tile, bucket * tile, tile, tile, px, y * cell, cell, cell)
				context.globalAlpha = 1
			}
		}

		// 极少数"噪声星点"，让空处有微小的呼吸。
		for (let index = 0; index < 26; index += 1) {
			const x = Math.floor(hash2(index, 1, epoch + 5) * cols)
			const y = Math.floor(hash2(index, 2, epoch + 5) * rows)
			const veil = veilAt(x * cell, y * cell)
			if (veil < 0.4) continue
			context.globalAlpha = 0.35 * veil
			context.drawImage(atlas, 26 * tile, 3 * tile, tile, tile, x * cell, y * cell, cell, cell)
			context.globalAlpha = 1
		}
	}

	// ── 3D 旋转 DSH 娘全息投影 ────────────────────────────────────────────

	/** 立绘里每种材质给一个高度差，旋转时才有真的视差。 */
	const LAYER_Z = [0.02, -0.03, 0.05, 0.07, -0.05, 0.03]
	/** 全息卡片用块状半调，细笔画字形在这个尺寸下会散成虚线。 */
	const BLOCK_RAMP = [25, 18, 9, 3, 2]
	let hitIndex = new Int16Array(0)
	let hitLight = new Float32Array(0)
	let hitDepth = new Float32Array(0)
	const portrait: { x: number[]; y: number[]; z: number[]; glyph: number[]; mat: number[]; light: number[] } = {
		x: [],
		y: [],
		z: [],
		glyph: [],
		mat: [],
		light: [],
	}
	for (let row = 0; row < CHAN_HEIGHT; row += 1) {
		const glyphs = CHAN_GLYPHS[row] ?? ''
		const light = CHAN_LIGHT[row] ?? ''
		const colors = CHAN_COLOR[row] ?? ''
		for (let column = 0; column < CHAN_WIDTH; column += 1) {
			const glyph = glyphs[column] ?? ' '
			if (glyph === ' ') continue
			const glyphIndex = GLYPHS.indexOf(glyph as never)
			if (glyphIndex < 0) continue
			const mat = Number(colors[column] ?? '0')
			portrait.x.push((column - CHAN_WIDTH / 2 + 0.5) / (CHAN_HEIGHT / 2))
			portrait.y.push((CHAN_HEIGHT / 2 - row - 0.5) / (CHAN_HEIGHT / 2))
			portrait.z.push(LAYER_Z[mat] ?? 0)
			portrait.glyph.push(glyphIndex)
			portrait.mat.push(mat)
			portrait.light.push(Number.parseInt(light[column] ?? '0', 16) / 15 + 0.18)
		}
	}

	function drawDshChan(time: number): void {
		if (!atlas) return
		const signal = state.signal
		const stage = state.stage ?? { x: 0, y: 0, w: width, h: height }
		if (!portraitAtlas || hitIndex.length !== gcols * grows) return
		hitIndex.fill(-1)
		hitDepth.fill(-9)

		const centerX = stage.x + stage.w / 2
		const scale = Math.min((stage.h * 0.76) / 2.05, stage.w * 0.82)
		const originY = stage.y + stage.h * 0.42
		const baseY = originY + 1.02 * scale
		const baseR = 0.52 * scale

		// 投影台
		const sweep = (time * 0.8) % (Math.PI * 2)
		for (let index = 0; index < 64; index += 1) {
			const angle = (index / 64) * Math.PI * 2
			const px = centerX + Math.cos(angle) * baseR
			const py = baseY + Math.sin(angle) * baseR * 0.24
			if (py > height + cell || px < -cell || px > width + cell) continue
			const delta = Math.abs(((angle - sweep + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
			const near = delta < 0.6 ? 1 - delta / 0.6 : 0
			context.globalAlpha = (index % 4 === 0 ? 0.4 : 0.15) + near * 0.45
			context.drawImage(atlas, (index % 4 === 0 ? 15 : 25) * tile, (near > 0.2 ? 1 : 3) * tile, tile, tile, px, py, cell, cell)
		}
		context.globalAlpha = 1

		// 背光
		const [ar, ag, ab] = state.accent
		const glow = context.createRadialGradient(centerX, originY - 0.05 * scale, 0.04 * scale, centerX, originY - 0.05 * scale, scale * 1.1)
		glow.addColorStop(0, `rgba(${ar},${ag},${ab},.16)`)
		glow.addColorStop(0.5, `rgba(${ar},${ag},${ab},.06)`)
		glow.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
		context.fillStyle = glow
		context.fillRect(centerX - scale, originY - 1.3 * scale, scale * 2, 2.6 * scale)

		const spin = time * (0.1 + Math.min(0.05, signal.cpu / 1200)) + Math.sin(time * 0.33) * 0.1
		const tilt = -0.03 + Math.sin(time * 0.6) * 0.05
		const cosY = Math.cos(spin)
		const sinY = Math.sin(spin)
		const cosX = Math.cos(tilt)
		const sinX = Math.sin(tilt)
		const bob = Math.sin(time * 1.2) * 0.012
		const edgeOn = Math.abs(cosY) < 0.16

		for (let index = 0; index < portrait.x.length; index += 1) {
			const x = portrait.x[index]!
			const y = portrait.y[index]!
			const z = portrait.z[index]!
			const x1 = x * cosY - z * sinY
			const z1 = x * sinY + z * cosY
			const depth = y * sinX + z1 * cosX
			const fov = 2.6 / Math.max(0.9, 2.6 - depth)
			const px = centerX + x1 * scale * fov
			const py = originY - (y * cosX - z1 * sinX + bob) * scale * fov
			const cellX = Math.floor(px / gcell)
			const cellY = Math.floor(py / gcell)
			if (cellX < 0 || cellX >= gcols || cellY < 0 || cellY >= grows) continue
			const slot = cellY * gcols + cellX
			if (depth <= hitDepth[slot]!) continue
			hitDepth[slot] = depth
			hitIndex[slot] = index
			hitLight[slot] = portrait.light[index]!
		}

		// 侧身瞬间做一次"重建"抖动，别让它看起来像纸片
		const glitch = edgeOn && (time % 0.5) < 0.12
		for (let cellY = 0; cellY < grows; cellY += 1) {
			if (cellY % 15 === 0) continue
			const py = cellY * gcell + gcell * 0.5
			for (let cellX = 0; cellX < gcols; cellX += 1) {
				const slot = cellY * gcols + cellX
				const index = hitIndex[slot]!
				if (index < 0) continue
				const light = Math.min(1, Math.pow(hitLight[slot]!, 0.82) * 1.12)
				const mat = portrait.mat[index]!
				const px = cellX * gcell + gcell * 0.5
				const veil = veilAt(px, py)
				const bucket =
					mat === 2 ? (light > 0.42 ? 0 : light > 0.2 ? 1 : 2)
					: mat === 3 ? (light > 0.24 ? 5 : 3)
					: mat === 0 ? (light > 0.42 ? 1 : light > 0.2 ? 2 : 3)
					: mat === 4 ? (light > 0.3 ? 4 : 6)
					: light > 0.55 ? 2 : light > 0.24 ? 3 : 6
				const offset = glitch ? (hash2(cellX, cellY, Math.floor(time * 20)) - 0.5) * gcell * 1.6 : 0
				const glyph = BLOCK_RAMP[Math.min(BLOCK_RAMP.length - 1, Math.floor(light * BLOCK_RAMP.length))]!
				const size = gcell * 1.34
				const left = cellX * gcell - size * 0.17 + offset
				const top = cellY * gcell - size * 0.17
				const bloom = size * 1.6
				context.globalAlpha = Math.min(1, light * 0.12 * veil)
				context.drawImage(portraitAtlas, glyph * portraitTile, bucket * portraitTile, portraitTile, portraitTile, left - (bloom - size) / 2, top - (bloom - size) / 2, bloom, bloom)
				context.globalAlpha = Math.min(1, (0.74 + light * 0.4) * veil)
				context.drawImage(portraitAtlas, glyph * portraitTile, bucket * portraitTile, portraitTile, portraitTile, left, top, size, size)
			}
		}
		context.globalAlpha = 1

		// 转到侧面时补一道扫描光带，别让人物凭空消失
		if (edgeOn) {
			const beamTop = originY - 0.98 * scale
			const beamBottom = originY + 0.98 * scale
			context.globalAlpha = 0.5
			for (let py = beamTop; py < beamBottom; py += gcell) {
				const px = centerX + (hash2(1, Math.floor(py / gcell), Math.floor(time * 12)) - 0.5) * gcell * 2
				context.drawImage(portraitAtlas, 18 * portraitTile, 1 * portraitTile, portraitTile, portraitTile, px - gcell * 0.5, py, gcell, gcell)
			}
			context.globalAlpha = 1
		}

		// 台面倒影：把画布自身翻折一次，比逐点再画一遍便宜
		context.save()
		context.globalAlpha = 0.1
		context.globalCompositeOperation = 'lighter'
		context.translate(0, baseY * 2)
		context.scale(1, -0.42)
		context.drawImage(canvas, 0, 0)
		context.restore()
		context.globalAlpha = 1

		// 上升的数据尘
		const epoch = Math.floor(time)
		for (let index = 0; index < 24; index += 1) {
			const seed = hash2(index, 3, 17)
			const rise = (time * (0.1 + seed * 0.13) + seed) % 1
			const px = centerX + (hash2(index, 5, epoch) - 0.5) * baseR * 2.6
			const py = baseY - rise * scale * 1.9
			context.globalAlpha = (1 - rise) * 0.35 * veilAt(px, py)
			context.drawImage(atlas, 25 * tile, 1 * tile, tile, tile, px, py, cell, cell)
		}
		context.globalAlpha = 1
	}

	function frame(now: number): void {
		if (!state.running) return
		state.raf = requestAnimationFrame(frame)
		const interval = state.reduced ? 1000 : 100
		if (now - state.last < interval) return
		state.last = now
		state.time += state.reduced ? 0 : interval / 1000
		paintBackground()
		if (state.pattern === 'field') drawField(state.time)
		else if (state.pattern === 'rain') drawRain(state.time)
		else if (state.pattern === 'dshchan') drawDshChan(state.time)
		state.frames += 1
		if (now - state.fpsAt > 1000) {
			state.fps = Math.round((state.frames * 1000) / (now - state.fpsAt))
			state.frames = 0
			state.fpsAt = now
		}
	}

	function start(): void {
		if (state.running) return
		state.running = true
		state.last = 0
		state.fpsAt = performance.now()
		state.frames = 0
		state.raf = requestAnimationFrame(frame)
	}

	function stop(): void {
		state.running = false
		cancelAnimationFrame(state.raf)
	}

	const onResize = (): void => {
		layout()
		if (!state.running || state.reduced) {
			paintBackground()
			if (state.pattern === 'field') drawField(state.time)
			else if (state.pattern === 'rain') drawRain(state.time)
			else if (state.pattern === 'dshchan') drawDshChan(state.time)
		}
	}

	layout()
	window.addEventListener('resize', onResize)

	return {
		start,
		stop,
		destroy(): void {
			stop()
			window.removeEventListener('resize', onResize)
		},
		setSignal(signal: Partial<FieldSignal>): void {
			Object.assign(state.signal, signal)
		},
		setClearRect(rect: ClearRect | null): void {
			state.clear = rect
		},
		setStage(rect: ClearRect | null): void {
			state.stage = rect
		},
		setPalette(inks: string[], accent?: string): void {
			if (inks.length < 7) return
			state.inks = inks.slice()
			if (accent) state.accent = parseColor(accent)
			buildAtlas()
			buildPortraitAtlas()
		},
		fps: (): number => state.fps,
	}
}
