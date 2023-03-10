/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'ts', 'tsx'],
  collectCoverageFrom: ['src/*.{ts,tsx}'],
  coverageProvider: "v8",
  preset: 'ts-jest',
  testEnvironment: 'node',
};