/**
 * 把本机真实会话日志搬进 e2e 隔离 home，供会话视图截图使用。
 *
 * DSH 在启动时才会列出工作区里的会话，所以顺序是：
 *   node e2e/seed-conversation.mjs && dsh-e2e stop && dsh-e2e start --wait-ready
 *   dsh-e2e run e2e/shots.mjs
 * 本机没有该工作区的历史时直接跳过（退出码 0），会话截图就不会产出。
 */
import { seedConversation } from './lib/fixtures.mjs'

const home = new URL('../.dsh-e2e-home', import.meta.url).pathname
const id = seedConversation(home)
console.log(id ? `✓ 已播种真实会话 ${id}` : '· 本机没有该工作区的会话历史，跳过')
