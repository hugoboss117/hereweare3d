import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createGradientSky, Tweens } from '../core/utils.js';

const CLOTHING_COLORS = [0xe0673f, 0x3d7a9e, 0xd4a53b, 0x6f9b6a, 0x9b6fa3, 0xc75c7a, 0xd98f4e, 0x5c8a99];
const SKIN_TONES = [0xe7b98f, 0xc98b5f, 0x8d5a3a, 0xf0c9a0, 0x6b4530];

const LINES = [
  'Every face here is different — and every one of them is figuring life out, just like you.',
  'Some are just arriving. Some have been here a long, long time.',
  'They speak differently, dress differently, believe different things — but underneath, they are the same.',
  'This one has a story that started somewhere far from here.',
  "Nobody has all the answers. Everybody's still learning.",
  "So many people. You'll only ever meet a few — be kind to the ones you do.",
  'Different favorite foods, different favorite songs — same wide-open curiosity.',
  "This one's new to the world too, just like you.",
];

export class PeopleChapter {
  label = 'Chapter Three — So Many People';
  promptText = 'Drag to look around · tap someone to meet them';

  constructor(renderer, hud) {
    this.renderer = renderer;
    this.hud = hud;
    this.tweens = new Tweens();
    this.clock = 0;

    this.scene = new THREE.Scene();
    this.scene.add(createGradientSky({ top: '#a9d4ec', bottom: '#f7e8c9', radius: 300 }));

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
    this.camera.position.set(0, 6, 11);

    this._buildLighting();
    this._buildPlaza();
    this._buildPeople();
    this._buildHighlight();

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.set(0, 1, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = 1.35;
    this.controls.enablePan = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.25;
    this.controls.enabled = false;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._downPos = null;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  _buildLighting() {
    const sun = new THREE.DirectionalLight(0xfff2df, 2.1);
    sun.position.set(5, 9, 4);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xa9d4ec, 0x3a3226, 0.65));
  }

  _buildPlaza() {
    const geometry = new THREE.CircleGeometry(9, 48);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0xd8cdb0, roughness: 0.95 });
    this.scene.add(new THREE.Mesh(geometry, material));
  }

  _buildHighlight() {
    const geometry = new THREE.RingGeometry(0.32, 0.4, 24);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0xe0673f,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.highlight = new THREE.Mesh(geometry, material);
    this.highlight.position.y = 0.02;
    this.scene.add(this.highlight);
  }

  _makePerson(seedRand, heightScale) {
    const group = new THREE.Group();
    const clothing = new THREE.MeshStandardMaterial({
      color: CLOTHING_COLORS[Math.floor(seedRand() * CLOTHING_COLORS.length)],
      roughness: 0.8,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: SKIN_TONES[Math.floor(seedRand() * SKIN_TONES.length)],
      roughness: 0.7,
    });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.5 * heightScale, 4, 8), clothing);
    body.position.y = 0.35 * heightScale + 0.19;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), skin);
    head.position.y = body.position.y + 0.25 * heightScale + 0.16;
    group.add(head);

    group.userData.pickMesh = body;
    group.userData.baseY = 0;
    return group;
  }

  _buildPeople() {
    let seed = 5;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const count = 30;
    this.people = [];
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = Math.sqrt(rand()) * 7.6;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const heightScale = 0.65 + rand() * 0.5;

      const person = this._makePerson(rand, heightScale);
      person.position.set(x, 0, z);
      person.rotation.y = rand() * Math.PI * 2;
      person.userData.phase = rand() * Math.PI * 2;
      person.userData.line = LINES[i % LINES.length];
      this.scene.add(person);
      this.people.push(person);
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

    const hits = this.raycaster.intersectObjects(this.people.map((p) => p.userData.pickMesh));
    if (!hits.length) return;
    const person = this.people.find((p) => p.userData.pickMesh === hits[0].object);
    this._meet(person);
  }

  _meet(person) {
    this.highlight.position.x = person.position.x;
    this.highlight.position.z = person.position.z;
    this.highlight.material.opacity = 0;
    this.tweens.add((p) => {
      this.highlight.material.opacity = Math.sin(p * Math.PI) * 0.8;
    }, 2.2);

    this.hud.setPrompt(person.userData.line);
    clearTimeout(this._promptTimer);
    this._promptTimer = setTimeout(() => this.hud.setPrompt(this.promptText), 3600);
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
    this.clock += dt;
    this.controls.update();
    this.tweens.update(dt);
    for (const person of this.people) {
      person.position.y = Math.sin(this.clock * 1.2 + person.userData.phase) * 0.03;
    }
  }
}
