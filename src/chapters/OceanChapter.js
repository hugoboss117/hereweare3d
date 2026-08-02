import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clamp, damp, lerp } from '../core/utils.js';

const WATER_LEVEL = 0;
const DIVE_FLOOR = -14;
const SWIM_SPEED = 2.4;
const LOOK_SENSITIVITY = 0.0032;

function waveHeight(x, z, t) {
  return (
    Math.sin(x * 0.35 + t * 0.9) * 0.22 +
    Math.sin(z * 0.28 - t * 0.7) * 0.18 +
    Math.sin((x + z) * 0.15 + t * 0.5) * 0.1
  );
}

export class OceanChapter {
  label = 'Chapter Six — Most of Earth Is the Sea';

  constructor(renderer, hud) {
    this.renderer = renderer;
    this.hud = hud;
    this.state = 'surface'; // 'surface' | 'diving' | 'transition'
    this.elapsed = 0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe3f0);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    this.camera.position.set(0, 3.5, 9);

    this._buildLighting();
    this._buildOcean();
    this._buildBoat();
    this._buildUnderwater();
    this._buildDiver();
    this._buildBubbles();

    this.surfaceControls = new OrbitControls(this.camera, renderer.domElement);
    this.surfaceControls.enableDamping = true;
    this.surfaceControls.dampingFactor = 0.08;
    this.surfaceControls.target.set(0, 0.4, 0);
    this.surfaceControls.minDistance = 5;
    this.surfaceControls.maxDistance = 16;
    this.surfaceControls.maxPolarAngle = Math.PI * 0.49;
    this.surfaceControls.enablePan = false;
    this.surfaceControls.enabled = false;

    this.keys = new Set();
    this.diverYaw = Math.PI;
    this.diverPitch = -0.1;
    this.look = null;

    this._onKeyDown = (e) => this.keys.add(e.code);
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  _buildLighting() {
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sun.position.set(5, 8, 3);
    this.scene.add(sun);
    this.sun = sun;

    const fill = new THREE.HemisphereLight(0xbfe3f0, 0x0a2a3a, 0.7);
    this.scene.add(fill);
    this.fill = fill;
  }

