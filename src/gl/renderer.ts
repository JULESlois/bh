import { VERT, SCENE_FRAG, BRIGHT_FRAG, BLUR_FRAG, COMPOSITE_FRAG } from './shaders'

export interface RenderParams {
  camPos: [number, number, number]
  right: [number, number, number]
  up: [number, number, number]
  fwd: [number, number, number]
  tanHalfFov: number
  time: number
  diskGain: number
  starGain: number
  falseColor: number
  exposure: number
  markPhoton: number
  markIsco: number
  companionDir: [number, number, number]
  /** disk palette: Planck temperature scale, 1 = default ember */
  tempScale: number
}

interface Target {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
  w: number
  h: number
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    throw new Error(`shader compile failed:\n${log}`)
  }
  return sh
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(p)}`)
  }
  return p
}

export class Renderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private progScene: WebGLProgram
  private progBright: WebGLProgram
  private progBlur: WebGLProgram
  private progComp: WebGLProgram
  private uni = new Map<string, WebGLUniformLocation | null>()
  private scene: Target | null = null
  private bloomA: Target | null = null
  private bloomB: Target | null = null
  private halfFloat: boolean
  private cssW = 0
  private cssH = 0
  /** internal resolution scale, adapted to frame time */
  scale = 1.0
  private dtEma = 16
  /** quality tier: 0 low, 1 medium, 2 high */
  tier = 2
  private frames = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      depth: false,
      stencil: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
    if (!gl) throw new Error('WebGL2 unavailable')
    this.gl = gl
    this.halfFloat = !!gl.getExtension('EXT_color_buffer_float')
    this.progScene = link(gl, VERT, SCENE_FRAG)
    this.progBright = link(gl, VERT, BRIGHT_FRAG)
    this.progBlur = link(gl, VERT, BLUR_FRAG)
    this.progComp = link(gl, VERT, COMPOSITE_FRAG)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
  }

  private loc(prog: WebGLProgram, name: string): WebGLUniformLocation | null {
    const key = `${name}@${(prog as unknown as { __id?: number }).__id ?? this.progId(prog)}`
    if (!this.uni.has(key)) this.uni.set(key, this.gl.getUniformLocation(prog, name))
    return this.uni.get(key)!
  }
  private ids = new Map<WebGLProgram, number>()
  private progId(p: WebGLProgram): number {
    if (!this.ids.has(p)) this.ids.set(p, this.ids.size)
    return this.ids.get(p)!
  }

  private makeTarget(w: number, h: number): Target {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (this.halfFloat) {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h)
    } else {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { fbo, tex, w, h }
  }

  private dropTarget(t: Target | null) {
    if (!t) return
    this.gl.deleteFramebuffer(t.fbo)
    this.gl.deleteTexture(t.tex)
  }

  setSize(cssW: number, cssH: number) {
    this.cssW = cssW
    this.cssH = cssH
    this.rebuild()
  }

  private rebuild() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    const w = Math.max(64, Math.round(this.cssW * dpr * this.scale))
    const h = Math.max(64, Math.round(this.cssH * dpr * this.scale))
    if (this.scene && this.scene.w === w && this.scene.h === h) return
    this.canvas.width = w
    this.canvas.height = h
    this.dropTarget(this.scene)
    this.dropTarget(this.bloomA)
    this.dropTarget(this.bloomB)
    this.scene = this.makeTarget(w, h)
    const bw = Math.max(32, w >> 2)
    const bh = Math.max(32, h >> 2)
    this.bloomA = this.makeTarget(bw, bh)
    this.bloomB = this.makeTarget(bw, bh)
  }

  /** call once per frame with the last frame's duration to adapt quality */
  adapt(dt: number) {
    this.dtEma = this.dtEma * 0.92 + dt * 0.08
    this.frames++
    if (this.frames % 45 !== 0) return
    if (this.dtEma > 30 && (this.scale > 0.45 || this.tier > 0)) {
      if (this.scale > 0.55) this.scale = Math.max(0.42, this.scale * 0.82)
      else this.tier = Math.max(0, this.tier - 1)
      this.rebuild()
    } else if (this.dtEma < 14 && (this.scale < 1.0 || this.tier < 2)) {
      if (this.tier < 2) this.tier++
      else this.scale = Math.min(1.0, this.scale * 1.12)
      this.rebuild()
    }
  }

  render(p: RenderParams) {
    const gl = this.gl
    if (!this.scene || !this.bloomA || !this.bloomB) return
    const steps = this.tier === 2 ? 620 : this.tier === 1 ? 400 : 240
    const stepScale = this.tier === 2 ? 1.0 : this.tier === 1 ? 1.2 : 1.55

    // ---- scene: general-relativistic ray trace into HDR target
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo)
    gl.viewport(0, 0, this.scene.w, this.scene.h)
    gl.useProgram(this.progScene)
    const s = this.progScene
    gl.uniform2f(this.loc(s, 'uRes'), this.scene.w, this.scene.h)
    gl.uniform1f(this.loc(s, 'uTime'), p.time)
    gl.uniform3fv(this.loc(s, 'uCamPos'), p.camPos)
    gl.uniform3fv(this.loc(s, 'uCamRight'), p.right)
    gl.uniform3fv(this.loc(s, 'uCamUp'), p.up)
    gl.uniform3fv(this.loc(s, 'uCamFwd'), p.fwd)
    gl.uniform1f(this.loc(s, 'uTanHalfFov'), p.tanHalfFov)
    gl.uniform1f(this.loc(s, 'uDiskGain'), p.diskGain)
    gl.uniform1f(this.loc(s, 'uStarGain'), p.starGain)
    gl.uniform1f(this.loc(s, 'uFalseColor'), p.falseColor)
    gl.uniform1f(this.loc(s, 'uMarkPhoton'), p.markPhoton)
    gl.uniform1f(this.loc(s, 'uMarkIsco'), p.markIsco)
    gl.uniform3fv(this.loc(s, 'uCompanionDir'), p.companionDir)
    gl.uniform1i(this.loc(s, 'uSteps'), steps)
    gl.uniform1f(this.loc(s, 'uStepScale'), stepScale)
    // angular size of one internal pixel — keeps star PSFs pixel-locked
    gl.uniform1f(this.loc(s, 'uPixAng'), (2 * p.tanHalfFov) / this.scene.h)
    gl.uniform1f(this.loc(s, 'uTempScale'), p.tempScale)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // ---- bright pass into quarter-res bloomA
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomA.fbo)
    gl.viewport(0, 0, this.bloomA.w, this.bloomA.h)
    gl.useProgram(this.progBright)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex)
    gl.uniform1i(this.loc(this.progBright, 'uTex'), 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // ---- two gaussian rounds, widening
    const blur = (src: Target, dst: Target, dx: number, dy: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
      gl.viewport(0, 0, dst.w, dst.h)
      gl.useProgram(this.progBlur)
      gl.bindTexture(gl.TEXTURE_2D, src.tex)
      gl.uniform1i(this.loc(this.progBlur, 'uTex'), 0)
      gl.uniform2f(this.loc(this.progBlur, 'uDir'), dx / src.w, dy / src.h)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    blur(this.bloomA, this.bloomB, 1.2, 0)
    blur(this.bloomB, this.bloomA, 0, 1.2)
    blur(this.bloomA, this.bloomB, 2.6, 0)
    blur(this.bloomB, this.bloomA, 0, 2.6)

    // ---- composite to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(this.progComp)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex)
    gl.uniform1i(this.loc(this.progComp, 'uScene'), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.bloomA.tex)
    gl.uniform1i(this.loc(this.progComp, 'uBloom'), 1)
    gl.uniform2f(this.loc(this.progComp, 'uRes'), this.canvas.width, this.canvas.height)
    gl.uniform1f(this.loc(this.progComp, 'uTime'), p.time)
    gl.uniform1f(this.loc(this.progComp, 'uExposure'), p.exposure)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.activeTexture(gl.TEXTURE0)
  }
}
