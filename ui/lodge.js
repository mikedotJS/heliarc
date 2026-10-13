// Easter egg of the offline screen: the Red Room of the Black Lodge, one colour pixel art (after the famous waiting-room shot).
// Cooper in the armchair, the Man from Another Place on the sofa in front of the Venus, the Giant standing, floor lamps, zigzag floor.
const W = 128, H = 96, SCALE = 4, HORIZON = 54
const grid = Array.from({ length: H }, () => new Array(W).fill(0)) // 1 = ink, 0 = paper
const put = (x, y, v) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = v }
const rect = (x, y, w, h, v) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, v) }
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
const shade = (x, y, level) => level * 16 > BAYER[y & 3][x & 3] ? 1 : 0 // level 0 (paper) .. 1 (ink): ordered dithering, so a grey becomes a fine pattern

// a sprite is a grid of characters: '#' ink, '.' paper, '+' half ink (checker), ' ' see-through; blitted with a one pixel paper halo
const sprite = (rows, x0, y0, halo = true) => {
  const at = (i, j) => rows[j]?.[i] ?? ' '
  if (halo) for (let j = -1; j <= rows.length; j++) for (let i = -1; i <= rows[0].length; i++)
    if (at(i, j) === ' ' && [-1, 0, 1].some(dj => [-1, 0, 1].some(di => at(i + di, j + dj) !== ' '))) put(x0 + i, y0 + j, 0)
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === '#') put(x0 + i, y0 + j, 1); else if (c === '.') put(x0 + i, y0 + j, 0); else if (c === '+') put(x0 + i, y0 + j, (i + j) % 2 ? 0 : 1) }))
}
const canvasOf = (w, h) => { const rows = Array.from({ length: h }, () => Array(w).fill(' ')); return { rows, set: (x, y, c) => { if (rows[y]?.[x] !== undefined) rows[y][x] = c }, box(x, y, bw, bh, c) { for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) this.set(x + i, y + j, c) }, text(x, y, t) { [...t].forEach((c, i) => c !== '~' && this.set(x + i, y, c)) }, out: () => rows.map(r => r.join('')) } }

// 1. the red curtains: big vertical folds in four tones, a little darker toward the top
const TONES = [0, .22, .5, .78, 1]
for (let y = 0; y < HORIZON; y++) for (let x = 0; x < W; x++) {
  const p = (((x + Math.sin(y / 14) * 2.5) % 13) + 13) % 13 / 13 // where we are in the fold, 0..1
  const fold = p < .1 ? 1 : p < .55 ? 1 - (p - .1) / .45 * .8 : .2 + (p - .55) / .45 * .2 // a dark crease, then a slope toward the light, then a soft shadow
  const level = Math.min(1, (.35 + .55 * fold) * (1 - .12 * (1 - y / HORIZON)) + .12 * (1 - y / HORIZON))
  put(x, y, shade(x, y, TONES.reduce((a, t) => Math.abs(t - level) < Math.abs(a - level) ? t : a)))
}
// 2. the zigzag floor in perspective: real depth, so the chevrons narrow toward the back
for (let y = HORIZON; y < H; y++) {
  const d = y - HORIZON + 2.5
  for (let x = 0; x < W; x++) {
    const X = (x - W / 2) * 10 / d, Z = 320 / d, u = ((X / 7) % 1 + 1) % 1, tri = Math.abs(u - .5) * 2
    const ink = Math.floor(Z + 1.7 * tri) % 2 === 0
    put(x, y, d < 9 ? shade(x, y, .5) : ink ? 1 : shade(x, y, .1))
  }
}
rect(0, HORIZON - 1, W, 1, 1)

// 3. two floor lamps (a thin pole and a cone shade)
const lamp = (x, top) => {
  const cone = ['###########', '#.........#', ' #.......# ', '  #.....#  ', '   #####   ']
  sprite(cone.map(r => r.padEnd(11, ' ')), x - 5, top)
  rect(x, top + 5, 1, 76 - top, 1); rect(x - 3, 76, 7, 1, 1); rect(x - 2, 77, 5, 1, 1)
}
lamp(60, 12); lamp(120, 16)

// 4. the Venus on her pedestal, behind the sofa
sprite(['   ####   ', '  #....#  ', '  #....#  ', '   #..#   ', '  #.##.#  ', ' #......# ', ' #......# ', ' #.....## ', '  #....#  ', '  #....#  ', ' #.....#  ', ' #......# ', '  #.....# ', '  #.....# ', '  #....## ', '   #...#  ', '   #...#  ', '   ##.##  '], 80, 22)

