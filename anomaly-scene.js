// A tiny procedural demoscene: no models, textures, video or 3D dependencies.
// Distances describe the solid; the fragment shader traces light through it.
export const fragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float time;
uniform float chapter;
uniform float pulse;
mat2 turn(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float box(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float ring(vec3 p,float r,float w){return length(vec2(length(p.xz)-r,p.y))-w;}
vec3 palette(float x){return .5+.5*cos(6.28318*(vec3(1.,1.,1.)*x+vec3(.0,.33,.67)));}
float field(vec3 p){
  p.xz=turn(time*.16)*p.xz;
  p.xy=turn(time*.11)*p.xy;
  if(chapter<.5){
    float d=min(ring(p,1.5,.026),ring(p.yxz,1.5,.026));
    vec3 q=p; q.yz=turn(.78)*q.yz;
    d=min(d,ring(q,1.85,.018));
    float core=(abs(p.x)+abs(p.y)+abs(p.z)-1.13)*.577;
    float hollow=abs(core)-.034;
    return min(d,hollow);
  }
  if(chapter<1.5){
    float d=box(p,vec3(1.18));
    float scale=1.;
    for(int i=0;i<3;i++){
      vec3 a=mod(p*scale,2.)-1.;scale*=3.;
      vec3 r=abs(1.-3.*abs(a));
      float hole=(min(max(r.x,r.y),min(max(r.y,r.z),max(r.z,r.x)))-1.)/scale;
      d=max(d,hole);
    }
    return d;
  }
  vec3 q=p;
  q.xy=turn(q.z*.7+time*.13)*q.xy;
  float torus=ring(q,1.13,.22);
  float ribs=sin(atan(q.x,q.z)*18.+time)*.035;
  return torus+ribs;
}
vec3 normalAt(vec3 p){vec2 e=vec2(.002,0.);return normalize(vec3(field(p+e.xyy)-field(p-e.xyy),field(p+e.yxy)-field(p-e.yxy),field(p+e.yyx)-field(p-e.yyx)));}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.-resolution)/min(resolution.x,resolution.y);
  vec2 sky=uv; sky*=turn(time*.018);
  float a=atan(sky.y,sky.x),r=length(sky);
  vec3 color=vec3(.007,.008,.025);
  // Curved nebula filaments with a dark central well, not a flashing backdrop.
  for(int i=0;i<5;i++){
    float f=float(i);
    float wave=sin(a*(3.+f)+r*(7.+f*2.)-time*.14+f);
    color+=palette(f*.17+time*.009)*.003/(.055+abs(wave)) * smoothstep(.25,1.4,r);
  }
  float halo=exp(-abs(r-1.03)*14.);
  color+=vec3(.15,.26,.6)*halo*.3;
  vec3 origin=vec3(0.,0.,4.8-pulse*.2);
  vec3 ray=normalize(vec3(uv,-2.5));
  origin.yz=turn(pointer.y*.35+.2)*origin.yz;
  ray.yz=turn(pointer.y*.35+.2)*ray.yz;
  origin.xz=turn(pointer.x*.5)*origin.xz;
  ray.xz=turn(pointer.x*.5)*ray.xz;
  float travel=0.,glow=0.;
  bool hit=false;
  for(int i=0;i<66;i++){
    vec3 p=origin+ray*travel;
    float d=field(p);
    glow+=exp(-abs(d)*28.)*.011;
    if(d<.0018){hit=true;break;}
    travel+=max(d*.78,.002);
    if(travel>9.)break;
  }
  vec3 tint=palette(time*.022+chapter*.19);
  color+=glow*mix(vec3(.1,.55,1.),tint,.7)*(.45+pulse*.6);
  if(hit){
    vec3 p=origin+ray*travel,n=normalAt(p);
    float light=max(dot(n,normalize(vec3(-2.,3.,4.))),0.);
    float rim=pow(1.-max(dot(n,-ray),0.),2.5);
    float bands=.5+.5*sin(p.y*35.+time*1.2);
    vec3 metal=mix(vec3(.035,.05,.09),palette(p.y*.14+time*.02),.65);
    color=metal*(.18+light*.8)+rim*vec3(.3,.8,1.6)+bands*.035;
    color+=pow(max(dot(reflect(ray,n),normalize(vec3(-1.,2.,3.))),0.),28.)*.9;
    color+=glow*tint*.2;
  }
  color*=1.-.22*pow(length(uv)*.5,2.);
  color=1.-exp(-color*1.45);
  gl_FragColor=vec4(pow(max(color,0.),vec3(.85)),1.);
}`;

function makeRenderer(canvas) {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const shaders = [];
  let program, buffer;
  const dispose = () => {
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
  try {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw Error("Shader unavailable");
      return shader;
    };
    program = gl.createProgram();
    gl.attachShader(
      program,
      compile(
        gl.VERTEX_SHADER,
        "attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}",
      ),
    );
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw Error("Renderer unavailable");
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(
      ["resolution", "pointer", "time", "chapter", "pulse"].map((name) => [
        name,
        gl.getUniformLocation(program, name),
      ]),
    );
    return {
      draw(t, chapter, pointer, pulse) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
        gl.uniform1f(uniforms.time, t);
        gl.uniform1f(uniforms.chapter, chapter);
        gl.uniform1f(uniforms.pulse, pulse);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
      dispose,
    };
  } catch {
    dispose();
    return null;
  }
}

export const chapters = [
  [
    "01 / CONTACT",
    "Something found you.",
    "An object with no business being here.",
  ],
  [
    "02 / RECURSION",
    "There is no inside.",
    "Every room contains a smaller impossible room.",
  ],
  [
    "03 / TRANSMISSION",
    "You are the signal.",
    "A small universe, running in your browser.",
  ],
];

export function startAnomalyScene(stage, onChapter) {
  const canvas = document.createElement("canvas"),
    particles = document.createElement("canvas");
  canvas.className = "anomaly-solid";
  particles.className = "anomaly-particles";
  canvas.setAttribute("aria-hidden", "true");
  particles.setAttribute("aria-hidden", "true");
  stage.prepend(canvas, particles);
  let renderer = makeRenderer(canvas);
  const ctx = particles.getContext("2d");
  stage.dataset.renderer = renderer ? "webgl" : "canvas";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motion.matches,
    paused = false,
    stopped = false,
    frame = 0;
  let t = 0,
    last = 0,
    chapter = 0,
    pulse = 0,
    width = 0,
    height = 0;
  const pointer = { x: 0, y: 0 },
    aim = { x: 0, y: 0 };
  const stars = Array.from({ length: 340 }, (_, i) => ({
    angle: i * 2.39996323,
    radius: 0.2 + ((i * 47) % 337) / 85,
    depth: ((i * 71) % 337) / 337,
  }));
  const resize = () => {
    width = stage.clientWidth;
    height = stage.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    particles.width = Math.round(width * ratio);
    particles.height = Math.round(height * ratio);
    const scale = Math.min(1, Math.sqrt(380000 / Math.max(1, width * height)));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  function point(x, y, z) {
    const ay = t * 0.12 + pointer.x,
      ax = 0.3 + pointer.y * 0.6;
    const xx = x * Math.cos(ay) - z * Math.sin(ay),
      zz = x * Math.sin(ay) + z * Math.cos(ay);
    const yy = y * Math.cos(ax) - zz * Math.sin(ax),
      zzz = y * Math.sin(ax) + zz * Math.cos(ax);
    const scale = (Math.min(width, height) * 0.29) / (2.8 + zzz * 0.24);
    return [width / 2 + xx * scale, height / 2 + yy * scale];
  }
  function drawParticles() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    for (const star of stars) {
      const z = (star.depth + t * 0.04) % 1;
      const a = star.angle + t * 0.035;
      const radius =
        (star.radius * Math.min(width, height) * 0.19) / (0.13 + z * 2);
      const x = width / 2 + Math.cos(a) * radius,
        y = height / 2 + Math.sin(a) * radius;
      const trail = 1 + (chapter === 2 ? 12 : 2) * (1 - z);
      ctx.strokeStyle = `hsla(${180 + star.depth * 170 + t * 3},85%,75%,${(0.25 + 0.5 * z) * Math.min(radius / 200, 1)})`;
      ctx.lineWidth = z > 0.8 ? 1.5 : 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * trail, y + Math.sin(a) * trail);
      ctx.stroke();
    }
    // Concentric orbital navigation rings; the projected knot also provides a
    // complete 3D fallback when WebGL is unavailable or loses its context.
    const count = renderer ? 3 : 12;
    for (let ring = 0; ring < count; ring++) {
      ctx.strokeStyle = `hsla(${ring * 22 + 175 + t * 5},85%,65%,${renderer ? 0.2 : 0.4})`;
      ctx.lineWidth = ring % 3 === 0 ? 1.5 : 0.6;
      ctx.beginPath();
      for (let i = 0; i <= 180; i++) {
        const a = (i / 180) * Math.PI * 2,
          b = (ring / count) * Math.PI * 2;
        const radius = renderer
          ? 4.2 + ring * 0.35
          : 2 + Math.cos(a * 3 + b) * 0.8;
        const p = point(
          Math.cos(a * (renderer ? 1 : 2)) * radius,
          Math.sin(a * (renderer ? 1 : 2)) * radius,
          Math.sin(a * 3 + b) * (renderer ? 0.9 : 1.2),
        );
        i ? ctx.lineTo(...p) : ctx.moveTo(...p);
      }
      ctx.stroke();
    }
    if (pulse > 0.02) {
      ctx.strokeStyle = `rgba(130,235,255,${pulse * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        width / 2,
        height / 2,
        (1 - pulse) * Math.max(width, height),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  function paint() {
    renderer?.draw(t, chapter, pointer, pulse);
    drawParticles();
  }
  function tick(now) {
    if (stopped) return;
    frame = 0;
    if (!document.hidden && !paused) {
      const delta = Math.min((now - (last || now)) / 1000, 0.05);
      if (!reduced) t += delta;
      const next = reduced ? chapter : Math.floor(t / 13) % 3;
      if (next !== chapter) {
        chapter = next;
        onChapter(chapter);
      }
      pointer.x += (aim.x - pointer.x) * 0.06;
      pointer.y += (aim.y - pointer.y) * 0.06;
      pulse = Math.max(0, pulse - delta * 0.65);
      paint();
    }
    last = now;
    if (!paused && !document.hidden && !reduced)
      frame = requestAnimationFrame(tick);
  }
  const schedule = () => {
    if (!frame && !stopped) frame = requestAnimationFrame(tick);
  };
  const move = (event) => {
    const rect = stage.getBoundingClientRect();
    aim.x = ((event.clientX - rect.left) / width) * 2 - 1;
    aim.y = -(((event.clientY - rect.top) / height) * 2 - 1);
    if (reduced) {
      pointer.x = aim.x;
      pointer.y = aim.y;
      paint();
    }
  };
  const disturb = () => {
    pulse = 1;
    if (reduced) paint();
  };
  const visibility = () => {
    last = 0;
    if (!document.hidden) schedule();
  };
  const preference = () => {
    reduced = motion.matches;
    schedule();
  };
  const contextLost = (event) => {
    event.preventDefault();
    renderer = null;
    stage.dataset.renderer = "canvas";
    paint();
  };
  stage.addEventListener("pointermove", move);
  stage.addEventListener("pointerdown", disturb);
  canvas.addEventListener("webglcontextlost", contextLost);
  document.addEventListener("visibilitychange", visibility);
  motion.addEventListener("change", preference);
  onChapter(0);
  schedule();
  return {
    next() {
      chapter = (chapter + 1) % 3;
      t = chapter * 13 + 0.1;
      pulse = reduced ? 0 : 1;
      onChapter(chapter);
      paint();
    },
    pause(value) {
      paused = value;
      last = 0;
      if (!value) schedule();
    },
    dispose() {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerdown", disturb);
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", preference);
      canvas.removeEventListener("webglcontextlost", contextLost);
      renderer?.dispose();
      canvas.remove();
      particles.remove();
    },
  };
}
