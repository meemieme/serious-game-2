// Scent-Stream Surfing - MakeCode Arcade port
// Paste into MakeCode Arcade (JavaScript view) as main.ts
// Controls: Arrows move/steer, Up hops, hold A = sniff (ride scent streams),
//           B while sniffing = Scent-Snap, B alone = Bark Echo-Ping

// default Arcade palette: 4 orange (fur), 13 tan (chest), 14 brown (ears/shadow)
const CREAM = 13, GOLD = 4, DGOLD = 14
const SC = 6 // world units per screen pixel
scene.setBackgroundColor(9)

function clamp(v: number, a: number, b: number) { return v < a ? a : (v > b ? b : v) }
function rnd(i: number) { let v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }

// ---------------- Nose facts ----------------
const FT = ["Sniffing is active", "A very different nose", "Following a gradient", "Casting", "Telling odors apart", "Warm air carries scent up", "Wind shapes scent plumes", "Trails have a direction", "Strong odors can overwhelm", "Weather changes scent", "Hearing is another sense"]
const FS = [
    "Dogs sniff in quick bursts, several times a second. Part of the air goes to a smell-only path, and exhaled air leaves through side slits, so fresh odor keeps arriving.",
    "A dog has roughly 100-300 million scent receptors (it varies by breed) versus about 6 million in a person, and far more brain area for smell.",
    "Odor is usually stronger nearer its source or trail. Dogs compare what each nostril samples to judge which way is stronger.",
    "When a dog loses a trail it sweeps side to side until the scent gets stronger, then follows the gradient back onto the trail.",
    "Places smell like blends of many odors. Trained detection dogs can pick one target odor out of a mix.",
    "Warm air rises and takes odor with it, so smells from a bakery vent or a fire drift upward and spread.",
    "Wind carries odor downwind as a widening, patchy plume. Gusts shift where the scent is strongest.",
    "Animals leave scent behind as they move. Studies suggest dogs can tell which way a trail leads after a few footsteps, likely from how the scent ages.",
    "Very strong smells such as bleach, citrus oils or skunk spray can mask other odors, and many dogs avoid them.",
    "Moisture can help ground odors linger, while heavy rain, wind or heat can wash away or scatter them. The research is mixed.",
    "Dogs hear higher-pitched sounds than people do: up to roughly 45 kHz or more versus about 20 kHz for humans."]
const FG = [
    "Holding A lights up the scent ribbons. Real odor is invisible - the ribbons are a visual metaphor.",
    "You can now sense a world that humans cannot.",
    "Riding the dense golden core is fastest: thrust grows with concentration.",
    "Drifting to the faded edge breaks your lock. Steer back toward the core.",
    "Scent-Snap is a simplification. Real dogs do not teleport!",
    "The lift here is far stronger than real air. Exaggerated for play.",
    "Gusts bend the ribbons, so keep steering to stay in the core.",
    "Real birds in flight leave no followable trail (ground animals do). This wake is a game invention.",
    "Repulsors push you away. Real dogs just get distracted or avoid them.",
    "Rain widens ground trails and shrinks airborne ones. A simplification.",
    "The echo-ping that shows scent through walls is invented."]
let got: boolean[] = []
for (let i = 0; i < 11; i++) got.push(false)
let gotCount = 0
let queue: number[] = []
let showing = false
let paused = false
let won = false

function unlock(i: number) {
    if (i < 0 || got[i]) return
    got[i] = true
    gotCount++
    queue.push(i)
    say("New nose fact " + gotCount + "/11")
}

// ---------------- World ----------------
interface Plat { x: number; y: number; w: number; roof: boolean; col: number }
let plats: Plat[] = []
function addPlat(x: number, y: number, w: number, roof: boolean, col: number) {
    plats.push({ x: x, y: y, w: w, roof: roof, col: col })
}
addPlat(-400, 620, 1900, false, 0)
addPlat(2300, 620, 1000, false, 0)
addPlat(5700, 620, 2400, false, 0)
addPlat(2950, 300, 1000, true, 3)
addPlat(4900, 340, 800, true, 6)

