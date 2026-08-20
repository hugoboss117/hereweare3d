(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/shared/playlist.js
  var require_playlist = __commonJS({
    "src/shared/playlist.js"(exports, module) {
      var PlaylistCursor = class {
        constructor(track) {
          this.mode = track.mode;
          this.clips = track.clips;
          this._index = -1;
          this._currentClip = null;
        }
        current() {
          return this._currentClip;
        }
        next() {
          if (this.clips.length === 0) {
            throw new Error("cannot advance an empty track");
          }
          if (this.mode === "sequential-loop") {
            this._index = (this._index + 1) % this.clips.length;
            this._currentClip = this.clips[this._index];
          } else if (this.mode === "shuffle") {
            this._currentClip = this.clips[Math.floor(Math.random() * this.clips.length)];
          } else if (this.mode === "shuffle-no-repeat") {
            if (this.clips.length === 1) {
              this._currentClip = this.clips[0];
            } else {
              const candidates = this.clips.filter((c) => c !== this._currentClip);
              this._currentClip = candidates[Math.floor(Math.random() * candidates.length)];
            }
          } else {
            throw new Error(`unknown playlist mode: ${this.mode}`);
          }
          return this._currentClip;
        }
        nextSkipping(isMediaAvailable) {
          for (let attempts = 0; attempts < this.clips.length; attempts++) {
            const clip = this.next();
            if (isMediaAvailable(clip)) return clip;
          }
          throw new Error("no available clips in track");
        }
      };
      module.exports = { PlaylistCursor };
    }
  });

  // src/shared/transition.js
  var require_transition = __commonJS({
    "src/shared/transition.js"(exports, module) {
      function computeCrossfadeOpacities(elapsedMs, durationMs) {
        if (durationMs <= 0) {
          return { outgoing: 0, incoming: 1 };
        }
        const progress = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
        return { outgoing: 1 - progress, incoming: progress };
      }
      module.exports = { computeCrossfadeOpacities };
    }
  });

  // src/renderer/player/shaders.js
  var require_shaders = __commonJS({
    "src/renderer/player/shaders.js"(exports, module) {
      var VERTEX_SHADER = `
  attribute vec2 position;
  varying vec2 uv;
  uniform vec2 scale;
  void main() {
    uv = (position + 1.0) / 2.0;
    gl_Position = vec4(position * scale, 0, 1);
  }
`;
      var ADJUST_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 uv;
  uniform sampler2D videoTexture;
  uniform float brightness;
  uniform float contrast;
  uniform float saturation;
  uniform float opacity;
  void main() {
    vec4 color = texture2D(videoTexture, vec2(uv.x, 1.0 - uv.y));
    color.rgb += brightness;
    color.rgb = (color.rgb - 0.5) * contrast + 0.5;
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, saturation);
    gl_FragColor = vec4(color.rgb, opacity);
  }
`;
      var PARTICLES_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 uv;
  uniform float time;
  uniform float density;
  uniform vec3 color;
  float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
  void main() {
    vec2 grid = floor(uv * density);
    float twinkle = rand(grid + floor(time));
    float dot = step(0.97, twinkle);
    gl_FragColor = vec4(color, dot * 0.8);
  }
`;
      var COLORWASH_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 uv;
  uniform float time;
  uniform vec3 color;
  uniform float intensity;
  void main() {
    float wave = 0.5 + 0.5 * sin(time * 0.5 + uv.y * 3.14159);
    gl_FragColor = vec4(color, wave * intensity);
  }
`;
      var NOISE_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 uv;
  uniform float time;
  uniform float intensity;
  float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
  void main() {
    float n = rand(uv * 500.0 + time);
    gl_FragColor = vec4(vec3(n), intensity);
  }
`;
      module.exports = {
        VERTEX_SHADER,
        ADJUST_FRAGMENT_SHADER,
        PARTICLES_FRAGMENT_SHADER,
        COLORWASH_FRAGMENT_SHADER,
        NOISE_FRAGMENT_SHADER
      };
    }
  });

  // src/renderer/player/effectsEngine.js
  var require_effectsEngine = __commonJS({
    "src/renderer/player/effectsEngine.js"(exports, module) {
      var {
        VERTEX_SHADER,
        ADJUST_FRAGMENT_SHADER,
        PARTICLES_FRAGMENT_SHADER,
        COLORWASH_FRAGMENT_SHADER,
        NOISE_FRAGMENT_SHADER
      } = require_shaders();
      function compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(`shader compile error: ${gl.getShaderInfoLog(shader)}`);
        }
        return shader;
      }
      function createProgram(gl, vertexSource, fragmentSource) {
        const program = gl.createProgram();
        gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
        gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error(`program link error: ${gl.getProgramInfoLog(program)}`);
        }
        return program;
      }
      function initEffectsEngine(canvas) {
        const gl = canvas.getContext("webgl");
        const adjustProgram = createProgram(gl, VERTEX_SHADER, ADJUST_FRAGMENT_SHADER);
        const particlesProgram = createProgram(gl, VERTEX_SHADER, PARTICLES_FRAGMENT_SHADER);
        const colorwashProgram = createProgram(gl, VERTEX_SHADER, COLORWASH_FRAGMENT_SHADER);
        const noiseProgram = createProgram(gl, VERTEX_SHADER, NOISE_FRAGMENT_SHADER);
        const generativePrograms = { particles: particlesProgram, colorwash: colorwashProgram, noise: noiseProgram };
        const quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const videoTexture = gl.createTexture();
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        const startTime = performance.now();
        function drawQuad(program) {
          gl.useProgram(program);
          const positionLoc = gl.getAttribLocation(program, "position");
          gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
          gl.enableVertexAttribArray(positionLoc);
          gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        function renderGenerative(effect) {
          const program = generativePrograms[effect.type];
          if (!program) return;
          const p = Object.assign({ density: 40, intensity: 0.3, color: [1, 1, 1] }, effect.params);
          gl.useProgram(program);
          gl.uniform1f(gl.getUniformLocation(program, "time"), (performance.now() - startTime) / 1e3);
          gl.uniform2f(gl.getUniformLocation(program, "scale"), 1, 1);
          if ("density" in p) gl.uniform1f(gl.getUniformLocation(program, "density"), p.density);
          if ("intensity" in p) gl.uniform1f(gl.getUniformLocation(program, "intensity"), p.intensity);
          if ("color" in p) gl.uniform3fv(gl.getUniformLocation(program, "color"), p.color);
          drawQuad(program);
        }
        function renderFrame(videoEl, effectInstances) {
          const displayWidth = canvas.clientWidth || canvas.width || 1;
          const displayHeight = canvas.clientHeight || canvas.height || 1;
          if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
          }
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.bindTexture(gl.TEXTURE_2D, videoTexture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          const videoWidth = videoEl.videoWidth || 1;
          const videoHeight = videoEl.videoHeight || 1;
          const canvasAspect = canvas.width / canvas.height;
          const videoAspect = videoWidth / videoHeight;
          let scaleX = 1;
          let scaleY = 1;
          if (videoAspect > canvasAspect) {
            scaleY = canvasAspect / videoAspect;
          } else {
            scaleX = videoAspect / canvasAspect;
          }
          const adjust = effectInstances.find((e) => e.type === "adjust") || { params: {} };
          const p = Object.assign({ brightness: 0, contrast: 1, saturation: 1, opacity: 1 }, adjust.params);
          gl.useProgram(adjustProgram);
          gl.uniform1f(gl.getUniformLocation(adjustProgram, "brightness"), p.brightness);
          gl.uniform1f(gl.getUniformLocation(adjustProgram, "contrast"), p.contrast);
          gl.uniform1f(gl.getUniformLocation(adjustProgram, "saturation"), p.saturation);
          gl.uniform1f(gl.getUniformLocation(adjustProgram, "opacity"), p.opacity);
          gl.uniform1i(gl.getUniformLocation(adjustProgram, "videoTexture"), 0);
          gl.uniform2f(gl.getUniformLocation(adjustProgram, "scale"), scaleX, scaleY);
          drawQuad(adjustProgram);
          for (const effect of effectInstances) {
            if (effect.type !== "adjust") renderGenerative(effect);
          }
        }
        return { renderFrame };
      }
      module.exports = { initEffectsEngine };
    }
  });

  // src/renderer/shared/playbackEngine.js
  var require_playbackEngine = __commonJS({
    "src/renderer/shared/playbackEngine.js"(exports, module) {
      var { PlaylistCursor } = require_playlist();
      var { computeCrossfadeOpacities } = require_transition();
      var { initEffectsEngine } = require_effectsEngine();
      function initPlaybackEngine2({ videoA: initialVideoA, videoB: initialVideoB, ambientAudioEl, canvas }) {
        let videoA = initialVideoA;
        let videoB = initialVideoB;
        let activeVideo = videoA;
        let hiddenVideo = videoB;
        let mediaPoolById = {};
        let effectsById = {};
        let cursor = null;
        let transitionStart = null;
        let transitionDuration = 0;
        let pendingClip = null;
        let preloadTargetElement = null;
        let currentActiveClip = null;
        let activeEffectInstances = [];
        const effectsEngine = initEffectsEngine(canvas);
        videoA.style.visibility = "hidden";
        videoB.style.visibility = "hidden";
        ambientAudioEl.addEventListener("error", () => {
          const mediaError = ambientAudioEl.error;
          console.warn(
            "ambient audio failed to load",
            mediaError ? `(code ${mediaError.code}: ${mediaError.message})` : ""
          );
        });
        function mediaPathFor(clip) {
          return mediaPoolById[clip.mediaId].path;
        }
        function applyVolume(videoEl, clip) {
          const media = mediaPoolById[clip.mediaId];
          videoEl.muted = Boolean(media.muted);
          videoEl.volume = media.volume;
        }
        function startClip(videoEl, clip) {
          videoEl.src = mediaPathFor(clip);
          videoEl.currentTime = clip.inPoint;
          applyVolume(videoEl, clip);
          videoEl.load();
          videoEl.play().catch(() => {
          });
        }
        function preloadHiddenVideo(clip) {
          preloadTargetElement = hiddenVideo;
          startClip(hiddenVideo, clip);
          hiddenVideo.style.opacity = "0";
          pendingClip = clip;
        }
        function preloadHiddenVideoSkippingMissing() {
          const clip = cursor.nextSkipping(() => true);
          preloadHiddenVideo(clip);
        }
        function logMediaError(event, failedClip) {
          const mediaError = event.target.error;
          const media = failedClip && mediaPoolById[failedClip.mediaId];
          console.warn(
            `media failed to load for clip ${failedClip && failedClip.id} (${media ? media.path : "unknown path"}), skipping`,
            mediaError ? `(code ${mediaError.code}: ${mediaError.message})` : ""
          );
        }
        function handleVideoError(event) {
          if (event.target === activeVideo) {
            logMediaError(event, currentActiveClip);
            pendingClip = null;
            preloadTargetElement = null;
            transitionStart = null;
            const nextClip = cursor.nextSkipping(() => true);
            currentActiveClip = nextClip;
            activeEffectInstances = nextClip.effectIds.map((id) => effectsById[id]).filter(Boolean);
            startClip(activeVideo, nextClip);
            return;
          }
          if (event.target !== preloadTargetElement) return;
          logMediaError(event, pendingClip);
          pendingClip = null;
          preloadTargetElement = null;
          preloadHiddenVideoSkippingMissing();
        }
        videoA.addEventListener("error", handleVideoError);
        videoB.addEventListener("error", handleVideoError);
        function startTransition(clip) {
          transitionDuration = clip.transition.duration;
          transitionStart = performance.now();
        }
        function swapActiveHidden() {
          const tmp = activeVideo;
          activeVideo = hiddenVideo;
          hiddenVideo = tmp;
        }
        function tick() {
          try {
            const activeClip = currentActiveClip;
            const videoEnded = Boolean(activeClip && activeVideo.ended);
            const reachedOutPoint = Boolean(activeClip && activeVideo.currentTime >= activeClip.outPoint);
            const preloadLeadSeconds = activeClip ? Math.max(activeClip.transition.duration, 300) / 1e3 : 0;
            if (activeClip && !pendingClip && (videoEnded || activeVideo.currentTime >= activeClip.outPoint - preloadLeadSeconds)) {
              preloadHiddenVideoSkippingMissing();
            }
            if (activeClip && (reachedOutPoint || videoEnded) && pendingClip) {
              if (transitionStart === null) startTransition(pendingClip);
              const elapsed = performance.now() - transitionStart;
              const { outgoing, incoming } = computeCrossfadeOpacities(elapsed, transitionDuration);
              activeVideo.style.opacity = String(outgoing);
              hiddenVideo.style.opacity = String(incoming);
              if (elapsed >= transitionDuration || videoEnded) {
                activeVideo.pause();
                const newActiveClip = pendingClip;
                currentActiveClip = newActiveClip;
                swapActiveHidden();
                activeVideo.style.opacity = "1";
                hiddenVideo.style.opacity = "0";
                transitionStart = null;
                pendingClip = null;
                activeEffectInstances = newActiveClip.effectIds.map((id) => effectsById[id]).filter(Boolean);
              }
            }
            effectsEngine.renderFrame(activeVideo, activeEffectInstances);
          } catch (err) {
            console.error("tick() frame error, continuing playback:", err);
          }
          requestAnimationFrame(tick);
        }
        function getActiveVideoElement() {
          return activeVideo;
        }
        function loadTrack({ track, mediaPool, effects }) {
          mediaPoolById = Object.fromEntries(mediaPool.map((m) => [m.id, m]));
          effectsById = Object.fromEntries(effects.map((e) => [e.id, e]));
          if (!track.clips || track.clips.length === 0) {
            console.warn(`track ${track.id} has no clips, nothing to play`);
            return;
          }
          if (track.ambientAudio) {
            ambientAudioEl.src = track.ambientAudio.path;
            ambientAudioEl.volume = track.ambientAudio.volume;
            ambientAudioEl.play().catch((err) => {
              console.warn(`ambient audio failed to play for track ${track.id}:`, err && err.message);
            });
          } else {
            ambientAudioEl.removeAttribute("src");
          }
          cursor = new PlaylistCursor(track);
          const firstClip = cursor.next();
          currentActiveClip = firstClip;
          activeEffectInstances = firstClip.effectIds.map((id) => effectsById[id]).filter(Boolean);
          startClip(activeVideo, firstClip);
          activeVideo.style.opacity = "1";
          hiddenVideo.style.opacity = "0";
          requestAnimationFrame(tick);
        }
        return { loadTrack, getActiveVideoElement };
      }
      module.exports = { initPlaybackEngine: initPlaybackEngine2 };
    }
  });

  // src/renderer/webplayer/player.js
  var { initPlaybackEngine } = require_playbackEngine();
  var engine = initPlaybackEngine({
    videoA: document.getElementById("videoA"),
    videoB: document.getElementById("videoB"),
    ambientAudioEl: document.getElementById("ambientAudioEl"),
    canvas: document.getElementById("compositeCanvas")
  });
  window.getActiveVideoElement = engine.getActiveVideoElement;
  engine.loadTrack(window.SHOW_DATA);
  var startOverlay = document.getElementById("startOverlay");
  setTimeout(() => {
    if (engine.getActiveVideoElement().paused) {
      startOverlay.style.display = "flex";
    }
  }, 500);
  function requestFullscreenCompat(el) {
    try {
      const request = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (request) {
        const result = request.call(el);
        if (result && result.catch) result.catch(() => {
        });
      }
    } catch (err) {
    }
  }
  startOverlay.addEventListener("click", () => {
    startOverlay.style.display = "none";
    engine.getActiveVideoElement().play().catch(() => {
    });
    requestFullscreenCompat(document.documentElement);
  });
})();
