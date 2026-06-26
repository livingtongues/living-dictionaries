export interface KeymanWeb {
  // these are just handwritten partial types - full types should come from Keyman
  init({ attachType }: OptionType): Promise<unknown>;
  detachFromControl(el: Element): unknown;
  addKeyboards(id: string): Promise<unknown>;
  attachToControl(el: Element): unknown;
  setKeyboardForControl(el: Element, id: string, bcp: string): unknown;
}

// from https://github.com/keymanapp/keyman/blob/master/web/source/kmwbase.ts
interface OptionType {
  root?: string;
  resources?: string;
  keyboards?: string;
  fonts?: string;
  attachType?: 'auto' | 'manual' | ''; // If blank or undefined, attachType will be assigned to "auto" or "manual"
  ui?: string;
  setActiveOnRegister?: string;
  spacebarText?: SpacebarText; //  default text shown on the spacebar, default: LANGUAGE_KEYBOARD
  useAlerts?: boolean; // Keyman displays its own alert messages, default: true
}

enum SpacebarText {
  KEYBOARD = 'keyboard',
  LANGUAGE = 'language',
  LANGUAGE_KEYBOARD = 'languageKeyboard',
  BLANK = 'blank'
}
