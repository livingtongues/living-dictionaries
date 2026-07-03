/**
 * Pure helpers for the admin-only "View as…" persona preview. The reactive
 * `AuthUser` class holds the `$state` and delegates the role math here so it
 * stays testable. Client-only and in-memory — see `AuthUser.preview`.
 *
 * LD has no subscriptions (unlike house), so a persona is just an admin tier:
 * the real admin's level down to 1, then a single level-0 "Visitor".
 */

export interface PreviewState {
  /** Previewed admin tier: 0 = non-admin visitor, else a level at or below the real level. */
  admin_level: number
}

export interface Persona {
  key: string
  label: string
  admin_level: number
}

export const LEVEL_LABELS: Readonly<Record<number, string>> = {
  0: 'Visitor',
  1: 'Super Manager',
  2: 'Admin',
  3: 'Super Admin',
}

/**
 * The "View as…" ladder for a real admin: their own level down to 1, then a
 * single level-0 "Visitor". A non-admin (level 0) gets an empty ladder — the
 * picker is never shown to them.
 */
export function build_personas({ real_admin_level }: { real_admin_level: number }): Persona[] {
  const personas: Persona[] = []
  for (let level = real_admin_level; level >= 1; level--)
    personas.push({ key: `admin-${level}`, label: LEVEL_LABELS[level], admin_level: level })
  if (real_admin_level >= 1)
    personas.push({ key: 'visitor', label: LEVEL_LABELS[0], admin_level: 0 })
  return personas
}

/** Clamp a requested preview so it can only step DOWN — never escalate above the real level. */
export function clamp_preview_level({ requested, real_admin_level }: { requested: number, real_admin_level: number }): number {
  return Math.max(0, Math.min(requested, real_admin_level))
}

export function persona_label({ admin_level }: PreviewState): string {
  return LEVEL_LABELS[admin_level] ?? LEVEL_LABELS[0]
}

/**
 * Whether a persona is the one currently in effect. `preview === null` means
 * "real you" — the top rung.
 */
export function is_active_persona({ persona, preview, real_admin_level }: {
  persona: Persona
  preview: PreviewState | null
  real_admin_level: number
}): boolean {
  if (!preview)
    return persona.admin_level === real_admin_level
  return persona.admin_level === preview.admin_level
}

if (import.meta.vitest) {
  describe(build_personas, () => {
    it('builds the full ladder for a level-3 super admin', () => {
      expect(build_personas({ real_admin_level: 3 })).toEqual([
        { key: 'admin-3', label: 'Super Admin', admin_level: 3 },
        { key: 'admin-2', label: 'Admin', admin_level: 2 },
        { key: 'admin-1', label: 'Super Manager', admin_level: 1 },
        { key: 'visitor', label: 'Visitor', admin_level: 0 },
      ])
    })

    it('starts the ladder at the real level (a level-2 admin cannot preview level 3)', () => {
      const personas = build_personas({ real_admin_level: 2 })
      expect(personas.map(persona => persona.key)).toEqual(['admin-2', 'admin-1', 'visitor'])
    })

    it('is empty for a non-admin', () => {
      expect(build_personas({ real_admin_level: 0 })).toEqual([])
    })
  })

  describe(clamp_preview_level, () => {
    it('passes through a level at or below the real level', () => {
      expect(clamp_preview_level({ requested: 0, real_admin_level: 3 })).toBe(0)
      expect(clamp_preview_level({ requested: 1, real_admin_level: 3 })).toBe(1)
      expect(clamp_preview_level({ requested: 3, real_admin_level: 3 })).toBe(3)
    })

    it('clamps an escalation attempt down to the real level', () => {
      expect(clamp_preview_level({ requested: 3, real_admin_level: 2 })).toBe(2)
      expect(clamp_preview_level({ requested: 9, real_admin_level: 0 })).toBe(0)
    })

    it('floors negatives at 0', () => {
      expect(clamp_preview_level({ requested: -1, real_admin_level: 2 })).toBe(0)
    })
  })

  describe(persona_label, () => {
    it('labels admin tiers by name', () => {
      expect(persona_label({ admin_level: 3 })).toBe('Super Admin')
      expect(persona_label({ admin_level: 2 })).toBe('Admin')
      expect(persona_label({ admin_level: 1 })).toBe('Super Manager')
    })

    it('labels the level-0 persona as a visitor', () => {
      expect(persona_label({ admin_level: 0 })).toBe('Visitor')
    })
  })

  describe(is_active_persona, () => {
    const real_admin_level = 3
    const personas = build_personas({ real_admin_level })
    const [top] = personas
    const visitor = personas.find(persona => persona.key === 'visitor') as Persona

    it('marks the top rung active when not previewing', () => {
      expect(is_active_persona({ persona: top, preview: null, real_admin_level })).toBe(true)
      expect(is_active_persona({ persona: visitor, preview: null, real_admin_level })).toBe(false)
    })

    it('matches an admin-level preview by level', () => {
      const preview = { admin_level: 2 }
      expect(is_active_persona({ persona: personas[1], preview, real_admin_level })).toBe(true)
      expect(is_active_persona({ persona: top, preview, real_admin_level })).toBe(false)
    })

    it('matches the visitor persona at level 0', () => {
      const preview = { admin_level: 0 }
      expect(is_active_persona({ persona: visitor, preview, real_admin_level })).toBe(true)
      expect(is_active_persona({ persona: top, preview, real_admin_level })).toBe(false)
    })
  })
}
