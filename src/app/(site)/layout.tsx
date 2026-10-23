import { BrokerBar } from "@/components/layout/BrokerBar";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

/** The public website: brokerage bar, header and footer around every visitor facing page. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoBanner />
      <BrokerBar />
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
