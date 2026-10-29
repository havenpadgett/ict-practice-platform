// Below 900px the app isn't usable (chart drawing needs a mouse and room),
// so a full-screen notice covers it. CSS only: at 900px and up this element
// is display:none and the layout underneath is untouched.
export function DesktopOnlyNotice() {
  return (
    <div
      role="alert"
      className="fixed inset-0 z-[1000] hidden items-center justify-center bg-background px-6 text-center max-[899.98px]:flex"
    >
      <p className="max-w-sm text-base text-foreground">This app is built for desktop. Please open it on a computer.</p>
    </div>
  );
}
