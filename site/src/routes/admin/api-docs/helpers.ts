export interface SchemaNode {
  $ref?: string
  type?: string
  format?: string
  description?: string
  nullable?: boolean
  enum?: unknown[]
  properties?: Record<string, SchemaNode>
  required?: string[]
  items?: SchemaNode
  additionalProperties?: SchemaNode | boolean
  oneOf?: SchemaNode[]
  allOf?: SchemaNode[]
  example?: unknown
}

export interface Operation {
  method: string
  path: string
  summary?: string
  description?: string
  parameters?: Record<string, any>[]
  requestBody?: Record<string, any>
  responses?: Record<string, { description?: string, content?: Record<string, any> }>
}

export function ref_name(ref: string): string {
  return ref.split('/').pop() ?? ref
}

/** A short one-line type label for a schema node, resolving refs/arrays/unions to names. */
export function type_label(node?: SchemaNode | boolean): string {
  if (!node || node === true)
    return 'any'
  if (node.$ref)
    return ref_name(node.$ref)
  if (node.oneOf)
    return node.oneOf.map(type_label).join(' | ')
  if (node.allOf)
    return node.allOf.map(type_label).join(' & ')

  let base: string
  if (node.type === 'array') {
    base = `${type_label(node.items)}[]`
  } else if (node.type === 'object') {
    base = node.additionalProperties && node.additionalProperties !== true
      ? `map<string, ${type_label(node.additionalProperties)}>`
      : 'object'
  } else {
    base = node.type ?? 'any'
  }
  if (node.nullable)
    base += ' | null'
  return base
}

/** An inline object schema worth rendering nested (not a $ref, has its own properties). */
export function nested_object(node?: SchemaNode): SchemaNode | null {
  if (!node)
    return null
  if (node.type === 'object' && node.properties)
    return node
  if (node.type === 'array' && node.items?.type === 'object' && node.items.properties)
    return node.items
  return null
}

export const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete']

export function method_color(method: string): string {
  switch (method) {
    case 'get': return 'var(--primary)'
    case 'post': return 'var(--success)'
    case 'put':
    case 'patch': return 'var(--warning)'
    case 'delete': return 'var(--danger)'
    default: return 'var(--color-secondary)'
  }
}

export interface TagGroup {
  name: string
  description: string
  operations: Operation[]
}

/**
 * Group operations by their OpenAPI TAG (every op carries exactly one — the
 * same grouping agents use via `?tag=`), ordered by the spec's `tags` list.
 */
export function build_tag_groups(spec: { tags?: { name: string, description?: string }[], paths?: Record<string, Record<string, any>> }): TagGroup[] {
  const map = new Map<string, Operation[]>()
  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const method of METHOD_ORDER) {
      const op = methods[method]
      if (!op)
        continue
      const tag = (op.tags?.[0] as string) ?? 'other'
      const list = map.get(tag) ?? []
      list.push({ method, path, ...op })
      map.set(tag, list)
    }
  }
  const tag_order = (spec.tags ?? []).map(tag => tag.name)
  const ordered = tag_order.filter(name => map.has(name))
    .concat([...map.keys()].filter(name => !tag_order.includes(name)))
  const descriptions = new Map((spec.tags ?? []).map(tag => [tag.name, tag.description ?? '']))
  return ordered.map(name => ({ name, description: descriptions.get(name) ?? '', operations: map.get(name) ?? [] }))
}

/**
 * Split a long markdown document into an intro + its `## ` sections so the
 * page can render an accordion instead of a prose wall.
 */
export function split_markdown_sections(markdown: string): { intro: string, sections: { title: string, body: string }[] } {
  const parts = markdown.split(/\n(?=## )/)
  const intro = parts[0]?.startsWith('## ') ? '' : (parts.shift() ?? '')
  const sections = parts.map((part) => {
    const newline = part.indexOf('\n')
    const title = part.slice(3, newline === -1 ? undefined : newline).trim()
    const body = newline === -1 ? '' : part.slice(newline + 1).trim()
    return { title, body }
  })
  return { intro: intro.trim(), sections }
}

/** Flattens a requestBody's content map into a list of { media_type, schema, example }. */
export function request_body_contents(request_body?: Record<string, any>): { media_type: string, schema?: SchemaNode, example?: unknown }[] {
  const content = request_body?.content
  if (!content)
    return []
  return Object.entries(content).map(([media_type, value]) => ({
    media_type,
    schema: (value as any)?.schema,
    example: (value as any)?.example,
  }))
}
