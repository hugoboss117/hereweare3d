import * as THREE from 'three';
import { createGradientSky, Tweens, easeOutBack } from '../core/utils.js';
import { FPVController } from '../core/FPVController.js';

const BOUNDS = { minX: -25, maxX: 25, minZ: -25, maxZ: 25 };

const CRITTERS = [
  { kind: 'rabbit', color: 0xcdbfa8, bodyRadius: 0.16, bodyLength: 0.3, earLength: 0.24, tailLength: 0.12,
    line: 'A rabbit, nose twitching — quick, quiet, and always listening.' },
  { kind: 'fox', color: 0xd97a3a, bodyRadius: 0.17, bodyLength: 0.42, earLength: 0.16, tailLength: 0.34,
    line: 'A fox slips between the trees. This forest is its home too.' },
  { kind: 'deer', color: 0xa9825a, bodyRadius: 0.2, bodyLength: 0.5, earLength: 0.2, tailLength: 0.14,
    line: 'A deer watches you back, just as curious as you are.' },
];

function makeQuadruped({ color, bodyRadius, bodyLength, earLength, tailLength }) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(bodyRadius, bodyLength, 4, 8), mat);
  body.rotation.z = Math.PI / 2;
  body.position.y = bodyRadius + 0.14;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(bodyRadius * 0.75, 12, 10), mat);
  head.position.set(bodyLength / 2 + bodyRadius * 0.5, body.position.y + bodyRadius * 0.4, 0);
  group.add(head);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(bodyRadius * 0.22, earLength, 6), mat);
    ear.position.set(head.position.x - 0.03, head.position.y + bodyRadius * 0.6, side * bodyRadius * 0.35);
    group.add(ear);
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(bodyRadius * 0.35, tailLength, 6), mat);
  tail.rotation.z = -Math.PI / 2.4;
  tail.position.set(-bodyLength / 2 - bodyRadius * 0.3, body.position.y + bodyRadius * 0.3, 0);
  group.add(tail);

  return group;
}

function makeBird(color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat);
  body.position.y = 0.3;
  group.add(body);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xe0a13f }));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.15, 0.3, 0);
  group.add(beak);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), mat);
    wing.rotation.x = Math.PI / 2;
    wing.rotation.z = side * 0.5;
    wing.position.set(-0.02, 0.32, side * 0.12);
    group.add(wing);
  }
  return group;
}

function makeTree(rand) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4530, roughness: 0.9 });
  const height = 1.4 + rand() * 1.4;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 + rand() * 0.06, 0.16, height, 7), trunkMat);
  trunk.position.y = height / 2;
  group.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3f, roughness: 0.9 });
  const clumpCount = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < clumpCount; i++) {
    const r = 0.5 + rand() * 0.4;
    const clump = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), leafMat);
    clump.position.set((rand() - 0.5) * 0.6, height + r * 0.5, (rand() - 0.5) * 0.6);
    group.add(clump);
  }
  return group;
}

function makeSapling() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.045, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.9 }),
  );
  trunk.position.y = 0.2;
  group.add(trunk);
  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x7fc46a, roughness: 0.85 }),
  );
  leaf.position.y = 0.45;
  group.add(leaf);
  return group;
}

export class NatureChapter {
  label = 'Chapter Seven — Sharing the Earth';
  promptText = 'Drag to look, WASD to walk · tap an animal to meet it · tap the ground to plant a tree';

  constructor(renderer, hud) {
    this.renderer = renderer;
    this.hud = hud;
    this.tweens = new Tweens();
    this.clock = 0;
    this.plantedCount = 0;

    this.scene = new THREE.Scene();
    this.scene.add(createGradientSky({ top: '#8fc7a0', bottom: '#eef2c9', radius: 280 }));

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);

    this._buildLighting();
    this._buildGround();
    this._buildTrees();
    this._buildCritters();

    this.fpv = new FPVController(this.camera, renderer.domElement, { eyeHeight: 1.7, speed: 3.4, bounds: BOUNDS });
    this.fpv.setPosition(0, 8);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._downPos = null;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  _buildLighting() {
    const sun = new THREE.DirectionalLight(0xfff2df, 2.1);
    sun.position.set(6, 12, 5);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0x8fc7a0, 0x2e3a1e, 0.6));
  }

  _buildGround() {
    const geometry = new THREE.PlaneGeometry(60, 60);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x5f9350, roughness: 1 });
    this.ground = new THREE.Mesh(geometry, material);
    this.scene.add(this.ground);
  }

  _buildTrees() {
    let seed = 17;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    this.treePositions = [];
    for (let i = 0; i < 40; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 6 + rand() * 18;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const tree = makeTree(rand);
      tree.position.set(x, 0, z);
      tree.rotation.y = rand() * Math.PI * 2;
      this.scene.add(tree);
      this.treePositions.push(new THREE.Vector2(x, z));
    }
  }

  _buildCritters() {
    let seed = 29;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    this.critters = [];
    const specs = [...CRITTERS, { kind: 'bird', line: 'A little bird sings — nobody taught it the words, it just knows.' }];
    for (const spec of specs) {
      const mesh = spec.kind === 'bird' ? makeBird(0x5c8a99) : makeQuadruped(spec);
      const angle = rand() * Math.PI * 2;
      const radius = 4 + rand() * 8;
      mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      mesh.rotation.y = rand() * Math.PI * 2;
      mesh.userData.line = spec.line;
      mesh.userData.phase = rand() * Math.PI * 2;
      mesh.userData.baseY = 0;
      this.scene.add(mesh);
      this.critters.push(mesh);
    }
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

    const critterHits = this.raycaster.intersectObjects(this.critters, true);
    if (critterHits.length) {
      let root = critterHits[0].object;
      while (root.parent && !this.critters.includes(root)) root = root.parent;
      this._greetCritter(root);
      return;
    }

    const groundHits = this.raycaster.intersectObject(this.ground);
    if (groundHits.length) this._plantTree(groundHits[0].point);
  }

  _greetCritter(critter) {
    this.tweens.add((p) => {
      critter.userData.hopOffset = Math.sin(p * Math.PI) * 0.3;
    }, 0.4, { onComplete: () => { critter.userData.hopOffset = 0; } });

    this.hud.setPrompt(critter.userData.line);
    clearTimeout(this._promptTimer);
    this._promptTimer = setTimeout(() => this.hud.setPrompt(this.promptText), 3400);
  }

  _plantTree(point) {
    const sapling = makeSapling();
    sapling.position.set(point.x, 0, point.z);
    sapling.scale.setScalar(0.0001);
    this.scene.add(sapling);
    this.tweens.add((p) => {
      sapling.scale.setScalar(Math.max(0.0001, easeOutBack(p)));
    }, 0.5);

    this.plantedCount++;
    this.hud.setPrompt(`${this.plantedCount} tree${this.plantedCount === 1 ? '' : 's'} planted`);
    clearTimeout(this._promptTimer);
    this._promptTimer = setTimeout(() => this.hud.setPrompt(this.promptText), 2000);
  }

  onEnter() {
    this.hud.setLabel(this.label);
    this.hud.setPrompt(this.promptText);
    this.hud.setAction(null);
    this.fpv.enable();
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp);
  }

  onExit() {
    this.fpv.disable();
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
    clearTimeout(this._promptTimer);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.clock += dt;
    this.fpv.update(dt);
    this.tweens.update(dt);
    for (const critter of this.critters) {
      const idleBob = Math.sin(this.clock * 1.5 + critter.userData.phase) * 0.02;
      critter.position.y = critter.userData.baseY + idleBob + (critter.userData.hopOffset || 0);
    }
  }
}
