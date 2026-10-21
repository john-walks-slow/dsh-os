/**
 * 两半产物：
 *
 *   lib/index.js   — 宿主半边。Node ESM，external 是 `@deepseek-ai/*`。
 *                    这份代码不 import 任何 dsh 包（含 type-only），所以 link 到
 *                    profile 之外也不会踩 ESM 解析坑。
 *   lib/client.js  — 浏览器半边。lazy-CJS，包进 `window.__ModuleLoader__.load`；
 *                    react / react-dom 与 `@deepseek-ai/*` 保持 external，由宿主的
 *                    模块表提供。load id 必须等于包名，否则整个 application combo
 *                    会被二次执行。
 */
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = dirname(fileURLToPath(import.meta.url))
const PKG = 'dsh-os'

const HOST = {
	entryPoints: [join(root, 'src/index.ts')],
	bundle: true,
	format: 'esm',
	platform: 'node',
	target: 'node22',
	external: ['@deepseek-ai/*'],
	sourcemap: false,
	logLevel: 'info',
	outfile: join(root, 'lib/index.js'),
}

const CLIENT = {
	entryPoints: [join(root, 'src/client/index.tsx')],
	bundle: true,
	format: 'cjs',
	platform: 'browser',
	jsx: 'automatic',
	target: 'es2022',
	minify: true,
	sourcemap: false,
	external: ['react', 'react-dom', 'react-dom/*', 'react/jsx-runtime', '@deepseek-ai/*'],
	logLevel: 'info',
}

const wrapped = [
	'window.__ModuleLoader__.load({',
	`\tid: "${PKG}",`,
	'\tfactory: (require) => {',
	'\t\tvar module = { exports: {} };',
	'\t\tvar exports = module.exports;',
	'\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
	'__BODY__',
	'\t\treturn module.exports;',
	'\t}',
	'});',
	'',
].join('\n')

await mkdir(join(root, 'lib'), { recursive: true })

await build(HOST)

const client = await build({ ...CLIENT, write: false })
const body = client.outputFiles[0].text
await (await import('node:fs/promises')).writeFile(
	join(root, 'lib/client.js'),
	wrapped.replace('__BODY__', () => body.trimEnd()),
	'utf8',
)
