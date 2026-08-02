import * as THREE from 'three';

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Framerate-independent damping toward a target. k ~ higher = snappier. */
export const damp = (current, target, k, dt) =>
  lerp(current, target, 1 - Math.exp(-k * dt));

export function createStarfield({ count = 1600, radius = 400 } = {}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const warmth = new THREE.Color(0xfff3d8);
  const cool = new THREE.Color(0xcfe3ff);

  for (let i = 0; i < count; i++) {
    const r = radius * (0.6 + Math.random() * 0.4);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const c = warmth.clone().lerp(cool, Math.random());
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

/** Procedurally paints a soft, simplified continent map so we never rely on external art assets. */
export function makeEarthTexture({ size = 1024, seed = 7 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');

  const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, '#2f6f8f');
  ocean.addColorStop(0.5, '#245a79');
  ocean.addColorStop(1, '#1c4863');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const landColors = ['#e9d9a8', '#d9c98f', '#c9d9a0'];

  const blob = (cx, cy, r) => {
    ctx.beginPath();
    const points = 10 + Math.floor(rand() * 4);
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const rr = r * (0.65 + rand() * 0.6);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = landColors[Math.floor(rand() * landColors.length)];
    ctx.fill();
  };

  const continents = 8;
  for (let i = 0; i < continents; i++) {
    const cx = rand() * canvas.width;
    const cy = canvas.height * 0.18 + rand() * canvas.height * 0.64;
    const r = canvas.width * (0.05 + rand() * 0.07);
    blob(cx, cy, r);
    // wrap around the seam so the map tiles seamlessly
    blob(cx - canvas.width, cy, r);
    blob(cx + canvas.width, cy, r);

    const satellites = 2 + Math.floor(rand() * 3);
    for (let j = 0; j < satellites; j++) {
      const sx = cx + (rand() - 0.5) * r * 2.2;
      const sy = cy + (rand() - 0.5) * r * 1.4;
      const sr = r * (0.25 + rand() * 0.35);
      blob(sx, sy, sr);
      blob(sx - canvas.width, sy, sr);
      blob(sx + canvas.width, sy, sr);
    }
  }

  // soft polar ice caps
  const capGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.12);
  capGrad.addColorStop(0, 'rgba(255,255,255,0.85)');
  capGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = capGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.12);
  ctx.save();
  ctx.translate(0, canvas.height);
  ctx.scale(1, -1);
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.1);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Large inverted sphere with a vertical gradient, used as a cheap storybook sky. */
export function createGradientSky({ top = '#8fc7e8', bottom = '#f4e4c1', radius = 500 } = {}) {
  const geometry = new THREE.SphereGeometry(radius, 24, 16);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(top) },
      bottomColor: { value: new THREE.Color(bottom) },
      offset: { value: 0 },
      exponent: { value: 0.7 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        float t = max(pow(max(h, 0.0), exponent), 0.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}