const CPX = [150, 2350, 3000, 3850, 4950, 5800]
const CPY = [598, 598, 278, 278, 318, 598]
let cpIndex = 0
const TX = [100, 1250, 2650, 3700, 5750, 7000]
const TM = ["Hold A: sniff scent", "Hold A, tap B: snap", "Ride the thermal up", "Catch the bird wake", "Follow the last trail", "Arthur is at the station"]
let TD: boolean[] = [false, false, false, false, false, false]
let toast = ""
let toastT = 0

const GOALX = 7450
const REPX = 4420, REPY = 335, REPR = 70

// ---------------- Streams ----------------
// kind: 0 ground, 1 draft, 2 thermal, 3 wake
interface Stream {
    kind: number; ax: number[]; ay: number[]; ox: number[]; oy: number[]
    w: number; wm: number; air: boolean; ok: boolean
    xs: number[]; ys: number[]; cum: number[]; len: number; am: number; cross: number
}
interface Near { d: number; x: number; y: number; tx: number; ty: number; s: number }
const KC = [10, 6, 4, 10] // ribbon colors
let streams: Stream[] = []
function mk(kind: number, pts: number[], w: number, cross: number): Stream {
    let s: Stream = { kind: kind, ax: [], ay: [], ox: [], oy: [], w: w, wm: w, air: kind != 0, ok: true, xs: [], ys: [], cum: [], len: 0, am: 1, cross: cross }
    for (let i = 0; i < pts.length; i += 2) { s.ax.push(pts[i]); s.ay.push(pts[i + 1]); s.ox.push(0); s.oy.push(0) }
    streams.push(s)
    return s
}
mk(0, [220, 596, 480, 586, 740, 598, 1000, 588, 1250, 596, 1480, 590], 68, 0)
mk(1, [1420, 560, 1600, 440, 1850, 370, 2100, 420, 2400, 545], 64, 380)
mk(2, [2870, 610, 2920, 520, 2840, 430, 2920, 340, 2890, 260], 70, 0)
let wake = mk(3, [0, 0, 0, 0], 60, 0)
wake.ok = false
mk(0, [5780, 596, 6100, 588, 6400, 598, 6700, 588, 7000, 596, 7300, 590], 68, 0)

let bx = 3300, by = 250, blast = 3300
let bhx: number[] = []
let bhy: number[] = []
let windV = 0

function cr(a: number, b: number, c: number, d: number, t: number) {
    let t2 = t * t, t3 = t2 * t
    return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
}
function sample(s: Stream) {
    let n = s.ax.length
    s.xs = []; s.ys = []; s.cum = [0]
    for (let i = 0; i < n - 1; i++) {
        let i0 = Math.max(i - 1, 0), i3 = Math.min(i + 2, n - 1)
        for (let j = 0; j < 10; j++) {
            let t = j / 10
            s.xs.push(cr(s.ax[i0] + s.ox[i0], s.ax[i] + s.ox[i], s.ax[i + 1] + s.ox[i + 1], s.ax[i3] + s.ox[i3], t))
            s.ys.push(cr(s.ay[i0] + s.oy[i0], s.ay[i] + s.oy[i], s.ay[i + 1] + s.oy[i + 1], s.ay[i3] + s.oy[i3], t))
        }
    }
    s.xs.push(s.ax[n - 1] + s.ox[n - 1])
    s.ys.push(s.ay[n - 1] + s.oy[n - 1])
    for (let i = 1; i < s.xs.length; i++) {
        let ddx = s.xs[i] - s.xs[i - 1], ddy = s.ys[i] - s.ys[i - 1]
        s.cum.push(s.cum[i - 1] + Math.sqrt(ddx * ddx + ddy * ddy))
    }
    s.len = s.cum[s.cum.length - 1]
}
function nearest(s: Stream, px: number, py: number): Near {
    let best = 1e12, bi = 0, bt = 0, rx = 0, ry = 0, tx = 1, ty = 0
    for (let i = 0; i < s.xs.length - 1; i++) {
        let dx = s.xs[i + 1] - s.xs[i], dy = s.ys[i + 1] - s.ys[i]
        let l2 = dx * dx + dy * dy
        if (l2 < 0.0001) l2 = 0.0001
        let t = clamp(((px - s.xs[i]) * dx + (py - s.ys[i]) * dy) / l2, 0, 1)
        let cx = s.xs[i] + dx * t, cy = s.ys[i] + dy * t
        let d = (px - cx) * (px - cx) + (py - cy) * (py - cy)
        if (d < best) {
            best = d; bi = i; bt = t; rx = cx; ry = cy
            let l = Math.sqrt(l2); tx = dx / l; ty = dy / l
        }
    }
    return { d: Math.sqrt(best), x: rx, y: ry, tx: tx, ty: ty, s: s.cum[bi] + bt * (s.cum[bi + 1] - s.cum[bi]) }
}

