import { DisclaimerFooter } from "@/components/disclaimer-footer";

export default function PracticePage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 pt-10 pb-16 text-center sm:px-6 sm:pt-14">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          FVG Practice
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted sm:text-base">
          The exercise screen is coming next — this is where you&apos;ll mark
          Fair Value Gaps on a chart and get instant feedback.
        </p>
      </div>

      <DisclaimerFooter />
    </div>
  );
}
