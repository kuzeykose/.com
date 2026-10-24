/**
 * InterrogationSound.js
 * Event-driven ambient sound library for detective/interrogation scenes.
 *
 * Usage:
 *   const scene = new InterrogationSound({ volume: 0.8 });
 *   scene.play();
 *   scene.setLayer('cello', 70);
 *   scene.setMood('breaking');
 *   scene.setTension(85);
 *   scene.on('event', e => console.log(e.label));
 *   scene.stop();
 *
 * Public API:
 *   play()                       — start all active layers
 *   stop()                       — stop everything, reset state
 *   pause() / resume()           — pause/resume Web Audio context
 *   setLayer(id, volume 0–100)   — adjust a layer volume live
 *   toggleLayer(id, bool?)       — enable/disable a layer live
 *   setMood(id)                  — crossfade to a mood preset
 *   setTension(0–100)            — set global tension (affects timing/pitch)
 *   escalate(amount?)            — bump tension by amount (default 20)
 *   setVolume(0–100)             — master volume
 *   trigger(layerId)             — manually fire a one-shot event layer
 *   on(event, fn)                — subscribe to events
 *   off(event, fn)               — unsubscribe
 *   getState()                   — returns snapshot of current state
 *   getLayers()                  — returns layer definitions
 *   getMoods()                   — returns mood presets
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.InterrogationSound = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /* ─── Constants ─────────────────────────────────────────────── */

  const LAYER_DEFS = [
    { id: 'drone', label: 'Deep Drone', type: 'continuous', defaultVol: 60 },
    { id: 'room', label: 'Room Tone', type: 'continuous', defaultVol: 55 },
    { id: 'rain', label: 'Soft Rain', type: 'continuous', defaultVol: 14 },
    { id: 'air', label: 'Air Hiss', type: 'continuous', defaultVol: 28 },
    { id: 'cello', label: 'Low Cello', type: 'continuous', defaultVol: 35 },
    { id: 'organ', label: 'Harmonium Pad', type: 'continuous', defaultVol: 24 },
    { id: 'rumble', label: 'Sub Rumble', type: 'continuous', defaultVol: 28 },
    { id: 'pulse', label: 'Pulse Synth', type: 'periodic', defaultVol: 22 },
    { id: 'string', label: 'String Scrape', type: 'periodic', defaultVol: 45 },
    { id: 'piano', label: 'Sparse Piano', type: 'periodic', defaultVol: 40 },
    { id: 'clock', label: 'Heartbeat', type: 'periodic', defaultVol: 38 },
    { id: 'radio', label: 'Radio Static', type: 'periodic', defaultVol: 25 },
    { id: 'glass', label: 'Glass Hit', type: 'sparse', defaultVol: 20 },
    { id: 'metal', label: 'Metal Clang', type: 'sparse', defaultVol: 16 },
    { id: 'chair', label: 'Chair Creak', type: 'sparse', defaultVol: 15 },
    { id: 'slam', label: 'Desk Slam', type: 'sparse', defaultVol: 18 },
  ];

  const MOODS = {
    tense: {
      drone: 60,
      room: 48,
      rain: 10,
      air: 12,
      cello: 40,
      organ: 26,
      rumble: 30,
      pulse: 18,
      string: 55,
      piano: 30,
      clock: 45,
      radio: 14,
      glass: 15,
      metal: 12,
      chair: 18,
      slam: 20,
    },
    cold: {
      drone: 35,
      room: 62,
      rain: 14,
      air: 16,
      cello: 25,
      organ: 30,
      rumble: 10,
      pulse: 8,
      string: 20,
      piano: 60,
      clock: 20,
      radio: 8,
      glass: 25,
      metal: 8,
      chair: 8,
      slam: 12,
    },
    breaking: {
      drone: 75,
      room: 30,
      rain: 8,
      air: 10,
      cello: 60,
      organ: 18,
      rumble: 75,
      pulse: 38,
      string: 80,
      piano: 10,
      clock: 70,
      radio: 22,
      glass: 30,
      metal: 30,
      chair: 25,
      slam: 45,
    },
    reveal: {
      drone: 40,
      room: 42,
      rain: 9,
      air: 10,
      cello: 30,
      organ: 42,
      rumble: 15,
      pulse: 12,
      string: 25,
      piano: 80,
      clock: 15,
      radio: 4,
      glass: 40,
      metal: 10,
      chair: 5,
      slam: 10,
    },
    silent: {
      drone: 20,
      room: 68,
      rain: 16,
      air: 14,
      cello: 15,
      organ: 20,
      rumble: 8,
      pulse: 6,
      string: 10,
      piano: 20,
      clock: 10,
      radio: 20,
      glass: 10,
      metal: 6,
      chair: 30,
      slam: 8,
    },
  };

  const INTERROGATION_MODS = {
    calm: { tensionBoost: 0, deltas: {} },
    excited: {
      tensionBoost: 62,
      deltas: {
        clock: 60,
        pulse: 58,
        string: 40,
        radio: 14,
        drone: 18,
        air: -10,
        rumble: 18,
        room: -24,
        piano: -24,
        organ: -10,
        slam: 22,
        metal: 12,
      },
    },
    afraid: {
      tensionBoost: 58,
      deltas: {
        drone: 48,
        rumble: 62,
        air: 12,
        organ: 24,
        string: 44,
        pulse: 22,
        radio: 16,
        clock: 34,
        room: -34,
        piano: -26,
        chair: 44,
        slam: 52,
        metal: 40,
      },
    },
    both: {
      tensionBoost: 85,
      deltas: {
        clock: 70,
        pulse: 70,
        string: 56,
        drone: 54,
        rumble: 70,
        air: 10,
        organ: 16,
        radio: 20,
        room: -40,
        piano: -30,
        glass: 24,
        metal: 50,
        chair: 56,
        slam: 66,
      },
    },
  };

  const EVENT_TRIGGER_MAP = {
    chair_creak: 'chair',
    file_slam: 'slam',
    door_creak: 'metal',
    radio_burst: 'radio',
    glass_clink: 'glass',
    breath: 'clock',
    photo_drop: 'slam',
  };

  const SCENE_EVENTS = [
    { id: 'chair_creak', label: 'Sandalye gıcırdadı' },
    { id: 'door_creak', label: 'Kapı gıcırdadı' },
    { id: 'file_slam', label: 'Dosya masaya vuruldu' },
    { id: 'long_silence', label: 'Uzun bir sessizlik çöktü' },
    { id: 'radio_burst', label: 'Telsizden parazit geldi' },
    { id: 'glass_clink', label: 'Cam bir ses duyuldu' },
    { id: 'footstep', label: 'Ayak sesi koridorda' },
    { id: 'breath', label: 'Nefes hızlandı' },
    { id: 'lamp_flicker', label: 'Sorgu lambası sallandı' },
    { id: 'photo_drop', label: 'Fotoğraf masaya bırakıldı' },
  ];

  const RAMP_TIME = 0.6; // seconds for crossfades

  /* ─── Main Class ─────────────────────────────────────────────── */

  class InterrogationSound {
    constructor(options = {}) {
      this._opts = Object.assign(
        { volume: 0.75, mood: 'tense', tension: 0, autoEvents: true, eventInterval: [4000, 12000] },
        options
      );

      this._AC = null;
      this._master = null;
      this._analyser = null;
      this._modHigh = null;
      this._modLow = null;
      this._modTone = null;
      this._modOut = null;

      this._vol = {}; // current volume per layer (0–100)
      this._baseVol = {}; // base layer volume before state modifiers
      this._enabled = {}; // layer on/off
      this._nodes = {}; // live audio nodes per layer

      this._tension = this._opts.tension;
      this._manualTension = this._opts.tension;
      this._mood = this._opts.mood;
      this._modState = { id: 'calm', intensity: 0 };
      this._playing = false;
      this._paused = false;

      this._listeners = {}; // event → Set<fn>
      this._eventTimer = null;

      // Seed volumes from default mood
      LAYER_DEFS.forEach((l) => {
        this._vol[l.id] = l.defaultVol;
        this._baseVol[l.id] = l.defaultVol;
        this._enabled[l.id] = true;
      });
      if (MOODS[this._mood]) {
        Object.assign(this._baseVol, MOODS[this._mood]);
      }
      Object.assign(this._vol, this._baseVol);
    }

    /* ── Event emitter ──────────────────────────────────────────── */

    on(event, fn) {
      if (!this._listeners[event]) this._listeners[event] = new Set();
      this._listeners[event].add(fn);
      return this;
    }

    off(event, fn) {
      this._listeners[event]?.delete(fn);
      return this;
    }

    _emit(event, data = {}) {
      this._listeners[event]?.forEach((fn) => {
        try {
          fn({ type: event, ...data });
        } catch (e) {}
      });
    }

    /* ── Lifecycle ──────────────────────────────────────────────── */

    play() {
      this._initAC();
      this._ensureAudioRunning();
      if (this._playing) return this;
      this._playing = true;
      this._paused = false;

      LAYER_DEFS.forEach((l) => {
        if (this._enabled[l.id]) this._startLayer(l.id);
      });

      if (this._opts.autoEvents) this._scheduleEvent();
      this._emit('play', { mood: this._mood, tension: this._tension });
      return this;
    }

    stop() {
      this._playing = false;
      this._paused = false;
      clearTimeout(this._eventTimer);

      Object.keys(this._nodes).forEach((id) => this._stopLayerNodes(id));
      this._nodes = {};

      this._emit('stop');
      return this;
    }

    pause() {
      if (!this._playing || this._paused) return this;
      this._AC?.suspend();
      this._paused = true;
      this._emit('pause');
      return this;
    }

    resume() {
      if (!this._paused) return this;
      this._ensureAudioRunning();
      this._paused = false;
      this._emit('resume');
      return this;
    }

    /* ── Public Controls ────────────────────────────────────────── */

    /**
     * Set a single layer's volume (0–100).
     * Works whether playing or not — takes effect immediately when live.
     */
    setLayer(id, volume) {
      if (!this._vol.hasOwnProperty(id)) {
        console.warn(`InterrogationSound: unknown layer "${id}"`);
        return this;
      }
      const v = Math.max(0, Math.min(100, volume));
      this._baseVol[id] = v;
      this._applyModMix();
      this._emit('layerChange', { id, volume: v });
      return this;
    }

    /**
     * Enable or disable a layer. Pass boolean or omit to toggle.
     */
    toggleLayer(id, enabled) {
      if (!this._vol.hasOwnProperty(id)) return this;
      const on = enabled !== undefined ? !!enabled : !this._enabled[id];
      this._enabled[id] = on;

      if (!on && this._nodes[id]) {
        this._stopLayerNodes(id);
        delete this._nodes[id];
      } else if (on && this._playing && !this._nodes[id]) {
        this._startLayer(id);
      }
      this._emit('layerToggle', { id, enabled: on });
      return this;
    }

    /**
     * Crossfade all layers to a mood preset.
     * @param {string} id — 'tense' | 'cold' | 'breaking' | 'reveal' | 'silent'
     */
    setMood(id) {
      if (!MOODS[id]) {
        console.warn(`InterrogationSound: unknown mood "${id}"`);
        return this;
      }
      const prev = this._mood;
      this._mood = id;
      const preset = MOODS[id];
      Object.assign(this._baseVol, preset);
      this._applyModMix();

      this._emit('moodChange', { from: prev, to: id, volumes: { ...preset } });
      return this;
    }

    /**
     * Set tension 0–100. Affects heartbeat BPM, string interval, pitch wobble.
     */
    setTension(value) {
      this._manualTension = Math.max(0, Math.min(100, value));
      this._applyModMix();
      return this;
    }

    /**
     * Increase tension by `amount` (default 20), capped at 100.
     */
    escalate(amount = 20) {
      return this.setTension(this._manualTension + amount);
    }

    /**
     * Set master volume (0–100).
     */
    setVolume(v) {
      const vol = Math.max(0, Math.min(100, v));
      this._opts.volume = vol / 100;
      if (this._master && this._AC) {
        this._master.gain.setTargetAtTime(vol / 100, this._AC.currentTime, 0.1);
      }
      this._emit('volumeChange', { volume: vol });
      return this;
    }

    /**
     * Manually fire a one-shot sound for a layer (even sparse ones).
     */
    trigger(id) {
      this._initAC();
      this._ensureAudioRunning();
      const makers = this._makers();
      if (makers[id]) {
        // Temporarily start then let it self-stop
        const saved = this._nodes[id];
        makers[id](true); // oneshot=true
        this._emit('trigger', { id });
        // Restore if it was already playing
        if (saved) this._nodes[id] = saved;
      } else {
        console.warn(`InterrogationSound: unknown trigger "${id}"`);
      }
      return this;
    }

    /**
     * Set interrogation mode and intensity.
     * @param {string} id - 'calm' | 'excited' | 'afraid' | 'both'
     * @param {number} intensity - 0..100
     */
    setMod(id, intensity = this._modState.intensity) {
      if (!INTERROGATION_MODS[id]) {
        console.warn(`InterrogationSound: unknown mod "${id}"`);
        return this;
      }
      let resolvedIntensity = Math.max(0, Math.min(100, intensity));
      if (id !== 'calm' && resolvedIntensity === 0) resolvedIntensity = 65;
      const prev = { ...this._modState };
      this._modState.id = id;
      this._modState.intensity = resolvedIntensity;
      this._applyModMix();
      this._emit('modChange', { from: prev, to: { ...this._modState } });

      if (this._playing && this._modState.intensity > 0) {
        if (id === 'excited') {
          this.trigger('clock');
          this.trigger('pulse');
        } else if (id === 'afraid') {
          this.trigger('chair');
          this.trigger('slam');
          this.trigger('metal');
        } else if (id === 'both') {
          this.trigger('chair');
          this.trigger('slam');
          this.trigger('radio');
          this.trigger('pulse');
          this.trigger('metal');
        }
      }
      return this;
    }

    setModIntensity(intensity) {
      const prev = this._modState.intensity;
      this._modState.intensity = Math.max(0, Math.min(100, intensity));
      this._applyModMix();
      this._emit('modIntensityChange', {
        from: prev,
        to: this._modState.intensity,
        mod: this._modState.id,
      });

      if (this._playing && this._modState.intensity > prev + 12) {
        if (this._modState.id === 'excited') {
          this.trigger('clock');
          this.trigger('pulse');
        } else if (this._modState.id === 'afraid') {
          this.trigger('chair');
          this.trigger('slam');
          this.trigger('metal');
        } else if (this._modState.id === 'both') {
          this.trigger('clock');
          this.trigger('chair');
          this.trigger('slam');
          this.trigger('radio');
          this.trigger('pulse');
          this.trigger('metal');
        }
      }
      return this;
    }

    /* ── State inspection ───────────────────────────────────────── */

    getState() {
      return {
        playing: this._playing,
        paused: this._paused,
        mood: this._mood,
        tension: this._tension,
        mod: { ...this._modState },
        volume: Math.round(this._opts.volume * 100),
        layers: LAYER_DEFS.reduce((acc, l) => {
          acc[l.id] = { volume: this._vol[l.id], enabled: this._enabled[l.id] };
          return acc;
        }, {}),
      };
    }

    getLayers() {
      return LAYER_DEFS.map((l) => ({
        ...l,
        volume: this._vol[l.id],
        enabled: this._enabled[l.id],
      }));
    }

    getMoods() {
      return Object.keys(MOODS).map((id) => ({ id, volumes: { ...MOODS[id] } }));
    }

    getMods() {
      return Object.keys(INTERROGATION_MODS).map((id) => ({ id, ...INTERROGATION_MODS[id] }));
    }

    /* ── Internal: Audio Context ────────────────────────────────── */

    _initAC() {
      if (this._AC) return;
      this._AC = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._AC.createGain();
      this._master.gain.value = this._opts.volume;
      this._analyser = this._AC.createAnalyser();
      this._analyser.fftSize = 64;

      this._modHigh = this._AC.createBiquadFilter();
      this._modHigh.type = 'highpass';
      this._modHigh.frequency.value = 22;

      this._modLow = this._AC.createBiquadFilter();
      this._modLow.type = 'lowpass';
      this._modLow.frequency.value = 12000;

      this._modTone = this._AC.createBiquadFilter();
      this._modTone.type = 'peaking';
      this._modTone.frequency.value = 1200;
      this._modTone.Q.value = 1;
      this._modTone.gain.value = 0;

      this._modOut = this._AC.createGain();
      this._modOut.gain.value = 1;

      this._master.connect(this._modHigh);
      this._modHigh.connect(this._modLow);
      this._modLow.connect(this._modTone);
      this._modTone.connect(this._modOut);
      this._modOut.connect(this._analyser);
      this._analyser.connect(this._AC.destination);

      this._applyModMix();
    }

    _G(vol, id) {
      const g = this._AC.createGain();
      g.gain.value = (vol / 100) * this._layerScalar(id);
      g.connect(this._master);
      return g;
    }

    _layerScalar(id) {
      const s = this._modState.intensity / 100;
      const mod = this._modState.id;
      const ambient = { room: 1, rain: 1, air: 1, drone: 1, rumble: 1, organ: 1 };
      const events = {
        chair: 1,
        slam: 1,
        metal: 1,
        glass: 1,
        radio: 1,
        string: 1,
        pulse: 1,
        clock: 1,
      };
      if (id === 'air') return 0.22 + s * 0.08;
      if (id === 'radio') return 0.3 + s * 0.12;

      if (ambient[id]) {
        if (mod === 'excited') return 0.5 + s * 0.18;
        if (mod === 'afraid') return 0.56 + s * 0.32;
        if (mod === 'both') return 0.6 + s * 0.4;
        return 0.62;
      }
      if (events[id]) {
        if (mod === 'excited') return 0.7 + s * 0.3;
        if (mod === 'afraid') return 0.76 + s * 0.34;
        if (mod === 'both') return 0.82 + s * 0.36;
        return 0.65;
      }
      return 0.65;
    }

    _ensureAudioRunning() {
      if (!this._AC || this._AC.state !== 'suspended') return;
      this._AC.resume().catch(() => {});
    }

    _applyModMix() {
      const profile = INTERROGATION_MODS[this._modState.id] || INTERROGATION_MODS.calm;
      const s = this._modState.intensity / 100;

      LAYER_DEFS.forEach((layer) => {
        const base = this._baseVol[layer.id] ?? this._vol[layer.id] ?? layer.defaultVol;
        const delta = profile.deltas[layer.id] || 0;
        const target = Math.max(0, Math.min(100, base + delta * s));
        this._vol[layer.id] = target;
        if (this._nodes[layer.id]?.gain && this._AC) {
          this._nodes[layer.id].gain.gain.setTargetAtTime(
            (target / 100) * this._layerScalar(layer.id),
            this._AC.currentTime,
            RAMP_TIME
          );
        }
      });

      const nextTension = Math.max(
        0,
        Math.min(100, this._manualTension + profile.tensionBoost * s)
      );
      if (nextTension !== this._tension) {
        const prev = this._tension;
        this._tension = nextTension;
        this._emit('tensionChange', { from: prev, to: this._tension });
      }

      if (this._AC && this._modHigh && this._modLow && this._modTone && this._modOut) {
        const now = this._AC.currentTime;
        let hp = 22,
          lp = 12000,
          toneFreq = 1200,
          toneGain = 0,
          outGain = 1;

        if (this._modState.id === 'excited') {
          hp = 80 + s * 140;
          lp = 7600 - s * 1200;
          toneFreq = 1800;
          toneGain = 1.5 + s * 4.5;
          outGain = 1 + s * 0.12;
        } else if (this._modState.id === 'afraid') {
          hp = 35 + s * 70;
          lp = 2400 - s * 700;
          toneFreq = 250;
          toneGain = 4 + s * 7;
          outGain = 1 + s * 0.1;
        } else if (this._modState.id === 'both') {
          hp = 90 + s * 180;
          lp = 2000 - s * 600;
          toneFreq = 700;
          toneGain = 5 + s * 8;
          outGain = 1 + s * 0.18;
        }

        this._modHigh.frequency.setTargetAtTime(Math.max(20, hp), now, 0.18);
        this._modLow.frequency.setTargetAtTime(Math.max(500, lp), now, 0.18);
        this._modTone.frequency.setTargetAtTime(toneFreq, now, 0.2);
        this._modTone.gain.setTargetAtTime(toneGain, now, 0.2);
        this._modOut.gain.setTargetAtTime(outGain, now, 0.2);
      }
    }

    _noiseBuf(sec, amp = 1) {
      const b = this._AC.createBuffer(1, this._AC.sampleRate * sec, this._AC.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * amp;
      return b;
    }

    _startLayer(id) {
      const m = this._makers();
      if (m[id]) m[id](false);
    }

    _stopLayerNodes(id) {
      const n = this._nodes[id];
      if (!n) return;
      try {
        n.stop();
      } catch (e) {}
    }

    /* ── Internal: Scene events ─────────────────────────────────── */

    _scheduleEvent() {
      if (!this._playing) return;
      const [min, max] = this._opts.eventInterval;
      // Tension shortens interval
      const factor = 1 - (this._tension / 100) * 0.5;
      const modFactor =
        this._modState.id === 'calm' ? 1 : 1 - (this._modState.intensity / 100) * 0.65;
      const delay = (min + Math.random() * (max - min)) * factor * modFactor;
      this._eventTimer = setTimeout(() => {
        if (!this._playing) return;
        const ev = SCENE_EVENTS[Math.floor(Math.random() * SCENE_EVENTS.length)];
        this._emit('event', { id: ev.id, label: ev.label });
        const triggerId = EVENT_TRIGGER_MAP[ev.id];
        if (triggerId && this._enabled[triggerId]) {
          this.trigger(triggerId);
        }
        this._scheduleEvent();
      }, delay);
    }

    /* ── Internal: Layer makers ─────────────────────────────────── */

    _makers() {
      const self = this;
      const AC = this._AC;

      return {
        drone(oneshot) {
          const g = self._G(self._vol.drone, 'drone');
          const pairs = [
            [55, 0.35],
            [82.4, 0.18],
            [110, 0.08],
            [36.7, 0.25],
          ];
          const oscs = pairs.map(([f, a]) => {
            const o = AC.createOscillator(),
              og = AC.createGain();
            o.type = 'sine';
            o.frequency.value = f;
            og.gain.value = a;
            const lfo = AC.createOscillator(),
              lg = AC.createGain();
            lfo.frequency.value = 0.05 + Math.random() * 0.06;
            lg.gain.value = f * 0.008;
            lfo.connect(lg);
            lg.connect(o.frequency);
            lfo.start();
            o.connect(og);
            og.connect(g);
            o.start();
            return { o, lfo };
          });
          const stop = () =>
            oscs.forEach((x) => {
              try {
                x.o.stop();
                x.lfo.stop();
              } catch (e) {}
            });
          if (oneshot) {
            setTimeout(stop, 1200);
          } else {
            self._nodes.drone = { gain: g, stop };
          }
        },

        room(oneshot) {
          const g = self._G(self._vol.room, 'room');
          const src = AC.createBufferSource();
          src.buffer = self._noiseBuf(4, 0.22);
          src.loop = !oneshot;
          const lp = AC.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 180;
          const hp = AC.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 30;
          const notch = AC.createBiquadFilter();
          notch.type = 'notch';
          notch.frequency.value = 3200;
          notch.Q.value = 1.1;
          src.connect(hp);
          hp.connect(lp);
          lp.connect(notch);
          notch.connect(g);
          src.start();
          if (!oneshot)
            self._nodes.room = {
              gain: g,
              stop: () => {
                try {
                  src.stop();
                } catch (e) {}
              },
            };
        },

        rain(oneshot) {
          const g = self._G(self._vol.rain, 'rain');

          // Far rain bed (broadband, muted lows/highs)
          const farBed = AC.createBufferSource();
          farBed.buffer = self._noiseBuf(4.8, 0.22);
          farBed.loop = !oneshot;
          const farHP = AC.createBiquadFilter();
          farHP.type = 'highpass';
          farHP.frequency.value = 220;
          const farLP = AC.createBiquadFilter();
          farLP.type = 'lowpass';
          farLP.frequency.value = 3600;
          const farGain = AC.createGain();
          farGain.gain.value = 0.3;
          farBed.connect(farHP);
          farHP.connect(farLP);
          farLP.connect(farGain);
          farGain.connect(g);
          farBed.start();

          // Near window hiss (fast raindrops on glass feel)
          const nearBed = AC.createBufferSource();
          nearBed.buffer = self._noiseBuf(2.6, 0.12);
          nearBed.loop = !oneshot;
          const nearHP = AC.createBiquadFilter();
          nearHP.type = 'highpass';
          nearHP.frequency.value = 1800;
          const nearLP = AC.createBiquadFilter();
          nearLP.type = 'lowpass';
          nearLP.frequency.value = 7800;
          const nearGain = AC.createGain();
          nearGain.gain.value = 0.12;

          const weatherLfo = AC.createOscillator();
          const weatherDepth = AC.createGain();
          weatherLfo.frequency.value = 0.08;
          weatherDepth.gain.value = 0.06;
          weatherLfo.connect(weatherDepth);
          weatherDepth.connect(nearGain.gain);
          weatherLfo.start();

          nearBed.connect(nearHP);
          nearHP.connect(nearLP);
          nearLP.connect(nearGain);
          nearGain.connect(g);
          nearBed.start();

          // Sparse droplet transients for realism
          let dropTimer = null;
          const spawnDrop = () => {
            if (!self._playing && !oneshot) return;
            const src = AC.createBufferSource();
            src.buffer = self._noiseBuf(0.035, 0.8);

            const bp = AC.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 1400 + Math.random() * 4200;
            bp.Q.value = 6 + Math.random() * 6;

            const env = AC.createGain();
            const now = AC.currentTime;
            const peak = 0.025 + Math.random() * 0.05;
            env.gain.setValueAtTime(0, now);
            env.gain.linearRampToValueAtTime(peak, now + 0.004);
            env.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

            src.connect(bp);
            bp.connect(env);
            env.connect(g);
            src.start(now);
            src.stop(now + 0.07);

            if (!oneshot) {
              const storm = self._modState.intensity / 100;
              const delay = 65 + Math.random() * (240 - storm * 70);
              dropTimer = setTimeout(spawnDrop, delay);
            }
          };
          spawnDrop();

          const stop = () => {
            clearTimeout(dropTimer);
            try {
              farBed.stop();
              nearBed.stop();
              weatherLfo.stop();
            } catch (e) {}
          };

          if (oneshot) {
            setTimeout(stop, 600);
          } else {
            self._nodes.rain = { gain: g, stop };
          }
        },

        air(oneshot) {
          const g = self._G(self._vol.air, 'air');
          const src = AC.createBufferSource();
          src.buffer = self._noiseBuf(3, 0.08);
          src.loop = !oneshot;
          const hp = AC.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 1800;
          const lp = AC.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 4200;
          const notch = AC.createBiquadFilter();
          notch.type = 'notch';
          notch.frequency.value = 2800;
          notch.Q.value = 1.2;
          const wob = AC.createOscillator();
          const wg = AC.createGain();
          wob.frequency.value = 0.2;
          wg.gain.value = 120;
          wob.connect(wg);
          wg.connect(lp.frequency);
          wob.start();
          src.connect(hp);
          hp.connect(lp);
          lp.connect(notch);
          notch.connect(g);
          src.start();
          const stop = () => {
            try {
              src.stop();
              wob.stop();
            } catch (e) {}
          };
          if (oneshot) {
            setTimeout(stop, 1400);
          } else {
            self._nodes.air = { gain: g, stop };
          }
        },

        organ(oneshot) {
          const g = self._G(self._vol.organ, 'organ');
          const chord = [73.4, 92.5, 110, 146.8];
          const oscs = [];
          chord.forEach((f, i) => {
            const o = AC.createOscillator();
            const og = AC.createGain();
            o.type = i % 2 === 0 ? 'triangle' : 'sine';
            o.frequency.value = f;
            og.gain.value = i === 0 ? 0.12 : 0.07;
            const drift = AC.createOscillator();
            const dg = AC.createGain();
            drift.frequency.value = 0.04 + Math.random() * 0.06;
            dg.gain.value = f * 0.01;
            drift.connect(dg);
            dg.connect(o.frequency);
            drift.start();
            o.connect(og);
            og.connect(g);
            o.start();
            oscs.push({ o, drift });
          });
          const stop = () =>
            oscs.forEach((x) => {
              try {
                x.o.stop();
                x.drift.stop();
              } catch (e) {}
            });
          if (oneshot) {
            setTimeout(stop, 1300);
          } else {
            self._nodes.organ = { gain: g, stop };
          }
        },

        cello(oneshot) {
          const g = self._G(self._vol.cello, 'cello');
          const notes = [65.4, 73.4, 55, 61.7, 73.4, 82.4, 65.4, 55];
          let idx = 0,
            t = null;
          function bow() {
            if (!self._playing && !oneshot) return;
            const f = notes[idx % notes.length];
            idx++;
            const o = AC.createOscillator(),
              env = AC.createGain();
            o.type = 'sawtooth';
            o.frequency.value = f;
            const vib = AC.createOscillator(),
              vg = AC.createGain();
            vib.frequency.value = 5.5;
            vg.gain.value = f * 0.012;
            vib.connect(vg);
            vg.connect(o.frequency);
            vib.start();
            const lp = AC.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = f * 3.5;
            lp.Q.value = 2;
            const dur = 2 + Math.random() * 2;
            env.gain.setValueAtTime(0, AC.currentTime);
            env.gain.linearRampToValueAtTime(0.35, AC.currentTime + 0.3);
            env.gain.setValueAtTime(0.3, AC.currentTime + dur - 0.4);
            env.gain.linearRampToValueAtTime(0, AC.currentTime + dur);
            o.connect(lp);
            lp.connect(env);
            env.connect(g);
            o.start();
            o.stop(AC.currentTime + dur + 0.1);
            setTimeout(
              () => {
                try {
                  vib.stop();
                } catch (e) {}
              },
              dur * 1000 + 200
            );
            if (!oneshot) t = setTimeout(bow, dur * 1000 + 1000 + Math.random() * 3000);
          }
          bow();
          if (!oneshot) self._nodes.cello = { gain: g, stop: () => clearTimeout(t) };
        },

        rumble(oneshot) {
          const g = self._G(self._vol.rumble, 'rumble');
          const src = AC.createBufferSource();
          src.buffer = self._noiseBuf(5, 0.8);
          src.loop = !oneshot;
          const lp = AC.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 55;
          const lfo = AC.createOscillator(),
            lg = AC.createGain();
          lfo.frequency.value = 0.12;
          lg.gain.value = 25;
          lfo.connect(lg);
          lg.connect(lp.frequency);
          lfo.start();
          src.connect(lp);
          lp.connect(g);
          src.start();
          const stop = () => {
            try {
              src.stop();
              lfo.stop();
            } catch (e) {}
          };
          if (oneshot) {
            setTimeout(stop, 1200);
          } else {
            self._nodes.rumble = { gain: g, stop };
          }
        },

        string(oneshot) {
          const g = self._G(self._vol.string, 'string');
          const freqs = [98, 110, 123, 87, 73, 98, 130, 110];
          let idx = 0,
            t = null;
          function scrape() {
            if (!self._playing && !oneshot) return;
            const f = freqs[idx % freqs.length];
            idx++;
            const o = AC.createOscillator();
            const n = AC.createBufferSource();
            n.buffer = self._noiseBuf(0.8, 0.3);
            const bp = AC.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = f * 2;
            bp.Q.value = 8;
            const env = AC.createGain();
            env.gain.setValueAtTime(0, AC.currentTime);
            env.gain.linearRampToValueAtTime(0.4, AC.currentTime + 0.05);
            env.gain.exponentialRampToValueAtTime(
              0.001,
              AC.currentTime + 0.9 + Math.random() * 0.5
            );
            o.type = 'sawtooth';
            o.frequency.value = f;
            const lp = AC.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 600;
            lp.Q.value = 4;
            o.connect(lp);
            n.connect(bp);
            lp.connect(env);
            bp.connect(env);
            env.connect(g);
            o.start();
            n.start();
            o.stop(AC.currentTime + 1.5);
            n.stop(AC.currentTime + 1.5);
            if (!oneshot) {
              const tension = self._tension;
              const modBoost = self._modState.intensity * 7;
              t = setTimeout(
                scrape,
                Math.max(380, 1800 + (1 - tension / 100) * 1400 + Math.random() * 700 - modBoost)
              );
            }
          }
          scrape();
          if (!oneshot) self._nodes.string = { gain: g, stop: () => clearTimeout(t) };
        },

        piano(oneshot) {
          const g = self._G(self._vol.piano, 'piano');
          const seq = [196, 220, 247, 196, 175, 196, 165, 175];
          let idx = 0,
            t = null;
          function note() {
            if (!self._playing && !oneshot) return;
            if (oneshot || Math.random() > 0.45) {
              const f = seq[idx % seq.length];
              [1, 2, 3].forEach((harm, hi) => {
                const o = AC.createOscillator(),
                  env = AC.createGain();
                o.type = 'sine';
                o.frequency.value = f * harm;
                const amp = hi === 0 ? 0.2 : hi === 1 ? 0.08 : 0.03;
                env.gain.setValueAtTime(0, AC.currentTime);
                env.gain.linearRampToValueAtTime(amp, AC.currentTime + 0.012);
                env.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 2.5 - hi * 0.5);
                o.connect(env);
                env.connect(g);
                o.start();
                o.stop(AC.currentTime + 3);
              });
            }
            idx++;
            if (!oneshot) t = setTimeout(note, 1400 + Math.random() * 3000);
          }
          note();
          if (!oneshot) self._nodes.piano = { gain: g, stop: () => clearTimeout(t) };
        },

        pulse(oneshot) {
          const g = self._G(self._vol.pulse, 'pulse');
          let step = 0,
            t = null;
          function tick() {
            if (!self._playing && !oneshot) return;
            const base = self._modState.id === 'afraid' || self._modState.id === 'both' ? 72 : 90;
            const f = base + Math.sin(step * 0.7) * 10;
            step++;
            const o = AC.createOscillator();
            const env = AC.createGain();
            const sat = AC.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
              const x = (i / 255) * 2 - 1;
              curve[i] = Math.tanh(x * 3.4);
            }
            sat.curve = curve;
            sat.oversample = '2x';
            o.type = 'square';
            o.frequency.value = f;
            const dur = 0.14 + Math.random() * 0.08;
            env.gain.setValueAtTime(0, AC.currentTime);
            env.gain.linearRampToValueAtTime(
              0.22 + self._modState.intensity / 420,
              AC.currentTime + 0.01
            );
            env.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
            o.connect(sat);
            sat.connect(env);
            env.connect(g);
            o.start();
            o.stop(AC.currentTime + dur + 0.03);
            if (!oneshot) {
              const fast = self._modState.intensity * 2.6 + self._tension * 1.4;
              t = setTimeout(tick, Math.max(160, 900 - fast + Math.random() * 120));
            }
          }
          tick();
          if (!oneshot) self._nodes.pulse = { gain: g, stop: () => clearTimeout(t) };
        },

        clock(oneshot) {
          const g = self._G(self._vol.clock, 'clock');
          let phase = 0,
            t = null;
          function beat() {
            if (!self._playing && !oneshot) return;
            function pulse(delay, freq, dur) {
              const src = AC.createBufferSource();
              src.buffer = self._noiseBuf(0.06, 1);
              const bp = AC.createBiquadFilter();
              bp.type = 'bandpass';
              bp.frequency.value = freq;
              bp.Q.value = 6;
              const env = AC.createGain();
              env.gain.setValueAtTime(0, AC.currentTime + delay);
              const punch = 0.5 + (self._modState.intensity / 100) * 0.45;
              env.gain.linearRampToValueAtTime(punch, AC.currentTime + delay + 0.01);
              env.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + delay + dur);
              src.connect(bp);
              bp.connect(env);
              env.connect(g);
              src.start(AC.currentTime + delay);
              src.stop(AC.currentTime + delay + dur + 0.1);
            }
            const fearTilt = self._modState.id === 'afraid' || self._modState.id === 'both' ? 1 : 0;
            const hi = 80 + self._modState.intensity * 1.2;
            const lo = 60 + self._modState.intensity * 0.6;
            pulse(0, hi, 0.1 + fearTilt * 0.03);
            pulse(0.14, lo, 0.15 + fearTilt * 0.05);
            const bpm =
              52 +
              self._tension * 0.65 +
              self._modState.intensity * 0.45 +
              Math.sin(phase * 0.3) * 4;
            phase++;
            if (!oneshot) t = setTimeout(beat, (60 / bpm) * 1000);
          }
          beat();
          if (!oneshot) self._nodes.clock = { gain: g, stop: () => clearTimeout(t) };
        },

        radio(oneshot) {
          const g = self._G(self._vol.radio, 'radio');
          let t = null;
          function burst() {
            if (!self._playing && !oneshot) return;
            const dur = 0.08 + Math.random() * (0.18 + self._modState.intensity / 300);
            const src = AC.createBufferSource();
            src.buffer = self._noiseBuf(dur + 0.1, 0.42);
            const bp = AC.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 1000 + Math.random() * (2800 + self._modState.intensity * 12);
            bp.Q.value = 0.8 + self._modState.intensity / 180;
            const lp = AC.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 3600;
            const env = AC.createGain();
            env.gain.setValueAtTime(0, AC.currentTime);
            env.gain.linearRampToValueAtTime(
              0.3 + self._modState.intensity / 500,
              AC.currentTime + 0.01
            );
            env.gain.setValueAtTime(0.3, AC.currentTime + dur * 0.7);
            env.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur + 0.05);
            src.connect(bp);
            bp.connect(lp);
            lp.connect(env);
            env.connect(g);
            src.start();
            src.stop(AC.currentTime + dur + 0.1);
            if (!oneshot) {
              const fast = self._modState.intensity * 40;
              t = setTimeout(burst, Math.max(600, 3000 + Math.random() * 9000 - fast));
            }
          }
          burst();
          if (!oneshot) self._nodes.radio = { gain: g, stop: () => clearTimeout(t) };
        },

        glass(oneshot) {
          const g = self._G(self._vol.glass, 'glass');
          let t = null;
          function hit() {
            if (!self._playing && !oneshot) return;
            const f = 800 + Math.random() * 2400;
            [1, 1.52, 2.05].forEach((h, i) => {
              const o = AC.createOscillator(),
                env = AC.createGain();
              o.type = 'sine';
              o.frequency.value = f * h;
              const amp = i === 0 ? 0.15 : i === 1 ? 0.08 : 0.04;
              env.gain.setValueAtTime(0, AC.currentTime);
              env.gain.linearRampToValueAtTime(amp, AC.currentTime + 0.004);
              env.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 2.5 - i * 0.4);
              o.connect(env);
              env.connect(g);
              o.start();
              o.stop(AC.currentTime + 3);
            });
            if (!oneshot) t = setTimeout(hit, 8000 + Math.random() * 18000);
          }
          hit();
          if (!oneshot) self._nodes.glass = { gain: g, stop: () => clearTimeout(t) };
        },

        metal(oneshot) {
          const g = self._G(self._vol.metal, 'metal');
          let t = null;
          function clang() {
            if (!self._playing && !oneshot) return;
            const base = 420 + Math.random() * 420;
            [1, 1.33, 1.88, 2.41].forEach((r, i) => {
              const o = AC.createOscillator();
              const env = AC.createGain();
              o.type = i === 0 ? 'square' : 'sine';
              o.frequency.value = base * r;
              env.gain.setValueAtTime(0, AC.currentTime);
              env.gain.linearRampToValueAtTime(0.13 - i * 0.02, AC.currentTime + 0.006);
              env.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.55 + i * 0.22);
              o.connect(env);
              env.connect(g);
              o.start();
              o.stop(AC.currentTime + 1.4);
            });
            if (!oneshot) {
              const fast = self._modState.intensity * 70;
              t = setTimeout(clang, Math.max(1000, 8500 + Math.random() * 16000 - fast));
            }
          }
          clang();
          if (!oneshot) self._nodes.metal = { gain: g, stop: () => clearTimeout(t) };
        },

        chair(oneshot) {
          const g = self._G(self._vol.chair, 'chair');
          let t = null;
          function creak() {
            if (!self._playing && !oneshot) return;
            const dur = 0.3 + Math.random() * 0.5;
            const o = AC.createOscillator(),
              env = AC.createGain();
            o.type = 'sawtooth';
            const startF = 300 + Math.random() * 200;
            o.frequency.setValueAtTime(startF, AC.currentTime);
            o.frequency.linearRampToValueAtTime(
              startF * (0.6 + Math.random() * 0.6),
              AC.currentTime + dur
            );
            const lp = AC.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 400;
            env.gain.setValueAtTime(0, AC.currentTime);
            env.gain.linearRampToValueAtTime(0.12, AC.currentTime + 0.02);
            env.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
            o.connect(lp);
            lp.connect(env);
            env.connect(g);
            o.start();
            o.stop(AC.currentTime + dur + 0.1);
            if (!oneshot) {
              const fast = self._modState.intensity * 65;
              t = setTimeout(creak, Math.max(1200, 6000 + Math.random() * 15000 - fast));
            }
          }
          creak();
          if (!oneshot) self._nodes.chair = { gain: g, stop: () => clearTimeout(t) };
        },

        slam(oneshot) {
          const g = self._G(self._vol.slam, 'slam');
          let t = null;
          function hit() {
            if (!self._playing && !oneshot) return;
            const dur = 0.14 + Math.random() * 0.12;
            const body = AC.createOscillator();
            const bodyEnv = AC.createGain();
            body.type = 'triangle';
            body.frequency.setValueAtTime(140 + Math.random() * 40, AC.currentTime);
            body.frequency.exponentialRampToValueAtTime(
              55 + Math.random() * 20,
              AC.currentTime + dur
            );
            bodyEnv.gain.setValueAtTime(0, AC.currentTime);
            bodyEnv.gain.linearRampToValueAtTime(0.28, AC.currentTime + 0.01);
            bodyEnv.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);

            const src = AC.createBufferSource();
            src.buffer = self._noiseBuf(0.22, 0.9);
            const bp = AC.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 320 + Math.random() * 160;
            bp.Q.value = 1.2;
            const noiseEnv = AC.createGain();
            noiseEnv.gain.setValueAtTime(0, AC.currentTime);
            noiseEnv.gain.linearRampToValueAtTime(0.2, AC.currentTime + 0.005);
            noiseEnv.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.18);

            body.connect(bodyEnv);
            bodyEnv.connect(g);
            src.connect(bp);
            bp.connect(noiseEnv);
            noiseEnv.connect(g);
            body.start();
            src.start();
            body.stop(AC.currentTime + dur + 0.05);
            src.stop(AC.currentTime + 0.24);

            if (!oneshot) {
              const fast = self._modState.intensity * 90;
              t = setTimeout(hit, Math.max(1500, 9000 + Math.random() * 20000 - fast));
            }
          }
          hit();
          if (!oneshot) self._nodes.slam = { gain: g, stop: () => clearTimeout(t) };
        },
      };
    }
  }

  return InterrogationSound;
});
