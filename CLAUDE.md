# Ashen Crown — project rules

A stylized souls-like action RPG in three.js (r180) + esbuild, to sell on Steam. The whole design is in
`docs/GAME_PLAN.md`: read it before changing anything. Engine pieces are **copied** (never imported) from the owner's
game Power Battlegrounds (`aldenlai2016-coder/power-battlegrounds`, read only).

## Where updates go (from the owner)

- **Every new update to the game is published to its claude.ai Artifact.** Build the single-file page
  (`npm run build` → `release/ashen-crown.html`) and republish it to the **same Artifact URL** each time, so the link
  never changes. Artifact: https://claude.ai/artifact/RhtmHVBBrjhgsJ84SCfQoK
- **Phase 0.1 is logged in the Google Doc "Ashen Crown Docs"**, made with the Google Drive connector: what was built,
  decisions, and what's next. Add an entry whenever there's progress. Doc: https://docs.google.com/document/d/1TlqJmR0sk7AlEwdJoiAKtU1SPpXKZ1rkJd5cPA9AToE/edit
  (the Google Docs editor connector was not available when it was made, so later entries may need it turned on)

## Rules from the plan (`docs/GAME_PLAN.md` §15, quoted)

1. "**Original only.** Never use Elden Ring / Dark Souls / FromSoftware names, characters, bosses, places, items, UI
   wording, logos or assets. No look-alike bosses."
2. "**Fair difficulty.** Every enemy attack has a tell; shrines sit close to bosses; no damage you can't see coming."
3. "**Gamepad is first-class** from M0, not bolted on at the end."
4. "**Every asset licensed** for commercial use, recorded in `CREDITS.md`."
5. "**No secrets in the build:** no API keys, no admin switches (Electron apps can be unpacked)."
6. "**Test the rules in node** (combat, stats, inventory, saves), like Power Battlegrounds."
7. "**Keep the plan honest:** this file is updated at the end of every milestone."

Also from the plan: "**Never start the next one until the current one feels good.**" (§12, milestones) and the
palette rule "**follow the gold.** The world is desaturated. Gold marks shrines, items, paths and bosses." (§3).

## Owner decisions since the plan

- **High poly** (phase 0.1, on the first knight: "no, it needs to be more high poly", then "like improve it"): smooth,
  finely divided models, not the plan's low-poly look. `docs/GAME_PLAN.md` pillar 5 is updated to match.

## Status: phase 0.1 — the risen knight

- `src/entities/knightRig.js`: the knight as a **procedural pose rig** (plan §11: "Start with the procedural pose rig
  (fast to iterate)"): lathed armour, layered plates, fingered gauntlets, a one-piece cloak bent on three springs, a
  longsword and a heater shield. The rig keeps the body's lowest point on the ground every frame.
- `src/entities/knightPoses.js`: the clips as data; node-tested by `scripts/poses.test.mjs`. Sign conventions are in
  the file's header. Moves: idle, walk, roll; with a sword: light attack, heavy attack, smash, thrust; with a shield:
  bash, guard, parry; with no sword the light / heavy buttons give a punch / kick (`MOVESETS`, owner: "add more moves
  like heavy attack, smash … if its holding a weapons"). A clip's `needs` lists the gear it needs, `events` the moments
  effects fire.
- Arms are aimed, not hand-tuned: a key's `aim` says where the hilt + tip, fist, or shield centre + facing should be,
  and `node scripts/solveArms.mjs [clip]` solves the angles into `src/entities/knightArms.json` (run it after
  changing a key's body pose or aim, then look at the move).
- `src/entities/knightFx.js`: hit feel (plan §5: "hit-stop, camera shake, impact flashes, sparks on a guard"): dust
  ring + ash on ground impacts, sparks on clangs, a gold flash on a parry, camera shake.
- `src/tools/knightGallery.js` + `public/knight.html`: the dev gallery (number keys moves, Q sword, E shield, S slow
  motion; gamepad bumpers / D-pad moves, X sword, B shield, Y slow motion). `?clip=heavy&t=1.0&cam=x,y,z,tx,ty,tz&
  gear=shield&nohud=1` freezes a pose for screenshots.
- `src/world/toon.js`: copied from Power Battlegrounds, retuned for Ashen Gold (softer brown-violet ink, less
  saturation).

## Commands

- `npm run dev` → http://localhost:5173/knight.html (live bundling)
- `npm test` → the node tests
- `npm run build` → `release/ashen-crown.html`, the one file the Artifact is published from
- Look at changes in a browser before calling them done (Playwright + Chromium are installed in cloud sessions).