let rainOn = false
let rainT = 25
let T = 0
function updateStreams(dt: number) {
    bx += 450 * dt
    by = 250 + Math.sin(T * 1.7) * 18
    if (bx - blast > 64) {
        bhx.push(bx); bhy.push(by); blast = bx
        if (bhx.length > 26) { bhx.removeAt(0); bhy.removeAt(0) }
    }
    if (bx > 5800) { bx = 3300; bhx = []; bhy = []; blast = 3300 }
    let wx = Math.sin(T * 0.7) * 45 + Math.sin(T * 0.23) * 30
    let wy = Math.cos(T * 0.9) * 28
    windV = wx
    for (let q = 0; q < streams.length; q++) {
        let s = streams[q]
        if (s.kind == 3) {
            s.ax = []; s.ay = []; s.ox = []; s.oy = []
            for (let i = 0; i < bhx.length; i++) {
                if (bhx[i] < bx - 70) { s.ax.push(bhx[i]); s.ay.push(bhy[i]); s.ox.push(0); s.oy.push(0) }
            }
            s.ax.push(bx - 34); s.ay.push(by + 2); s.ox.push(0); s.oy.push(0)
            s.ok = s.ax.length >= 4
        } else {
            let amp = s.kind == 1 ? 1.6 : (s.kind == 2 ? 1.1 : 0)
            let n = s.ax.length
            let k = Math.min(1, dt * 3)
            for (let i = 0; i < n; i++) {
                let f = i / (n - 1) * (0.7 + 0.3 * Math.sin(i * 1.7 + T))
                s.ox[i] += (wx * amp * f - s.ox[i]) * k
                s.oy[i] += (wy * amp * f - s.oy[i]) * k
            }
        }
        s.wm = s.w * (rainOn ? (s.air ? 0.7 : 1.25) : 1)
        s.am = (rainOn && !s.air) ? 1.25 : 1
        if (s.ok) sample(s)
    }
}

// ---------------- Dog ----------------
let dX = 150, dY = 598, dVX = 0, dVY = 0, face = 1
let onGround = false
let surfing = false
let cur: Stream = null
let sp = 0, vl = 0, core = 0, lockT = 0, buf = 0, rho = 0, dist = 0
let sniff = false
let ping = 0, pingCd = 0, snapFlash = 0
let coreT = 0, surfT = 0
let camX = 0, camY = 0
let tStart = game.runtime()

