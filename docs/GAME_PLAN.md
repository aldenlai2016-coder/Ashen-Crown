# Ashen Crown — game plan

A stylized, open-world **souls-like action RPG** in three.js, made to sell on **Steam**. Mood: **Ashen Gold**.
Inspired by the *style* of Elden Ring / Dark Souls — never their names, characters, places, bosses, items, wording or
assets.

> The engine pieces it reuses are **copied** from the owner's game Power Battlegrounds (as that game copied from Reel
> It). The two games never import from each other.

---

## 1. The pitch

The kingdom of **Aurel** was blessed by the **Golden Crown**, a radiant relic that kept the sun high and the dead at
rest. The Crown shattered. Its shards fell to the kingdom's mightiest, who were twisted by them, and ash has fallen
ever since. You are a **nameless risen knight**, woken in a field of ash. Cross the open lands, clear the fortresses,
kill the **shard-bearers** and decide what to do with the Crown.

**One line:** *a sad, golden, ruined kingdom; hard, fair boss fights; a world you want to explore.*

## 2. Pillars (every feature must serve one)

1. **Combat that's hard but fair.** Every death is the player's fault and teaches something.
2. **Bosses are the heart.** Each one is a memorable fight in a beautiful arena, with a sad story behind it.
3. **Exploration is rewarded.** See something on the horizon → go there → find something worth it.
4. **Beauty in decay.** Everything was once magnificent. Mostly grey; gold means something matters.
5. **Shippable by a tiny team.** Stylized, low-poly, foggy and data-driven. Hand-made only where it counts (bosses,
   legacy dungeons).

## 3. The mood: Ashen Gold

### Palette

| Role | Colour | Used for |
|---|---|---|
| Main | Ash grey `#8a8580` | ground, stone, ruins, falling ash |
| Light | Warm gold `#e8b54a` | sunlight, holy things, the Crown, ember shrines, loot |
| Sky | Pale cream haze `#e9dcc4` | horizon, fog |
| Shadow | Brown-violet `#3a2e35` | shadows, caves, castle interiors (never pure black) |
| Danger | Ember red `#c4492c` | fire, enemy magic, blood, death screen |
| Rare accent | Faded teal `#5f8a86` | old sorcery, ghosts, secrets |

**Rule: follow the gold.** The world is desaturated. Gold marks shrines, items, paths and bosses.

### Lighting + atmosphere
- A **low, always-late-afternoon sun**: long shadows, warm rim light.
- **Thick warm fog** that fades distance to cream. It makes the world feel huge and hides the draw distance.
- **God rays** through broken roofs and clouds; **ash particles** always drifting.
- **The Crown in the sky:** a huge cracked golden crown floating over the capital, slowly turning, visible from
  everywhere. It's the landmark the player always steers by.

### Places
Tall thin gothic towers, giant staircases, arches; **statues far too big** (scale makes the player feel small for the
price of one mesh); missing roofs, broken bridges, fallen colossi across valleys; dead white trees, golden grass, roots
through stone.

### Tone
Melancholy, not horror. Most enemies are **victims** of the fall: soldiers still guarding forgotten posts, nobles
rotting in their finery. The story is told through **item descriptions, ruins and a few strange NPCs**: cheap to write
and right for the genre.

## 4. The core loop

```
explore → find enemies / loot / secrets → fight → earn EMBERS (XP + currency)
   → rest at an EMBER SHRINE (level up, refill flasks, enemies respawn)
   → push further → BOSS → shard reclaimed → new area opens
```

**Death:** you wake at the last shrine and drop **all your carried Embers** where you fell, marked by a glowing ash
pile. Reach it without dying again and you get them back. Die first and they're gone.

## 5. Combat

Built on the Power Battlegrounds combat code (`src/game/combat.js`, `fighter.js`, `moves.js`: moves as data, hit
sweeps, hit-stop, i-frames, parries, ragdolls), **slowed down and made deliberate**.

### The player's actions

| Input (KB+M / gamepad) | Action |
|---|---|
| LMB / R1 | **Light attack**: a 3–4 hit chain per weapon |
| Hold LMB / R2 | **Heavy attack**: chargeable; breaks poise |
| RMB / L1 | **Guard**: blocks the front; costs stamina per hit |
| Guard just before a hit / L2 | **Parry**: tight window; staggers the enemy, opens a **riposte** |
| Space / B | **Dodge roll**: i-frames; distance depends on equip weight |
| Hold Space / hold B | **Sprint** |
| Jump / A | Jump; jump attacks |
| MMB / R3 | **Lock-on** (flick to switch targets) |
| R / X | **Drink a flask** (slow; you can be punished for it) |
| 1–4 / D-pad | Swap spells / items / weapon |
| E / Y | Interact, pick up, rest |

