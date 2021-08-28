# SvelteKit + Firebase 9 + TailwindCSS + Vercel Walkthrough

This is an overview of how this repo, the Living Dictionaries web app, was built with SvelteKit, Firebase, TailwindCSS and Vercel, and includes brief mentions of testing frameworks as implemented thus far on the Living Dictionaries web app. This script originally paired with the [walkthrough video on YouTube](), but is now being updated as the technologies used herein advance.

# Video-only intro

This is an overview of how the open-sourced Living Dictionaries web app was built with SvelteKit, Firebase, TailwindCSS, and Vercel, and includes brief mentions of testing frameworks as implemented thus far on the Living Dictionaries web app. SvelteKit is still in beta so adjustments will need to be made to the app to keep up with changes, but this video is made to show how useful these tools have been in my development process and that SvelteKit is production ready.

---

You’ll see my preference towards technologies that give quick feedback during the development process, as well as “using the platform” whenever possible (e.g. using alert, prompt, and confirm instead of building out extra modals that depend on a component).

## Create SvelteKit app

We start by creating a new SvelteKit app, `npm init svelte@next`, the `@next` won’t be needed after v1 is released. We'll use the skeleton option though you should try the demo app if new to Svelte and SvelteKit. I opt in to use Typescript, ESLint, and Prettier. Then I `npm install`, init the repo, push it to GitHub, and `npm run dev` to see my app running in dev mode which has almost instead startup and hot module reloads because SvelteKit uses ES modules. SvelteKit uses Vite under the hood to serve up just the modules needed for a particular view. This stands in contrast to how Webpack or Rollup need to bundle the entire app before serving a view and is enabled because ES modules are now supported natively by browsers. With a small app, this is nothing to get excited about because bundlers are pretty fast at this point. The benefits of a quick startup + Hot-module-reloading (HMR) really start to show as our app gets large, as can be seen in the Living Dictionaries repo.

## Automatic Linting & Formatting

- As you go along, you may want to adjust the ESLint rules to your preferences by turning them off or adjusting an error to a warning and vice versa
- Take a peek at prettier.io and svelte-prettier to see the code formatting customizations available. I like spaces and trailing commas so I remove those and turn off the custom svelteBracketNewLine setting.
- Let's make formatting and linting automatic. Add the prettier-vscode extension and the vscode-eslint extension and tell VSCode to format and fix all lint errors on save. I like to take things a step further and use the errorlens extension to make my errors easy to read as I'm writing code w/o needing to hover over messages.
- We can take things a step further by using `simple-git-hooks` to run custom `lint-staged` commands as a pre-commit git hook to ensure that every team members' commits (regardless of editor or editor settings) are also formatted and linted according to the team's agreed rules. Install both packages, add the configuation to package.json. Note that you need to manually run `npx simple-git-hooks` every time the simple-git-hooks configuration is changed. If you like this idea but don't like how it slows down the commit process, look into using GitHub actions to lint and format all commits on the GitHub side.

## Automatic Deployment using Vercel

I like to get my web app deployed first thing so I can test in its final environment all through the development process, so I'm going to go to Vercel, add a new project, select my repository after giving Vercel the proper permissions, select SvelteKit as the type and deploy! Since you gave Vercel permissions it will now take care of automatically making production and preview deployments on every single commit. _Consider setting up the Slack integration to give you convenient and timely feedback on your deploys_

## Automatic Testing & Audit with Slack Notifications

To automate our deployment, as well as run audits and tests on every deployment, let's use GitHub Actions. Start by creating two .yml files, one audits production deployments and one for tests and audits preview deployments using their Vercel preview URL. You'll see I'm only testing and auditing pull request commits, but you could automate every single push if desired as each push has its own preview deployment.

- After setting up our action triggers, we declare environment variables available to the whole workflow. (Github token is an automatic secret available to actions)
- See https://api.slack.com/messaging/webhooks to get a slack webhook url - add this to the GitHub secrets for your repo
- Then we declare our DEPLOY_URL to keep from repeating ourselves
- Add the first job, checkout the code, install dependencies, validate their are no errors in our Svelte components and run all tests
- We have a variety of steps that send deployment status notifications to our chosen Slack channel and run a Lighthouse speed audits. The Lighthouse audit report is added to pull requests (updated on future pushes) and also sent to Slack. There is a lot of room here to build things as you desire, but do note that a few things. If you have an open source repo, you may prefer to just add the GitHub app to Slack just subscribe to pull request updates. Also know that you can set up a Lighthouse server to keep track of long-term changes in your web apps loading speeds, as well as setting budgets and parameters that will trigger a workflow failure.
- You'll notice on pull requests, we have a second job that depends on the success of the first job, sets the working directory to `e2e`, runs tests, and saves resulting screenshots as artifacts on the action (currently not implemented).
- That was a bit of work to set up our actions, but it gives us a foundation to rapidly make changes and test things easily, both via automated tests, as well as manual testing.

## E2E testing w/ Playwright

