import { list_guides } from './guides'
import { build_openapi_spec } from './openapi'
import { build_front_door, FRONT_DOOR_TASKS, suggest_task } from './front-door'
import type { FrontDoorContext } from './front-door'

const origin = 'https://example.test'

function context(overrides: Partial<FrontDoorContext> = {}): FrontDoorContext {
  return {
    dictionary: { id: 'abc', url: 'abc-dict', name: 'Abc', gloss_languages: ['en'], entry_count: 500 },
    scope: 'write',
    open_import_conversations: 0,
    unlinked_files: 0,
    ...overrides,
  }
}

describe(build_front_door, () => {
  test('stays small — this is the FIRST thing an agent reads', () => {
    const bytes = JSON.stringify(build_front_door({ origin })).length
    // The doc it replaced as a first read was 207,000 bytes. Keep it in the
    // low thousands: the routing prose earns its bytes, nothing else should.
    // eslint-disable-next-line no-restricted-syntax -- genuine size budget
    expect(bytes).toBeLessThan(8000)
  })

  test('leads with tasks and lists the reference last', () => {
    const doc = build_front_door({ origin })
    expect(doc.tasks.map(task => task.id)).toEqual(['import', 'cleanup', 'consume', 'media', 'corpus', 'ask-us'])
    // Key ORDER is the message: an agent reads top-down, so tasks come before
    // the reference. JSON.stringify preserves insertion order.
    expect(Object.keys(doc)).toEqual(['name', 'what', 'start', 'auth', 'tasks', 'guides_index', 'reference'])
    expect(doc.reference.index).toBe(`${origin}/api/v1/openapi.json`)
    expect(doc.reference.full).toBe(`${origin}/api/v1/openapi.json?view=full`)
  })

  test('anonymous — no dictionary block, `{id}` left as a placeholder', () => {
    const doc = build_front_door({ origin })
    expect(doc.dictionary).toBeUndefined()
    expect(doc.suggested_task).toBeUndefined()
    expect(doc.tasks[0].next[1].url).toBe(`${origin}/api/v1/dictionaries/{id}/files`)
  })

  test('with a key — names the dictionary, suggests a task, and substitutes its id into every path', () => {
    const doc = build_front_door({ origin, context: context() })
    expect(doc.dictionary?.name).toBe('Abc')
    expect(doc.dictionary?.scope).toBe('write')
    expect(doc.suggested_task?.task).toBe('cleanup')
    const urls = doc.tasks.flatMap(task => task.next.map(call => call.url))
    expect(urls.some(url => url.includes('{id}'))).toBeFalsy()
    expect(urls).toContain(`${origin}/api/v1/dictionaries/abc-dict/files`)
  })
})

describe(suggest_task, () => {
  test('a read-only key settles it — you cannot write, so read in bulk', () => {
    expect(suggest_task(context({ scope: 'read', open_import_conversations: 3 })).task).toBe('consume')
  })

  test('an open import conversation beats every other signal', () => {
    const suggestion = suggest_task(context({ open_import_conversations: 1, unlinked_files: 4 }))
    expect(suggestion.task).toBe('import')
    expect(suggestion.because).toContain('1 open import conversation ')
  })

  test('unlinked uploaded resources mean the import has not been done', () => {
    expect(suggest_task(context({ unlinked_files: 2 })).task).toBe('import')
  })

  test('an empty dictionary needs an import; a populated one needs cleanup', () => {
    expect(suggest_task(context({ dictionary: { ...context().dictionary, entry_count: 0 } })).task).toBe('import')
    expect(suggest_task(context()).task).toBe('cleanup')
  })
})

describe('FRONT_DOOR_TASKS', () => {
  test('every guide a task points at actually exists', () => {
    const slugs = new Set(list_guides().map(guide => guide.slug))
    for (const task of FRONT_DOOR_TASKS) {
      for (const slug of task.guides)
        expect(slugs.has(slug), `task "${task.id}" points at missing guide "${slug}"`).toBeTruthy()
    }
  })

  test('every next-call path exists in the OpenAPI spec (catches a renamed route)', () => {
    const spec = build_openapi_spec({ origin }) as { paths: Record<string, Record<string, unknown>> }
    for (const task of FRONT_DOOR_TASKS) {
      for (const call of task.next) {
        // Guide reads hit the templated `/guides/{slug}` operation.
        const spec_path = call.path.replace(/^\/api\/v1\/guides\/.+$/, '/api/v1/guides/{slug}')
        const operations = spec.paths[spec_path]
        expect(operations, `task "${task.id}" points at unknown path ${call.path}`).toBeDefined()
        expect(operations[call.method.toLowerCase()], `${call.method} ${call.path} does not exist`).toBeDefined()
      }
    }
  })

  test('every task leads with a first call, and all but ask-us lead with a guide', () => {
    const lead_calls = FRONT_DOOR_TASKS.map(task => ({
      id: task.id,
      has_next: task.next.length > 0,
      // ask-us has no guide — its first call is the feedback POST itself.
      leads_with_guide: task.guides.length === 0 || task.next[0].path === `/api/v1/guides/${task.guides[0]}`,
    }))
    expect(lead_calls.filter(task => !task.has_next || !task.leads_with_guide)).toEqual([])
  })
})
