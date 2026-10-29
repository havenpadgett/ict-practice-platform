import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Disclaimer", description: "ICT Practice is educational only and is not financial advice." };

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer" lede="Please read this before you use ICT Practice.">
      <LegalSection heading="Educational only">
        <p>
          ICT Practice is a training tool for reading charts. Nothing on this site is financial, investment or trading advice, and
          nothing here is a recommendation to buy or sell anything.
        </p>
      </LegalSection>
      <LegalSection heading="Trading is risky">
        <p>
          Trading futures involves substantial risk of loss and is not suitable for everyone. You can lose more than you put in.
          Only trade with money you can afford to lose, and talk to a licensed professional before you make trading decisions.
        </p>
      </LegalSection>
      <LegalSection heading="Past data is not a prediction">
        <p>
          The charts here use historical market data. How price moved in the past does not predict how it will move in the future,
          and doing well in practice does not mean you will do well trading real money.
        </p>
      </LegalSection>
      <LegalSection heading="Not affiliated">
        <p>
          ICT Practice is an independent project. It is not affiliated with, endorsed by or connected to ICT (Inner Circle Trader),
          Michael J. Huddleston, or PB Trading.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
