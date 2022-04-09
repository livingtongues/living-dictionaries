# Windi + Kitbook Migration

## To Launch
- check for build errors
- test
- merge to main
- update vercel for main site
- deploy @ld/parts to vercel


## After Launch
- fix logout bug
- double check scrollbar stuff in global.css
- add scripts package and move update-locales from site package
- restore functions
- remap path MediaStream and Recorder components
- update eslint config
- switch to svelte-pieces modal and note that doesn't have mb-4 sm:mb-6 on body and needs noscroll = true input
- update Button component to allow injected styles
- use 1 slideover component for EntryFilters and SideMenu in __layout
- wean off font-awesome

## Notes
*Used `<[A-Z]([^>]|[\s\n])+?class="` to find Button classes (though causes catastrophic backtracking and will crash VSCode eventually)*