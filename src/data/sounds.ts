import type { LucideIcon } from "lucide-react";
import {
  CloudRain,
  CloudLightning,
  Wind,
  Waves,
  Trees,
  Bird,
  Flame,
  Coffee,
  TrainFront,
  AudioWaveform,
  Droplets,
  Bug,
  Leaf,
  Tent,
  House,
  Radio,
  AppWindow,
  CloudDrizzle,
} from "lucide-react";
import rain from "@/assets/scene-rain.webp";
import ocean from "@/assets/scene-ocean.webp";
import fire from "@/assets/scene-fireplace.webp";
import diorama from "@/assets/home-diorama.webp";

export type Category = "Natureza" | "Chuva" | "Aconchego" | "Cidade" | "Ruídos";

export interface Sound {
  id: string;
  name: string;
  category: Category;
  icon: LucideIcon;
}

export const sounds: Sound[] = [
  { id: "rain", name: "Chuva", category: "Chuva", icon: CloudRain },
  { id: "window-rain", name: "Chuva na janela", category: "Chuva", icon: AppWindow },
  { id: "roof-rain", name: "Chuva no telhado", category: "Chuva", icon: House },
  { id: "thunder", name: "Trovões", category: "Chuva", icon: CloudLightning },
  { id: "far-storm", name: "Tempestade distante", category: "Chuva", icon: CloudDrizzle },
  { id: "wind", name: "Vento", category: "Natureza", icon: Wind },
  { id: "ocean", name: "Oceano", category: "Natureza", icon: Waves },
  { id: "forest", name: "Floresta", category: "Natureza", icon: Trees },
  { id: "birds", name: "Pássaros", category: "Natureza", icon: Bird },
  { id: "crickets", name: "Grilos", category: "Natureza", icon: Bug },
  { id: "stream", name: "Água corrente", category: "Natureza", icon: Droplets },
  { id: "leaves", name: "Folhas balançando", category: "Natureza", icon: Leaf },
  { id: "tree-wind", name: "Vento nas árvores", category: "Natureza", icon: Trees },
  { id: "fireplace", name: "Lareira", category: "Aconchego", icon: Flame },
  { id: "campfire", name: "Fogueira", category: "Aconchego", icon: Tent },
  { id: "cafe", name: "Cafeteria", category: "Cidade", icon: Coffee },
  { id: "train", name: "Trem", category: "Cidade", icon: TrainFront },
  { id: "white", name: "Ruído branco", category: "Ruídos", icon: Radio },
  { id: "pink", name: "Ruído rosa", category: "Ruídos", icon: AudioWaveform },
  { id: "brown", name: "Ruído marrom", category: "Ruídos", icon: AudioWaveform },
];

export const categories: Category[] = ["Chuva", "Natureza", "Aconchego", "Cidade", "Ruídos"];

export interface Experience {
  id: string;
  title: string;
  mood: string;
  image: string;
  mix: { soundId: string; volume: number }[];
}

export const experiences: Experience[] = [
  {
    id: "rain-forest",
    title: "Floresta sob a chuva",
    mood: "Dormir",
    image: rain,
    mix: [
      { soundId: "rain", volume: 70 },
      { soundId: "thunder", volume: 25 },
      { soundId: "forest", volume: 35 },
    ],
  },
  {
    id: "moon-sea",
    title: "Mar ao luar",
    mood: "Relaxar",
    image: ocean,
    mix: [
      { soundId: "ocean", volume: 75 },
      { soundId: "wind", volume: 20 },
    ],
  },
  {
    id: "cabin",
    title: "Cabana aquecida",
    mood: "Ler",
    image: fire,
    mix: [
      { soundId: "fireplace", volume: 60 },
      { soundId: "window-rain", volume: 40 },
    ],
  },
  {
    id: "lake-house",
    title: "Casa do lago",
    mood: "Meditar",
    image: diorama,
    mix: [
      { soundId: "crickets", volume: 45 },
      { soundId: "stream", volume: 55 },
    ],
  },
];

export const moods = ["Dormir", "Relaxar", "Meditar", "Estudar", "Trabalhar", "Ler", "Concentrar"];

export const filterExperiencesByMood = (mood: string | null) =>
  mood ? experiences.filter((experience) => experience.mood === mood) : experiences;

export const soundById = (id: string) => sounds.find((s) => s.id === id)!;
export const iconFor = (slug: string): LucideIcon =>
  sounds.find((s) => s.id === slug)?.icon ?? AudioWaveform;
