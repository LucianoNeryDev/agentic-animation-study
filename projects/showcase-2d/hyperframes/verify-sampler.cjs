// Parity check: this route's sampler against fight.py's reference sampler.
// Compares every joint of both fighters plus the camera pan on every frame (270 at 60 fps).
//   node verify-sampler.cjs        (run from this directory; needs python3)
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const dir = path.resolve(__dirname, "..");
// Load fight.js and sampler.js exactly as the page does, into a stub window.
const vm = require("vm");
const ctx = { window: {} };
for (const f of ["fight.js", "sampler.js"]) vm.runInNewContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx);
const Fight = ctx.window.Fight;
const FPS = 60, N = Math.round(Fight.FIGHT.duration * FPS);

const py = `
import json, sys
sys.path.insert(0, ${JSON.stringify(dir)})
import fight
out = []
for f in range(${N}):
    t = f / ${FPS}
    out.append({"cam": fight.cam_x(t), **{n: fight.skeleton(fight.FIGHT, n, t) for n in ("blue", "red")}})
print(json.dumps(out))
`;
const ref = JSON.parse(execFileSync("python3", ["-c", py], { maxBuffer: 64 << 20 }));

let worst = 0, where = "";
for (let f = 0; f < N; f++) {
  const t = f / FPS;
  const d = Math.abs(Fight.camX(t) - ref[f].cam);
  if (d > worst) [worst, where] = [d, `cam @ frame ${f}`];
  for (const n of ["blue", "red"]) {
    const js = Fight.skeleton(n, t);
    for (const k in ref[f][n]) for (const i of [0, 1]) {
      const e = Math.abs(js[k][i] - ref[f][n][k][i]);
      if (e > worst) [worst, where] = [e, `${n}.${k}[${i}] @ frame ${f}`];
    }
  }
}
for (const [n, t] of [["blue", 0.84], ["blue", 1.86], ["red", 2.4], ["red", 3.5]]) {
  const f = Math.round(t * FPS), j = Fight.skeleton(n, f / FPS), r = ref[f][n];
  console.log(`${n} hand_f/head @ ${t}s  js ${j.hand_f.map((v) => v.toFixed(6))} ${j.head.map((v) => v.toFixed(6))}` +
    `  py ${r.hand_f.map((v) => v.toFixed(6))} ${r.head.map((v) => v.toFixed(6))}`);
}
console.log(`${N} frames, 2 fighters x 13 joints + camera: max |js - py| = ${worst.toExponential(2)} (${where || "all equal"})`);
process.exit(worst < 1e-9 ? 0 : 1);
