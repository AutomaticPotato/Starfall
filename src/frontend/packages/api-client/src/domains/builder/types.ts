// --- Selection rules ---

export type SelectionRuleDataModel = {
  registrationId: string;
  registrationSelectionRuleId: string;
  name: string;
  type: string;
  activeRegistration?: boolean;
};

export type SelectionRuleOptionDataModel = {
  elementId: string;
  name: string;
  source?: string | null;
  /** What it asks of the character, in words ("Artificer Level 6+"). */
  prerequisite?: string | null;
  /** False when the character does not meet its requirements yet (a plan for a higher level). */
  eligible?: boolean;
  /** For a spell: its level (0 = cantrip), school and casting figures. */
  spell?: SpellOptionDataModel | null;
};

export type SpellOptionDataModel = {
  level: number;
  school?: string | null;
  castingTime?: string | null;
  range?: string | null;
  duration?: string | null;
  components?: string | null;
  concentration?: boolean;
  ritual?: boolean;
  /** The spell lists it is on ("Wizard", "Cleric"). */
  lists?: string[];
};

// --- Registrations ---

export type RegistrationModel = {
  registrationId: string;
  name: string;
  type: string;
  associatedElementId: string;
  parentRegistrationId?: string;
  characterId: string;
  children?: RegistrationModel[];
};

// --- Classes ---

export type CharacterClass = {
  characterClassId: string;
  registrationId: string;
  name: string;
  level: number;
  isPrimary: boolean;
};

// --- Statistics ---

export type StatisticValueDataModel = {
  source: string;
  value: number;
  displayName?: string;
  ruleId?: string;
};

export type StatisticGroupDataModel = {
  groupName: string;
  totalValue: number;
  values: StatisticValueDataModel[];
  isFinalized: boolean;
};

// --- Mutations ---

export type RegisterSelectionRequest = {
  parentRegistration: string;
  elementId: string;
};

export type RegisterSelectionResponse = {
  registrationId: string;
};

export type UnregisterSelectionRequest = {
  parentRegistration: string;
  elementId: string;
};

export type UpdateClassLevelRequest = {
  newLevel: number;
};
