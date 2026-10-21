import { createGlyphField } from '../src/client/field/engine'

const canvas = document.createElement('canvas')
canvas.style.position = 'fixed'
canvas.style.inset = '0'
document.getElementById('stage')!.appendChild(canvas)
const field = createGlyphField(canvas)
field.setSignal({ cpu: Number(new URLSearchParams(location.search).get('cpu') ?? 25), mem: 62, load: 1.2, rx: 90000, tx: 40000 })
field.setClearRect({ x: 470, y: 330, w: 770, h: 250 })
field.start()
