# Windi + Kitbook Migration

- add scripts package and move update-locales from site package
- bring in PRs and review recent changes
- restore functions
- set admin context on a global level and in kitbook add Context component
- fix logout bug
- space under images in table on mobile
- update github actions
- remap path MediaStream and Recorder components
- double check scrollbar stuff in global.css
- update eslint config
- switch to svelte-pieces modal and note that doesn't have mb-4 sm:mb-6 on body and needs noscroll = true input
- update Button component to allow injected styles
- use 1 slideover component for EntryFilters and SideMenu in __layout
- wean off font-awesome
- consider prefix for svelte-pieces components or learn how not to preprocess again

## Notes
*Used `<[A-Z]([^>]|[\s\n])+?class="` to find Button classes (though causes catastrophic backtracking and will crash VSCode eventually)*