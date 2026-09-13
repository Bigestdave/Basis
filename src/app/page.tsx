"use client";

import { AppShell } from "@/components/layout/AppShell";
import { StoreProvider, useStore } from "@/store/store";
import { HomePage } from "@/features/home/HomePage";
import { CreditPage } from "@/features/credit/CreditPage";
import { BorrowRepayPage } from "@/features/credit/BorrowRepayPage";
import { ActivityPage } from "@/features/activity/ActivityPage";
import { EvidencePage } from "@/features/evidence/EvidencePage";
import { WalletsPage, ConnectWalletView } from "@/features/wallets/WalletsPage";
import { NetworksPage } from "@/features/networks/NetworksPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { BuildCreditPage } from "@/features/build-credit/BuildCreditPage";
import { CreditResultPage } from "@/features/build-credit/CreditResultPage";
import { FarmTestPage } from "@/features/farm-test/FarmTestPage";
import { EventDrawer } from "@/features/activity/EventDrawer";
import { Card, ErrorState } from "@/components/ui";

function Routes() {
  const { route, status, reload } = useStore();

  if (status === "error") {
    return (
      <Card className="mx-auto mt-16 max-w-[560px] p-2">
        <ErrorState
          title="We couldn't reach BASIS"
          description="Your economic data could not be loaded. This is usually temporary — retry in a moment."
          onRetry={reload}
        />
      </Card>
    );
  }

  switch (route) {
    case "home":
      return <HomePage />;
    case "credit":
      return <CreditPage />;
    case "borrow":
      return <BorrowRepayPage mode="borrow" />;
    case "repay":
      return <BorrowRepayPage mode="repay" />;
    case "activity":
      return <ActivityPage />;
    case "evidence":
      return <EvidencePage />;
    case "wallets":
      return <WalletsPage />;
    case "connect-wallet":
      return <ConnectWalletView />;
    case "networks":
      return <NetworksPage />;
    case "settings":
      return <SettingsPage />;
    case "build-credit":
      return <BuildCreditPage />;
    case "credit-result":
      return <CreditResultPage />;
    case "farm-test":
      return <FarmTestPage />;
    default:
      return <HomePage />;
  }
}

function Shell() {
  const { route } = useStore();
  return (
    <AppShell>
      <div key={route} className="animate-fade">
        <Routes />
      </div>
      <EventDrawer />
    </AppShell>
  );
}

export default function Page() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
