import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createStarfield, makeEarthTexture } from '../core/utils.js';

const EARTH_RADIUS = 2;
const ORBIT_SHELL_RADIUS = EARTH_RADIUS * 1.7;
const MAX_SATELLITES = 24;

export class SpaceChapter {
  label = 'Chapter One — Here We Are';
  promptText = 'Drag to look around · tap near Earth to launch a satellite';

  constructor(renderer, hud) {
    this.renderer = renderer;
    this.hud = hud;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070d);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    this.camera.position.set(0, 2.6, 8.5);

    this._buildLighting();
    this.scene.add(createStarfield({ count: 1800, radius: 350 }));
    this._buildEarth();
    this._buildAtmosphere();
    this._buildMoon();

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4.2;
    this.controls.maxDistance = 18;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.5;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.2;
    this.controls.enabled = false;

    this.orbitSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), ORBIT_SHELL_RADIUS);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.satellites = [];

    this._downPos = null;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  _buildLighting() {
    const sun = new THREE.DirectionalLight(0xfff2df, 2.2);
    sun.position.set(6, 3, 4);
    this.scene.add(sun);

    const fill = new THREE.HemisphereLight(0x3a5a8c, 0x0a0a12, 0.55);
    this.scene.add(fill);
  }

  _buildEarth() {
    const texture = makeEarthTexture({ size: 1024, seed: 42 });
    const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 48);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.earth = new THREE.Mesh(geometry, material);
    this.earth.castShadow = false;
    this.scene.add(this.earth);
  }

  _buildAtmosphere() {
    const geometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.035, 48, 32);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0x8fc5ff) },
      },
      vertexShader: /* glsl */ `
        varying float vFresnel;
        void main() {
          vec3 viewDir = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
          vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
          vFresnel = pow(1.0 - max(dot(viewDir, worldNormal), 0.0), 4.0);
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 glowColor;
        varying float vFresnel;
        void main() {
          gl_FragColor = vec4(glowColor, smoothstep(0.0, 1.0, vFresnel) * 0.35);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.scene.add(new THREE.Mesh(geometry, material));
  }

  _buildMoon() {
    this.moonPivot = new THREE.Group();
    this.moonPivot.rotation.x = 0.15;
    this.scene.add(this.moonPivot);

    const geometry = new THREE.SphereGeometry(0.42, 24, 18);
    const material = new THREE.MeshStandardMaterial({ color: 0xd9d3c8, roughness: 1 });
    const moon = new THREE.Mesh(geometry, material);
    moon.position.set(EARTH_RADIUS * 3.4, 0, 0);
    this.moonPivot.add(moon);
  }

  _makeSatellite() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe7e2d6, roughness: 0.6 });
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xe0673f,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.14), bodyMat);
    group.add(body);

    const panelGeo = new THREE.BoxGeometry(0.26, 0.01, 0.09);
    const panelL = new THREE.Mesh(panelGeo, panelMat);
    panelL.position.x = -0.2;
    const panelR = new THREE.Mesh(panelGeo, panelMat);
    panelR.position.x = 0.2;
    group.add(panelL, panelR);

    return group;
  }

  _onPointerDown(event) {
    this._downPos = { x: event.clientX, y: event.clientY };
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp);
  }

  _onPointerUp(event) {
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
    if (!this._downPos) return;
    const dx = event.clientX - this._downPos.x;
    const dy = event.clientY - this._downPos.y;
    this._downPos = null;
    // ignore drags (camera orbiting), only treat near-stationary clicks as spawn taps
    if (Math.hypot(dx, dy) > 6) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectSphere(this.orbitSphere, hit)) {
      this._spawnSatellite(hit);
    }
  }

  _spawnSatellite(point) {
    if (this.satellites.length >= MAX_SATELLITES) {
      const oldest = this.satellites.shift();
      this.scene.remove(oldest.mesh, oldest.ring);
    }

    const radius = point.length();
    const randomVec = Math.abs(point.y) < radius * 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    const axis = new THREE.Vector3().crossVectors(point, randomVec).normalize();

    const ringPoints = [];
    const segments = 72;
    for (let i = 0; i <= segments; i++) {
      const p = point.clone().applyAxisAngle(axis, (i / segments) * Math.PI * 2);
      ringPoints.push(p);
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ringMat = new THREE.LineBasicMaterial({ color: 0xe0673f, transparent: true, opacity: 0.35 });
    const ring = new THREE.LineLoop(ringGeo, ringMat);
    this.scene.add(ring);

    const mesh = this._makeSatellite();
    mesh.position.copy(point);
    this.scene.add(mesh);

    this.satellites.push({
      mesh,
      ring,
      position: point.clone(),
      axis,
      speed: 0.35 + Math.random() * 0.5,
    });

    this.hud.setPrompt(`${this.satellites.length} satellite${this.satellites.length === 1 ? '' : 's'} launched`);
    clearTimeout(this._promptTimer);
    this._promptTimer = setTimeout(() => this.hud.setPrompt(this.promptText), 1800);
  }

  onEnter() {
    this.controls.enabled = true;
    this.hud.setLabel(this.label);
    this.hud.setPrompt(this.promptText);
    this.hud.setAction(null);
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
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
    this.earth.rotation.y += dt * 0.03;
    this.moonPivot.rotation.y += dt * 0.06;

    for (const sat of this.satellites) {
      sat.position.applyAxisAngle(sat.axis, sat.speed * dt);
      sat.mesh.position.copy(sat.position);
      const tangent = new THREE.Vector3().crossVectors(sat.axis, sat.position).normalize();
      sat.mesh.lookAt(sat.mesh.position.clone().add(tangent));
    }
  }
}