function say(m: string) { toast = m; toastT = 4 }
function respawn() {
    dX = CPX[cpIndex]; dY = CPY[cpIndex]; dVX = 0; dVY = 0
    surfing = false; cur = null; lockT = 0.3; buf = 0
    say("Lost the scent!")
}
function onSurf(s: Stream) {
    unlock(1)
    if (s.kind == 1) unlock(6)
    if (s.kind == 2) unlock(5)
    if (s.kind == 3) unlock(7)
}
function launch(kind: number) { // 0 manual, 1 edge, 2 crest
    if (kind == 1) unlock(3)
    if (kind == 0 && dVY < -120) { dVX *= 1.08; dVY *= 1.08 }
    surfing = false; cur = null; onGround = false; buf = 0.45
    lockT = kind == 2 ? 0.12 : (kind == 1 ? 0.35 : 0.2)
}
function findSnapStream(): Stream {
    let speed = Math.sqrt(dVX * dVX + dVY * dVY)
    let ddx = face, ddy = 0
    if (speed > 60) { ddx = dVX / speed; ddy = dVY / speed }
    let best: Stream = null, bestD = 1e9, bn: Near = null
    for (let q = 0; q < streams.length; q++) {
        let s = streams[q]
        if (!s.ok || s == cur) continue
        let n = nearest(s, dX, dY)
        if (n.d > 240) continue
        if (n.d > 25) {
            let c = ((n.x - dX) * ddx + (n.y - dY) * ddy) / n.d
            if (c < 0.7071) continue
        }
        if (n.d < bestD) { bestD = n.d; best = s; bn = n }
    }
    snapN = bn
    return best
}
let snapN: Near = null
function doSnap() {
    let s = findSnapStream()
    if (!s) return
    let speed = Math.sqrt(dVX * dVX + dVY * dVY)
    cur = s; surfing = true
    dX = snapN.x; dY = snapN.y
    sp = Math.max(speed * 0.95, 260); vl = 0; snapFlash = 0.35
    onSurf(s); unlock(4)
}

function surfStep(dt: number) {
    let s = cur
    if (!s.ok || !sniff) { launch(sniff ? 1 : 0); return }
    let n = nearest(s, dX, dY)
    let tx = n.tx, ty = n.ty, nx = ty, ny = -tx
    let rn = (dX - n.x) * nx + (dY - n.y) * ny
    let wd = s.wm
    rho = clamp(1 - (n.d / wd) * (n.d / wd), 0, 1)
    if (n.s > s.len - 8) { launch(2); return }
    if (n.d >= wd) { launch(1); return }
    let rdx = dX - REPX, rdy = dY - REPY
    let rd = Math.sqrt(rdx * rdx + rdy * rdy)
    if (rd < 1) rd = 1
    if (rd < REPR) {
        dVX = rdx / rd * 650 + dVX * 0.3
        dVY = rdy / rd * 650 - 150 + dVY * 0.3
        surfing = false; cur = null; lockT = 0.7; buf = 0.2
        unlock(8); say("Repulsor!")
        return
    }
    surfT += dt
    if (rho > 0.85) coreT += dt
    if (rho < 0.25) unlock(3)
    core = rho > 0.85 ? core + dt : Math.max(0, core - 2 * dt)
    if (core >= 1.2) unlock(2)
    let vm = s.kind == 2 ? 700 : 1280
    let cap = 380 + (vm - 380) * Math.min(1, core / 1.2)
    sp += (420 + 1500 * Math.pow(rho, 1.5) * s.am) * dt
    if (sp > cap) sp -= (sp - cap) * Math.min(1, 5 * dt)
    if (rho < 0.25) sp *= (1 - (0.25 - rho) * 8 * dt)
    sp = Math.max(sp, 100)
    let ux = (controller.right.isPressed() ? 1 : 0) - (controller.left.isPressed() ? 1 : 0)
    let uy = (controller.down.isPressed() ? 1 : 0) - (controller.up.isPressed() ? 1 : 0)
    let ul = Math.max(1, Math.sqrt(ux * ux + uy * uy))
    let st = clamp((ux * nx + uy * ny) / ul, -1, 1)
    vl += (st * 1100 - 7 * rn - 5 * vl + s.cross * Math.sin(T * 1.3)) * dt
    if (rho < 0.2) vl += Math.sin(T * 35) * 140 * 6 * dt
    dVX = tx * sp + nx * vl
    dVY = ty * sp + ny * vl
    dX += dVX * dt; dY += dVY * dt
    if (Math.abs(dVX) > 20) face = dVX > 0 ? 1 : -1
}
function freeStep(dt: number) {
    let a = (controller.right.isPressed() ? 1 : 0) - (controller.left.isPressed() ? 1 : 0)
    let spd = sniff ? 150 : 250
    if (onGround) {
        if (Math.abs(dVX) > spd + 10) dVX *= (1 - 2.5 * dt)
        else dVX += (a * spd - dVX) * Math.min(1, 12 * dt)
        if (controller.up.isPressed() && !sniff) { dVY = -560; onGround = false }
    } else {
        if (Math.abs(dVX) < 330 || a * dVX <= 0) dVX += a * 900 * dt
        if (Math.abs(dVX) > 330) dVX *= (1 - (buf > 0 ? 0.1 : 0.6) * dt)
    }
    dVY = Math.min(dVY + 1800 * dt, 1500)
    let pf = dY + 22
    dX += dVX * dt; dY += dVY * dt
    onGround = false
    for (let i = 0; i < plats.length; i++) {
        let p = plats[i]
        if (dVY >= 0 && dX > p.x - 8 && dX < p.x + p.w + 8 && pf <= p.y + 16 && dY + 22 >= p.y) {
            dY = p.y - 22; dVY = 0; onGround = true
        }
    }
    if (Math.abs(dVX) > 20) face = dVX > 0 ? 1 : -1
    if (onGround) dist += Math.abs(dVX) * dt
    if (sniff && lockT <= 0) {
        let bs: Stream = null, bd = 1e9, bn: Near = null
        for (let q = 0; q < streams.length; q++) {
            let s = streams[q]
            if (!s.ok) continue
            let n = nearest(s, dX, dY)
            if (n.d < s.wm && n.d < bd) { bd = n.d; bs = s; bn = n }
        }
        if (bs) {
            cur = bs; surfing = true
            sp = Math.max(dVX * bn.tx + dVY * bn.ty, 180); vl = 0; core = 0
            onSurf(bs)
        }
    }
    if (dY > 900) respawn()
}
function step(dt: number) {
    lockT -= dt; buf -= dt
    let px = dX
    if (surfing) surfStep(dt)
    else freeStep(dt)
    // buildings are solid from the side
    for (let i = 0; i < plats.length; i++) {
        let p = plats[i]
        if (p.roof && dY + 20 > p.y + 6 && dX > p.x - 30 && dX < p.x + p.w + 30) {
            dX = px < p.x + p.w / 2 ? p.x - 30 : p.x + p.w + 30
            if (!surfing) dVX = 0
        }
    }
}