### The rules
- **Health, Focus (spells), Stamina.** Attacks, rolls, guarding and sprinting cost stamina; it regenerates quickly
  when you stop.
- **Poise + stagger:** hits wear down a hidden poise meter; breaking it staggers. Big enemies have big poise. A
  staggered or parried enemy can take a **critical hit** (a heavy, cinematic strike).
- **Commitment:** attacks can't be cancelled once started (except by being hit). Animation timing is the difficulty.
- **Backstabs:** hit a calm enemy from behind for a critical.
- **Hit feel** (from Power Battlegrounds): hit-stop, camera shake, impact flashes, sparks on a guard, a strong sound for
  each weapon class.
- **Enemy tells:** every enemy attack has a readable wind-up (pose + sound + a glint for the dangerous ones).

### Stats (level up at shrines with Embers)
**Vigor** (HP) · **Endurance** (stamina, equip load) · **Strength** · **Dexterity** · **Mind** (focus) · **Faith**
(golden miracles). Weapons scale with Strength / Dex / Faith (letter grades S–E).

### Weapons for the vertical slice (one moveset each)
1. **Longsword**: balanced, the starter
2. **Greataxe**: slow, huge damage + poise damage, Strength
3. **Twin daggers**: fast, low damage, quick roll, Dex
4. **Spear**: reach + a guard-counter poke, Dex
5. **Sacred Bell** (catalyst): 3 golden miracles: a light bolt, a short heal, a radiant burst. Faith.

**Shields:** small (better parry), medium, large (blocks everything, heavy).

### Healing
**Ember Flasks:** 4 charges, refilled at shrines. More charges come from upgrades found in the world.

## 6. The world

The full game has 5 regions (see §16 *Build later*). **The vertical slice is one region: the Ashfields.**

### The Ashfields (the vertical slice)
- **Size:** about 1 × 1 km of open land, plus its caves and one legacy dungeon.
- **Built as:** a hand-placed layout (paths, landmarks, the castle, the boss arenas) on generated terrain (heightmap +
  noise), with scattered ruins, camps and dead trees placed by rules and hand-tuned where it matters.
- **Landmarks you can see from the start:** the castle on the cliff, a fallen colossus across the valley, a burning
  windmill, the Crown in the sky.
- **Contents:**
  - **Castle Morrow** (the legacy dungeon): a hand-built castle with shortcuts that loop back to its shrines, ending at
    the major boss
  - **2 catacombs** (small hand-built dungeons with a minor boss each)
  - **1 open-world minor boss** (patrols the road at night)
  - **6 ember shrines**
  - **3–4 enemy camps**, ruined villages, a few hidden chests and secrets
  - **1 NPC** with a short questline (the mysterious knight who keeps turning up)

### Enemies (the slice)
| Enemy | Role |
|---|---|
| **Hollow Soldier** | the basic enemy: sword + shield, teaches blocking and timing |
| **Hollow Archer** | ranged, keeps you moving |
| **Ash Hound** | fast, comes in packs, teaches rolling |
| **Gilded Sentinel** | a statue that wakes up when you get close; slow, high poise, teaches patience |
| **Fallen Noble** | an elegant duelist, a mini-boss-lite that parries you back |
| **Ash Crow swarm** | ambient danger, punishes careless running |

AI starts from the Power Battlegrounds bot brain (`src/game/botBrain.js`: targeting, spacing, reactions, tiers),
reworked into **patrolling, aggro, leashing back home, attack-pattern tables and group behaviour** (no more than 2
attacking at once).

### Bosses (the slice: 1 major + 3 minor)
| Boss | Where | The fight |
|---|---|---|
| **The Hollow Champion** *(major)* | Castle Morrow's throne hall | The kingdom's greatest knight, still fighting a war that ended long ago. Phase 1: precise sword and shield. Phase 2 (at 50%): drops the shield and fights with two-handed fury while golden fire runs along the blade. |
| **The Gravewarden** *(minor)* | Catacomb 1 | A huge jailer with a hook and chain that pulls you in |
| **Twin Mourners** *(minor)* | Catacomb 2 | Two veiled sisters; when one dies the other grows stronger |
| **The Night Rider** *(minor)* | The Ashfields road, at night | A mounted knight; charges and sweeping spear arcs |