// 5. the sofa
const sofa = canvasOf(46, 24); sofa.box(0, 4, 46, 20, '#'); sofa.box(2, 6, 42, 3, '+'); sofa.box(22, 8, 1, 16, '.'); sofa.box(0, 0, 4, 24, '#'); sofa.box(42, 0, 4, 24, '#')
sprite(sofa.out(), 66, 44)
// 7. Cooper, in the armchair on the left, black suit, legs crossed, a lamp on the little table
const chair = canvasOf(34, 36); chair.box(0, 4, 34, 32, '+'); chair.box(0, 0, 9, 36, '#'); chair.box(26, 12, 8, 24, '#'); chair.box(0, 34, 34, 2, '#')
sprite(chair.out(), 2, 34)
const cooper = canvasOf(30, 34)
cooper.text(2, 0, '  #####  '); cooper.text(2, 1, ' ####### '); cooper.text(2, 2, ' #.....# '); cooper.text(2, 3, ' #.#.#.# '); cooper.text(2, 4, ' #.....# '); cooper.text(2, 5, '  #...#  '); cooper.text(2, 6, '  ##.##  ')
cooper.box(0, 7, 13, 11, '#'); cooper.text(4, 7, '#..#'); cooper.text(5, 8, '.#.'); cooper.box(10, 14, 12, 3, '#'); cooper.text(22, 15, '..') // shoulders, a forearm resting on the knee, the hand
cooper.box(2, 18, 22, 4, '#'); cooper.box(20, 22, 4, 8, '#'); cooper.box(20, 30, 8, 2, '#') // thigh, shin, shoe
sprite(cooper.out(), 8, 36)
rect(4, 66, 8, 2, 1); rect(7, 62, 2, 4, 1); sprite(['  ###  ', ' #...# ', ' #...# ', '  ###  '], 5, 56) // the little table's lamp
// 8. the Giant, tall and in a dark suit, on the right in front of the lamp
const giant = canvasOf(15, 56)
;['      ###      ', '     #...#     ', '    #.....#    ', '    #.#.#.#    ', '    #.....#    ', '     #...#     ', '      #.#      ', '     ##.##     ', '   ###...###   ', '  ####.#.####  ', ' ####.###.#### '].forEach((r, j) => giant.text(0, j, r))
for (let j = 11; j < 33; j++) giant.text(0, j, j === 32 ? ' #..#######..# ' : ' ##.#######.## ')
for (let j = 33; j < 54; j++) giant.text(0, j, '   #### ####   ')
giant.text(0, 54, '  ##### #####  '); giant.text(0, 55, ' ###### ###### ')
sprite(giant.out(), 98, 30)
const base = grid.map(r => r.slice()) // the room without the Man from Another Place

// 9. the Man from Another Place: seated on the sofa in his red suit (a half tone), hands together... or dancing in the room
const seated = () => sprite(['  #####  ', '  #...#  ', '  #.#.#  ', '  #...#  ', '   #.#   ', ' ####### ', '#+++++++#', '#+++...+#', '#+++++++#', '#+++++++#', ' ######## ', '##########', '#.#....#.#'].map(r => r.padEnd(10, ' ')), 74, 42)
const line = (c, x0, y0, x1, y1, ch) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) c.set(Math.round(x0 + (x1 - x0) * i / (n || 1)), Math.round(y0 + (y1 - y0) * i / (n || 1)), ch) }
// each pose: where the left hand, the right hand, the left foot and the right foot go (the canvas is 15 wide, the shoulders at x 4 and 10)
const POSES = [
  { lh: [1, 12], rh: [13, 12], lf: [4, 19], rf: [10, 19] }, { lh: [0, 8], rh: [13, 0], lf: [3, 19], rf: [11, 16] }, { lh: [0, 6], rh: [14, 6], lf: [2, 19], rf: [12, 19] },
  { lh: [1, 0], rh: [14, 8], lf: [4, 16], rf: [11, 19] }, { lh: [2, 2], rh: [12, 2], lf: [6, 19], rf: [8, 19] }, { lh: [10, 9], rh: [4, 9], lf: [7, 19], rf: [8, 19] },
]
const dancer = (p, flip) => {
  const c = canvasOf(15, 21)
  ;['    ###    ', '   #...#   ', '   #.#.#   ', '   #...#   ', '    #.#    '].forEach((r, j) => c.text(2 + 0, j, r.slice(0, 11).padStart(11, ' ')))
  c.box(4, 5, 7, 1, '#'); for (let j = 6; j < 12; j++) c.text(4, j, '#+++++#'); c.box(4, 12, 7, 1, '#') // shoulders, the suit, the hips
  const m = x => flip ? 14 - x : x
  line(c, m(4), 6, m(p.lh[0]), p.lh[1], '#'); line(c, m(10), 6, m(p.rh[0]), p.rh[1], '#'); c.set(m(p.lh[0]), p.lh[1], '.'); c.set(m(p.rh[0]), p.rh[1], '.') // arms, the hands in paper
  line(c, m(5), 13, m(p.lf[0]), p.lf[1], '#'); line(c, m(9), 13, m(p.rf[0]), p.rf[1], '#'); c.set(m(p.lf[0]) - 1, p.lf[1] + 1, '#'); c.set(m(p.rf[0]) + 1, p.rf[1] + 1, '#') // legs and shoes
  return c.out()
}
window.lodgeFrames = 28 // the dance: he steps off the sofa, shuffles across the floor and swings his arms
const placeAt = i => { const t = i / (window.lodgeFrames - 1); return { x: 60 + Math.round(26 * Math.sin(t * Math.PI * 3)), y: 56 + (i % 2) * 2, pose: POSES[Math.floor(i / 2) % POSES.length], flip: Math.floor(i / 4) % 2 === 1 } }

window.lodgeImage = frame => { // the picture as an image address (a canvas can lose its pixels while the window is hidden, an image can't)
  const canvas = document.createElement('canvas') // paper and ink: one colour on one colour, whatever the theme (it is a picture: black suits stay black)
  const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue('--on-light').trim() || '#000', paper = css.getPropertyValue('--on-color').trim() || '#fff'
  canvas.width = W * SCALE; canvas.height = H * SCALE
  const c = canvas.getContext('2d', { willReadFrequently: true }); c.fillStyle = paper; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = ink
  base.forEach((row, y) => { grid[y] = row.slice() })
  if (frame === undefined) seated(); else { const d = placeAt(frame); sprite(dancer(d.pose, d.flip), d.x, d.y) }
  grid.forEach((row, y) => row.forEach((v, x) => v && c.fillRect(x * SCALE, y * SCALE, SCALE, SCALE)))
  return canvas.toDataURL()
}
