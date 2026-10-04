export type HairStyle = "short" | "long" | "bun" | "ponytail";

export type CharacterPalette = {
  skin: string;
  hair: string;
  jacket: string;
  pants: string;
  shoes: string;
  accent: string;
};

export type CharacterDefinition = {
  id: string;
  gender: "male" | "female";
  label: string;
  palette: CharacterPalette;
  hair: HairStyle;
  /** 1 = default shoulder width. */
  shoulder: number;
  hip: number;
};

/** Data-driven character registry — add NPCs/variants by adding entries. */
export const CHARACTERS: Record<string, CharacterDefinition> = {
  "engineer-male": {
    id: "engineer-male",
    gender: "male",
    label: "Engineer",
    palette: { skin: "#c58c68", hair: "#2a211d", jacket: "#1f4e6e", pants: "#26303a", shoes: "#e8e4dc", accent: "#22d3ee" },
    hair: "short",
    shoulder: 1,
    hip: 1,
  },
  "engineer-female": {
    id: "engineer-female",
    gender: "female",
    label: "Engineer",
    palette: { skin: "#d9a077", hair: "#4a2c14", jacket: "#7c3aed", pants: "#1f2937", shoes: "#e8e4dc", accent: "#f0abfc" },
    hair: "ponytail",
    shoulder: 0.85,
    hip: 0.95,
  },
  alex: {
    id: "alex",
    gender: "male",
    label: "Alex Morgan",
    palette: { skin: "#c58c68", hair: "#3f3f46", jacket: "#f97316", pants: "#292524", shoes: "#44403c", accent: "#fdba74" },
    hair: "short",
    shoulder: 1.05,
    hip: 1,
  },
  priya: {
    id: "priya",
    gender: "female",
    label: "Priya Nair",
    palette: { skin: "#8d5524", hair: "#111827", jacket: "#0e7490", pants: "#164e63", shoes: "#e8e4dc", accent: "#38bdf8" },
    hair: "bun",
    shoulder: 0.85,
    hip: 0.95,
  },
};

export function getCharacter(id: string): CharacterDefinition {
  return CHARACTERS[id] ?? CHARACTERS["engineer-male"];
}

export function characterForGender(gender: "male" | "female"): CharacterDefinition {
  return gender === "female" ? CHARACTERS["engineer-female"] : CHARACTERS["engineer-male"];
}
