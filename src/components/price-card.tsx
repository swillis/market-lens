import type { PriceSnapshot, CompanyProfile } from "@/lib/types/market";
import { formatPrice, formatPercent, formatChange } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{price.symbol}</h1>
            {company.exchange && (
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                {company.exchange}
              </span>
            )}
          </div>
          <p className="mt-1 text-zinc-400">{company.companyName}</p>
          {(company.sector || company.industry) && (
            <p className="mt-0.5 text-sm text-zinc-500">
              {[company.sector, company.industry].filter(Boolean).join(" / ")}
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="text-3xl font-semibold text-white">
            {formatPrice(price.currentPrice)}
          </p>
          <div
            className={cn(
              "mt-1 flex items-center justify-end gap-2 text-lg font-medium",
              isPositive && "text-emerald-400",
              isNegative && "text-red-400",
              !isPositive && !isNegative && "text-zinc-400"
            )}
          >
            {isPositive && <TrendingUp className="h-5 w-5" />}
            {isNegative && <TrendingDown className="h-5 w-5" />}
            {!isPositive && !isNegative && <Minus className="h-5 w-5" />}
            <span>
              {formatChange(price.change)} ({formatPercent(price.changePercent)})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
