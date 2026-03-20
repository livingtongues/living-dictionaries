---
title: Change SEO meta tags to entries pages
type: task
priority: 3
assignee: Danble
github_issue: 256
---

SEO meta tags in entries pages are in the entries layout file, since algolia requires the browser to be loaded before mounting the entries components (list, table, gallery and print pages). 
Each of the entries components should have its own SEO meta tags.
