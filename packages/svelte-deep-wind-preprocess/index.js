import MagicString from 'magic-string';
import { parse, walk } from 'svelte/compiler';

const deepName = (classes) => 'deep_' + classes.replace(/\s+/g, '_').replace(/:/g, '-').replace(/!/g, '\\!');

/**
 * @returns {import('svelte/types/compiler/preprocess').PreprocessorGroup}
 */
export default () => {
  return {
    markup({ content, filename }) {
      const s = new MagicString(content);

      const scriptIsFirst = /^<script/;
      if (!scriptIsFirst.test(content)) { return { code: content } }
      
      const scriptBlocksAtBeginning = /^<script[\s\S]*<\/script>\s*/gm;
      const match = scriptBlocksAtBeginning.exec(content);
      const scriptEndIndex = match[0].length;

      const noScriptnoApplyContent = content.slice(scriptEndIndex).replace(/@apply [\s\S]+?[^}]+/g, '');
      const ast = parse(noScriptnoApplyContent);

      const deepClasses = new Set();

      walk(ast.html, {
        enter({ type, attributes }) {
          if (type === 'InlineComponent') {
            const clsAttr = attributes.find(attribute => attribute.name === 'class');
            if (clsAttr) {
              const { raw: classesStr, start, end } = clsAttr.value[0];
              deepClasses.add(classesStr);
              s.overwrite(start + scriptEndIndex, end + scriptEndIndex, deepName(classesStr))
            }
          }
        }
      })

      if (deepClasses.size > 0) {
        let deepStyles = '';
        for (const cls of deepClasses) {
          deepStyles = deepStyles + ` :global(.${deepName(cls)}) { @apply ${cls}; }`;
        }
        if (ast.css == null) {
          s.append('<style>' + deepStyles + '</style>');
        } else {
          s.appendLeft(ast.css.content.start + scriptEndIndex, deepStyles);
        }
      }

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true, file: filename })
      }
    }
  }
}
