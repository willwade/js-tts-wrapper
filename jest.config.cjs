module.exports = {
  preset: "ts-jest",
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      { tsconfig: "tsconfig.cjs.json" }
    ]
  },
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/dist/",
    "<rootDir>/src/__tests__/.*.helper.ts",
    "<rootDir>/src/__tests__/.*.mock.ts"
  ],
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts",
    "!src/**/__tests__/**"
  ],
  moduleNameMapper: {
    "sherpa-onnx-node": "<rootDir>/src/__tests__/sherpaonnx.mock.ts",
  },
  extensionsToTreatAsEsm: [".ts"],
};
