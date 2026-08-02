import * as THREE from 'three';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.chapters = new Map();
    this.active = null;
    this.clock = new THREE.Clock();

    window.addEventListener('resize', () => this._resize());
    this._resize();
  }

  register(id, chapter) {
    this.chapters.set(id, chapter);
  }

  setActive(id) {
    const next = this.chapters.get(id);
    if (!next || next === this.active) return;

    if (this.active?.onExit) this.active.onExit();
    this.active = next;
    this.activeId = id;
    if (this.active.resize) this.active.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    if (this.active.onEnter) this.active.onEnter();
  }

  _resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    for (const chapter of this.chapters.values()) {
      if (chapter.resize) chapter.resize(width, height);
    }
  }

  start() {
    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(this.clock.getDelta(), 1 / 30);
      const elapsed = this.clock.elapsedTime;
      if (this.active) {
        this.active.update?.(dt, elapsed);
        this.renderer.render(this.active.scene, this.active.camera);
      }
    };
    tick();
  }
}
