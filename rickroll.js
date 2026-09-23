// Unlock audio in the submit gesture, before authentication crosses the network.
// This is an original arcade sting; the animation never needs a media player.
export function prepareRickrollSound() {
  let context,
    master,
    started = false,
    closed = false;
  const silent = { play() {}, mute() {}, close() {} };
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return silent;
    context = new Audio();
    context.resume().catch(() => {});
    master = context.createGain();
    master.gain.value = 0.06;
    master.connect(context.destination);
    const sync = () => {
      if (closed) return;
      (document.hidden ? context.suspend() : context.resume()).catch(() => {});
    };
    document.addEventListener("visibilitychange", sync);
    return {
      play() {
        if (closed || started) return;
        started = true;
        const now = context.currentTime + 0.02;
        const note = (midi, at, duration, type, volume) => {
          const voice = context.createOscillator(),
            envelope = context.createGain();
          voice.type = type;
          voice.frequency.value = 440 * 2 ** ((midi - 69) / 12);
          envelope.gain.setValueAtTime(0, at);
          envelope.gain.linearRampToValueAtTime(volume, at + 0.01);
          envelope.gain.exponentialRampToValueAtTime(0.001, at + duration);
          voice.connect(envelope);
          envelope.connect(master);
          voice.onended = () => {
            voice.disconnect();
            envelope.disconnect();
          };
          voice.start(at);
          voice.stop(at + duration + 0.02);
        };
        // Four bars of arpeggiated synth chords and a walking bass, then silence.
        for (let beat = 0; beat < 32; beat++) {
          const root = [57, 53, 60, 55][Math.floor(beat / 8)];
          note(
            root + [12, 19, 24, 19][beat % 4],
            now + beat * 0.18,
            0.17,
            "triangle",
            0.5,
          );
          if (beat % 2 === 0)
            note(root - 12, now + beat * 0.18, 0.3, "sine", 0.7);
        }
        sync();
      },
      mute(value) {
        if (!closed)
          master.gain.setTargetAtTime(
            value ? 0 : 0.06,
            context.currentTime,
            0.03,
          );
      },
      close() {
        if (closed) return;
        closed = true;
        document.removeEventListener("visibilitychange", sync);
        context.close().catch(() => {});
      },
    };
  } catch {
    context?.close().catch(() => {});
    return silent;
  }
}

export const rickStage = `<div class="rick-stage" role="img" aria-label="Rickrolled: a ginger-haired singer dances under neon lights at a microphone">
  <div class="rick-beam rick-beam-a"></div><div class="rick-beam rick-beam-b"></div><div class="rick-grid"></div>
  <span class="rick-channel" aria-hidden="true">CH 87 • SIGNAL FOUND</span><strong class="rick-title" aria-hidden="true">RICK<br>ROLLED.</strong>
  <svg class="rick-performer" viewBox="0 0 360 420" aria-hidden="true">
    <ellipse cx="180" cy="394" rx="100" ry="13" fill="#06091c" opacity=".6"/>
    <g class="rick-dance">
      <g class="rick-leg-left"><path d="M148 242L137 327 125 383 155 387 178 320 183 248" fill="#20354d"/><path d="M125 379L109 391Q106 400 124 400H158L156 382Z" fill="#0b1221"/></g>
      <g class="rick-leg-right"><path d="M181 247L188 327 204 386 236 380 221 319 215 240" fill="#15283f"/><path d="M205 382L206 400H253Q263 393 237 377Z" fill="#0b1221"/></g>
      <g class="rick-torso">
        <path d="M148 122Q174 110 206 123L224 251Q184 272 137 250Z" fill="#ece8da"/>
        <path d="M147 148H208M145 166H211M144 184H214M141 202H217M140 220H218M138 238H220" stroke="#233747" stroke-width="8"/>
        <path d="M150 119L130 126 121 257 153 265 166 140Z" fill="#bc9878"/><path d="M201 119L221 130 234 262 204 265 186 140Z" fill="#c9a888"/>
        <path d="M150 119L144 147 158 153 152 184 171 138M201 119L212 149 200 155 208 180 183 139" fill="#e1c3a1"/>
        <g class="rick-arm-left"><path d="M135 135Q108 152 100 211L127 237 142 215 124 200 152 149" fill="#c9a888"/><path d="M128 213Q145 204 152 218L148 235 133 240 122 231Z" fill="#e6b193"/></g>
        <g class="rick-arm-right"><path d="M216 134Q240 140 252 174L227 219 208 206 227 173 205 155" fill="#bc9878"/><path d="M214 202Q196 191 192 206L202 226 218 223 226 212Z" fill="#e6b193"/></g>
        <g class="rick-head"><path d="M168 100L165 127 179 141 197 125 192 99" fill="#d79a7e"/><path d="M151 54Q177 31 202 56L203 88Q198 115 179 118Q159 113 151 88Z" fill="#edba9a"/><path d="M150 81L143 59Q139 36 159 30Q185 13 210 36L216 56 201 76 197 52Q173 65 157 53L157 82Z" fill="#9d452a"/><path d="M151 48Q171 26 199 38" stroke="#d57640" stroke-width="7" fill="none"/><path d="M164 80H169M187 80H192" stroke="#263243" stroke-width="3"/><path d="M180 80L176 93 182 94" stroke="#c58c75" stroke-width="2" fill="none"/><path d="M170 101Q180 107 190 99" stroke="#954a48" stroke-width="2" fill="none"/></g>
      </g>
    </g>
    <path d="M186 191L182 391M155 396L182 387 213 396" stroke="#9cb7c9" stroke-width="5" fill="none"/><g transform="rotate(-18 186 184)"><rect x="177" y="158" width="18" height="39" rx="9" fill="#d1dfe5"/><path d="M180 166H192M180 172H192M180 178H192" stroke="#46556c" stroke-width="2"/></g>
  </svg><span class="rick-caption" aria-hidden="true">ACCESS DENIED. VIBES GRANTED.</span>
</div>`;
