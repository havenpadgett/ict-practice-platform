export function GoogleSignInButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.11C3.25 21.3 7.31 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.61H1.27A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11z"
        />
        <path
          fill="#EA4335"
          d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.23 0 12 0 7.31 0 3.25 2.7 1.27 6.61l4 3.11C6.22 6.88 8.87 4.77 12 4.77z"
        />
      </svg>
      Continue with Google
    </button>
  );
}
