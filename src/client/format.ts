/**
 * 数字的终端写法：固定宽度、短、不四舍五入到失真。
 *
 * @module dsh-os/client/format
 */

/** 字节 → B/K/M/G（保留一位小数，去掉多余的 .0）。 */
export function bytes(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return '0'
	const units = ['B', 'K', 'M', 'G', 'T']
	let index = 0
	let scaled = value
	while (scaled >= 1024 && index < units.length - 1) {
		scaled /= 1024
		index += 1
	}
	const digits = scaled >= 100 || index === 0 ? 0 : 1
	return `${scaled.toFixed(digits)}${units[index]}`
}

/** 速率：字节/秒。 */
export function rate(value: number): string {
	return `${bytes(value)}/s`
}

/** 秒 → 时长：HH:MM:SS / Nd HH:MM。 */
export function duration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return '00:00:00'
	const total = Math.floor(seconds)
	const days = Math.floor(total / 86400)
	const hours = Math.floor((total % 86400) / 3600)
	const minutes = Math.floor((total % 3600) / 60)
	const secs = total % 60
	const pad = (value: number): string => String(value).padStart(2, '0')
	if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}`
	return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
}

/** 时钟：HH:MM:SS。 */
export function clock(at: number): string {
	const date = new Date(at)
	return [date.getHours(), date.getMinutes(), date.getSeconds()].map((value) => String(value).padStart(2, '0')).join(':')
}

/** 日期：YYYY-MM-DD。 */
export function date(at: number): string {
	const value = new Date(at)
	const month = String(value.getMonth() + 1).padStart(2, '0')
	const day = String(value.getDate()).padStart(2, '0')
	return `${value.getFullYear()}-${month}-${day}`
}

/** 相对时间：刚刚 / 3m / 2h / 5d。 */
export function ago(at: number, now = Date.now()): string {
	const delta = Math.max(0, now - at)
	if (delta < 60_000) return 'now'
	if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`
	if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`
	return `${Math.floor(delta / 86_400_000)}d`
}

/** 百分比：整数。 */
export function percent(value: number | null | undefined): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '--'
	return `${Math.round(value)}%`
}

/** token 数：1.2M / 84.2K / 912。 */
export function tokens(value: number | null | undefined): string {
	if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '0'
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
	if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
	return String(Math.round(value))
}

/** 补齐固定宽度（等宽字体下的列对齐）。 */
export function pad(value: string | number, width: number): string {
	return String(value).padStart(width, ' ')
}

/** 把标题压成一行短名。 */
export function shorten(title: string, width: number): string {
	const clean = title.replace(/\s+/g, ' ').trim()
	return clean.length <= width ? clean : `${clean.slice(0, Math.max(1, width - 1))}…`
}

/** 工作区 basename。 */
export function basename(path: string | undefined): string {
	if (!path) return '—'
	const parts = path.split('/').filter(Boolean)
	return parts[parts.length - 1] ?? path
}
