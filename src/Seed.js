const mongoose = require("mongoose");
// Make sure to adjust the path to where your actual Problem model is located
// If you prefer, you can also paste the model definition directly here for a standalone script.
const { Problem, Counter } = require("./models/problem.model"); 

// REPLACE WITH YOUR ACTUAL MONGODB URI
const MONGO_URI = "mongodb+srv://swadeshicreator_db_user:jYCXD1cZLzsVVCgO@cluster0.vdvdirm.mongodb.net/OA_Database?appName=Cluster0";

const seedProblems = [
  {
    problemId: 1001,
    name: "The Sigma Sum",
    timeLimit: 1.0,
    memoryLimit: 256,
    htmlDescription: `
# Problem Description
You are given an array $A$ of size $n$. Your task is to calculate the sum of all elements.

The formula for the sum is:
$$ S = \\sum_{i=1}^{n} A_i $$

**Input Format**
- The first line contains an integer $n$ ($1 \\le n \\le 10^5$).
- The second line contains $n$ space-separated integers $A_i$.

**Output Format**
- Print a single integer representing the sum.
`,
    isPrivate: false,
  },
  {
    problemId: 1002,
    name: "Combinatorics Challenge",
    timeLimit: 2.0,
    memoryLimit: 512,
    htmlDescription: `
# Counting Ways
You have $n$ items and you need to choose $k$ of them. Calculate the number of ways to do this modulo $10^9 + 7$.

The formula for combinations is:
$$ C(n, k) = \\frac{n!}{k!(n-k)!} $$

**Constraints**
- $1 \\le k \\le n \\le 1000$
- Output the answer modulo $10^9 + 7$.
`,
    isPrivate: false,
  },
  {
    problemId: 1003,
    name: "Circle Area",
    timeLimit: 0.5,
    memoryLimit: 64,
    htmlDescription: `
# Geometry Basics
Given the radius $r$ of a circle, calculate its area.

$$ Area = \\pi r^2 $$

**Note:** Use $\\pi \\approx 3.14159$.

**Input:**
- A single float $r$.
`,
    isPrivate: false,
  },
  {
    problemId: 1004,
    name: "Golden GCD",
    timeLimit: 1.0,
    memoryLimit: 128,
    htmlDescription: `
# Greatest Common Divisor
Given two integers $a$ and $b$, find their greatest common divisor.

$$ \\gcd(a, b) = \\begin{cases} a & \\text{if } b = 0 \\\\ \\gcd(b, a \\% b) & \\text{if } b \\neq 0 \\end{cases} $$

**Example:**
- If $a=10, b=5$, result is $5$.
`,
    isPrivate: false,
  },
  {
    problemId: 1005,
    name: "Physics Motion",
    timeLimit: 1.0,
    memoryLimit: 256,
    htmlDescription: `
# Kinematics
An object starts with initial velocity $u$ and accelerates at rate $a$ for time $t$. Find the final distance $s$.

The equation of motion is:
$$ s = ut + \\frac{1}{2}at^2 $$

**Constraints:**
- All inputs are non-negative integers.
`,
    isPrivate: false,
  },
  {
    problemId: 1006,
    name: "Complex Roots",
    timeLimit: 1.5,
    memoryLimit: 256,
    htmlDescription: `
# Quadratic Equation
Find the roots of the quadratic equation $ax^2 + bx + c = 0$.

The quadratic formula is:
$$ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} $$

If $b^2 - 4ac < 0$, print "Imaginary".
`,
    isPrivate: false,
  },
  {
    problemId: 1007,
    name: "Limit Breaker",
    timeLimit: 2.0,
    memoryLimit: 512,
    htmlDescription: `
# Calculus Limit
Evaluate the following limit for a given $x$:

$$ \\lim_{x \\to 0} \\frac{\\sin x}{x} = 1 $$

**Task:**
Verify this property numerically for small values of $x$.
`,
    isPrivate: false,
  },
  {
    problemId: 1008,
    name: "Matrix Power",
    timeLimit: 3.0,
    memoryLimit: 1024,
    htmlDescription: `
# Matrix Exponentiation
Given a $2 \\times 2$ matrix $M$, calculate $M^k$.

$$ M = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} $$

Output the matrix elements modulo $10^9+7$.
`,
    isPrivate: false,
  },
  {
    problemId: 1009,
    name: "Set Theory",
    timeLimit: 1.0,
    memoryLimit: 128,
    htmlDescription: `
# Intersection
Given two sets $A$ and $B$, find the size of their intersection.

$$ |A \\cap B| = |A| + |B| - |A \\cup B| $$

**Input:**
- Two lists of integers representing the sets.
`,
    isPrivate: false,
  },
  {
    problemId: 1010,
    name: "Logarithmic Scale",
    timeLimit: 0.5,
    memoryLimit: 64,
    htmlDescription: `
# Logarithms
Calculate the value of $y$ given $x$:

$$ y = \\log_2(x) + \\ln(x) $$

**Constraints:**
- $x > 0$
`,
    isPrivate: false,
  },
];

const seedDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB...");

    // 1. Clear existing problems to keep a clean slate
// 1. Clear existing problems to keep a clean slate
    // await Problem.deleteMany({});
    // console.log("Cleared existing problems...");

    // // 2. CRITICAL FIX: Delete any old counter, then EXPLICITLY create the starting counter
    await Counter.deleteOne({ _id: 'assessment_seq' });
    await Counter.create({ _id: 'assessment_seq', seq: 999999 }); // Force the starting number here!
    // console.log("Reset and initialized problem sequence counter to 999999...");

    // // 3. Save documents individually so the pre('save') hook triggers
    // const savePromises = seedProblems.map(prob => new Problem(prob).save());
    // await Promise.all(savePromises);

    // console.log("Successfully seeded 10 problems with sequential IDs starting at 1000000!");
    mongoose.connection.close();
  } catch (err) {
    console.error("Error seeding database:", err);
    mongoose.connection.close();
  }
};

seedDB();