// ---------------- Rendering ----------------
function sxp(wx: number) { return Math.floor((wx - camX) / SC) }
function syp(wy: number) { return Math.floor((wy - camY) / SC) }

function drawScene(t: Image) {
    // sky glow, sun, clouds
    t.fill(9)
    t.fillCircle(130, 16, 11, 5)
    t.fillCircle(130, 16, 8, 1)
    for (let i = 0; i < 6; i++) {
        let cx = ((i * 60 - camX * 0.01 + T * 1.2 * (1 + (i % 3) * 0.3)) % 260 + 260) % 260 - 50
        let cy = 8 + (i * 9) % 34
        t.fillCircle(cx, cy, 5, 1); t.fillCircle(cx + 7, cy - 2, 6, 1); t.fillCircle(cx + 14, cy, 5, 1)
    }
    // hills
    for (let layer = 0; layer < 2; layer++) {
        let f = layer == 0 ? 0.45 : 0.6
        let a = layer == 0 ? 60 : 40
        let b = layer == 0 ? 0.004 : 0.006
        let y0 = layer == 0 ? 520 : 565
        for (let x = 0; x < 160; x++) {
            let wx = x * SC + camX * f
            let h = Math.floor((y0 - camY * f * 0.5 + Math.sin(wx * b) * a + Math.sin(wx * b * 2.3) * a * 0.4) / SC)
            t.fillRect(x, h, 1, 120 - h, layer == 0 ? 7 : 7)
            if (layer == 1) t.setPixel(x, h, 6)
        }
    }
    // platforms
    for (let i = 0; i < plats.length; i++) {
        let p = plats[i]
        let x0 = sxp(p.x), x1 = sxp(p.x + p.w), y0 = syp(p.y)
        if (x1 < 0 || x0 > 160) continue
        if (p.roof) {
            t.fillRect(x0, y0, x1 - x0, 130, p.col)
            t.fillRect(x0, y0, x1 - x0, 2, 2)
            for (let wx = p.x + 24; wx < p.x + p.w - 20; wx += 44) {
                let sx = sxp(wx)
                if (sx < -4 || sx > 160) continue
                for (let wy = p.y + 40; wy < p.y + 520; wy += 60) {
                    if (rnd(wx * 0.37 + wy) > 0.45) t.fillRect(sx, syp(wy), 3, 4, 9)
                }
            }
        } else {
            t.fillRect(x0, y0, x1 - x0, 130, 14)
            t.fillRect(x0, y0, x1 - x0, 2, 13)
            t.fillRect(x0, y0 - 2, x1 - x0, 2, 7)
        }
    }
    // trees and flowers
    let k = 0
    for (let g = 0; g < 3; g++) {
        let a = g == 0 ? -400 : (g == 1 ? 2300 : 5700)
        let b = g == 0 ? 1500 : (g == 1 ? 3300 : 8000)
        for (let wx = a + 60; wx < b - 40; wx += 70) {
            k++
            if (wx < camX - 90 || wx > camX + 960 + 90) continue
            let r = rnd(wx * 0.13)
            let gx = sxp(wx), gy = syp(620)
            if (k % 5 == 0 && !(wx > -20 && wx < 170) && !(wx > 7250 && wx < 7700)) {
                t.fillRect(gx, gy - 14, 2, 14, 14)
                t.fillCircle(gx + 1, gy - 18, 8, r > 0.5 ? 7 : 6)
                t.fillCircle(gx - 4, gy - 15, 5, 7); t.fillCircle(gx + 6, gy - 15, 5, 7)
            } else {
                let fx = sxp(wx + r * 40)
                t.setPixel(fx, gy - 3, r > 0.5 ? 3 : 5)
                t.setPixel(fx, gy - 4, 5)
            }
        }
    }
    // home and station
    t.fillRect(sxp(30), syp(500), 18, 20, 5)
    t.fillRect(sxp(24), syp(488), 20, 3, 2)
    t.fillRect(sxp(56), syp(530), 10, 15, 14)
    t.fillRect(sxp(7300), syp(430), 60, 32, 5)
    t.print("STATION", sxp(7310), syp(440), 2)
    t.fillRect(sxp(7500), syp(500), 8, 20, 8)
}

