"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

const DEFAULT_TICKERS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN"];

export function TickerSearch() {
  const [value, setValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_TICKERS);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch ticker suggestions
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsLoading(true);
    const query = value.trim();

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/tickers/search?q=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        setSuggestions(data.results || DEFAULT_TICKERS);
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
        setSuggestions(DEFAULT_TICKERS);
      } finally {
        setIsLoading(false);
      }
    }, 300); // Debounce for 300ms

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function navigateToTicker(ticker: string) {
    router.push(`/ticker/${ticker}`);
    setIsOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ticker = value.trim().toUpperCase();
    if (ticker && /^[A-Z]{1,5}$/.test(ticker)) {
      navigateToTicker(ticker);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value.toUpperCase();
    setValue(newValue);
    setIsOpen(true);
    setSelectedIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          navigateToTicker(suggestions[selectedIndex]);
        } else {
          handleSubmit(e as any);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a ticker (e.g. NVDA)"
          maxLength={5}
          className="w-full rounded-xl border border-zinc-200 bg-white py-4 pl-12 pr-4 text-lg text-zinc-900 placeholder-zinc-400 outline-none ring-zinc-200 transition focus:border-zinc-400 focus:ring-2"
        />

        {/* Autocomplete Dropdown */}
        {isOpen && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-sm z-50"
          >
            {isLoading && (
              <div className="px-4 py-3 text-sm text-zinc-400">
                Loading suggestions...
              </div>
            )}
            {!isLoading &&
              suggestions.map((ticker, index) => (
                <button
                  key={ticker}
                  type="button"
                  onClick={() => navigateToTicker(ticker)}
                  className={`w-full px-4 py-3 text-left text-sm transition ${
                    index === selectedIndex
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  } ${index > 0 ? "border-t border-zinc-100" : ""}`}
                >
                  <span className="font-semibold">{ticker}</span>
                </button>
              ))}
          </div>
        )}
      </div>
    </form>
  );
}
