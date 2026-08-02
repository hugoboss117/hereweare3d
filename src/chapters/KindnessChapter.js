import * as THREE from 'three';
import { createStarfield, makeEarthTexture, clamp, easeOutCubic, Tweens } from '../core/utils.js';

const LOOK_SENSITIVITY = 0.003;
const EARTH_RADIUS = 45;

const CLOSING_LINES = [
  "You don't have to know everything. Just remember to be kind.",
  "There is enough here for everyone, if we look after each other.",
  'Whenever you feel lost, remember — you are never really alone.',
];

export class KindnessChapter {
  label = 'Chapter Eight — Be a Good Person';
  promptText = 'Tap the fire to light it';

  constructor(renderer, hud, onRestart) {
    this.renderer = renderer;
    this.hud = hud;
    this.onRestart = onRestart;
    this.tweens = new Tweens();
    this.lit = false;
    this.state = 'sitting'; // sitting | finale
    this.yaw = 0;
    this.pitch = -0.05;
    this.look = null;
    this.clock = 0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e1a);
    this.stars = createStarfield({ count: 1200, radius: 260 });
    this.scene.add(this.stars);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
    this.camera.position.set(0, 1.6, 4.2);

    this._buildEarth();
    this._buildGround();
    this._buildFirePit();
    this._buildFamily();
    this._buildFireflies();
    this._buildLighting();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._downPos = null;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  _buildEarth() {
    const texture = makeEarthTexture({ size: 1024, seed: 42 });
    const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 48);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
    this.earth = new THREE.Mesh(geometry, material);
    this.earth.position.set(0, -EARTH_RADIUS, 0);
    this.scene.add(this.earth);
  }

  _buildGround() {
    const geometry = new THREE.CircleGeometry(7, 40);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x2e3320, roughness: 1 });
    this.scene.add(new THREE.Mesh(geometry, material));
  }

  _buildFirePit() {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a9184, roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), stoneMat);
      stone.position.set(Math.cos(a) * 0.55, 0.06, Math.sin(a) * 0.55);
      this.scene.add(stone);
    }
    const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 });
    for (const rot of [0.4, -0.5, 1.4]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 6), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = rot;
      log.position.y = 0.08;
      this.scene.add(log);
    }

    this.flame = new THREE.Group();
    this.flame.visible = false;
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffa542,
      emissive: 0xff7a1f,
      emissiveIntensity: 1.4,
      roughness: 0.4,
    });
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14 - i * 0.03, 0.4 - i * 0.08, 8), flameMat);
      cone.position.y = 0.15 + i * 0.14;
      this.flame.add(cone);
    }
    this.scene.add(this.flame);

    this.fireLight = new THREE.PointLight(0xffb066, 0, 6);
    this.fireLight.position.set(0, 0.6, 0);
    this.scene.add(this.fireLight);

    this.pitTarget = new THREE.Vector3(0, 0.2, 0);
  }

  _buildFamily() {
    const colors = [0x6b3f4a, 0x3f5a6b, 0x4a5a3a];
    this.family = [];
    const count = 3;
    for (let i = 0; i < count; i++) {
      // Spread across the far side of the fire circle so nobody sits
      // directly between the camera (at +Z) and the fire pit.
      const a = -Math.PI * 0.5 + (i - (count - 1) / 2) * 0.9;
      const mat = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.85, emissive: 0x000000 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), mat);
      body.scale.set(1, 0.9, 1);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat);
      const group = new THREE.Group();
      body.position.y = 0.32;
      head.position.y = 0.7;
      group.add(body, head);
      const dist = 1.6;
      group.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
      group.lookAt(0, 0.3, 0);
      this.scene.add(group);
      this.family.push(mat);
    }
  }

  _buildFireflies() {
    const count = 60;
    const positions = new Float32Array(count * 3);
    this.fireflyPhase = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 4;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.3 + Math.random() * 1.6;
      positions[i * 3 + 2] = Math.sin(a) * r;
      this.fireflyPhase.push(Math.random() * Math.PI * 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.fireflyBase = positions.slice();
    const material = new THREE.PointsMaterial({
      color: 0xfff0a0,
      size: 0.06,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.fireflies = new THREE.Points(geometry, material);
    this.scene.add(this.fireflies);
  }

  _buildLighting() {
    this.moon = new THREE.DirectionalLight(0x9fb4e0, 1.3);
    this.moon.position.set(-6, 8, 4);
    this.scene.add(this.moon);
    this.scene.add(new THREE.HemisphereLight(0x3a4a70, 0x1c1812, 0.85));
  }

  _lightFire() {
    this.lit = true;
    this.flame.visible = true;
    this.tweens.add((p) => {
      this.fireLight.intensity = p * 3;
    }, 1.2);
    for (const mat of this.family) {
      this.tweens.add((p) => {
        mat.emissive.setRGB(p * 0.4, p * 0.18, p * 0.05);
      }, 1.4);
    }
    this.tweens.add((p) => {
      this.fireflies.material.opacity = p * 0.85;
    }, 2.2, { delay: 0.6 });

    const line = CLOSING_LINES[Math.floor(Math.random() * CLOSING_LINES.length)];
    this.hud.setPrompt(line);
    setTimeout(() => {
      if (this.state === 'sitting') this.hud.setAction('Here We Are', () => this._startFinale());
    }, 2200);
  }

  _startFinale() {
    this.state = 'finale';
    this.hud.setAction(null);
    this.hud.setPrompt('');
    const startPos = this.camera.position.clone();
    const startQuat = this.camera.quaternion.clone();
    const endPos = new THREE.Vector3(0, 130, 210);
    const endLookAt = new THREE.Vector3(0, -EARTH_RADIUS * 0.3, 0);
    const endQuat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(endPos, endLookAt, new THREE.Vector3(0, 1, 0)),
    );

    this.tweens.add((p) => {
      const eased = easeOutCubic(p);
      this.camera.position.lerpVectors(startPos, endPos, eased);
      this.camera.quaternion.slerpQuaternions(startQuat, endQuat, eased);
    }, 4.5, {
      onComplete: () => {
        this.hud.setLabel('Here We Are');
        this.hud.setPrompt('Thank you for reading along.');
        this.hud.setAction('Start Over', () => this.onRestart?.());
      },
    });
  }

  _onPointerDown(event) {
    this._downPos = { x: event.clientX, y: event.clientY };
    this.look = { x: event.clientX, y: event.clientY };
  }

  _onPointerMove(event) {
    if (!this.look) return;
    const dx = event.clientX - this.look.x;
    const dy = event.clientY - this.look.y;
    this.look = { x: event.clientX, y: event.clientY };
    this.yaw -= dx * LOOK_SENSITIVITY;
    this.pitch = clamp(this.pitch - dy * LOOK_SENSITIVITY, -0.6, 0.6);
  }

  _onPointerUp(event) {
    this.look = null;
    if (!this._downPos) return;
    const dx = event.clientX - this._downPos.x;
    const dy = event.clientY - this._downPos.y;
    this._downPos = null;
    if (Math.hypot(dx, dy) > 6) return;
    if (this.lit || this.state !== 'sitting') return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const dist = this.raycaster.ray.distanceToPoint(this.pitTarget);
    if (dist < 1.1) this._lightFire();
  }

  onEnter() {
    this.hud.setLabel(this.label);
    this.hud.setPrompt(this.lit ? '' : this.promptText);
    this.hud.setAction(null);
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  onExit() {
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.clock += dt;
    this.tweens.update(dt);

    if (this.state === 'sitting') {
      this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    }

    if (this.flame.visible) {
      const s = 1 + Math.sin(this.clock * 9) * 0.08;
      this.flame.scale.set(s, 1 + Math.sin(this.clock * 7) * 0.15, s);
    }

    if (this.fireflies.material.opacity > 0.01) {
      const pos = this.fireflies.geometry.attributes.position;
      for (let i = 0; i < this.fireflyPhase.length; i++) {
        const phase = this.fireflyPhase[i];
        pos.setX(i, this.fireflyBase[i * 3] + Math.sin(this.clock * 0.6 + phase) * 0.4);
        pos.setY(i, this.fireflyBase[i * 3 + 1] + Math.sin(this.clock * 1.3 + phase) * 0.25);
        pos.setZ(i, this.fireflyBase[i * 3 + 2] + Math.cos(this.clock * 0.6 + phase) * 0.4);
      }
      pos.needsUpdate = true;
    }
  }
}
