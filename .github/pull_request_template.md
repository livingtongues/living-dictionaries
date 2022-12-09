#### Relevant Issue
(prepend "closes" if issue will be closed by PR)

#### Summarize what changed in this PR (for developers)


#### How can the changes be tested? 
Please also provide applicable links using relative paths from root (e.g. `/apatani/entries`) and reviewers can just add that onto preview urls or localhost.

#### Checklist before marking ready to merge
Please keep it in draft mode until these are completed:
- [ ] Equal time was spent cleaning the code as writing it
  - [ ] Functions
    - [ ] Functions that don't belong in Svelte components are extracted out into `.ts` files
    - [ ] Functions are short and well named
    - [ ] Concise tests are written for all functions
  - [ ] Classes (a Svelte Component is a Class)
    - [ ] Svelte components are broken down into smaller components so that each component is responsible for one thing (Single Responsibility Principle)
    - [ ] Stories/variants are written to describe use cases
  - [ ] Comments are only included when absolutely necessary information that cannot be explained in code is needed