function drawRibbons(t: Image) {
    let showAll = sniff || ping > 0
    for (let q = 0; q < streams.length; q++) {
        let s = streams[q]
        if (!s.ok) continue
        if (!showAll) {
            let n = nearest(s, dX, dY)
            if (n.d < 650) {
                for (let j = 0; j < 3; j++) {
                    let f = (T * 0.5 + j / 3) % 1
                    t.setPixel(sxp(n.x + (dX - n.x) * f), syp(n.y + (dY - n.y) * f), KC[s.kind])
                }
            }
            continue
        }
        let vis = ping > 0
        if (!vis) {
            for (let i = 0; i < s.xs.length; i += 6) {
                let ddx = s.xs[i] - dX, ddy = s.ys[i] - dY
                if (ddx * ddx + ddy * ddy < 1400 * 1400) { vis = true; break }
            }
        }
        if (!vis) continue
        let col = KC[s.kind]
        let rr = s.wm * 0.85
        let riding = surfing && cur == s && rho >= 0.8
        for (let i = 0; i < s.xs.length - 1; i++) {
            let ddx = s.xs[i + 1] - s.xs[i], ddy = s.ys[i + 1] - s.ys[i]
            let l = Math.sqrt(ddx * ddx + ddy * ddy)
            if (l < 0.01) continue
            let nx = ddy / l, ny = -ddx / l
            let x0 = sxp(s.xs[i]), y0 = syp(s.ys[i]), x1 = sxp(s.xs[i + 1]), y1 = syp(s.ys[i + 1])
            if ((x0 < -20 && x1 < -20) || (x0 > 180 && x1 > 180)) continue
            t.drawLine(x0, y0, x1, y1, riding ? 5 : col)
            if (riding) t.drawLine(x0, y0 + 1, x1, y1 + 1, 5)
            if (i % 2 == 0) {
                t.setPixel(sxp(s.xs[i] + nx * rr), syp(s.ys[i] + ny * rr), col)
                t.setPixel(sxp(s.xs[i] - nx * rr), syp(s.ys[i] - ny * rr), col)
            }
        }
        let ph = Math.floor(T * 40)
        for (let i = ph % 14; i < s.xs.length; i += 14) {
            let sx = sxp(s.xs[i]), sy = syp(s.ys[i])
            t.fillRect(sx - 1, sy - 1, 2, 2, 1)
        }
    }
    if (sniff) {
        let sn = findSnapStream()
        if (sn) t.drawCircle(sxp(snapN.x), syp(snapN.y), 3 + Math.floor((T * 8) % 2), 5)
    }
    if (ping > 0) t.drawCircle(sxp(dX), syp(dY), Math.floor((2.5 - ping) * 1100 / SC), 4)
}

