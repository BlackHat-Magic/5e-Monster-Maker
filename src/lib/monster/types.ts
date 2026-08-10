export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type SkillKey =
  | "acrobatics"
  | "animal_handling"
  | "arcana"
  | "athletics"
  | "deception"
  | "history"
  | "insight"
  | "intimidation"
  | "investigation"
  | "medicine"
  | "nature"
  | "perception"
  | "performance"
  | "persuasion"
  | "religion"
  | "sleight_of_hand"
  | "stealth"
  | "survival";

export type SizeName = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";
export type SpeedLabel = "walk" | "burrow" | "climb" | "fly" | "swim";
export type SenseLabel = "blindsight" | "darkvision" | "tremorsense" | "truesight" | "telepathy";

export type PresetName =
  | ""
  | "none"
  | "attack"
  | "legendary_resistance"
  | "spellcasting"
  | "innate_spellcasting";

	export type EditorSection =
	  | "basics"
	  | "stats"
	  | "proficiencies"
	  | "language"
	  | "traits"
  | "action"
  | "bonus_action"
  | "reaction"
  | "legendary_action"
  | "villain_action"
  | "mythic_action";

export interface LanguageEntry {
  name: string;
  status: "speaks" | "understands";
  but?: string;
}

export interface ActionItem {
  name: string;
  preset?: PresetName;
  description?: string;
  uses?: number;
  interval?: string;
  recharge_min?: number;
  recharge_max?: number;
  cost?: number | string;
  initiative?: number | string;
  trigger?: string;

  // Attack preset.
  reach?: number | null;
  short_range?: number | null;
  long_range?: number | null;
  ability?: AbilityKey | null;
  die_count?: number;
  die_size?: number;
  damage_type?: string;

  // Spellcasting preset.
  level?: number;
  class?: string;
  spells?: unknown;

  // Save preset.
  dc_ability?: AbilityKey;
  save?: AbilityKey;
  dice?: string;
  damage_type_save?: string;
  area?: string;
  targets?: string;
}

export interface Basics {
  size?: SizeName;
  type?: string;
  tag?: string;
  alignment?: string;
  flavor?: string;
}

export interface Stats {
  base_ac?: number;
  add_dex?: boolean;
  max_dex?: number;
  armor?: string;
  hit_dice?: number;
  speed?: number[];
  ability_scores?: number[];
}

export interface Proficiencies {
  saves?: AbilityKey[];
  skills?: SkillKey[];
  expertise?: SkillKey[];
  damage_vulnerabilities?: string[];
  damage_resistances?: string[];
  damage_immunities?: string[];
  condition_immunities?: string[];
  senses?: Array<number | string>;
  challenge?: number | string;
}

export interface Monster {
  name?: string;
  shortened_name?: string;
  shortened_plural?: string;
  proper_noun?: boolean;

  is_legendary?: boolean;
  legendary_description?: string;
  is_villain?: boolean;
  villain_description?: string;
  is_mythic?: boolean;
  mythic_description?: string;

  basics?: Basics;
  stats?: Stats;
  proficiencies?: Proficiencies;

  language?: LanguageEntry[];

  ability?: ActionItem[];
  action?: ActionItem[];
  bonus_action?: ActionItem[];
  reaction?: ActionItem[];
  legendary_action?: ActionItem[];
  villain_action?: ActionItem[];
  mythic_action?: ActionItem[];
}
