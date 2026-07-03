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

export interface OperationGroup {
  label: string
  operations: Operation[]
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

const DICT_PREFIX = '/api/v1/dictionaries/{id}'
const MEDIA_SEGMENTS = ['audio', 'photos', 'videos']

const TOKEN_LABEL: Record<string, string> = {
  entries: 'Entries',
  senses: 'Senses',
  sentences: 'Sentences',
  texts: 'Texts',
  relationships: 'Relationships',
  speakers: 'Speakers',
  tags: 'Tags',
  dialects: 'Dialects',
  orthographies: 'Orthographies',
  sources: 'Sources',
  feedback: 'Feedback',
}

export const GROUP_ORDER = [
  'Dictionary',
  'Entries',
  'Senses',
  'Sentences',
  'Texts',
  'Relationships',
  'Media',
  'Speakers',
  'Tags',
  'Dialects',
  'Orthographies',
  'Sources',
  'Feedback',
]

export function group_for_path(path: string): string {
  const rest = path.replace(DICT_PREFIX, '')
  if (rest === '')
    return 'Dictionary'
  const segments = rest.split('/').filter(Boolean)
  if (segments.some(segment => MEDIA_SEGMENTS.includes(segment)))
    return 'Media'
  const [first] = segments
  return TOKEN_LABEL[first] ?? (first.charAt(0).toUpperCase() + first.slice(1))
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

export function build_groups(paths: Record<string, Record<string, any>>): OperationGroup[] {
  const map = new Map<string, Operation[]>()
  for (const [path, methods] of Object.entries(paths ?? {})) {
    for (const method of METHOD_ORDER) {
      const op = methods[method]
      if (!op)
        continue
      const group = group_for_path(path)
      const list = map.get(group) ?? []
      list.push({ method, path, ...op })
      map.set(group, list)
    }
  }
  const ordered = GROUP_ORDER.filter(group => map.has(group))
    .concat([...map.keys()].filter(group => !GROUP_ORDER.includes(group)))
  return ordered.map(label => ({ label, operations: map.get(label) ?? [] }))
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
