import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { FeatureList } from "@/components/feature-list";
import { PrimaryButton } from "@/components/primary-button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 pt-10 pb-16 text-center sm:px-6 sm:pt-14">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
          ICT Concepts Practice Platform
        </h1>
        <p className="mt-4 max-w-lg text-base text-muted sm:text-lg">
          Practice spotting chart patterns and get instant, honest feedback —
          repetition that builds recognition, not another video to watch.
        </p>

        <div className="mt-8 w-full max-w-sm">
          <FeatureList />
        </div>

        <div className="mt-10">
          <PrimaryButton href="/dashboard">Start Practicing</PrimaryButton>
        </div>
      </section>

      <DisclaimerFooter />
    </div>
  );
}