**Boss design rules:** every attack has a tell; every boss has a pattern table plus phase-2 additions; every arena is
beautiful and readable (no clutter to catch the camera); a fog gate at the entrance; the shrine near the boss is
**close** (a long run back is a punishment, not a challenge); a health bar with the boss's name at the bottom of the
screen.

**On a win:** the music cuts, a single deep tone, gold text **SHARD RECLAIMED**, a big Ember payout and a unique item
(a boss weapon or spell).

## 7. The player character + gear

- **The risen knight:** helmet hides the face, no voice. Starts in worn armour and a ragged cloak; ends in gold armour
  they earned.
- **Starting classes** (only starting stats + gear differ): **Knight** (longsword + shield), **Brute** (greataxe),
  **Rogue** (twin daggers), **Pilgrim** (bell + spear).
- **Armour:** head / chest / arms / legs; weight affects the roll (light < 30% load, medium < 70%, heavy beyond).
- **Upgrades:** weapons +1 → +10 with **Gilded Shards** at the smith in the hub shrine.
- **Rings:** 2 slots, passive effects (more stamina, quieter steps, Embers +10%).

## 8. Camera + feel

- A third-person orbit camera that's never obstructed (pulls in at walls), with soft lock-on framing both fighters.
  Starts from `src/entities/cameraRig.js`.
- The camera **never** spins wildly when a big boss is locked on (clamp its pitch; widen the FOV a little).
- Optional: a **cinematic** boss intro (a short camera swing + the name card), reusing the ultimate's cinematic
  camera.

## 9. HUD + menus

- **On screen:** thin Health / Focus / Stamina bars top-left, the equipped item + spell + weapons bottom-left, the
  Ember count bottom-right, a boss bar bottom-centre. Nothing else.
- **Style:** thin gold rules, an old serif font, cream on dark: a faded royal manuscript.
- **Death:** slow ember-red text **YOU FELL**, a fade to black, wake at the shrine.
- **Menus:** inventory, equipment, level up (at shrines), map (fog-of-war, revealed by map fragments), settings.
- **Settings (required for Steam):** resolution / window mode / V-sync / FPS cap; graphics presets; key rebinding;
  gamepad remap; mouse sensitivity + invert; camera distance; subtitles; volume sliders (master, music, SFX, voice).

## 10. Sound + music

- **Exploring:** near silence. Wind, distant bells, hissing ash, footsteps that change with the surface.
- **Ember shrine:** a warm, safe theme (harp or a lone cello).
- **Bosses:** choir + strings + timpani; phase 2 changes the track.
- **Weapons:** each class has its own swing, hit, guard and parry sound.
- Start from Power Battlegrounds' procedural audio (`src/core/audio.js`, `music.js`), but **the final game needs
  recorded or licensed music and SFX.** Procedural sound reads as "web game" on Steam.

## 11. Tech

### Stack
- **three.js** (current release, pinned) + **esbuild**, plain JS modules, as now.
- **Desktop wrapper: Electron**, with Steam features through **steamworks.js**. Its GitHub page describes it as *"A
  steamworks implementation for nw.js/electron games"* (<https://github.com/ceifa/steamworks.js>).
- **Builds:** Windows first (most Steam players), then Linux / **Steam Deck**; macOS later.
- **Target:** 60 fps at 1080p on a mid-range GPU from about 5 years ago, and on Steam Deck at its native 800p.

### Reused from the Power Battlegrounds engine (copied, not imported)
| Piece | From | Change |
|---|---|---|
| Toon renderer, bloom, vignette | `src/world/toon.js`, `src/core/graphics.js` | muted Ashen Gold palette, softer outlines, fog + god rays |
| Input | `src/core/input.js` | + **gamepad** (Gamepad API), rebinding |
| Camera | `src/entities/cameraRig.js` | souls lock-on, wall collision |
| Combat rules | `src/game/combat.js`, `fighter.js`, `moves.js` | stamina, poise, criticals, backstabs, weapon movesets |
| Character body | `src/game/body.js` | uneven ground, slopes, ledges, stairs |
| Enemy AI | `src/game/botBrain.js` | patrol / aggro / leash, pattern tables, bosses |
| Hit VFX + particles | `src/entities/fightFx.js`, `effects.js`, `movesetFx.js` | sparks, ash, golden fire |
| Audio engine | `src/core/audio.js`, `music.js` | placeholder sounds until real assets arrive |
| Saves | `src/core/save.js` | → local save **files** + Steam Cloud; 3 save slots |

