import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createGradientSky, createStarfield, clamp } from '../core/utils.js';

function sampleCyclicStops(stops, t) {
  for (let i = 0; i < stops.length; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[(i + 1) % stops.length];
    let span = t1 - t0;
    if (span <= 0) span += 1;
    let localT = t - t0;
    if (localT < 0) localT += 1;
    if (localT <= span) return c0.clone().lerp(c1, localT / span);
  }
  return stops[0][1].clone();
}

function sampleLinearStops(stops, t) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t <= t1 || i === stops.length - 2) {
      return c0.clone().lerp(c1, clamp((t - t0) / (t1 - t0), 0, 1));
    }
  }
  return stops[stops.length - 1][1].clone();
}

const SKY_TOP = [
  [0, new THREE.Color(0x0a1230)],
  [0.25, new THREE.Color(0xf6b98a)],
  [0.5, new THREE.Color(0x6fb7e6)],
  [0.75, new THREE.Color(0xf2946a)],
];
const SKY_BOTTOM = [
  [0, new THREE.Color(0x101625)],
  [0.25, new THREE.Color(0xffd9a0)],
  [0.5, new THREE.Color(0xfbe9c8)],
  [0.75, new THREE.Color(0xffb37a)],
];
const LEAF_STOPS = [
  [0, new THREE.Color(0x9ed17b)],
  [0.33, new THREE.Color(0x4f8f4a)],
  [0.66, new THREE.Color(0xd97a3a)],
  [1, new THREE.Color(0x8a6a4a)],
];
const GROUND_STOPS = [
  [0, new THREE.Color(0x9ed17b)],
  [0.33, new THREE.Color(0x7fae5a)],
  [0.66, new THREE.Color(0xc9a15a)],
  [1, new THREE.Color(0xf0f0f0)],
];

export class TimeChapter {
  label = 'Chapter Four — Keeping Track of Time';
  promptText = 'Drag the dials below to move through a day, and through the seasons';

