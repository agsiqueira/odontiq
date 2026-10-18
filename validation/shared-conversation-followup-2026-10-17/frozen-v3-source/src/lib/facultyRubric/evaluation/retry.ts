export async function evaluateFacultySemanticWithRetry<T>({
  evaluate,
  onFirstFailure,
}: {
  evaluate: (attemptNumber: 1 | 2) => Promise<T>;
  onFirstFailure?: (error: unknown) => void;
}) {
  try {
    return await evaluate(1);
  } catch (error) {
    onFirstFailure?.(error);
    return evaluate(2);
  }
}
