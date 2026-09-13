import { useState, type ElementType, type ReactNode } from "react";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  CircleUser,
  Download,
  Eye,
  Fingerprint,
  Globe,
  KeyRound,
  Lock,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Wallet,
} from "lucide-react";
import { useStore } from "../../store/store";
import { Badge, Button, Card, IconTile, Input, Modal, PageHeader, Select, Toggle } from "../../components/ui";
import { NetworkIcon } from "../../components/ui/icons";

function SettingRow({
  icon,
  title,
  description,
  right,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  right?: ReactNode;
  onClick?: () => void;
}) {
  const Comp: ElementType = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-line-soft py-3.5 text-left last:border-0 ${
        onClick ? "group hover:bg-subtle" : ""
      }`}
    >
      <IconTile size={34} tone="neutral" className="bg-subtle text-brand">
        {icon}
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">{title}</p>
        {description && <p className="truncate text-[12.5px] text-muted">{description}</p>}
      </div>
      {right ?? (onClick && <ChevronRight size={16} className="text-[#c4cbd6] group-hover:text-muted" />)}
    </Comp>
  );
}

export function SettingsPage() {
  const { user, wallet, navigate, pushToast, disconnectWallet } = useStore();
  const [notifications, setNotifications] = useState({
    activity: true,
    credit: true,
    security: true,
    product: false,
  });
  const [twoFactor, setTwoFactor] = useState(true);
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("en");
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [error, setError] = useState<string | null>(null);

  const saveProfile = () => {
    if (!name.trim()) return setError("Name cannot be empty.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");
    setError(null);
    setEditOpen(false);
    pushToast("success", "Account updated", "Your details were saved.");
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="min-w-0 space-y-6">
        <PageHeader title="Settings" subtitle="Manage your account, security, and preferences." />

        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <IconTile size={38}>
                <CircleUser size={18} />
              </IconTile>
              <div>
                <h3 className="text-[16px] font-semibold text-ink">Account information</h3>
                <p className="mt-0.5 text-[13px] text-muted">Your personal details and account settings.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#3b6fff] text-[14px] font-semibold text-white">
              {user?.initials}
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">{user?.name}</p>
              <p className="text-[13px] text-muted">{user?.email}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-3">
            {[
              { l: "Username", v: user?.username },
              { l: "Member since", v: user?.memberSince },
              { l: "Account type", v: user?.accountType },
            ].map((f, i) => (
              <div key={f.l} className={i > 0 ? "sm:border-l sm:border-line sm:pl-5" : undefined}>
                <p className="text-[12.5px] text-muted">{f.l}</p>
                <p className="mt-1 text-[14px] font-medium text-ink">{f.v}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <IconTile size={38}>
                <Bell size={18} />
              </IconTile>
              <div>
                <h3 className="text-[16px] font-semibold text-ink">Notifications</h3>
                <p className="mt-0.5 text-[13px] text-muted">Choose what you want to be notified about.</p>
              </div>
            </div>
            <button
              onClick={() => pushToast("info", "Notification preferences", "Advanced controls are disabled in demo mode.")}
              className="text-[13.5px] font-medium text-brand hover:underline"
            >
              Manage all
            </button>
          </div>

          <div className="mt-4">
            {[
              { k: "activity", t: "Activity updates", d: "Deposits, withdrawals, and transactions", i: <Eye size={15} /> },
              { k: "credit", t: "Credit updates", d: "Changes to your credit limit or score", i: <ShieldCheck size={15} /> },
              { k: "security", t: "Security alerts", d: "Login attempts, device changes, and more", i: <Lock size={15} /> },
              { k: "product", t: "Product updates", d: "New features, improvements, and announcements", i: <Bell size={15} /> },
            ].map((r) => (
              <SettingRow
                key={r.k}
                icon={r.i}
                title={r.t}
                description={r.d}
                right={
                  <Toggle
                    checked={notifications[r.k as keyof typeof notifications]}
                    onChange={(v) => setNotifications((n) => ({ ...n, [r.k]: v }))}
                  />
                }
              />
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-3">
            <IconTile size={38}>
              <Palette size={18} />
            </IconTile>
            <div>
              <h3 className="text-[16px] font-semibold text-ink">Appearance</h3>
              <p className="mt-0.5 text-[13px] text-muted">Customize how BASIS looks and feels.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
            <div>
              <p className="text-[14px] font-medium text-ink">Theme</p>
              <p className="text-[12.5px] text-muted">Choose between light and dark mode.</p>
            </div>
            <div className="inline-flex rounded-[10px] bg-subtle p-1">
              {[
                { id: "light", label: "Light", icon: <Sun size={14} /> },
                { id: "dark", label: "Dark", icon: <Moon size={14} /> },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    if (t.id === "dark") pushToast("info", "Dark mode", "Dark theme is coming soon to BASIS.");
                  }}
                  className={`inline-flex items-center gap-2 rounded-[8px] px-5 py-2 text-[13.5px] font-medium transition-all duration-150 ${
                    theme === t.id ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)]" : "text-muted"
                  }`}
                >
                  <span className={theme === t.id ? "text-warn" : ""}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
            <div>
              <p className="text-[14px] font-medium text-ink">Language</p>
              <p className="text-[12.5px] text-muted">Select your preferred language.</p>
            </div>
            <Select
              value={language}
              onChange={setLanguage}
              className="w-[220px]"
              icon={<Globe size={15} className="text-muted" />}
              options={[
                { value: "en", label: "English" },
                { value: "es", label: "Español" },
                { value: "fr", label: "Français" },
                { value: "ko", label: "한국어" },
              ]}
            />
          </div>
        </Card>
      </div>

      {/* rail */}
      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <IconTile size={38}>
              <Wallet size={18} />
            </IconTile>
            <div>
              <h3 className="text-[16px] font-semibold text-ink">Connected wallet</h3>
              <p className="mt-0.5 text-[13px] text-muted">Your primary wallet for BASIS.</p>
            </div>
          </div>

          <div className="mt-4 rounded-[12px] border border-line">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
              <span className="inline-flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-[7px] bg-brand-soft text-brand">
                  <Wallet size={14} />
                </span>
                <span className="font-mono text-[13.5px] text-ink">{wallet?.shortAddress}</span>
              </span>
              <Badge tone="positive">Connected</Badge>
            </div>
            <button
              onClick={() => navigate("wallets")}
              className="group flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-subtle"
            >
              <div className="flex-1">
                <p className="text-[12.5px] text-muted">Network</p>
                <p className="mt-0.5 inline-flex items-center gap-2 text-[13.5px] font-medium text-ink">
                  <NetworkIcon id="ethereum" size={18} /> Ethereum
                </p>
              </div>
              <div className="flex-1 border-l border-line pl-4">
                <p className="text-[12.5px] text-muted">Last connected</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-ink">{wallet?.lastConnected}</p>
              </div>
              <ChevronRight size={16} className="text-[#c4cbd6] group-hover:text-muted" />
            </button>
          </div>

          <button
            onClick={() => navigate("connect-wallet")}
            className="group mt-3 flex w-full items-center gap-3 rounded-[12px] border border-line px-4 py-3.5 text-left hover:bg-subtle"
          >
            <Wallet size={16} className="text-muted" />
            <span className="flex-1 text-[14px] font-medium text-ink">Manage wallet</span>
            <ChevronRight size={16} className="text-[#c4cbd6] group-hover:text-muted" />
          </button>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <IconTile size={38}>
              <ShieldCheck size={18} />
            </IconTile>
            <div>
              <h3 className="text-[16px] font-semibold text-ink">Security</h3>
              <p className="mt-0.5 text-[13px] text-muted">Keep your account safe and secure.</p>
            </div>
          </div>
          <div className="mt-3">
            <SettingRow
              icon={<Fingerprint size={15} />}
              title="Two-factor authentication (2FA)"
              description="Add an extra layer of security to your account."
              right={<Toggle checked={twoFactor} onChange={setTwoFactor} />}
            />
            <SettingRow
              icon={<Eye size={15} />}
              title="Login sessions"
              description="View and manage your active sessions."
              onClick={() => pushToast("info", "2 active sessions", "Chrome · macOS and Safari · iOS")}
            />
            <SettingRow
              icon={<KeyRound size={15} />}
              title="Password"
              description="Change your password regularly."
              onClick={() => pushToast("info", "Password reset", "A reset link would be emailed to you.")}
            />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <IconTile size={38}>
              <Lock size={18} />
            </IconTile>
            <div>
              <h3 className="text-[16px] font-semibold text-ink">Data &amp; privacy</h3>
              <p className="mt-0.5 text-[13px] text-muted">Control how your data is used.</p>
            </div>
          </div>
          <div className="mt-3">
            <SettingRow
              icon={<ShieldCheck size={15} />}
              title="Data permissions"
              description="Manage what data you share with BASIS."
              onClick={() => pushToast("info", "Data permissions", "BASIS reads public on-chain data only.")}
            />
            <SettingRow
              icon={<Eye size={15} />}
              title="Privacy settings"
              description="Control your visibility and preferences."
              onClick={() => pushToast("info", "Privacy settings", "Your evidence is private by default.")}
            />
            <SettingRow
              icon={<Download size={15} />}
              title="Download your data"
              description="Get a copy of your account data."
              onClick={() => pushToast("success", "Export requested", "We'll email your data export shortly.")}
            />
            <SettingRow
              icon={<KeyRound size={15} />}
              title="Disconnect wallet"
              description="Remove this wallet from BASIS."
              onClick={() => void disconnectWallet()}
            />
          </div>
        </Card>

        <Card className="bg-subtle p-0">
          <button
            onClick={() => pushToast("info", "Help center", "Support is not available in demo mode.")}
            className="group flex w-full items-center gap-3 p-5 text-left"
          >
            <IconTile size={38}>
              <CircleHelp size={18} />
            </IconTile>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-ink">Need help?</p>
              <p className="text-[12.5px] text-muted">Visit our help center or contact support.</p>
            </div>
            <ChevronRight size={16} className="text-[#c4cbd6] group-hover:text-muted" />
          </button>
        </Card>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit account information"
        subtitle="Update the details shown across BASIS."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveProfile}>Save changes</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-ink">Full name</label>
            <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-[13px] font-medium text-ink">Email</label>
            <Input className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="text-[12.5px] text-neg">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
