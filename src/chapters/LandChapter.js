import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createGradientSky, easeOutBack, Tweens } from '../core/utils.js';

const DEPTH = 0.35;
const LAND_COLORS = [0xe3cf9a, 0xd8c489, 0xc9d6a0, 0xdbb98f];

function buildLandmass(cx, cz, radius, rand, color) {
  const shape = new THREE.Shape();
  const points = 10 + Math.floor(rand() * 4);
  const outline = [];
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = radius * (0.7 + rand() * 0.5);
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
    outline.push(new THREE.Vector3(cx + x, DEPTH + 0.01, cz - y));
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(cx, 0, cz);

  return { mesh, outline, center: new THREE.Vector3(cx, DEPTH, cz), radius, visited: false };
}

export class LandChapter {
  label = 'Chapter Two — This Is You';

  constructor(renderer, hud) {
    this.renderer = renderer;
    this.hud = hud;
    this.tweens = new Tweens();
    this.visitedCount = 0;

    this.scene = new THREE.Scene();
    this.scene.add(createGradientSky({ top: '#7fb3d9', bottom: '#f4e6c8', radius: 300 }));

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    this.camera.position.set(0, 13, 15);

    this._buildLighting();
    this._buildOcean();
    this._buildLandmasses();
    this._buildPin();

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.set(0, 0.5, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 26;
    this.controls.maxPolarAngle = 1.1;
    this.controls.minPolarAngle = 0.35;
    this.controls.minAzimuthAngle = -1.1;
    this.controls.maxAzimuthAngle = 1.1;
    this.controls.enablePan = false;
    this.controls.enabled = false;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._downPos = null;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  _buildLighting() {
    const sun = new THREE.DirectionalLight(0xfff2df, 2.2);
    sun.position.set(6, 10, 4);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0x9fc7e8, 0x33291c, 0.6));
  }

  _buildOcean() {
    const geometry = new THREE.PlaneGeometry(80, 80);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x2e7fa0, roughness: 0.5 });
    this.scene.add(new THREE.Mesh(geometry, material));
  }

  _buildLandmasses() {
    let seed = 11;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const layout = [
      { cx: -5, cz: -3, r: 2.6 },
      { cx: 3, cz: -5, r: 2 },
      { cx: 6, cz: 1.5, r: 2.3 },
      { cx: -2, cz: 3, r: 1.8 },
      { cx: 1.5, cz: 6, r: 2.1 },
      { cx: -6.5, cz: 2.5, r: 1.6 },
    ];

    this.landmasses = layout.map(({ cx, cz, r }, i) => {
      const land = buildLandmass(cx, cz, r, rand, LAND_COLORS[i % LAND_COLORS.length]);
      this.scene.add(land.mesh);
      land.borderGroup = new THREE.Group();
      land.borderGroup.visible = false;
      this.scene.add(land.borderGroup);
      land.buildingsGroup = new THREE.Group();
      this.scene.add(land.buildingsGroup);
      land.rand = rand;
      return land;
    });
  }

  _buildPin() {
    const pin = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.6, 12),
      new THREE.MeshStandardMaterial({ color: 0xe0673f, roughness: 0.4 }),
    );
    stem.rotation.x = Math.PI;
    stem.position.y = 0.3;
    pin.add(stem);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xf6efe1, roughness: 0.3 }),
    );
    head.position.y = 0.66;
    pin.add(head);
    pin.visible = false;
    this.pin = pin;
    this.scene.add(pin);
  }

  _revealLand(land) {
    if (land.visited) return;
    land.visited = true;
    this.visitedCount++;

    land.borderGroup.visible = true;
    const geometry = new THREE.BufferGeometry().setFromPoints(land.outline);
    const material = new THREE.LineBasicMaterial({ color: 0xe0673f, transparent: true, opacity: 0 });
    const line = new THREE.LineLoop(geometry, material);
    land.borderGroup.add(line);
    this.tweens.add((p) => {
      material.opacity = p * 0.9;
    }, 0.6);

    const houseCount = 2 + Math.floor(land.rand() * 3);
    for (let i = 0; i < houseCount; i++) {
      const house = this._makeHouse();
      const a = land.rand() * Math.PI * 2;
      const dist = land.radius * 0.15 + land.rand() * land.radius * 0.4;
      house.position.set(
        land.center.x + Math.cos(a) * dist,
        land.center.y,
        land.center.z + Math.sin(a) * dist,
      );
      house.rotation.y = land.rand() * Math.PI * 2;
      house.scale.setScalar(0.0001);
      land.buildingsGroup.add(house);
      this.tweens.add((p) => {
        house.scale.setScalar(Math.max(0.0001, easeOutBack(p)));
      }, 0.45, { delay: i * 0.08 });
    }

    this.hud.setPrompt(`${this.visitedCount} of ${this.landmasses.length} places marked`);
    clearTimeout(this._promptTimer);
    this._promptTimer = setTimeout(() => this.hud.setPrompt(this.promptText), 1800);
  }

  _makeHouse() {
    const group = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1e3c6, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb5563c, roughness: 0.7 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.26), wallMat);
    wall.position.y = 0.11;
    group.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 0.31;
    group.add(roof);
    return group;
  }

  get promptText() {
    return 'Drag to tilt the map · tap a place to mark it';
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

    const hits = this.raycaster.intersectObjects(this.landmasses.map((l) => l.mesh));
    if (!hits.length) return;
    const hit = hits[0];
    const land = this.landmasses.find((l) => l.mesh === hit.object);

    this.pin.visible = true;
    const startY = DEPTH + 2.4;
    const targetY = DEPTH;
    this.pin.position.set(hit.point.x, startY, hit.point.z);
    this.tweens.add((p) => {
      this.pin.position.y = startY + (targetY - startY) * easeOutBack(p);
    }, 0.5);

    this._revealLand(land);
  }

  onEnter() {
    this.controls.enabled = true;
    this.hud.setLabel(this.label);
    this.hud.setPrompt(this.promptText);
    this.hud.setAction(null);
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp);
  }

  onExit() {
    this.controls.enabled = false;
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
    clearTimeout(this._promptTimer);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.controls.update();
    this.tweens.update(dt);
  }
}
