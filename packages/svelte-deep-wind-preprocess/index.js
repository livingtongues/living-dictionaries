import MagicString from 'magic-string';
import { parse, walk } from 'svelte/compiler';

const deepName = (classes) => 'deep_' + classes.replace(/\s+/g, '_').replace(/:/g, '-');
const classNameEscapeCharacters = /([^a-zA-Z0-9_-])/g;
const escapeDisallowedCharacters = (className) => className.replace(classNameEscapeCharacters, '\\$1');

/**
 * @returns {import('svelte/types/compiler/preprocess').PreprocessorGroup}
 * @param {Object} options Preprocessor options
 * @param {boolean} options.rtl Support Right-To-Left languages using rtl: and ltr: prefixes
 */
export default ({ rtl } = { rtl: false }) => {
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

      let addedStyles = '';
      for (const clsGroup of deepClasses) {
        const clsName = `.${escapeDisallowedCharacters(deepName(clsGroup))}`;
        const classes = clsGroup.split(" ");
        const normalClasses = classes.filter((c) => {
          return c.indexOf("rtl:") === -1 && c.indexOf("ltr:") === -1;
        });
        addedStyles = addedStyles + ` :global(${clsName}) { @apply ${normalClasses.join(" ")}; }`;

        if (rtl) {
          const rtlClArr = classes.filter((c) => c.indexOf("rtl") !== -1);
          const ltrClArr = classes.filter((c) => c.indexOf("ltr") !== -1);
          if (rtlClArr.length) {
            addedStyles = addedStyles + ` :global([dir=rtl] ${clsName}) { @apply ${rtlClArr.join(" ").replace('rtl:', '')}; }`;
          }
          if (ltrClArr.length) {
            addedStyles = addedStyles + ` :global([dir=ltr] ${clsName}) { @apply ${ltrClArr.join(" ").replace('ltr:', '')}; }`;
          }
        }
      }

      if (rtl) {
        // capture rtl: and ltr: classes
        const rtlMatches = noTSnoApplyContent.matchAll(/rtl:[a-z0-9:()[\]-]+/g)
        const ltrMatches = noTSnoApplyContent.matchAll(/ltr:[a-z0-9:()[\]-]+/g)
        const rtlClasses = new Set();
        const ltrClasses = new Set();
        for (const match of rtlMatches) {
          rtlClasses.add(match[0]);
        }
        for (const match of ltrMatches) {
          ltrClasses.add(match[0]);
        }
        for (const cls of rtlClasses) {
          addedStyles = addedStyles + ` :global([dir=rtl] .${escapeDisallowedCharacters(cls.replace(/rtl:/, 'rtl_'))}) { @apply ${cls.replace('rtl:', '')}; }`;
        }
        for (const cls of ltrClasses) {
          addedStyles = addedStyles + ` :global([dir=ltr] .${escapeDisallowedCharacters(cls.replace(/ltr:/, 'ltr_'))}) { @apply ${cls.replace('ltr:', '')}; }`;
        }
      }

      if (addedStyles) {
        if (ast.css == null) {
          s.append('<style>' + addedStyles + '</style>');
        } else {
          s.appendLeft(ast.css.content.start + scriptEndIndex, addedStyles);
        }
      }

      return {
        // change names to keep windi from recognizing them
        code: s.toString().replace(/ltr:/g, 'ltr_').replace(/rtl:/g, 'rtl_'),
        map: s.generateMap({ hires: true, file: filename })
      }
    }
  }
}

export { default as logFile } from './logFile';