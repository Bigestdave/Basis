import { BellIcon, HelpIcon, MenuIcon, SearchIcon } from "./Icons";
import { Button } from "./ui";

export function TopBar({
  title,
  onMenu,
  onBorrow,
  onRepay,
}: {
  title: string;
  onMenu: () => void;
  onBorrow: () => void;
  onRepay: () => void;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface lg:hidden"
        aria-label="Open navigation"
      >
        <MenuIcon size={20} />
      </button>

      <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="hidden items-center gap-2.5 rounded-full bg-surface px-3.5 lg:flex h-10 w-[248px] xl:w-[300px]">
          <SearchIcon size={17} className="shrink-0 text-ink-3" />
          <input
            placeholder="Search activity, counterparties"
            className="h-full w-full bg-transparent text-[14px] text-ink outline-none"
          />
        </div>

        <Button onClick={onBorrow}>Borrow</Button>
        <Button variant="secondary" onClick={onRepay} className="hidden sm:inline-flex">
          Repay
        </Button>

        <button
          type="button"
          className="relative hidden h-10 w-10 items-center justify-center rounded-full bg-surface text-ink hover:bg-surface-2 sm:flex"
          aria-label="Notifications"
        >
          <BellIcon size={18} />
          <span className="absolute right-2.5 top-2.5 h-[6px] w-[6px] rounded-full bg-blue ring-2 ring-surface" />
        </button>
        <button
          type="button"
          className="hidden h-10 w-10 items-center justify-center rounded-full bg-surface text-ink hover:bg-surface-2 xl:flex"
          aria-label="Help"
        >
          <HelpIcon size={18} />
        </button>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-[12.5px] font-semibold text-white"
          aria-label="Account"
        >
          AM
        </button>
      </div>
    </header>
  );
}