  _buildOcean() {
    const geometry = new THREE.PlaneGeometry(70, 70, 56, 56);
    geometry.rotateX(-Math.PI / 2);
    this.oceanGeometry = geometry;

    const material = new THREE.MeshStandardMaterial({
      color: 0x1f7ea3,
      roughness: 0.35,
      metalness: 0.05,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    this.ocean = new THREE.Mesh(geometry, material);
    this.scene.add(this.ocean);
  }

  _buildBoat() {
    const boat = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.75 });
    const hullShape = new THREE.CylinderGeometry(0.05, 0.55, 1.8, 8, 1, true);
    const hull = new THREE.Mesh(hullShape, hullMat);
    hull.rotation.z = Math.PI / 2;
    hull.position.y = 0.15;
    boat.add(hull);

    const deckMat = new THREE.MeshStandardMaterial({ color: 0xe7d3ab, roughness: 0.6 });
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 8), deckMat);
    deck.position.y = 0.42;
    boat.add(deck);

    const mastMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mastMat);
    mast.position.y = 1.2;
    boat.add(mast);

    const sailMat = new THREE.MeshStandardMaterial({
      color: 0xf6efe1,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0.75);
    sailShape.lineTo(0, -0.05);
    sailShape.quadraticCurveTo(0.55, 0.35, 0, 0.75);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), sailMat);
    sail.position.set(0.03, 0.5, 0);
    boat.add(sail);

    boat.scale.setScalar(1.3);
    this.boat = boat;
    this.scene.add(boat);
  }

  _buildUnderwater() {
    const group = new THREE.Group();
    this.underwater = group;
    this.scene.add(group);

    // seabed
    const bedGeo = new THREE.PlaneGeometry(70, 70, 1, 1);
    bedGeo.rotateX(-Math.PI / 2);
    const bedMat = new THREE.MeshStandardMaterial({ color: 0xd8c98a, roughness: 1 });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.y = DIVE_FLOOR;
    group.add(bed);

    // coral clusters
    const coralPalette = [0xe0673f, 0xf2a65a, 0xd45c8a, 0x7fb8a4];
    for (let i = 0; i < 26; i++) {
      const cx = (Math.random() - 0.5) * 55;
      const cz = (Math.random() - 0.5) * 55;
      if (Math.hypot(cx, cz) < 4) continue;
      const color = coralPalette[Math.floor(Math.random() * coralPalette.length)];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      const cluster = new THREE.Group();
      const nubs = 2 + Math.floor(Math.random() * 4);
      for (let n = 0; n < nubs; n++) {
        const h = 0.6 + Math.random() * 1.4;
        const geo = new THREE.ConeGeometry(0.18 + Math.random() * 0.15, h, 6);
        const nub = new THREE.Mesh(geo, mat);
        nub.position.set((Math.random() - 0.5) * 0.6, h / 2, (Math.random() - 0.5) * 0.6);
        nub.rotation.z = (Math.random() - 0.5) * 0.3;
        cluster.add(nub);
      }
      cluster.position.set(cx, DIVE_FLOOR, cz);
      group.add(cluster);
    }

    // fish shoal (instanced)
    const fishGeo = new THREE.ConeGeometry(0.09, 0.32, 4);
    fishGeo.rotateX(Math.PI / 2);
    const fishMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.5 });
    const count = 42;
    this.fishMesh = new THREE.InstancedMesh(fishGeo, fishMat, count);
    this.fish = [];
    for (let i = 0; i < count; i++) {
      this.fish.push({
        center: new THREE.Vector3((Math.random() - 0.5) * 30, DIVE_FLOOR + 2 + Math.random() * 8, (Math.random() - 0.5) * 30),
        radius: 1 + Math.random() * 3,
        speed: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        bob: Math.random() * Math.PI * 2,
      });
    }
    group.add(this.fishMesh);

    group.visible = false;
  }

  _buildDiver() {
    const diver = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe7b98f, roughness: 0.7 });
    const suitMat = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.6 });
    const finMat = new THREE.MeshStandardMaterial({ color: 0xe0673f, roughness: 0.5 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 10), suitMat);
    body.rotation.x = Math.PI / 2;
    diver.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), skinMat);
    head.position.set(0, 0.05, -0.5);
    diver.add(head);

    const tankGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8);
    const tank = new THREE.Mesh(tankGeo, new THREE.MeshStandardMaterial({ color: 0xd7d2c4, roughness: 0.4 }));
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0, 0.12, 0.15);
    diver.add(tank);

    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 4), finMat);
      fin.rotation.x = -Math.PI / 2;
      fin.position.set(side * 0.12, -0.02, 0.62);
      diver.add(fin);
    }

    diver.position.set(0, WATER_LEVEL - 1.6, 3);
    diver.visible = false;
    this.diver = diver;
    this.scene.add(diver);
  }

  _buildBubbles() {
    const count = 120;
    const positions = new Float32Array(count * 3);
    this.bubbleData = [];
    for (let i = 0; i < count; i++) {
      const p = this._randomBubblePos();
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      this.bubbleData.push({ speed: 0.4 + Math.random() * 0.6 });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xdff4ff,
      size: 0.06,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.bubbles = new THREE.Points(geometry, material);
    this.bubbles.visible = false;
    this.scene.add(this.bubbles);
  }

  _randomBubblePos() {
    return new THREE.Vector3(
      (Math.random() - 0.5) * 30,
      DIVE_FLOOR + Math.random() * 14,
      (Math.random() - 0.5) * 30,
    );
  }

  // ---- input ----

  _onPointerDown(event) {
    if (this.state !== 'diving') return;
    this.look = { x: event.clientX, y: event.clientY };
  }

  _onPointerMove(event) {
    if (!this.look) return;
    const dx = event.clientX - this.look.x;
    const dy = event.clientY - this.look.y;
    this.look = { x: event.clientX, y: event.clientY };
    this.diverYaw -= dx * LOOK_SENSITIVITY;
    this.diverPitch = clamp(this.diverPitch - dy * LOOK_SENSITIVITY, -1.1, 1.1);
  }

  _onPointerUp() {
    this.look = null;
  }

  // ---- state transitions ----

  startDive() {
    if (this.state !== 'surface') return;
    this.state = 'transition';
    this.surfaceControls.enabled = false;
    this.underwater.visible = true;
    this.bubbles.visible = true;
    this.diver.visible = true;
    this._diveStartY = WATER_LEVEL - 0.4;
    this._diveEndY = WATER_LEVEL - 2.2;
    this.diver.position.set(this.boat.position.x, this._diveStartY, this.boat.position.z + 1.5);
    this.hud.setPrompt('Diving in…');
    this.hud.setAction(null);
    this._transitionT = 0;
  }

  startSurface() {
    if (this.state !== 'diving') return;
    this.state = 'transition-up';
    this.hud.setPrompt('Surfacing…');
    this.hud.setAction(null);
    this._transitionT = 0;
    this._transStartCamPos = this.camera.position.clone();
  }

  _finishDiveTransition() {
    this.state = 'diving';
    this.hud.setPrompt('Drag to look · WASD to swim · Space/Shift for up and down');
    this.hud.setAction('Back to Boat', () => this.startSurface());
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  _finishSurfaceTransition() {
    this.state = 'surface';
    this.underwater.visible = false;
    this.bubbles.visible = false;
    this.diver.visible = false;
    this.surfaceControls.enabled = true;
    this.hud.setPrompt('Drag to look around the boat');
    this.hud.setAction('Dive In', () => this.startDive());
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
  }

  // ---- lifecycle ----

  onEnter() {
    this.hud.setLabel(this.label);
    if (this.state === 'surface') {
      this.surfaceControls.enabled = true;
      this.hud.setPrompt('Drag to look around the boat');
      this.hud.setAction('Dive In', () => this.startDive());
    } else {
      this._finishDiveTransition();
    }
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  onExit() {
    this.surfaceControls.enabled = false;
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.keys.clear();
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt, elapsed) {
    this.elapsed = elapsed;
    this._updateOcean(elapsed);
    this._updateBoat(elapsed);
    this._updateFish(dt, elapsed);
    this._updateBubbles(dt);

    if (this.state === 'surface') {
      this.surfaceControls.update();
    } else if (this.state === 'transition') {
      this._stepDiveTransition(dt);
    } else if (this.state === 'transition-up') {
      this._stepSurfaceTransition(dt);
    } else if (this.state === 'diving') {
      this._updateDiver(dt);
    }

    const underwater = this.camera.position.y < WATER_LEVEL - 0.3;
    const targetFog = underwater ? 0.045 : 0;
    if (!this.scene.fog) this.scene.fog = new THREE.FogExp2(0x0d5678, 0);
    this.scene.fog.density = damp(this.scene.fog.density, targetFog, 3, dt);
    this.scene.background.set(underwater ? 0x0d5678 : 0xbfe3f0);
  }

  _updateOcean(t) {
    const pos = this.oceanGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, waveHeight(x, z, t));
    }
    pos.needsUpdate = true;
    this.oceanGeometry.computeVertexNormals();
  }

  _updateBoat(t) {
    const h = waveHeight(this.boat.position.x, this.boat.position.z, t);
    const hx = waveHeight(this.boat.position.x + 0.6, this.boat.position.z, t);
    const hz = waveHeight(this.boat.position.x, this.boat.position.z + 0.6, t);
    this.boat.position.y = h;
    this.boat.rotation.z = (h - hx) * 0.6;
    this.boat.rotation.x = (hz - h) * 0.6;
  }

  _updateFish(dt, t) {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i];
      const a = t * f.speed + f.phase;
      const x = f.center.x + Math.cos(a) * f.radius;
      const z = f.center.z + Math.sin(a) * f.radius;
      const y = f.center.y + Math.sin(t * 0.6 + f.bob) * 0.4;
      dummy.position.set(x, y, z);
      const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      dummy.lookAt(dummy.position.clone().add(tangent));
      dummy.updateMatrix();
      this.fishMesh.setMatrixAt(i, dummy.matrix);
    }
    this.fishMesh.instanceMatrix.needsUpdate = true;
  }

  _updateBubbles(dt) {
    if (!this.bubbles.visible) return;
    const pos = this.bubbles.geometry.attributes.position;
    for (let i = 0; i < this.bubbleData.length; i++) {
      let y = pos.getY(i) + this.bubbleData[i].speed * dt;
      if (y > WATER_LEVEL - 0.2) {
        const p = this._randomBubblePos();
        pos.setXYZ(i, p.x, DIVE_FLOOR, p.z);
      } else {
        pos.setY(i, y);
      }
    }
    pos.needsUpdate = true;
  }

  _updateDiver(dt) {
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.diverPitch, this.diverYaw, 0, 'YXZ'));
    this.diver.quaternion.copy(quat);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const move = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(SWIM_SPEED * dt);
    this.diver.position.add(move);

    let vertical = 0;
    if (this.keys.has('Space')) vertical += 1;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) vertical -= 1;
    this.diver.position.y += vertical * SWIM_SPEED * 0.6 * dt;
    this.diver.position.y = clamp(this.diver.position.y, DIVE_FLOOR + 1, WATER_LEVEL - 0.4);

    const bound = 33;
    this.diver.position.x = clamp(this.diver.position.x, -bound, bound);
    this.diver.position.z = clamp(this.diver.position.z, -bound, bound);

    const behind = new THREE.Vector3(0, 1.1, 3.6).applyQuaternion(quat);
    const desiredCamPos = this.diver.position.clone().add(behind);
    this.camera.position.x = damp(this.camera.position.x, desiredCamPos.x, 4, dt);
    this.camera.position.y = damp(this.camera.position.y, desiredCamPos.y, 4, dt);
    this.camera.position.z = damp(this.camera.position.z, desiredCamPos.z, 4, dt);

    const lookTarget = this.diver.position.clone().add(forward.clone().multiplyScalar(2));
    this.camera.lookAt(lookTarget);
  }

  _stepDiveTransition(dt) {
    this._transitionT = Math.min(1, this._transitionT + dt / 1.3);
    const t = this._transitionT;
    const startPos = new THREE.Vector3(this.boat.position.x + 2, this.boat.position.y + 2.2, this.boat.position.z + 5);
    const endPos = new THREE.Vector3(this.diver.position.x + 1.5, this._diveEndY + 0.6, this.diver.position.z + 2);
    this.camera.position.lerpVectors(startPos, endPos, t);
    this.diver.position.y = lerp(this._diveStartY, this._diveEndY, t);
    this.camera.lookAt(this.diver.position);
    if (t >= 1) this._finishDiveTransition();
  }

  _stepSurfaceTransition(dt) {
    this._transitionT = Math.min(1, this._transitionT + dt / 1.1);
    const t = this._transitionT;
    const endPos = new THREE.Vector3(this.boat.position.x + 4, this.boat.position.y + 3.2, this.boat.position.z + 8);
    this.camera.position.lerpVectors(this._transStartCamPos, endPos, t);
    this.camera.lookAt(this.boat.position);
    if (t >= 1) this._finishSurfaceTransition();
  }
}