function drawBird(t: Image) {
    let x = sxp(bx), y = syp(by)
    let f = Math.floor(Math.sin(T * 16) * 2)
    t.fillRect(x - 2, y - 1, 5, 2, 8)
    t.fillRect(x - 3, y - 3 - f, 2, 2, 8)
    t.fillRect(x + 2, y, 2, 1, 5)
}

function drawDog(t: Image) {
    let x = sxp(dX), y = syp(dY)
    let f = face
    let nose = sniff || surfing
    let ph = dist * 0.05
    function px(rx: number, ry: number, w: number, h: number, c: number) {
        t.fillRect(f > 0 ? x + rx : x - rx - w, y + ry, w, h, c)
    }
    if (surfing && rho >= 0.8) {
        for (let i = 0; i < 3; i++) px(-9 - randint(0, 4), -2 + i * 2, 4, 1, 5)
    }
    let sw1 = surfing ? -2 : (onGround ? Math.floor(Math.sin(ph) * 2) : 0)
    let sw2 = surfing ? 2 : (onGround ? Math.floor(Math.sin(ph + 3.14) * 2) : 0)
    // tail
    let wag = Math.floor(Math.sin(T * 12) * 1.5)
    px(-8, -3 + wag, 3, 2, GOLD); px(-9, -5 + wag, 2, 2, CREAM)
    // far legs
    px(-4 + sw2, 1, 2, 3, DGOLD); px(3 + sw1, 1, 2, 3, DGOLD)
    // body
    px(-5, -2, 10, 5, GOLD)
    px(-4, 3, 7, 1, CREAM)
    // near legs
    px(-5 + sw1, 1, 2, 3, GOLD); px(4 + sw2, 1, 2, 3, GOLD)
    px(3, -1, 3, 4, CREAM) // chest
    // head
    let hy = nose ? 0 : -3
    px(4, hy - 3, 5, 5, GOLD)
    px(8, hy - 1, 3, 3, CREAM)
    px(10, hy - 1, 1, 1, 15)
    px(7, hy - 3, 1, 1, 15)
    px(5, hy - 2, 2, 4, surfing ? DGOLD : DGOLD)
    px(9, hy + 2, 1, 1 + (Math.floor(T * 10) % 2), 3)
    px(4, hy + 2, 2, 1, 2) // collar
}

