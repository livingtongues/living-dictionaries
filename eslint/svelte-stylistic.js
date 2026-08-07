// Kept local because the Git-hosted package's prepare lifecycle installs its full
// development toolchain and fails on Windows even though these two rules ship prebuilt.
const brackets_same_line = {
  meta: {
    type: 'layout',
    docs: { description: 'Keep closing brackets on the same line as the last attribute or tag' },
    schema: [],
    messages: { bracket_on_next_line: 'Closing bracket is separated from tag and attributes' },
    fixable: 'whitespace',
  },
  create(context) {
    return {
      SvelteElement(node) {
        const start_line = node.loc.start.line
        const last_attribute = node.startTag.attributes.at(-1)
        const last_attribute_line = last_attribute?.loc.end.line ?? -1
        const last_line = Math.max(start_line, last_attribute_line)
        const start_tag_end_line = node.startTag.loc.end.line

        if (last_line < start_tag_end_line) {
          context.report({
            node: last_attribute || node.startTag,
            loc: {
              start: last_attribute?.loc.end || node.startTag.loc.start,
              end: node.startTag.loc.end,
            },
            messageId: 'bracket_on_next_line',
            fix(fixer) {
              const [, last_attribute_end] = last_attribute?.range ?? []
              const [start_tag_start, start_tag_end] = node.startTag.range
              const from = last_attribute_end ?? start_tag_start
              const to = start_tag_end
              const code = context.sourceCode.text.slice(from, to)
              return fixer.replaceTextRange([from, to], code.replace(/\s+/g, ''))
            },
          })
        }

        if (!node.endTag || node.endTag.loc.start.line === node.endTag.loc.end.line)
          return

        context.report({
          node: node.endTag,
          loc: {
            start: node.endTag.loc.start,
            end: node.endTag.loc.end,
          },
          messageId: 'bracket_on_next_line',
          fix(fixer) {
            const [from, to] = node.endTag.range
            const code = context.sourceCode.text.slice(from, to)
            return fixer.replaceTextRange([from, to], code.replace(/\s+/g, ''))
          },
        })
      },
    }
  },
}

const consistent_attribute_lines = {
  meta: {
    type: 'layout',
    docs: { description: 'Keep attributes consistently inline or on separate lines' },
    schema: [],
    messages: {
      attribute_should_wrap: 'Attribute should be on its own line to match the first attribute',
      attribute_should_not_wrap: 'Attribute should be on the same line as the tag to match the first attribute',
      wrap_when_multiline: 'Attributes should be on their own line when a multiline attribute is present',
    },
    fixable: 'whitespace',
  },
  create(context) {
    return {
      SvelteStartTag(node) {
        if (node.attributes.length === 0)
          return

        const start_line = node.loc.start.line
        const has_multiline_attribute = node.attributes.some(attribute =>
          attribute.loc.start.line !== attribute.loc.end.line)

        if (has_multiline_attribute) {
          node.attributes.forEach((attribute, index) => {
            const previous_attribute = node.attributes[index - 1]
            const previous_line = previous_attribute?.loc.end.line || start_line
            if (previous_line !== attribute.loc.start.line)
              return

            context.report({
              node: attribute,
              loc: {
                start: { ...attribute.loc.start, line: attribute.loc.start.line - 1 },
                end: attribute.loc.start,
              },
              messageId: 'wrap_when_multiline',
              fix: fixer => fixer.replaceTextRange([attribute.range[0] - 1, attribute.range[0]], '\n'),
            })
          })
          return
        }

        const [first_attribute] = node.attributes
        const attributes_are_inline = start_line === first_attribute.loc.start.line

        node.attributes.forEach((attribute, index) => {
          if (index === 0)
            return

          const previous_attribute = node.attributes[index - 1]
          const attributes_share_line = previous_attribute.loc.end.line === attribute.loc.start.line
          if (attributes_are_inline === attributes_share_line)
            return

          context.report({
            node: attribute,
            loc: {
              start: previous_attribute.loc.end,
              end: attribute.loc.start,
            },
            messageId: attributes_are_inline ? 'attribute_should_not_wrap' : 'attribute_should_wrap',
            fix: fixer => fixer.replaceTextRange(
              [previous_attribute.range[1], attribute.range[0]],
              attributes_are_inline ? ' ' : '\n',
            ),
          })
        })
      },
    }
  },
}

export default {
  rules: {
    'brackets-same-line': brackets_same_line,
    'consistent-attribute-lines': consistent_attribute_lines,
  },
}
