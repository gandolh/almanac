import preset from "./vendor/house-style/knip.json" with { type: "json" };

// knip has no `extends`, so this spreads the house preset. Almanac adds the entry knip can't find on
// its own (the docs capture helper, run by hand) and the one dependency nothing imports.
export default {
  ...preset,
  workspaces: {
    ".": { entry: ["docs/images/*.mjs"] },
    web: {
      // Run by hand to regenerate the home-screen icons in public/icons; no script calls it.
      ignoreDependencies: ["@vite-pwa/assets-generator"],
    },
  },
};