function drawHud(t: Image) {
    // top banner notification
    if (toastT > 0 && !paused) {
        t.fillRect(0, 0, 160, 10, 8)
        t.print(toast, Math.max(1, Math.floor((160 - toast.length * 6) / 2)), 1, 1)
    }
    // progress bar
    let pr = clamp((dX - 150) / (GOALX - 150), 0, 1)
    t.fillRect(8, 112, 90, 4, 8)
    t.fillRect(8, 112, Math.floor(90 * pr), 4, 5)
    t.fillRect(8 + Math.floor(90 * pr) - 1, 110, 3, 8, 4)
    // scent lock
    t.fillRect(106, 112, 46, 4, 8)
    let lk = surfing ? rho : 0
    t.fillRect(106, 112, Math.floor(46 * lk), 4, 5)
    t.print("LOCK", 106, 104, 15)
    t.print("TRAIL", 8, 104, 15)
    t.print("" + gotCount + "/11", 134, 2, toastT > 0 ? 8 : 15)
    if (rainOn) t.print("RAIN", 4, 12, 15)
}

scene.createRenderable(0, function (t: Image, cam: scene.Camera) {
    drawScene(t)
    drawRibbons(t)
    drawBird(t)
    drawDog(t)
    if (rainOn) {
        for (let i = 0; i < 40; i++) {
            let rx = (i * 37 + Math.floor(T * 60) * 3) % 160
            let ry = (i * 53 + Math.floor(T * 120)) % 120
            t.drawLine(rx, ry, rx - 1, ry + 3, 9)
        }
    }
    drawHud(t)
})

// ---------------- Input & loop ----------------
controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    if (paused || won) return
    if (controller.A.isPressed()) doSnap()
    else if (pingCd <= 0) { ping = 2.5; pingCd = 4; unlock(10) }
})

let acc = 0
game.onUpdate(function () {
    if (paused || won) return
    let dt = Math.min(0.05, control.eventContext().deltaTime)
    T += dt
    sniff = controller.A.isPressed()
    if (sniff) unlock(0)
    ping = Math.max(0, ping - dt); pingCd = Math.max(0, pingCd - dt)
    snapFlash = Math.max(0, snapFlash - dt); toastT = Math.max(0, toastT - dt)
    // weather cycle: rain every ~45 s for ~18 s
    rainT -= dt
    if (rainT <= 0) {
        rainOn = !rainOn
        rainT = rainOn ? 18 : 45
        if (rainOn) { unlock(9); say("It's raining!") }
    }
    updateStreams(dt)
    acc += dt
    while (acc >= 1 / 120) { step(1 / 120); acc -= 1 / 120 }
    for (let i = 0; i < CPX.length; i++) {
        if (onGround && dX >= CPX[i] && i > cpIndex && Math.abs(dY - CPY[i]) < 8) cpIndex = i
    }
    for (let i = 0; i < TX.length; i++) {
        if (!TD[i] && dX > TX[i]) { TD[i] = true; say(TM[i]) }
    }
    camX += (dX - 320 + clamp(dVX * 0.25, -200, 300) - camX) * Math.min(1, dt * 4)
    camY += (clamp(dY - 440, -150, 0) - camY) * Math.min(1, dt * 3)
    if (dX > 7400) {
        won = true
        let secs = Math.round((game.runtime() - tStart) / 1000)
        let pct = surfT > 0 ? Math.round(coreT / surfT * 100) : 0
        game.splash("You found Arthur!", "Time " + secs + "s  Core " + pct + "%")
        game.splash("Nose journal", "Read what you found")
        for (let k = 0; k < queue.length; k++) {
            let f = queue[k]
            game.showLongText(FT[f] + ": " + FS[f], DialogLayout.Top)
            game.showLongText("In the game: " + FG[f], DialogLayout.Top)
        }
        game.splash("Nose facts found", "" + gotCount + " of 11")
        game.over(true)
    }
})

paused = true
game.splash("Scent-Stream Surfing", "Follow the trail to Arthur")
game.showLongText("Arrows: move and steer. Up: hop. Hold A: sniff and ride scent ribbons. B while sniffing: Scent-Snap. B alone: bark echo-ping.", DialogLayout.Center)
paused = false