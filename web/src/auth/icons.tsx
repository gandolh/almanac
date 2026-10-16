/**
 * The error mark beside a sign-in or password error: a 24-unit grid, round
 * caps, coloured by
 * `currentColor`. There is no danger colour: an error is ink, semibold,
 * with this mark. Decorative; the text says it.
 */
export function AlertIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v4.9" />
      <path d="M12 16.2h.01" strokeWidth={2.6} />
    </svg>
  );
}
