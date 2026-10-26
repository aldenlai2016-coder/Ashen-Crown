// The knight's pose data (src/entities/knightPoses.js), checked in node: every clip samples to finite joint angles at
// any time, keys are in order inside the clip, every clip loops without a jump, and the attack and the roll start
// from the guard stance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIPS, JOINTS, samplePose, mixPoses } from '../src/entities/knightPoses.js';

for (const [name, clip] of Object.entries(CLIPS)) {
  test(`${name}: keys are in order and inside the clip`, () => {
    assert.equal(clip.keys[0].t, 0);
    for (let i = 1; i < clip.keys.length; i++) assert.ok(clip.keys[i].t > clip.keys[i - 1].t, `key ${i} out of order`);
    assert.ok(clip.keys.at(-1).t <= clip.duration);
  });

  test(`${name}: every joint is finite at every time`, () => {
    for (let t = -1; t <= clip.duration * 2; t += 0.013) {
      const p = samplePose(clip, t);
      for (const j of JOINTS) for (const v of p.joints[j]) assert.ok(Number.isFinite(v), `${j} at ${t}`);
      for (const v of Object.values(p.root)) assert.ok(Number.isFinite(v));
    }
  });

  test(`${name}: starts and ends in the same body pose (it loops without a jump)`, () => {
    const a = samplePose(clip, 0), b = samplePose(clip, clip.duration - 1e-6);
    for (const j of JOINTS) for (let k = 0; k < 3; k++) assert.ok(Math.abs(a.joints[j][k] - b.joints[j][k]) < 0.02, `${j}[${k}]`);
  });
}

test('the attack and the roll start in the guard stance (the walk has its own cycle)', () => {
  const guard = samplePose(CLIPS.idle, 0);
  for (const name of ['attack', 'roll']) {
    const p = samplePose(CLIPS[name], 0);
    for (const j of JOINTS) assert.deepEqual(p.joints[j], guard.joints[j], `${name} ${j}`);
  }
});

test('the roll makes exactly one forward turn', () => {
  const end = samplePose(CLIPS.roll, CLIPS.roll.duration - 1e-6);
  assert.ok(Math.abs(end.root.pitch - 2 * Math.PI) < 1e-3);
});

test('mixPoses is a straight blend', () => {
  const a = samplePose(CLIPS.idle, 0), b = samplePose(CLIPS.roll, 0.44);
  const m = mixPoses(a, b, 0.5, true);
  for (const j of JOINTS) for (let k = 0; k < 3; k++) assert.ok(Math.abs(m.joints[j][k] - (a.joints[j][k] + b.joints[j][k]) / 2) < 1e-9);
});
