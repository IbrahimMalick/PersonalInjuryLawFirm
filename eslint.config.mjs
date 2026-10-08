import nextPlugin from "eslint-config-next";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "drizzle/**", "data/**"],
  },
  ...nextPlugin,
];

export default config;
