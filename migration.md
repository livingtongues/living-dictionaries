# Windi + Kitbook Migration

## To Launch
- convert site windicss
  - review class="{condition ? '' : ''}" situations as windi doesn't parse those? (or maybe just multiline versions)
- check for build errors
- Get Diego up to speed, 
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
- replace font-awesome
- update Button component to allow injected styles
- use 1 slideover component for EntryFilters and SideMenu in __layout

## Notes
*Used `<[A-Z]([^>]|[\s\n])+?class="` to find Button classes (though causes catastrophic backtracking and will crash VSCode eventually)*