**Dropped:** the CrazyGames SDK, ads, PeerJS rooms (co-op is later, through Steam), Roblox-style R6 looks, emotes.

### New pieces to build
1. **Characters + animation.** Knights and monsters need real models. Start with the procedural pose rig (fast to
   iterate), then move to **skinned glTF models with animation clips** (made in Blender, or bought packs edited to
   fit) and three.js `AnimationMixer`, with **root motion** for attacks. Hitboxes are tied to bones.
2. **Terrain:** a heightmap chunked into tiles with LODs, splat-painted ground (ash / grass / stone / road), instanced
   grass + rocks + dead trees.
3. **World streaming:** load / unload chunks and dungeon interiors around the player; nothing hitches.
4. **A level editor** (in-game, dev-only): place ruins, enemies, shrines, chests, triggers and fog gates; save to JSON.
   **The biggest new tool; it pays for itself on every region.**
5. **Physics / collision:** keep the capsule controller; add a proper broadphase for a big world (or bring in a small
   physics library if needed).
6. **Boss framework:** phases, pattern tables, arenas, fog gates, the boss bar, the intro, the win sequence.
7. **Inventory, equipment, stats, levelling, upgrades:** pure data + logic, node-testable like Power Battlegrounds'
   combat.
8. **Electron + Steam:** window, full-screen, saves to the user's folder, Steam Cloud, achievements, overlay.

### Testing (the same habits as Power Battlegrounds)
- `npm test`: combat, stats, inventory, AI and save logic in node.
- A **boss sim**: a scripted "good player" against each boss to check it can be beaten and how long it takes.
- **Dev galleries:** the weapons gallery (each moveset on a dummy, slow motion), the enemy gallery, the boss arena
  viewer.
- **A performance check**: a fixed camera fly-through of the region, recording frame times.

## 12. Milestones

Each milestone ends with something playable. **Never start the next one until the current one feels good.**

### M0 — Setup (about 1–2 weeks)
New repo; engine pieces copied in; Electron window running the game; gamepad input; a test arena with a dummy.
**Done when:** you can run, roll and swing a sword at a dummy in a desktop window, on keyboard or gamepad.

### M1 — Combat feel (about 4–6 weeks) ← *the most important milestone*
Stamina, light / heavy attacks, roll, guard, parry, riposte, poise, stagger, criticals, backstabs, lock-on, flasks;
the longsword + one shield; Hollow Soldier + Ash Hound; hit feel; death + the Ember drop.
**Done when:** fighting 1–3 Hollow Soldiers in a test arena is fun for 20 minutes, and testers say dying felt fair.

### M2 — First boss (about 3–4 weeks)
The boss framework + **The Hollow Champion** in a grey-box arena (both phases).
**Done when:** the boss takes a first-time tester 5–15 tries, and they want another go after every death.

### M3 — The Ashfields (about 6–10 weeks)
Terrain, streaming, the level editor, the Ashen Gold look (palette, fog, god rays, ash, the Crown in the sky); shrines,
levelling, inventory, the 4 other weapons + the bell; all slice enemies; the 2 catacombs + 2 minor bosses; the Night
Rider; the NPC.
**Done when:** a tester explores for an hour without being told where to go, and wants to keep going.

### M4 — Castle Morrow + polish = the vertical slice (about 6–8 weeks)
The legacy dungeon with its shortcuts; the Hollow Champion in his real arena; real models + animations for the player
and slice enemies; menus, settings, 3 save slots; first real music + SFX; performance on Steam Deck.
**Done when:** about 1–2 hours from the start of the game to beating the Hollow Champion, and it looks good enough
for a trailer.

### M5 — Steam page + demo (about 3–4 weeks)
Capsule art, screenshots, a trailer, the store page; the **demo** = the Ashfields slice; Steam Cloud + a few
achievements; a crash reporter; feedback from playtests through Steam.
**Done when:** the Steam page is live and gathering wishlists, and the demo is ready for a **Steam Next Fest**.

### After M5 → the *Build later* section
Early Access (2 regions, 4 major bosses), then the full release.

**Rough total to the demo: about 6–9 months** of steady work, working with Claude (and Codex for self-contained
modules). This is a guess; the combat (M1) and the art (M4) are where it can stretch.

## 13. Releasing on Steam: checklist

- [ ] A Steamworks partner account + the per-game app fee. I remember it as **$100, recouped after $1,000 in sales**,
      but couldn't open Steam's site from here to confirm — **check the "Steam Direct" page on
      partner.steamgames.com before relying on it.**
