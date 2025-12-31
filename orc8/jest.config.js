import { createDefaultEsmPreset } from "ts-jest";
const preset = createDefaultEsmPreset();

/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  ...preset,
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transformIgnorePatterns: ["/node_modules/(?!(@artinet|eventsource)/)"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/dump/",
    "/publish-temp/",
    "/test/bundle.test.ts",
  ],
  // Add this to help Jest resolve ESM packages
  resolver: undefined,
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json", "node"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          rootDir: ".",
        },
      },
    ],
  },
};
