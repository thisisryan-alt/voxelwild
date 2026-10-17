// Placeholder music engine — replaced in the audio stage with the full generative sequencer.
export class Music {
  constructor(audio) { this.audio = audio; this.track = null; this.intensity = 0; }
  init() {}
  play(id) { this.track = id; }
  setIntensity(v) { this.intensity = v; }
  stop() {}
  duck() {}
  update() {}
}
