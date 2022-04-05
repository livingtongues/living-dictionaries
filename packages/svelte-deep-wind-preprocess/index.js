import MagicString from 'magic-string';
import { parse, walk } from 'svelte/compiler';

const deepName = (classes) => 'deep_' + classes.replace(/\s+/g, '_').replace(/:/g, '-');

/**
 * @returns {import('svelte/types/compiler/preprocess').PreprocessorGroup}
 */
export default () => {
  return {
    markup({ content, filename }) {
      const s = new MagicString(content);

      let scriptEndIndex = 0;
      if (/lang=['"]ts['"]/.test(content)) {
        const scriptIsFirst = /^<script/;
        if (!scriptIsFirst.test(content)) { return { code: content } }
        const scriptBlocksAtBeginning = /^<script[\s\S]*<\/script>\s*/gm;
        const match = scriptBlocksAtBeginning.exec(content);
        scriptEndIndex = match[0].length;
      }

      const noTSnoApplyContent = content.slice(scriptEndIndex).replace(/@apply [\s\S]+?[^}]+/g, '');
      const ast = parse(noTSnoApplyContent);

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

      // capture rtl: and ltr: classes
      // const rtlMatches = noTSnoApplyContent.matchAll(/rtl:[a-z0-9:()[\]-]+/g)
      // const ltrMatches = noTSnoApplyContent.matchAll(/ltr:[a-z0-9:()[\]-]+/g)

      // const rtlClasses = new Set();
      // const ltrClasses = new Set();

      // for (const match of rtlMatches) {
      //   rtlClasses.add(match[0]);
      // }
      // for (const match of ltrMatches) {
      //   ltrClasses.add(match[0]);
      // }

      let addedStyles = '';
      for (const cls of deepClasses) {
        addedStyles = addedStyles + ` :global(.${deepName(cls).replace(/!/g, '\\!')}) { @apply ${cls}; }`;
      }
      // for (const cls of rtlClasses) {
      //   addedStyles = addedStyles + ` :global([dir="rtl"] ${cls.replace(/rtl:/, 'rtl_').replace(':', '\\:')}) { @apply ${cls}; }`;
      // }
      // for (const cls of ltrClasses) {
      //   addedStyles = addedStyles + ` :global([dir="ltr"] ${cls.replace(/ltr:/, 'ltr_').replace(':', '\\:')}) { @apply ${cls}; }`;
      // }

      if (addedStyles) {
        if (ast.css == null) {
          s.append('<style>' + addedStyles + '</style>');
        } else {
          s.appendLeft(ast.css.content.start + scriptEndIndex, addedStyles);
        }
      }

      return {
        // change names to keep windi from recognizing them
        // code: s.toString().replace(/ltr:/g, 'ltr_').replace(/rtl:/g, 'rtl_'),
        code: s.toString(),
        map: s.generateMap({ hires: true, file: filename })
      }
    }
  }
}
