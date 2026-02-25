import * as THREE from 'three'
import gradientUrl from '../assets/gradient.jpg'
import noiseUrl from '../assets/noise.png'

// ─── Canvas Mouse Trail Texture ───────────────────────────────────────────────

class CanvasTrail {
  constructor(el) {
    this.$el = el
    this.size = 60
    this.maxAge = 50
    this.radius = 0.08 * this.size
    this.points = []
    this.needUpdate = false
    this.last = null
    const rect = el.getBoundingClientRect()
    this.width = this.size
    this.height = this.size * (rect.height / rect.width)
    this._init()
  }

  _init() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.ctx = this.canvas.getContext('2d', { alpha: false })
    this.texture = new THREE.CanvasTexture(this.canvas)
    this._clear()
  }

  _clear() {
    this.ctx.fillStyle = 'black'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }

  reset() {
    this._clear()
    this.points = []
    this.texture.needsUpdate = true
  }

  addPoint(pt) {
    let vx = 0, vy = 0, force = 0
    if (this.last) {
      const dx = pt.x - this.last.x
      const dy = pt.y - this.last.y
      const dist2 = dx * dx + dy * dy
      const dist = Math.sqrt(dist2)
      vx = dx / dist
      vy = dy / dist
      force = Math.min(10000 * dist2, 1)
    }
    this.last = { x: pt.x, y: pt.y }
    this.points.push({ x: pt.x, y: pt.y, vx, vy, force, age: 0 })
  }

  _drawPoint(pt) {
    const x = pt.x * this.width
    const y = pt.y * this.height
    const ctx = this.ctx

    let s
    const t30 = 0.3 * this.maxAge
    if (pt.age < t30) {
      s = Math.sin((pt.age / t30) * (Math.PI / 2))
    } else {
      const k = 1 - (pt.age - t30) / (0.7 * this.maxAge)
      s = -k * (k - 2)
    }
    s *= pt.force

    const r = `${((pt.vx + 1) / 2) * 255}, ${((pt.vy + 1) / 2) * 255}, ${255 * s}`
    const offset = 5 * this.width

    ctx.shadowOffsetX = offset
    ctx.shadowOffsetY = offset
    ctx.shadowBlur = this.radius * 0.5
    ctx.shadowColor = `rgba(${r}, ${0.2 * s})`
    ctx.beginPath()
    ctx.fillStyle = 'rgba(255, 0, 0, 1)'
    ctx.arc(x - offset, y - offset, this.radius, 0, Math.PI * 2)
    ctx.fill()
  }

  resize() {
    const rect = this.$el.getBoundingClientRect()
    this.last = null
    this.height = this.size * (rect.height / rect.width)
    this.texture.dispose()
    this.canvas.height = this.height
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.needsUpdate = true
  }

  update() {
    if (this.points.length === 0 && this.needUpdate) {
      this.needUpdate = false
      this.reset()
      return
    }
    if (this.points.length > 0) {
      this.needUpdate = true
      this._clear()
      for (let i = this.points.length - 1; i >= 0; i--) {
        this.points[i].age++
        if (this.points[i].age > this.maxAge) this.points.splice(i, 1)
      }
      this.points.forEach(p => this._drawPoint(p))
      this.texture.needsUpdate = true
    }
  }

  destroy() {
    this.texture.dispose()
  }
}

// ─── Shaders ─────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */`
uniform float uTime;
uniform float uSpeed;
uniform float uZoom;
uniform float uGrainAmount;
uniform float uGrainSpeed;
uniform float uNoiseOffset;
uniform vec2  uResolution;
uniform vec2  uMeshSize;
uniform vec2  uImageSize;
uniform sampler2D uNoise;
uniform sampler2D uGradient;
uniform sampler2D uCursorTexture;
varying vec2 vUv;

vec2 aspectCover(vec2 uv, vec2 imageSize, vec2 meshSize) {
  vec2 sizeRatio = imageSize / meshSize;
  vec2 newSize   = min(sizeRatio.x, sizeRatio.y) / sizeRatio;
  return uv * newSize + (1.0 - newSize) * 0.5;
}

vec2 rotateUV(vec2 uv, float a) {
  float c = cos(a), s = sin(a), mid = 0.5;
  return vec2(
    c * (uv.x - mid) + s * (uv.y - mid) + mid,
    c * (uv.y - mid) - s * (uv.x - mid) + mid
  );
}

vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1  = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy  -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x * x0.x  + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec4 animatedNoise(vec2 uv) {
  vec2  pos = uv * 0.05;
  float c   = 0.25 * snoise(pos);
  return vec4(vec3(c), 1.0);
}

float random(vec2 st) {
  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;

  vec4  noiseTex = texture2D(uNoise, uv);
  vec4  mouseTex = texture2D(uCursorTexture, uv);
  float vx = -((mouseTex.r * 2.0) - 1.0);
  float vy =   (mouseTex.g * 2.0) - 1.0;
  uv.x += noiseTex.r * vx * 0.3 * mouseTex.b;
  uv.y += noiseTex.r * vy * 0.3 * mouseTex.b;

  vec2 gradientUV = aspectCover(uv, uImageSize, uMeshSize);

  vec2 noiseUV = aspectCover(uv * uZoom, uImageSize, uMeshSize);
  noiseUV.xy *= (uResolution.x / uResolution.y) * 10.0;
  noiseUV.y  *=  uResolution.y / uResolution.x;
  noiseUV.xy += uTime * 0.05;
  noiseUV     = rotateUV(noiseUV, uTime * 0.05);
  vec4 noiseLayer = animatedNoise(noiseUV) / 0.25;

  gradientUV  = rotateUV(gradientUV, uNoiseOffset * 500.0 + uTime * uSpeed);
  gradientUV -= 0.5;
  gradientUV.y *= uResolution.y / uResolution.x;
  gradientUV += 0.5;
  gradientUV -= 0.5;
  gradientUV.y *= noiseLayer.r * 4.0;
  gradientUV += 0.5;

  vec4 gradientColor = texture2D(uGradient, gradientUV);

  vec2  grainUV = uv + snoise(uv * 400.0);
  float grain   = snoise(grainUV + uTime * random(grainUV) * uGrainSpeed);

  gl_FragColor = vec4(gradientColor.rgb + vec3(grain) * uGrainAmount, 1.0);
}
`

// ─── Per-element Gradient Mesh ────────────────────────────────────────────────

class GradientMesh {
  constructor(el, gl, gradientTex, imageSize) {
    this.el = el
    this.gl = gl
    this.isInView = false
    this.canMove = false
    this.trail = new CanvasTrail(el)

    this._createMesh(gradientTex, imageSize)
    this._setData()
    this._bindEvents()
  }

  _createMesh(gradientTex, imageSize) {
    const rect = this.el.getBoundingClientRect()
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime:          { value: 0 },
        uSpeed:         { value: 0.25 },
        uZoom:          { value: 1.1 },
        uGrainAmount:   { value: 0.07 },
        uGrainSpeed:    { value: 5 },
        uNoiseOffset:   { value: Math.random() },
        uResolution:    { value: new THREE.Vector2(this.gl.w, this.gl.h) },
        uMeshSize:      { value: new THREE.Vector2(rect.width, rect.height) },
        uImageSize:     { value: imageSize.clone() },
        uNoise:         { value: this.gl.noiseTex },
        uGradient:      { value: gradientTex },
        uCursorTexture: { value: this.trail.texture },
      },
    })
    this.geometry = new THREE.PlaneGeometry(1, 1, 1, 1)
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.gl.scene.add(this.mesh)
  }

  _getBounds() {
    const rect = this.el.getBoundingClientRect()
    this.bounds = {
      rect,
      gl: {
        x: rect.left - this.gl.w / 2 + rect.width / 2,
        y: -rect.top + this.gl.h / 2 - rect.height / 2 - window.scrollY,
      },
    }
  }

  _setData() {
    this._getBounds()
    const { gl, rect } = this.bounds
    this.material.uniforms.uMeshSize.value.set(rect.width, rect.height)
    this.mesh.position.set(gl.x, gl.y, 0)
    this.mesh.scale.set(rect.width, rect.height, 1)
  }

  _bindEvents() {
    this._onEnter = () => { this.canMove = true }
    this._onLeave = () => { this.canMove = false }
    this.el.addEventListener('mouseenter', this._onEnter)
    this.el.addEventListener('mouseleave', this._onLeave)
  }

  onEnterView() {
    this.isInView = true
    this.mesh.visible = true
  }

  onLeaveView() {
    this.isInView = false
    this.trail.reset()
    this.mesh.visible = false
  }

  move(domX, domY) {
    if (!this.canMove) return
    const rect = this.el.getBoundingClientRect()
    this.trail.addPoint({
      x: (domX - rect.left) / rect.width,
      y: (domY - rect.top)  / rect.height,
    })
  }

  resize() {
    this._setData()
    this.trail.resize()
    this.material.uniforms.uCursorTexture.value = this.trail.texture
    this.material.uniforms.uResolution.value.set(this.gl.w, this.gl.h)
    this.material.needsUpdate = true
  }

  update() {
    const rect = this.el.getBoundingClientRect()
    this.mesh.position.y = -rect.top + this.gl.h / 2 - rect.height / 2

    if (this.isInView) {
      this.material.uniforms.uTime.value = (this.material.uniforms.uTime.value + 0.01) % 1000
      this.trail.update()
    }
  }

  destroy() {
    this.el.removeEventListener('mouseenter', this._onEnter)
    this.el.removeEventListener('mouseleave', this._onLeave)
    this.material.dispose()
    this.geometry.dispose()
    this.trail.destroy()
    this.gl.scene.remove(this.mesh)
  }
}

// ─── GL Singleton ─────────────────────────────────────────────────────────────

let glReady = false
let gl, gradientTex, imageSize, rafId
let meshes = []
let observer = null

const onMouseMove = (e) => {
  if (window.innerWidth <= 991) return
  meshes.forEach(m => m.move(e.clientX, e.clientY))
}
const onResize = () => {
  if (!gl) return
  gl.w = window.innerWidth
  gl.h = window.innerHeight
  gl.renderer.setSize(gl.w, gl.h)
  gl.camera.left   = gl.w / -2
  gl.camera.right  = gl.w / 2
  gl.camera.top    = gl.h / 2
  gl.camera.bottom = gl.h / -2
  gl.camera.updateProjectionMatrix()
  meshes.forEach(m => m.resize())
}

function setupGL() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setSize(window.innerWidth, window.innerHeight)

  Object.assign(renderer.domElement.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '0',
  })
  document.body.appendChild(renderer.domElement)

  const camera = new THREE.OrthographicCamera(
    window.innerWidth  / -2, window.innerWidth  / 2,
    window.innerHeight / 2,  window.innerHeight / -2,
    0.1, 10
  )
  camera.position.z = 1

  gl = {
    renderer,
    scene: new THREE.Scene(),
    camera,
    w: window.innerWidth,
    h: window.innerHeight,
    noiseTex: null,
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', () => {
    if (!rafId) return
    if (document.hidden) {
      cancelAnimationFrame(rafId)
      rafId = null
    } else {
      startRAF()
    }
  })

  const loader = new THREE.TextureLoader()
  let loaded = 0

  function onLoad() {
    if (++loaded === 2) {
      glReady = true
      startRAF()
      enter()
    }
  }

  loader.load(gradientUrl, (tex) => {
    gradientTex = tex
    imageSize = new THREE.Vector2(tex.image.width, tex.image.height)
    onLoad()
  })
  loader.load(noiseUrl, (tex) => {
    gl.noiseTex = tex
    onLoad()
  })
}

function startRAF() {
  ;(function animate() {
    rafId = requestAnimationFrame(animate)
    meshes.forEach(m => m.update())
    gl.renderer.render(gl.scene, gl.camera)
  })()
}

// ─── Public API (for Barba hooks) ─────────────────────────────────────────────

function enter() {
  if (!glReady) return

  const els = document.querySelectorAll('[data-gradient]')
  if (!els.length) return

  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const m = meshes.find(m => m.el === entry.target)
      if (!m) return
      entry.isIntersecting ? m.onEnterView() : m.onLeaveView()
    })
  })

  els.forEach(el => {
    const m = new GradientMesh(el, gl, gradientTex, imageSize)
    meshes.push(m)
    observer.observe(el)
  })
}

function leave() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  meshes.forEach(m => m.destroy())
  meshes = []
}

window.GradientSmudge = { enter, leave }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupGL)
} else {
  setupGL()
}
