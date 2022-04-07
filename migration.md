# Windi + Kitbook Migration

## To Launch
- rename to parts
- convert site windicss
  - review class="{condition ? '' : ''}" situations as windi doesn't parse those
    - entry filters
  - review slideovers
- check for errors
- double check scrollbar stuff in global.css
- Get Diego up to speed, test, and merge to main
- update vercel for main site
- deploy @ld/parts to vercel

## After Launch
- add scripts package and move update-locales from site package
- restore functions
- remap path MediaStream and Recorder components
- update eslint config
- switch to svelte-pieces modal and note that doesn't have mb-4 sm:mb-6 on body and needs noscroll = true input
- replace font-awesome
- update Button component to allow injected styles

## Notes
*Used `<[A-Z]([^>]|[\s\n])+?class="` to find Button classes (though causes catastrophic backtracking and will crash VSCode eventually)*