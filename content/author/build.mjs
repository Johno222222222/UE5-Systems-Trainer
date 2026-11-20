import { writeTrack } from "./lib.mjs";
import { fpsBeginner } from "./fps-beginner.mjs";
import { fpsIntermediate } from "./fps-intermediate.mjs";
import { tpsBeginner } from "./tps-beginner.mjs";
import { tpsIntermediate } from "./tps-intermediate.mjs";
import { horrorBeginner } from "./horror-beginner.mjs";
import { horrorIntermediate } from "./horror-intermediate.mjs";
import { strategyBeginner } from "./strategy-beginner.mjs";
import { strategyIntermediate } from "./strategy-intermediate.mjs";

const tracks = [
  fpsBeginner,
  fpsIntermediate,
  tpsBeginner,
  tpsIntermediate,
  horrorBeginner,
  horrorIntermediate,
  strategyBeginner,
  strategyIntermediate,
];
for (const track of tracks) writeTrack(new URL("../programs/", import.meta.url).pathname, track);
