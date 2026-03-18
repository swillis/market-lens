import { z } from "zod";

// FMP /stable/quote response
export const fmpQuoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  previousClose: z.number(),
  change: z.number(),
  changePercentage: z.number(),
  open: z.number().optional(),
  dayLow: z.number().optional(),
  dayHigh: z.number().optional(),
});
export const fmpQuoteArraySchema = z.array(fmpQuoteSchema).min(1);

// FMP /stable/profile response
export const fmpProfileSchema = z.object({
  symbol: z.string(),
  companyName: z.string(),
  sector: z.string().optional().default(""),
  industry: z.string().optional().default(""),
  exchange: z.string().optional().default(""),
});
export const fmpProfileArraySchema = z.array(fmpProfileSchema).min(1);

// Finnhub /company-news response
export const finnhubNewsItemSchema = z.object({
  headline: z.string().optional().default("Untitled"),
  source: z.string().optional().default("Unknown"),
  datetime: z.number().optional(),
  url: z.string().optional().default(""),
  summary: z.string().optional(),
  related: z.string().optional(),
});
export const finnhubNewsArraySchema = z.array(finnhubNewsItemSchema);

// Finnhub /stock/peers response
export const finnhubPeersSchema = z.array(z.string());
