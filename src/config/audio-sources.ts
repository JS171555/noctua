/** User-supplied rain/thunder and generated ambience; noises use a worker.
 * URLs are versioned so old deployments/caches cannot replace the new sound pack.
 * See docs/audio.md for production details and limitations.
 */
export const audioSources: Partial<Record<string, string>> = {
  rain: "/audio/v2/rain.mp3?rev=5",
  "window-rain": "/audio/v2/window-rain.mp3",
  "roof-rain": "/audio/v2/roof-rain.mp3",
  thunder: "/audio/v2/thunder.mp3?rev=5",
  "far-storm": "/audio/v2/far-storm.mp3",
  wind: "/audio/v2/wind.mp3",
  ocean: "/audio/v2/ocean.mp3",
  forest: "/audio/v2/forest.mp3",
  birds: "/audio/v2/birds.mp3",
  crickets: "/audio/v2/crickets.mp3",
  stream: "/audio/v2/stream.mp3",
  leaves: "/audio/v2/leaves.mp3",
  "tree-wind": "/audio/v2/tree-wind.mp3",
  fireplace: "/audio/v2/fireplace.mp3",
  campfire: "/audio/v2/campfire.mp3",
  cafe: "/audio/v2/cafe.mp3",
  train: "/audio/v2/train.mp3",
};