  constructor(renderer, hud) {
    this.renderer = renderer;
    this.hud = hud;
    this.time = 0.5;
    this.season = 0;

    this.scene = new THREE.Scene();
    this.sky = createGradientSky({ radius: 250 });
    this.scene.add(this.sky);
    this.stars = createStarfield({ count: 700, radius: 220 });
    this.stars.material.opacity = 0;
    this.scene.add(this.stars);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    this.camera.position.set(0, 4, 9);

    this._buildGround();
    this._buildTree();
    this._buildSundial();
    this._buildCelestialBodies();
    this._buildLighting();

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.set(0, 1.2, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 15;
    this.controls.maxPolarAngle = 1.3;
    this.controls.minAzimuthAngle = -1.0;
    this.controls.maxAzimuthAngle = 1.0;
    this.controls.enablePan = false;
    this.controls.enabled = false;

    this._onTimeInput = (e) => {
      this.time = parseFloat(e.target.value);
    };
    this._onSeasonInput = (e) => {
      this.season = parseFloat(e.target.value);
    };
  }

  _buildLighting() {
    this.sun = new THREE.DirectionalLight(0xfff2df, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -8;
    this.sun.shadow.camera.right = 8;
    this.sun.shadow.camera.top = 8;
    this.sun.shadow.camera.bottom = -8;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x6f8fae, 0x2a2318, 0.5);
    this.scene.add(this.hemi);
  }

  _buildGround() {
    const geometry = new THREE.CircleGeometry(6, 40);
    geometry.rotateX(-Math.PI / 2);
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x9ed17b, roughness: 1 });
    this.ground = new THREE.Mesh(geometry, this.groundMat);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  _buildTree() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.4, 8), trunkMat);
    trunk.position.set(-1.6, 0.7, -0.5);
    trunk.castShadow = true;
    this.scene.add(trunk);

    this.leafMat = new THREE.MeshStandardMaterial({ color: 0x9ed17b, roughness: 0.9 });
    this.leaves = new THREE.Group();
    const clumps = [
      [0, 1.55, 0, 0.62],
      [0.35, 1.35, 0.1, 0.44],
      [-0.32, 1.3, -0.15, 0.42],
      [0.05, 1.75, -0.25, 0.4],
    ];
    for (const [x, y, z, r] of clumps) {
      const clump = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), this.leafMat);
      clump.position.set(trunk.position.x + x, y, trunk.position.z + z);
      clump.castShadow = true;
      this.leaves.add(clump);
    }
    this.scene.add(this.leaves);
  }

  _buildSundial() {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.55, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0xcfc3a8, roughness: 0.8 }),
    );
    base.position.set(1.4, 0.06, 0.8);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);

    const gnomon = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.7, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 0.6 }),
    );
    gnomon.position.set(1.4, 0.42, 0.8);
    gnomon.rotation.z = -0.5;
    gnomon.castShadow = true;
    this.scene.add(gnomon);
  }

  _buildCelestialBodies() {
    this.sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff2c8 }),
    );
    this.scene.add(this.sunDisc);

    this.moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xd9e2f2 }),
    );
    this.scene.add(this.moonDisc);
  }

  _applyTime() {
    const t = this.time;
    const angle = t * Math.PI * 2;
    const height = -Math.cos(angle);
    const dayFactor = clamp(height, 0, 1);

    const radius = 16;
    this.sunDisc.position.set(Math.sin(angle) * radius, height * radius, Math.cos(angle) * radius * 0.4);
    this.sunDisc.visible = height > -0.08;

    const moonAngle = angle + Math.PI;
    const moonHeight = -Math.cos(moonAngle);
    this.moonDisc.position.set(
      Math.sin(moonAngle) * radius,
      moonHeight * radius,
      Math.cos(moonAngle) * radius * 0.4,
    );
    this.moonDisc.visible = moonHeight > -0.08;

    this.sun.position.copy(this.sunDisc.visible ? this.sunDisc.position : this.moonDisc.position);
    this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = 0.3 + dayFactor * 2.2;
    this.sun.color.set(dayFactor > 0.5 ? 0xfff2df : 0xdce6ff);

    this.hemi.intensity = 0.25 + dayFactor * 0.5;

    const top = sampleCyclicStops(SKY_TOP, t);
    const bottom = sampleCyclicStops(SKY_BOTTOM, t);
    this.sky.material.uniforms.topColor.value.copy(top);
    this.sky.material.uniforms.bottomColor.value.copy(bottom);

    this.stars.material.opacity = 1 - dayFactor;
  }

  _applySeason() {
    const s = this.season;
    this.leafMat.color.copy(sampleLinearStops(LEAF_STOPS, s));
    this.groundMat.color.copy(sampleLinearStops(GROUND_STOPS, s));
    const bareFactor = clamp((s - 0.85) / 0.15, 0, 1);
    this.leaves.scale.setScalar(1 - bareFactor * 0.75);
  }

  onEnter() {
    this.controls.enabled = true;
    this.hud.setLabel(this.label);
    this.hud.setPrompt(this.promptText);
    this.hud.setAction(null);
    this._timeSlider = document.getElementById('time-slider');
    this._seasonSlider = document.getElementById('season-slider');
    this._timeControls = document.getElementById('time-controls');
    this._timeSlider.value = this.time;
    this._seasonSlider.value = this.season;
    this._timeSlider.addEventListener('input', this._onTimeInput);
    this._seasonSlider.addEventListener('input', this._onSeasonInput);
    this._timeControls.classList.add('visible');
  }

  onExit() {
    this.controls.enabled = false;
    this._timeSlider.removeEventListener('input', this._onTimeInput);
    this._seasonSlider.removeEventListener('input', this._onSeasonInput);
    this._timeControls.classList.remove('visible');
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update() {
    this.controls.update();
    this._applyTime();
    this._applySeason();
  }
}
