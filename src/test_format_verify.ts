import { formatTime } from './engine/mathUtils';

const testCases = [
    { input: 45.123, expected: '45.123' },
    { input: 9.999, expected: '9.999' },
    { input: 60.000, expected: '1:00.000' },
    { input: 65.123, expected: '1:05.123' },
    { input: 3599.999, expected: '59:59.999' },
    { input: 3600.000, expected: '1:00:00.000' },
    { input: 3661.123, expected: '1:01:01.123' },
    { input: 7322.000, expected: '2:02:02.000' },
];

let failed = false;

testCases.forEach(({ input, expected }) => {
    const actual = formatTime(input);
    if (actual !== expected) {
        console.error(`FAILED: Input ${input}. Expected "${expected}", Got "${actual}"`);
        failed = true;
    } else {
        console.log(`PASS: ${input} -> ${actual}`);
    }
});

if (failed) {
    process.exit(1);
} else {
    console.log("All formatTime tests passed.");
}