- Now let's add a title to our homepage and check for "Living Dictionaries" using a Playwright end-to-end test.
- Please watch my [Playwright Overview Video](https://vimeo.com/539258111/f857aaa64e) for tips on how to set up and use Playwright w/ Jest.
- I don't have any strong reason why I'm using Playwright over Cypress. You could use either, but to me Cypress feels a bit heavier and more geared towards test-driven design usage. Playwright doesn't ship it's own test runner and we'll use Jest to run its tests as Jest is a test runner I particularly like. If you're not comfortable with Jest yet and don't plan to use it for other tests, you may enjoy the batteries included feel of Cypress better.

---

Unfinished notes below

## Firebase

- To add Cloud Functions, run `firebase init` and select Functions to add Firebase Functions. Opt out of adding ESLint as we will use root level config for consistency and select your project.
- use dual projects for easy development
- haven't bought in to the Firebase Emulator suite yet as it adds a bit of overhead (install Java, not available in web-based dev environments) but it looks to be powerful and useful for those who don't want the dual project setup
- Firestore helpers (show usage in components)

## SSR

## Scripts

- ts-node

## Add i18n

- fetch-messages for i18n (using a Google Sheet but would love something whereby anyone in the world could create a pull-request w/ just a name and email address)
- https://github.com/cibernox/svelte-intl-precompile
- i18n ally

## Components

- Svelte makes modals, page transitions, button components and other reusable components painless to build and lazy-load.
  - Take for example, this simple JSON component that I keep around to easily inspect data, w/o incurring extra weight to normal end-users. (You'll need the svelte-vscode extension and I highly recommend the vscode-svelte-snippets as well as you'll be using conditionals and loops a lot)
  - SEO: https://github.com/svelte-society/sveltesociety-2021/blob/main/src/routes/%24layout.svelte
  - Simple Admin Guard: admin components (not fully secure, but OK because real security is in the Firestore rules, show sample for not being able to read other users)
  - Take a look at the repo for more component examples.

## Tailwind CSS

- I like TailwindCSS because when used with the vscode-tailwindcss extension, it makes writing CSS extremely easy, particularly when trying to take breakpoints into consideration. As well it only compiles the styles actually being used.
- With a fresh repo, you can run `npx svelte-adder tailwind`
- Note that for this repo I ran `npm i -D tailwindcss postcss postcss-cli cssnano autoprefixer` and added postcss.config.cjs and tailwind.config.cjs files.
- `.cjs` is used here to tell node that these are commonjs files. To take advantage of the now standardized ES Modules which both browsers and Node (as of version 12) now natively support, SvelteKit has added a line to your package.json `"type": "module",` to tell Node that `.js` files are ES modules and not commonjs, the Node default. This means that for tooling (like PostCSS and TailwindCSS) that haven't yet made the transition to ESModules, we need to `.cjs` file ending that would otherwise just be `.js` as specified in their documentation. \*\*Note that in projects which still use commonjs (the default) you need to use the `.mjs` file extension to specify the ES module format. The primary noticeable difference is that ES modules uses the `import ____ from ____` syntax we've been using in Typescript and browser modules instead of `const _____ = require(____)`.
- PostCSS will automatically add needed vendor prefixes, as well as minify our styles on production.
- You'll notice that I've added a few things to my Tailwind configuration:

  - I extend Tailwind with styles for prose and forms: `npm i -D @tailwindcss/typography @tailwindcss/forms`
  - Adjust the look of the prose styles (use them by adding `.prose` and sometimes `.max-w-none`)
  - and add a few colors but let's stop there as Tailwind has great documentation.
  - Add global styles to layout.svelte

- If you prefer not to be hassled with adding styles to your build pipeline, Bootstrap, Bulma, and many other frameworks are good options. Alternatively if you're good at CSS and don't want any style framework at all, Svelte makes it extremely easy to just write vanilla CSS directly in your components because they are scoped to just that component.

## env variables

- Mapbox key

## Unit & Integration Testing

- Jest
- Testing Library
- Multiple projects (Functions, Svelte, Scripts)
- Wallaby
- Use Quokka for a testing playground

## Svench

If you've ever built a component with many different possible states and want to be able to make changes w/o breaking anything, then a visual mocking tool based off various states or "stories" is really nice. Unit testing won't tell you if your CSS layout is broken in many of your views because of that last change you made. Storybook is the industry standard here, but can be quite slow to start up, so we're going to use Svench, an alternative option developed by Rixo for the Svelte community. To get started:

- `npm i -D svench vite @sveltejs/vite-plugin-svelte`
- I need to import Tailwind styles on startup so I can add `import './global.css';` to a .svench.js file. If you do your style import in your index.html file, you can do that by adding an index.svench file.
- For SvelteKit, at the moment we need to add a `svench.config.js` file to tell the Vite server that Svench runs how to resolve our aliases.
- Run `npx svench` and then create a `Button.svench` file right next to your `Button.svelte` component

## Making a change

- Run `npm run dev` to open in your browser. Note the optional addition of `--open --host` has made it automatically open and available over the network for easy mobile device testing.
- Make a change and then make a pull request.
- After tests run to ensure you haven't broken anything, a teammate can easily look at the deployed staging app to check things out. If any edits are needed, they can click the edit in GitPod button (or use GitHub Codespaces) to easily make changes and finish up the feature.
- Then release the feature by merging to the `main` branch where it will be automatically deployed

## Sign-off

This video will become out of date but the repo and corresponding Walkthrough.md file will stay up to date on how to set things up. This will be particularly relevant for SvelteKit as it comes out of beta.

Please comment on what you learned. As well, if you have any suggestions on how to improve things please create an issue or submit a pull request to the [repo](https://github.com/Living-Tongues/living-dictionaries).