- [ ] The store page live **months before** launch (wishlists drive launch visibility).
- [ ] A capsule image, 5+ screenshots, a trailer (bosses first, within the first 5 seconds).
- [ ] A content survey / age rating answered honestly (fantasy violence, blood).
- [ ] Controller support declared; aim for **Steam Deck Verified**.
- [ ] Steam Cloud saves, achievements, the overlay working inside Electron.
- [ ] A free **demo**, entered in a **Steam Next Fest**.
- [ ] A price: about **$15–20** for Early Access with 2 regions; reconsider at full release.
- [ ] Every asset licensed for commercial use (keep a `CREDITS.md` + licences folder).

## 14. Risks + how we handle them

| Risk | Mitigation |
|---|---|
| **Scope grows until it never ships** | Ship the slice first. Anything new goes to *Build later*, not into the current milestone. |
| **Combat feels floaty / unfair** | M1 is long on purpose. Playtest early, record clips, tune frame data in `moves.js`-style data files. |
| **Art looks "cheap"** | Commit to the stylized toon + fog look; spend art budget on the player, bosses and landmarks, not everything. Buy model / animation packs where it helps. |
| **Animation is a lot of work** | Fewer, better weapon classes; share skeletons across enemies; buy animation packs and edit them. |
| **three.js performance in a big world** | Chunk streaming, instancing, LODs, fog limits the draw distance, and a performance check every milestone. |
| **It looks like a copy** | Original names, characters, places, story and UI wording. Inspired by the genre, not one game. |
| **Solo burnout** | Small, playable milestones; show progress often (Steam page, devlogs). |

## 15. Rules

1. **Original only.** Never use Elden Ring / Dark Souls / FromSoftware names, characters, bosses, places, items, UI
   wording, logos or assets. No look-alike bosses.
2. **Fair difficulty.** Every enemy attack has a tell; shrines sit close to bosses; no damage you can't see coming.
3. **Gamepad is first-class** from M0, not bolted on at the end.
4. **Every asset licensed** for commercial use, recorded in `CREDITS.md`.
5. **No secrets in the build:** no API keys, no admin switches (Electron apps can be unpacked).
6. **Test the rules in node** (combat, stats, inventory, saves), like Power Battlegrounds.
7. **Keep the plan honest:** this file is updated at the end of every milestone.

## 16. Build later

Not in the vertical slice. Parked here so the slice stays small; pull from this list only after M5.

### More world
- **The Gilded Capital:** the fallen royal city, the biggest legacy dungeon (Early Access)
- **The Ember Wastes:** a burned land still smouldering under red skies
- **The Pale Heights:** white-and-gold mountains above the ash, up near the Crown
- **The Hollow Below:** a dark realm beneath the capital (the late-game secret area)
- More catacombs, caves, towers and hidden areas in every region
- A **day / night cycle** with different enemies at night

### More bosses (the shard-bearers)
- **The Gilded Matriarch:** a queen fused to her golden throne, which walks on stone legs
- **The Ashen Wyrm:** a dragon whose fire burned out; it breathes choking ash instead
- **The Last Priest:** prays to a dead god and is answered with something terrible in phase 2
- One major boss per region, 15–20 minor bosses across the game, and an optional super-boss
- A final boss + **2–3 endings** depending on what you do with the Crown

### More systems
- **Spirit mount** for crossing the open world, with mounted combat
- **Co-op summons:** summon a friend through Steam for a boss (Steam networking)
- **Spirit summons:** call AI allies in boss fights
- More weapon classes (greatsword, katana-style curved sword, hammer, bow, crossbow, whip, fist weapons, staffs)
- **Sorcery** (teal, old magic) next to the golden miracles; weapon skills / special arts
- Weapon **infusions** (fire, holy, ash, frost)
- **Crafting** (arrows, throwables, consumables) from gathered materials
- More NPC questlines, merchants, and a hub that fills up as you save people
- Hidden items + lore everywhere; item descriptions that tell the story
- **New Game +** (harder, with new item versions)
- More rings, armour sets, upgrade paths

### More release polish
- A full achievement list; trading cards
- Recorded voice for the few NPCs; a full orchestral-style soundtrack
- **Photo mode**
- **Localisation** (start with the languages most Steam players use)
- macOS build; ultrawide support; accessibility options (colour-blind modes, camera-shake slider, an easier-difficulty
  option or a "help" item)
- Steam Workshop / mod support, much later and only if wanted
