# Musje Change Log

## 0.4.1 (2016-05-26)

- Use Travis CI build test.
- More tests are added with some refactoring.

### Features

- A CodeMirror mode (simple mode) with stylesheet is provided.

### Broken changes

- External `require('Snap')` is changed to be `require('snapsvg')`.


## 0.4.0 (2016-05-08)

- The module system is changed to commonjs.
- Gulp with webpack bundling is used in the build tasks.
- For developing, it suggests to reinstall the node modules

  ```
  rm -r node_modules
  npm install
  ```
- Test tasks are added, and some minor refactoring is done.

### Features

- Umd (commonjs, amd and global) is supported.
- Minified version of the lib is added in `musje/lib/musje.min.js`.

## Broken changes

- The distribution is moved from `musje/musje.js` `musje/musje.css` to `musje/lib/musje.js` `musje/lib/musje.css`.
- Only `parse()` and `Score` are exposed to the `musje` namespace, others are hidden in this new version.


## 0.3.1 (2016-04-09)

### Bug fixes

- Fix issue #10 : Consecutive slurs can be parsed now.
- This module can work in nodejs environment.


## 0.3.0 (2015-09-06)

- Model has been complete rewritten.
- Refactoring model and renderer
- Add documentation using jsdoc3 (not completed yet).
- The libs in demo is now included (not from CDN anymore).
- Add this change log file.

### Features

- Ties can be rendered.
- Pitch alter is now correctly affected by the previous note with the same step.
- Slur rendering implemented.
- The last system is filled and each system measures length are balanced
  during the process.

### Broken changes

- The JSON schema support is dropped due to the written model (may be written again if required - low priority).
- The model is slightly changed in tie and slur.


## 0.2.0 (2015-08-19)

- In demo page, note that is played can be seen by the color changes.

### Breaking changes

- model schema changed. Cell is now { data: [/* musicData */] }


## 0.1.3 (2015-08-16)

- In demo page, window resize can trigger score rerender.
- Refactor model.

### Features

- Add stroke for smaller pitch font.

### Bug fixes

- Fix the first/last barline error and empty measure error.
- Fix dot y position.


## 0.1.2 (2015-08-14)

- Lots of refactoring and code clean up.
- Refactor Defs and Layout.
- Implement Renderer.renderBar.
- Add README for renderer and refactor filenames.

### Features

- Improve layout results.
- Improve bar render results.

### Bug fixes

- Fix Defs.PitchDef error.


## 0.1.1 (2015-08-12)

- Sub-divide many parts in Layout and Renerer.
- Extract out Layout.System class.
- Refactor variable names, and layoutCell, layout.options.

### Features

- Measure width can be tuned in a "good" position automatically.
- Barlines are in correct place now.

### Bug fixes

- renderBar back in work.


## 0.1.0 (2015-08-10)

- Publish musje to the npm registry.
- Improve gulpfile, and use gulp-sourcemaps.
- Upgrade tv4 for the demo page.
- Layout become a class and together with the renderer, been rewriten.


## 0.0.2 (2015-08-09)

- Several leap improvement for this release.
- The SVG Lib d3.js dropped, use Snapsvg instead for simplicity sake.
- Renderer now has three main parts, namely, Defs, Layout and Renderer.
- Use gulp task runner to help development cycles.
- Demo page improved using AngularJS and Bootstrap (jQuery dropped).

### Features

- New score renderer implemented.
- Basic note (with accidental, step, octave, type and dot)
  and rest can be rendered.
- Notes shorter than a quarter can be automatically beamed.
- Score can be played using the MIDI.js lib.
- Add musje-logo.svg musje-log.png files.


## 0.0.1 (2015-07-24)

- The repo is picked up again for further development.
- Repo transfer from https://github.com/malcomwu/musje.git
  to https://github.com/jianpu/musje.git
- Code clean up. Use vanilla javascript as much as possible.


## 0.0.0 (2014-01-23)

- Build infrastructure.

### Features

- Musje 123 parser implemented.
