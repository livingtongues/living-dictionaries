# Svelte 5 Migration Notes

## Lint Cleanup
- Deleted 9 unused `.composition` Kitbook files that ESLint couldn't parse (JSX/TypeScript errors)
- `data.map()` → `data.forEach()` where return value wasn't used (array-callback-return)
- Indentation circular conflicts between `svelte/indent` and `style/indent-binary-ops` in `<script>` blocks — resolved with `eslint-disable-line` to prefer `svelte/indent`
- Collapsed multiline template expressions onto single lines to avoid indent conflicts
