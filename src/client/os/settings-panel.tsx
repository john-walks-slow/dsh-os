/**
 * 设置页（settings.section）：背景图案、主题色、原生皮肤开关。
 *
 * 控件用宿主主题变量着色，所以在浅色/深色盘下都像原生设置项；真正的
 * 观感改动发生在 HUD 与字符场里。
 *
 * @module dsh-os/os/settings-panel
 */

import { useSyncExternalStore } from 'react'
import { ACCENTS, PATTERNS, type AccentName, type Pattern, type SettingsStore } from '../settings'

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

function Field({
	title,
	hint,
	children,
}: {
	title: string
	hint?: string
	children: JSX.Element
}): JSX.Element {
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
	return (
		<section className="dso-settings">
			<header className="dso-header">
				<h2>DeepSeek Harness OS</h2>
				<p>首页桌面层：字符场背景、开机自检、原生界面皮肤与 Token 账本。这些选项只影响浏览器观感，不改动会话数据。</p>
			</header>

			<div className="dso-group">
				<Field title="首页桌面层" hint="在主视图没有会话时接管首页；进入会话后自动退回普通界面。">
					<Toggle label="首页桌面层" on={settings.enabled} onChange={(enabled) => store.set({ enabled })} />
				</Field>
				<Field title="开机自检" hint="首次进入标签页时播放 POST 序列，可按任意键跳过。">
					<Toggle label="开机自检" on={settings.boot} onChange={(boot) => store.set({ boot })} />
				</Field>
				<Field title="Token 账本" hint="按会话统计输入/输出/缓存命中与解码速度；没有投影数据的会话显示为空。">
					<Toggle label="Token 账本" on={settings.ledger} onChange={(ledger) => store.set({ ledger })} />
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

			<h3 className="dso-section">原生界面皮肤</h3>
			<div className="dso-group">
				<Field title="侧边栏" hint="深色底、霓虹分隔线、New Session 描边按钮。">
					<Toggle label="侧边栏皮肤" on={settings.skinSidebar} onChange={(skinSidebar) => store.set({ skinSidebar })} />
				</Field>
				<Field title="输入框" hint="把 hero 输入框换成一扇终端窗：暗色渐变、主色描边、发光提交键。">
					<Toggle label="输入框皮肤" on={settings.skinComposer} onChange={(skinComposer) => store.set({ skinComposer })} />
				</Field>
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
