// The house dependency-cruiser preset, from the vendored house-style copy: no cycles, no unresolvable
// imports, a feature used through its index only, no Fastify in lib/.
module.exports = {
  extends: "./vendor/house-style/.dependency-cruiser.cjs",
  forbidden: [
    {
      // A warning for now (2026-11-11): the route files import `FeatureContext` from app.ts, which
      // imports them back. When each feature has its own options type, this entry goes and the rule
      // is an error again.
      name: "no-circular",
      severity: "warn",
    },
  ],
};
