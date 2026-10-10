# Reserved shared-hooks directory

The unused legacy home hooks were archived by PR #150.
Current Natori hooks live within `src/features/natori/`.

Keep this directory tracked: `scripts/natori-phase-0b/prepare-browser.mjs`
copies `src/hooks` while building the isolated Natori browser fixture.
Later Natori phases reuse that preparation step. This README preserves the
directory without restoring retired application code or changing the tests.
