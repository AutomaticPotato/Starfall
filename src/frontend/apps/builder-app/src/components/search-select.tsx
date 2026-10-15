import { CheckIcon, ChevronsUpDownIcon, InfoIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { facetValues, filterOptions, toggleFacet, type Facet, type FacetSelection } from "@/lib/rules/option-filters";
import { cn } from "@/lib/utils";

export type SearchSelectOption = {
  id: string;
  name: string;
  hint?: string | null;
  disabled?: boolean;
  /** Its values per filter group (see the list's facets): level, school… */
  facets?: Record<string, string[]>;
  /** What it is, in a few words, for the details strip ("3rd-level evocation"). */
  kind?: string | null;
  /** Its figures, for the details strip (casting time, range…). */
  details?: { label: string; value: string }[];
  /** What it needs, for the details strip ("Wizard Level 5"). */
  needs?: string | null;
};

// long lists (all spells, all feats) render the first matches only; typing narrows them down
const MAX_SHOWN = 200;

/**
 * A dropdown with a search box, like Aurora's selection lists: type to filter, arrows + Enter to pick.
 * Options are usually loaded when the list opens (see onOpenChange). onHighlight reports the option under the
 * mouse or keyboard so a description panel can follow along.
 */
export function SearchSelect({
  value,
  valueLabel,
  valueHint,
  options,
  loading,
  placeholder = "Choose…",
  disabled,
  className,
  onOpenChange,
  onSelect,
  onClear,
  onHighlight,
  facets,
}: {
  value?: string | null;
  valueLabel?: string | null;
  valueHint?: string | null;
  options?: SearchSelectOption[];
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  onSelect: (id: string) => void;
  onClear?: () => void;
  onHighlight?: (id: string | null) => void;
  /** Filter groups for its options (spells: level, school, casting, tags); chips show for the groups that tell them apart. */
  facets?: Facet[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [selection, setSelection] = useState<FacetSelection>({});
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const listRef = useRef<HTMLUListElement>(null);

  const groups = useMemo(
    () => (facets ?? []).map((facet) => ({ facet, values: facetValues(options ?? [], facet) })).filter((g) => g.values.length > 0),
    [facets, options],
  );
  // "only what I can take" when some options can't be taken yet (a feat or plan for a higher level)
  const someDisabled = useMemo(() => (options ?? []).some((o) => o.disabled) && (options ?? []).some((o) => !o.disabled), [options]);
  const hasFilters = groups.length > 0 || someDisabled;
  const ticked = Object.values(selection).reduce((n, v) => n + v.length, 0) + (onlyAvailable ? 1 : 0);
  const hasDetails = useMemo(() => (options ?? []).some((o) => o.details?.length || o.kind || o.needs), [options]);

  const filtered = useMemo(() => filterOptions(options ?? [], query, selection, onlyAvailable), [options, query, selection, onlyAvailable]);
  const shown = useMemo(() => filtered.slice(0, MAX_SHOWN), [filtered]);

  // start on the current pick when the list opens or its options arrive
  useEffect(() => {
    if (open) setActive(Math.max(0, shown.findIndex((o) => o.id === value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options]);

  const activeId = open ? (shown[active]?.id ?? null) : null;
  useEffect(() => {
    onHighlight?.(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setSelection({});
      setOnlyAvailable(false);
    } else {
      // the chips start open on a wide screen and folded on a phone, where the list needs the room
      setShowFilters(typeof window === "undefined" || window.matchMedia("(min-width: 640px)").matches);
    }
    onOpenChange?.(next);
  }

  function tick(key: string, value: string) {
    setSelection((s) => toggleFacet(s, key, value));
    setActive(0);
  }

  const current = shown[active];

  function pick(option: SearchSelectOption) {
    if (option.disabled && option.id !== value) return;
    changeOpen(false);
    if (option.id !== value) onSelect(option.id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    }
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-sm shadow-xs transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50",
            !valueLabel && "border-dashed",
            className,
          )}
        >
          <span className="min-w-0 truncate">
            {valueLabel ? (
              <>
                {valueLabel}
                {valueHint && <span className="text-muted-foreground"> · {valueHint}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search…"
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {hasFilters && (
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={cn(
                "flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted max-sm:min-h-9",
                (showFilters || ticked > 0) && "text-foreground",
              )}
            >
              <SlidersHorizontalIcon className="size-3.5" /> Filters{ticked > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{ticked}</span>}
            </button>
          )}
        </div>
        {hasFilters && showFilters && (
          <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto border-b px-3 py-2">
            {groups.map(({ facet, values }) => (
              <div key={facet.key} className="flex items-center gap-1.5">
                <span className="w-14 shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">{facet.label}</span>
                <div className="flex min-w-0 gap-1 overflow-x-auto pb-0.5">
                  {values.map((value) => {
                    const on = selection[facet.key]?.includes(value) ?? false;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => tick(facet.key, value)}
                        className={cn(
                          "h-7 shrink-0 rounded-full border px-2.5 text-xs whitespace-nowrap max-sm:min-h-9",
                          on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {(someDisabled || ticked > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {someDisabled && (
                  <button
                    type="button"
                    aria-pressed={onlyAvailable}
                    onClick={() => {
                      setOnlyAvailable((v) => !v);
                      setActive(0);
                    }}
                    className={cn(
                      "h-7 rounded-full border px-2.5 text-xs max-sm:min-h-9",
                      onlyAvailable ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    Only what I can take now
                  </button>
                )}
                {ticked > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelection({});
                      setOnlyAvailable(false);
                      setActive(0);
                    }}
                    className="h-7 px-1 text-xs text-muted-foreground underline-offset-2 hover:underline max-sm:min-h-9"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center p-4">
            <Spinner className="size-5" />
          </div>
        ) : shown.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">{ticked > 0 || query ? "Nothing matches; change the filters or the search." : "No options"}</p>
        ) : (
          <ul ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {shown.map((option, i) => (
              <li
                key={option.id}
                data-index={i}
                role="option"
                aria-selected={option.id === value}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(option)}
                className={cn(
                  "flex cursor-pointer items-start gap-2 px-3 py-1.5 text-sm",
                  i === active && "bg-muted",
                  option.disabled && "cursor-not-allowed text-muted-foreground",
                )}
              >
                <CheckIcon className={cn("mt-0.5 size-4 shrink-0", option.id === value ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.name}</span>
                  {option.hint && <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>}
                </span>
                {hasDetails && (
                  // on a phone a tap picks, so the details have their own button
                  <button
                    type="button"
                    aria-label={`Details of ${option.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActive(i);
                    }}
                    className={cn("-my-1 -me-2 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background max-sm:size-9", i === active && "text-foreground")}
                  >
                    <InfoIcon className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {hasDetails && current && (current.kind || current.details?.length || current.needs) && (
          <div aria-live="polite" className="max-h-40 overflow-y-auto border-t bg-muted/40 px-3 py-2 text-xs">
            <p className="font-medium text-foreground">
              {current.name}
              {current.kind && <span className="font-normal text-muted-foreground"> · {current.kind}</span>}
            </p>
            {current.details && current.details.length > 0 && (
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                {current.details.map((d) => (
                  <div key={d.label} className="contents">
                    <dt className="text-muted-foreground">{d.label}</dt>
                    <dd className="min-w-0 break-words">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {current.needs && (
              <p className={cn("mt-1", current.disabled ? "text-destructive" : "text-muted-foreground")}>
                Needs {current.needs}
                {current.disabled ? ": not met yet" : ": met"}
              </p>
            )}
          </div>
        )}
        {filtered.length > MAX_SHOWN && (
          <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            Showing {MAX_SHOWN} of {filtered.length}. Type to narrow down.
          </p>
        )}
        {value && onClear && (
          <button
            type="button"
            onClick={() => {
              changeOpen(false);
              onClear();
            }}
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
          >
            <XIcon className="size-4" /> Clear choice
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
