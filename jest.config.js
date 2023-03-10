/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'ts', 'tsx'],
  collectCoverageFrom: ['<rootDir>/src/*.{ts,tsx}'],
  coverageProvider: "v8",
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transformIgnorePatterns: ['<rootDir>/node_modules/(?!wavesurfer.js)'],
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
    "^.+\\.(js|jsx)$": "babel-jest",
  }
};