---
name: bugfix
description: If there is the question to fix a bug in the code, this skill helps identify the issue and implement the necessary changes.
---

# Bugfix

This skill is used when there is a need to identify and fix bugs in the code.

## 1. Understand and reproduce the bug

From the user input, identify the reported bug and any relevant context or steps to reproduce it.
Create a minimal reproducible example if possible, so you can observe the bug in isolation.
Include it in the test suite to ensure the bug can be consistently reproduced and verified after the fix.

## 2. Fix the bug

Ensure that the bug is properly addressed and that the code behaves as expected after the fix.
For the expectation, also consider the files in the docs folder to understand the intended behavior and structure of the system.

## 3. Expand the test to similar scenarios

After fixing the bug, consider other similar scenarios that might be affected by the same issue.
Add tests for these scenarios to ensure that the fix is comprehensive and does not introduce new bugs.

## 4. Wrap up

Summarize what changed and explicitly name the core issue that was fixed.