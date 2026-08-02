import * as THREE from 'three';
import { clamp } from './utils.js';

const LOOK_SENSITIVITY = 0.0032;
const PITCH_LIMIT = 1.3;

/** Shared first-person ground-walk controller: drag to look, WASD/arrows to move. */
export class FPVController {
  constructor(camera, domElement, { eyeHeight = 1.7, speed = 3.2, bounds = null } = {}) {
    this.camera = camera;
    this.domElement = domElement;
    this.eyeHeight = eyeHeight;
    this.speed = speed;
    this.bounds = bounds;

    this.position = new THREE.Vector3(0, eyeHeight, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.look = null;
    this.enabled = false;

    this._onKeyDown = (e) => this.keys.add(e.code);
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onPointerDown = (e) => {
      this.look = { x: e.clientX, y: e.clientY };
    };
    this._onPointerMove = (e) => {
      if (!this.look) return;
      const dx = e.clientX - this.look.x;
      const dy = e.clientY - this.look.y;
      this.look = { x: e.clientX, y: e.clientY };
      this.yaw -= dx * LOOK_SENSITIVITY;
      this.pitch = clamp(this.pitch - dy * LOOK_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT);
    };
    this._onPointerUp = () => {
      this.look = null;
    };
  }

  setPosition(x, z) {
    this.position.set(x, this.eyeHeight, z);
  }

  enable() {
    this.enabled = true;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.domElement.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  disable() {
    this.enabled = false;
    this.keys.clear();
    this.look = null;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
  }

  update(dt) {
    if (!this.enabled) return;

    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawQuat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQuat);

    const move = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(this.speed * dt);
    this.position.add(move);

    if (this.bounds) {
      this.position.x = clamp(this.position.x, this.bounds.minX, this.bounds.maxX);
      this.position.z = clamp(this.position.z, this.bounds.minZ, this.bounds.maxZ);
    }

    this.camera.position.copy(this.position);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }
}
