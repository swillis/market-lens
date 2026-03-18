import type { PriceSnapshot, CompanyProfile } from "@/lib/types/market";
import { formatPrice, formatPercent, formatChange } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function PriceCard({
  price,
  company,
}: {
  price: PriceSnapshot;
  company: CompanyProfile;
}) {
  const isPositive = price.changePercent > 0;
  const isNegative = price.changePercent < 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">{price.symbol}</h1>
            {company.exchange && (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                {company.exchange}
              </span>
            )}
          </div>
          <p className="mt-1 text-zinc-500">{company.companyName}</p>
          {(company.sector || company.industry) && (
            <p className="mt-0.5 text-sm text-zinc-400">
              {[company.sector, company.industry].filter(Boolean).join(" / ")}
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="text-3xl font-semibold text-zinc-900">
            {formatPrice(price.currentPrice)}
          </p>
          <div className="mt-2 flex items-center justify-end">
            <span
              className={cn(
                "rounded-full px-3 py-0.5 text-sm font-medium",
                isPositive && "bg-green-50 text-green-600",
                isNegative && "bg-red-50 text-red-600",
                !isPositive && !isNegative && "bg-zinc-100 text-zinc-500"
              )}
            >
              {formatChange(price.change)} ({formatPercent(price.changePercent)})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
