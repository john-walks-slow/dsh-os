/**
 * 设置页（settings.section）：桌面层开关、明暗、背景图案、主题色、输入框皮肤。
 *
 * 控件用宿主主题变量着色，所以在浅色/深色盘下都像原生设置项；真正的观感改动
 * 发生在 HUD 与字符场里。
 *
 * @module dsh-os/os/settings-panel
 */

import { useSyncExternalStore } from 'react'
import { ACCENTS, PATTERNS, TONES, type AccentName, type Pattern, type SettingsStore, type ToneChoice } from '../settings'

interface OsSettingsPanelProps {
	store: SettingsStore
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }): JSX.Element {
	return (
		<button
			type="button"
			className="dso-switch"
			data-on={on ? 'true' : 'false'}
			role="switch"
			aria-checked={on}
			aria-label={label}
			onClick={() => onChange(!on)}
		>
			<span className="dso-knob" />
		</button>
	)
}

function Field({ title, hint, children }: { title: string; hint?: string; children: JSX.Element }): JSX.Element {
	return (
		<div className="dso-field">
			<div className="dso-field-text">
				<b>{title}</b>
				{hint ? <span>{hint}</span> : null}
			</div>
			{children}
		</div>
	)
}

export function OsSettingsPanel({ store }: OsSettingsPanelProps): JSX.Element {
	const settings = useSyncExternalStore(store.subscribe, () => store.value)
	const patterns = Object.entries(PATTERNS) as [Pattern, { label: string; blurb: string }][]
	const accents = Object.entries(ACCENTS) as [Exclude<AccentName, 'custom'>, { key: string }][]
	const tones = Object.entries(TONES) as [ToneChoice, { label: string }][]
	return (
		<section className="dso-settings">
			<header className="dso-header">
				<h2>DeepSeek Harness OS</h2>
				<p>
					dsh-os 是一套覆盖整个 GUI 的主题：官方主题 token 负责配色与圆角，首页桌面层负责"停机时"的仪表盘，会话里的遥测条负责"干活时"的读数。所有数字来自本机真实读数与会话投影缓存，这些选项只改观感，不动会话数据。
				</p>
			</header>

			<div className="dso-group">
				<Field
					title="全应用主题"
					hint="接管 DSH 官方主题 token：会话流、侧边栏、代码块、弹窗、菜单一起换墨（深浅两套都由宿主明暗决定）。"
				>
					<Toggle label="全应用主题" on={settings.skin} onChange={(skin) => store.set({ skin })} />
				</Field>
				<Field title="首页桌面层" hint="在主视图没有会话时接管首页；进入会话后自动退回普通界面。">
					<Toggle label="首页桌面层" on={settings.enabled} onChange={(enabled) => store.set({ enabled })} />
				</Field>
				<Field title="会话遥测条" hint="会话视图顶端一条 21px 状态带：模型、上下文压力、用量、缓存与解码速度，点箭头展开明细。">
					<Toggle label="会话遥测条" on={settings.strip} onChange={(strip) => store.set({ strip })} />
				</Field>
				<Field title="开机自检" hint="首次进入标签页时播放 POST 序列，可按任意键跳过。">
					<Toggle label="开机自检" on={settings.boot} onChange={(boot) => store.set({ boot })} />
				</Field>
				<Field
					title="模型账本"
					hint="按模型聚合全部历史会话的 token 用量；点一行回到该模型最近用过的会话。桌面上也可用 WS / ALL 切换口径。"
				>
					<Toggle label="模型账本" on={settings.ledger} onChange={(ledger) => store.set({ ledger })} />
				</Field>
				<Field title="输入框皮肤" hint="把 hero 输入框换成一扇终端窗：与桌面同底的渐变、主色描边。">
					<Toggle label="输入框皮肤" on={settings.skinComposer} onChange={(skinComposer) => store.set({ skinComposer })} />
				</Field>
			</div>

			<h3 className="dso-section">明暗</h3>
			<div className="dso-group">
				<Field title="墨色" hint="跟随宿主时，宿主切深浅色桌面一起换（桌面不再强行改写宿主的主题）。">
					<span className="dso-seg">
						{tones.map(([key, meta]) => (
							<button
								key={key}
								type="button"
								className="dso-seg-item"
								data-on={settings.tone === key ? 'true' : 'false'}
								onClick={() => store.set({ tone: key })}
							>
								{meta.label}
							</button>
						))}
					</span>
				</Field>
			</div>

			<h3 className="dso-section">背景动效</h3>
			<div className="dso-patterns">
				{patterns.map(([key, meta]) => (
					<button
						type="button"
						key={key}
						className="dso-pattern"
						data-on={settings.pattern === key ? 'true' : 'false'}
						onClick={() => store.set({ pattern: key })}
					>
						<span className={`dso-pattern-art dso-pattern-art-${key}`} aria-hidden="true">
							<i />
							<i />
							<i />
							<i />
							<i />
						</span>
						<b>{meta.label}</b>
						<span>{meta.blurb}</span>
					</button>
				))}
			</div>

			<h3 className="dso-section">主题色</h3>
			<div className="dso-swatches">
				{accents.map(([key, meta]) => (
					<button
						type="button"
						key={key}
						className="dso-swatch"
						data-on={settings.accent === key ? 'true' : 'false'}
						style={{ background: meta.key }}
						aria-label={key}
						onClick={() => store.set({ accent: key })}
					/>
				))}
				<label className="dso-custom" data-on={settings.accent === 'custom' ? 'true' : 'false'}>
					<input
						type="color"
						value={settings.custom}
						onChange={(event) => store.set({ accent: 'custom', custom: event.target.value })}
					/>
					<span>自定义</span>
				</label>
			</div>

			<footer className="dso-footer">
				<span>快捷键：` 切换桌面层 · Esc 跳过开机</span>
				<button type="button" className="dso-reset" onClick={() => store.reset()}>
					恢复默认
				</button>
			</footer>
		</section>
	)
}
