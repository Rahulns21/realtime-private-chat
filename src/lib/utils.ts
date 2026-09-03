import { nanoid } from "nanoid";
import { PREFIXES, ANIMALS } from "./constants";

// --- Utility Functions ---

export const capitalize = (str: string): string => {
    if (!str) return '';
    return str.charAt(0).toUpperCase + str.slice(1);
}

export const generateUsername = () => {
    const word = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `anonymous-${word}-${animal}-${nanoid(5)}`;
};