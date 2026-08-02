import * as THREE from 'three';
import { createGradientSky, createStarfield, damp, clamp } from '../core/utils.js';
import { FPVController } from '../core/FPVController.js';

const BOUNDS = { minX: -22, maxX: 22, minZ: -22, maxZ: 22 };

export class SkyChapter {
  label = 'Chapter Five — Sun, Clouds and Sky';

  constructor(renderer, hud) {
    this.renderer = renderer;
    this.hud = hud;
    this.dayFactor = 1;
    this.dayFactorTarget = 1;
    this.raining = false;
    this.rainTimer = 0;
    this.constellationOrder = [];

    this.scene = new THREE.Scene();
    this.sky = createGradientSky({ top: '#7fc4e8', bottom: '#eaf3d8', radius: 280 });
    this.scene.add(this.sky);
    this.stars = createStarfield({ count: 900, radius: 240 });
    this.stars.material.opacity = 0;
    this.scene.add(this.stars);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);

    this._buildLighting();
    this._buildGround();
    this._buildClouds();
    this._buildConstellation();
    this._buildRain();

    this.fpv = new FPVController(this.camera, renderer.domElement, { eyeHeight: 1.7, speed: 3.4, bounds: BOUNDS });
    this.fpv.setPosition(0, 6);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._downPos = null;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  _buildLighting() {
    this.sun = new THREE.DirectionalLight(0xfff2df, 2.2);
    this.sun.position.set(8, 14, 6);
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0x9fd0ec, 0x3a4a2a, 0.65);
    this.scene.add(this.hemi);
  }

  _buildGround() {
    const geometry = new THREE.PlaneGeometry(60, 60, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x7fb35a, roughness: 1 });
    this.scene.add(new THREE.Mesh(geometry, this.groundMat));

    const bladeGeo = new THREE.ConeGeometry(0.035, 0.34, 3);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x6da34a, roughness: 1 });
    const count = 2200;
    this.blades = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
    const dummy = new THREE.Object3D();
    let seed = 3;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < count; i++) {
      dummy.position.set((rand() - 0.5) * 44, 0.17, (rand() - 0.5) * 44);
      dummy.rotation.y = rand() * Math.PI * 2;
      dummy.scale.setScalar(0.7 + rand() * 0.7);
      dummy.updateMatrix();
      this.blades.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(this.blades);
  }

  _buildClouds() {
    let seed = 21;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rand() * 3);
      for (let p = 0; p < puffs; p++) {
        const r = 1 + rand() * 1.2;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), material);
        puff.position.set((rand() - 0.5) * 3, (rand() - 0.5) * 0.6, (rand() - 0.5) * 1.5);
        cloud.add(puff);
      }
      cloud.position.set((rand() - 0.5) * 44, 10 + rand() * 6, (rand() - 0.5) * 30 - 8);
      cloud.userData.speed = 0.4 + rand() * 0.5;
      cloud.userData.pickRadius = 2.6;
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  _buildConstellation() {
    // Fixed backdrop positions high overhead so they read as a night sky
    // pattern the player can trace, regardless of where they're walking.
    const positions = [
      [-16, 26, -34],
      [-8, 32, -36],
      [0, 27, -35],
      [9, 34, -37],
      [16, 24, -33],
    ];
    const material = new THREE.MeshBasicMaterial({ color: 0xcdd8ee });
    this.constellationStars = positions.map(([x, y, z]) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), material.clone());
      mesh.position.set(x, y, z);
      mesh.visible = false;
      this.scene.add(mesh);
      return mesh;
    });
    this.constellationLines = new THREE.Group();
    this.scene.add(this.constellationLines);
  }

  _buildRain() {
    const count = 400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = Math.random() * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xaecbe8,
      size: 0.05,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rain = new THREE.Points(geometry, material);
    this.scene.add(this.rain);
  }

  get promptText() {
    return 'Drag to look, WASD to walk · tap a cloud for rain · Night to see stars';
  }

  _onPointerDown(event) {
    this._downPos = { x: event.clientX, y: event.clientY };
  }

  _onPointerUp(event) {
    if (!this._downPos) return;
    const dx = event.clientX - this._downPos.x;
    const dy = event.clientY - this._downPos.y;
    this._downPos = null;
    if (Math.hypot(dx, dy) > 6) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    if (this.dayFactor < 0.5) {
      const starHits = this.raycaster.intersectObjects(this.constellationStars);
      if (starHits.length) {
        this._tapStar(starHits[0].object);
        return;
      }
    }

    const cloudHits = this.raycaster.intersectObjects(this.clouds, true);
    if (cloudHits.length) {
      this.raining = true;
      this.rainTimer = 6;
      this.hud.setPrompt('It starts to rain…');
    }
  }

  _tapStar(mesh) {
    if (this.constellationOrder.includes(mesh)) return;
    mesh.material.color.set(0xfff4d0);
    if (this.constellationOrder.length > 0) {
      const prev = this.constellationOrder[this.constellationOrder.length - 1];
      const geometry = new THREE.BufferGeometry().setFromPoints([prev.position, mesh.position]);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xfff4d0 }));
      this.constellationLines.add(line);
    }
    this.constellationOrder.push(mesh);
    if (this.constellationOrder.length === this.constellationStars.length) {
      this.hud.setPrompt('You drew a constellation of your own');
      setTimeout(() => this._resetConstellation(), 3200);
    }
  }

  _resetConstellation() {
    this.constellationOrder = [];
    for (const mesh of this.constellationStars) mesh.material.color.set(0xcdd8ee);
    while (this.constellationLines.children.length) {
      this.constellationLines.remove(this.constellationLines.children[0]);
    }
    if (this.dayFactor < 0.5) this.hud.setPrompt(this.promptText);
  }

  toggleNight() {
    this.dayFactorTarget = this.dayFactorTarget > 0.5 ? 0 : 1;
    this.hud.setAction(this.dayFactorTarget > 0.5 ? 'Turn to Night' : 'Turn to Day', () => this.toggleNight());
  }

  onEnter() {
    this.hud.setLabel(this.label);
    this.hud.setPrompt(this.promptText);
    this.hud.setAction(this.dayFactorTarget > 0.5 ? 'Turn to Night' : 'Turn to Day', () => this.toggleNight());
    this.fpv.enable();
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp);
  }

  onExit() {
    this.fpv.disable();
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt, elapsed) {
    this.fpv.update(dt);

    this.dayFactor = damp(this.dayFactor, this.dayFactorTarget, 2, dt);
    const topDay = new THREE.Color(0x7fc4e8);
    const topNight = new THREE.Color(0x0a1230);
    const bottomDay = new THREE.Color(0xeaf3d8);
    const bottomNight = new THREE.Color(0x141a2e);
    this.sky.material.uniforms.topColor.value.copy(topNight.clone().lerp(topDay, this.dayFactor));
    this.sky.material.uniforms.bottomColor.value.copy(bottomNight.clone().lerp(bottomDay, this.dayFactor));
    this.stars.material.opacity = 1 - this.dayFactor;
    for (const mesh of this.constellationStars) mesh.visible = this.dayFactor < 0.6;
    this.constellationLines.visible = this.dayFactor < 0.6;
    this.sun.intensity = 0.15 + this.dayFactor * 2.1;
    this.hemi.intensity = 0.2 + this.dayFactor * 0.55;

    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 24) cloud.position.x = -24;
    }

    if (this.raining) {
      this.rainTimer -= dt;
      if (this.rainTimer <= 0) {
        this.raining = false;
        this.hud.setPrompt(this.promptText);
      }
    }
    const targetOpacity = this.raining ? 0.55 : 0;
    this.rain.material.opacity = damp(this.rain.material.opacity, targetOpacity, 4, dt);
    if (this.rain.material.opacity > 0.01) {
      const pos = this.rain.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 9;
        if (y < 0) y = 16 + Math.random() * 2;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  }
}
