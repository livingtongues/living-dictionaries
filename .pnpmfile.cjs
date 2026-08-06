// Suppress the prepare script for eslint-plugin-svelte-stylistic (git-hosted dep).
// Its `simple-git-hooks` prepare script requires a full devDependency install that
// fails on Windows, and the package ships prebuilt dist/ — nothing needs compiling.
function readPackage(pkg, _context) {
  if (pkg.name === 'eslint-plugin-svelte-stylistic') {
    delete pkg.scripts.prepare
  }
  return pkg
}

module.exports = { hooks: { readPackage } }
