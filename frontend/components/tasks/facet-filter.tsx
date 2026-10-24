"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FacetOption {
  value: string;
  label: string;
  /** Rendered instead of ``label`` in the list; ``label`` is still used for search and chips. */
  content?: ReactNode;
}

/**
 * Filter dropdown with search. Single-select by default; ``multiple`` turns it into a
 * checklist. The trigger shows the current selection so state is visible at a glance.
 */
export function FacetFilter({
  title,
  options,
  selected,
  onChange,
  multiple = false,
  disabled = false,
  disabledHint,
  searchable = true,
}: {
  title: string;
  options: FacetOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.filter((o) => selected.includes(o.value));
  const summary =
    chosen.length === 0
      ? null
      : chosen.length === 1
        ? chosen[0].label
        : `${chosen.length} selected`;

  const toggle = (value: string) => {
    if (!multiple) {
      onChange(selected.includes(value) ? [] : [value]);
      setOpen(false);
      return;
    }
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          title={disabled ? disabledHint : undefined}
          aria-label={summary ? `${title}: ${summary}` : `Filter by ${title.toLowerCase()}`}
          className={cn(
            "h-9 max-w-56 border-dashed font-normal",
            summary && "border-solid bg-accent/50",
          )}
        >
          <span className="text-muted-foreground">{title}</span>
          {summary && <span className="truncate font-medium">{summary}</span>}
          <ChevronDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder={`Search ${title.toLowerCase()}…`} />}
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => toggle(option.value)}
                    aria-selected={isSelected}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center border border-primary/50",
                        multiple ? "rounded-sm" : "rounded-full",
                        isSelected ? "bg-primary text-primary-foreground" : "[&_svg]:invisible",
                      )}
                      aria-hidden
                    >
                      <Check className="size-3" />
                    </span>
                    {option.content ?? option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onChange([]);
                      setOpen(false);
                    }}
                    className="justify-center text-center"
                  >
                    Clear {title.toLowerCase()}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
