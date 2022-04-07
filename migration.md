# Windi + Kitbook Migration

## To Launch
- check for build errors
- convert site windicss
  - review class="{condition ? '' : ''}" situations as windi doesn't parse those
    - slideovers
      - entry filters
    - space-x-1 and space-x-3
- Get Diego up to speed, test, and merge to main

- double check scrollbar stuff in global.css
- update vercel components root to parts
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