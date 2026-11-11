import { describe, expect, it } from "vitest";
import { experiences, filterExperiencesByMood } from "@/data/sounds";

describe("experience mood filters", () => {
  it("returns every experience when no mood is selected", () => {
    expect(filterExperiencesByMood(null)).toEqual(experiences);
  });

  it("returns only experiences matching the selected mood", () => {
    expect(
      filterExperiencesByMood("Relaxar").map((experience) => experience.id),
    ).toEqual(["moon-sea"]);
  });

  it("returns an empty list for moods with no published experiences", () => {
    expect(filterExperiencesByMood("Estudar")).toEqual([]);
  });

  it("keeps thunder present in the rain forest mix", () => {
    const rainForest = experiences.find(
      (experience) => experience.id === "rain-forest",
    )!;
    expect(
      rainForest.mix.find((item) => item.soundId === "thunder")!.volume,
    ).toBe(45);
  });
});
