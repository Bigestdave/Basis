import { useEffect, useRef, useState } from "react";
import { NAV, SidebarContent } from "./components/Sidebar";
import type { NavKey } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { RightRail } from "./components/RightRail";
import type { PanelMode, PanelState } from "./components/RightRail";
import { Overview } from "./views/Overview";
import { Evidence } from "./views/Evidence";
import { Activity } from "./views/Activity";
import { CreditLine } from "./views/CreditLine";
import { Wallets } from "./views/Wallets";
import { Networks } from "./views/Networks";
import { FarmTest } from "./views/FarmTest";
import { BasisProvider, useBasis } from "./context/BasisContext";
import { BuildCreditModal } from "./components/BuildCreditModal";
import { EventDetailDrawer } from "./components/EventDetailDrawer";

const TITLES: Record<NavKey, string> = {
  overview: "Overview",
  credit: "Credit line",
  evidence: "Evidence",
  activity: "Activity",
  wallets: "Wallets",
  networks: "Networks & Verification",
  "farm-test": "Sybil & Farm Verification",
};

export default function App() {
  return (
    <BasisProvider>
      <BasisApp />
    </BasisProvider>
  );
}

function BasisApp() {
  const [view, setView] = useState<NavKey>("overview");
  const [navOpen, setNavOpen] = useState(false);
  const [panel, setPanel] = useState<PanelState>({
    mode: "borrow",
    amount: "",
    stage: "input",
  });

  const { buildModalOpen, setBuildModalOpen, inspectEventId, setInspectEventId } = useBasis();

  const mainRef = useRef<HTMLDivElement>(null);
  const mobileRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [view]);

  const navigate = (k: NavKey) => {
    setView(k);
    setNavOpen(false);
  };

  const startAction = (mode: PanelMode) => {
    setPanel({ mode, amount: "", stage: "input" });
    if (window.matchMedia("(max-width: 1279px)").matches) {
      mobileRailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const content =
    view === "overview" ? (
      <Overview go={navigate} />
    ) : view === "evidence" ? (
      <Evidence />
    ) : view === "activity" ? (
      <Activity />
    ) : view === "credit" ? (
      <CreditLine />
    ) : view === "wallets" ? (
      <Wallets />
    ) : view === "networks" ? (
      <Networks />
    ) : (
      <FarmTest />
    );

  return (
    <div className="flex h-full w-full overflow-hidden bg-white text-ink">
      {/* ------------------------------------------------------- sidebar */}
      <aside className="hidden w-[252px] shrink-0 border-r border-line lg:block">
        <SidebarContent current={view} onNavigate={navigate} />
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/25"
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[272px] border-r border-line bg-white shadow-xl">
            <SidebarContent
              current={view}
              onNavigate={navigate}
              onClose={() => setNavOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={TITLES[view]}
          onMenu={() => setNavOpen(true)}
          onBorrow={() => startAction("borrow")}
          onRepay={() => startAction("repay")}
        />

        <div className="flex min-h-0 flex-1">
          <div ref={mainRef} className="scroll-area min-w-0 flex-1 overflow-y-auto">
            {content}

            {/* rail folds beneath the content on narrow viewports */}
            <div ref={mobileRailRef} className="border-t border-line xl:hidden">
              <div className="mx-auto max-w-[880px] px-0 sm:px-2 lg:px-4">
                <RightRail state={panel} setState={setPanel} />
              </div>
            </div>

            <MobileTabs current={view} onNavigate={navigate} />
          </div>

          <aside className="scroll-area hidden w-[372px] shrink-0 overflow-y-auto border-l border-line xl:block">
            <RightRail state={panel} setState={setPanel} />
          </aside>
        </div>
      </div>

      {/* ------------------------------------------------ Modals and Drawers */}
      <BuildCreditModal
        isOpen={buildModalOpen}
        onClose={() => setBuildModalOpen(false)}
      />
      <EventDetailDrawer
        eventId={inspectEventId}
        onClose={() => setInspectEventId(null)}
      />
    </div>
  );
}

function MobileTabs({
  current,
  onNavigate,
}: {
  current: NavKey;
  onNavigate: (k: NavKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-line px-5 py-5 sm:px-8 lg:hidden">
      {NAV.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onNavigate(key)}
          className={
            "h-9 rounded-full px-4 text-[13.5px] font-medium transition-colors " +
            (key === current ? "bg-blue-soft text-blue" : "bg-surface text-ink-2")
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

