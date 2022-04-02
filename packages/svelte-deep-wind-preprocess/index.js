import MagicString from 'magic-string'
import { parse, walk } from 'svelte/compiler'
const deepName = (classes) => 'deep_' + classes.replace(/\s+/g, '_').replace(/:/g, '-');

/**
 * @returns {import('svelte/types/compiler/preprocess').PreprocessorGroup}
 */
export default () => {
  return {
    markup({ content, filename }) {
      const s = new MagicString(content)
      const ast = parse(content)
      const deepClasses = new Set();

      walk(ast.html, {
        enter({ type, attributes }) {
          if (type === 'InlineComponent') {
            const clsAttr = attributes.find(attribute => attribute.name === 'class');
            if (clsAttr) {
              const { raw: classesStr, start, end } = clsAttr.value[0];
              deepClasses.add(classesStr);
              s.overwrite(start, end, deepName(classesStr))
            }
          }
        }
      })

      if (deepClasses.size > 0) {
        if (ast.css == null) {
          s.append('<style>');
          for (const cls of deepClasses) {
            s.append(` :global(.${deepName(cls)}) { @apply ${cls}; }`);
          }
          s.append('</style>');
        } else {
          for (const cls of deepClasses) {
            s.appendLeft(ast.css.content.start, ` :global(.${deepName(cls)}) { @apply ${cls}; }`);
          }
        }
      }

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true, file: filename })
      }
    }
  }
}
