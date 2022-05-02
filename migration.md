# Windi + Kitbook Migration

- bring in PRs and review recent changes
- use node-fetch instead of fetch-as
- restore functions
- set admin context on a global level and in kitbook add Context component
- fix logout bug
- space under images in table on mobile
- update github actions
- remap path MediaStream and Recorder components
- double check scrollbar stuff in global.css
- update eslint config
- switch to svelte-pieces modal and note that doesn't have mb-4 sm:mb-6 on body and needs noscroll = true input, doesn't need spacer between footer buttons
- update Button component to allow injected styles
- use 1 slideover component for EntryFilters and SideMenu in __layout
- wean off font-awesome
- consider prefix for svelte-pieces components or learn how not to preprocess again
- decide on font-semibold (600) or font-medium (500) - both look the same usually

## Notes
*Used `<[A-Z]([^>]|[\s\n])+?class="` to find Button classes (though causes catastrophic backtracking and will crash VSCode eventually)*