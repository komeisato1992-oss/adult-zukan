import { SNS_X_ACCOUNT_LABEL } from "@/lib/admin/sns-x-account";

export function SnsXAccountBanner() {
  return (
    <div className="w-full max-w-full overflow-hidden rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
      <p className="break-words text-sm text-foreground">
        <span className="text-muted">Xアカウント：</span>
        <span className="whitespace-nowrap font-semibold">{SNS_X_ACCOUNT_LABEL}</span>
      </p>
    </div>
  );
}
