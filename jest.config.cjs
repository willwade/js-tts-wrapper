module.exports = {
  preset: "ts-jest/presets/default-esm", 
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true 
      }
    ]
  },
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/?(*.)+(spec|test).+(ts|tsx|js)" 
  ],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/dist/",
    "<rootDir>/src/__tests__/.*\\.helper\\.ts",
    "<rootDir>/src/__tests__/.*\\.mock\\.ts",
    "<rootDir>/emsdk/"
  ],
  collectCoverage: false,
  coverageDirectory: "coverage",
  collectCoverageFrom: [ 
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/types/**",
    "!**/node_modules/**"
  ],
  coverageReporters: [ 
    "json-summary",
    "text",
    "lcov"
  ],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  moduleFileExtensions: [ 
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "node"
  ],
  extensionsToTreatAsEsm: [".ts"],
  modulePathIgnorePatterns: [
    "<rootDir>/dist/"
  ]
};
