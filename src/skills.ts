import type { Dialog } from './content';
import skills from './skills.json';

/**
 * The trophy room. `skills.json` is the single source of truth for the
 * technologies, their category and their tier; tools/build_map.py reads the
 * same file to place the trophies, and this module turns it into dialogs.
 */

export type Tier = 'gold' | 'silver' | 'bronze';

export interface Skill {
  name: string;
  tier: Tier;
  big?: boolean;
}

export interface SkillCategory {
  id: string;
  name: string;
  skills: Skill[];
}

export const SKILL_CATEGORIES: SkillCategory[] = skills.categories as SkillCategory[];

const TIER_WORDS: Record<Tier, string> = {
  gold: 'Gold trophy: one of my strongest tools, used in anger every week.',
  silver: 'Silver trophy: solid, production experience.',
  bronze: 'Bronze trophy: used it, shipped with it, would not call it a favourite.',
};

/** Ids are `skill-<category>-<index>`, matching tools/build_map.py. */
export function skillDialogs(): Record<string, Dialog> {
  const out: Record<string, Dialog> = {};
  for (const cat of SKILL_CATEGORIES) {
    cat.skills.forEach((s, i) => {
      const text = s.big
        ? `${s.name}. The big one: the technology I have gone deepest on.`
        : TIER_WORDS[s.tier];
      out[`skill-${cat.id}-${i}`] = [{ speaker: s.name, text }];
    });
  }
  return out;
}
