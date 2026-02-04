import { getSkillDisplayValue } from "../src/lib/utils";

const testCases = [
  { input: 200, expected: 20 },
  { input: 189, expected: 18 },
  { input: 199, expected: 19 },
  { input: 10, expected: 1 },
  { input: 9, expected: 1 },
  { input: 5, expected: 1 },
  { input: 1, expected: 1 },
  { input: 155, expected: 15 },
];

let failed = false;

console.log("Running getSkillDisplayValue tests...");

testCases.forEach(({ input, expected }) => {
  const result = getSkillDisplayValue(input);
  if (result !== expected) {
    console.error(`FAILED: Input ${input} => Expected ${expected}, got ${result}`);
    failed = true;
  } else {
    console.log(`PASSED: Input ${input} => ${result}`);
  }
});

if (failed) {
  console.error("Some tests failed.");
  process.exit(1);
} else {
  console.log("All tests passed!");
}
