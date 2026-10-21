/**
 * 决定论 Perlin 噪声（2D/3D 共用置换表）。
 *
 * 场引擎每帧要采样上万个点，这里只保留真正用得上的部分：没有分配、
 * 没有 gl 依赖，纯函数。
 *
 * @module dsh-os/field/noise
 */

const PERM = (() => {
	const table = new Uint8Array(512)
	let seed = 0x9e3779b9
	const random = (): number => {
		seed ^= seed << 13
		seed ^= seed >>> 17
		seed ^= seed << 5
		return ((seed >>> 0) % 1000) / 1000
	}
	const base = new Uint8Array(256)
	for (let index = 0; index < 256; index += 1) base[index] = index
	for (let index = 255; index > 0; index -= 1) {
		const swap = Math.floor(random() * (index + 1))
		const value = base[index]!
		base[index] = base[swap]!
		base[swap] = value
	}
	for (let index = 0; index < 512; index += 1) table[index] = base[index & 255]!
	return table
})()

const GRAD3 = [
	[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
	[1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
	[0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
]

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const dot = (hash: number, x: number, y: number, z: number): number => {
	const g = GRAD3[hash % 12]!
	return g[0]! * x + g[1]! * y + g[2]! * z
}

/** 三维 Perlin，值域约 [-1, 1]。 */
export function perlin3(x: number, y: number, z: number): number {
	const xi = Math.floor(x) & 255
	const yi = Math.floor(y) & 255
	const zi = Math.floor(z) & 255
	const xf = x - Math.floor(x)
	const yf = y - Math.floor(y)
	const zf = z - Math.floor(z)
	const u = fade(xf)
	const v = fade(yf)
	const w = fade(zf)
	const a = PERM[xi]! + yi
	const aa = PERM[a]! + zi
	const ab = PERM[a + 1]! + zi
	const b = PERM[xi + 1]! + yi
	const ba = PERM[b]! + zi
	const bb = PERM[b + 1]! + zi
	const x1 = lerp(dot(PERM[aa]!, xf, yf, zf), dot(PERM[ba]!, xf - 1, yf, zf), u)
	const x2 = lerp(dot(PERM[ab]!, xf, yf - 1, zf), dot(PERM[bb]!, xf - 1, yf - 1, zf), u)
	const y1 = lerp(x1, x2, v)
	const x3 = lerp(dot(PERM[aa + 1]!, xf, yf, zf - 1), dot(PERM[ba + 1]!, xf - 1, yf, zf - 1), u)
	const x4 = lerp(dot(PERM[ab + 1]!, xf, yf - 1, zf - 1), dot(PERM[bb + 1]!, xf - 1, yf - 1, zf - 1), u)
	const y2 = lerp(x3, x4, v)
	return lerp(y1, y2, w)
}

/** 分形叠加：三种倍频，权重按 1/2 递减。 */
export function fbm(x: number, y: number, z: number): number {
	const sum = perlin3(x, y, z) * 0.62 + perlin3(x * 2.03, y * 2.03, z * 1.7) * 0.28 + perlin3(x * 4.11, y * 4.11, z * 2.3) * 0.1
	// 归一化到接近 [-1, 1]，让每一层等值线都有机会出现。
	return sum * 2.1
}

/** 稳定哈希：同一个 (x, y, epoch) 永远得到同一个 [0, 1) 值。 */
export function hash2(x: number, y: number, epoch: number): number {
	let h = x * 374761393 + y * 668265263 + epoch * 2246822519
	h = (h ^ (h >>> 13)) * 1274126177
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
