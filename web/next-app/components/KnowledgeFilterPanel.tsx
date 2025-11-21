/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Filter, X, Search, Tag } from "lucide-react";

type FilterOptions = {
  tags: string[];
  winnersOnly: boolean;
  correlationsOnly: boolean;
  searchTerm: string;
};

type Props = {
  filters: FilterOptions;
  onChange: (filters: FilterOptions) => void;
  availableTags?: string[];
};

export function KnowledgeFilterPanel({ filters, onChange, availableTags = [] }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeFilterCount =
    filters.tags.length +
    (filters.winnersOnly ? 1 : 0) +
    (filters.correlationsOnly ? 1 : 0) +
    (filters.searchTerm ? 1 : 0);

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags: newTags });
  };

  const clearFilters = () => {
    onChange({
      tags: [],
      winnersOnly: false,
      correlationsOnly: false,
      searchTerm: "",
    });
  };

  // Predefined common tags if none available from API
  const tags = availableTags.length > 0 
    ? availableTags 
    : [
        "volatility",
        "trend-following",
        "mean-reversion",
        "momentum",
        "BTC",
        "ETH",
        "correlation",
        "feature-importance",
        "risk-management",
        "position-sizing",
      ];

  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="font-medium"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-2 h-3 w-3" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Search */}
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-2">
              <Search className="h-3 w-3" />
              Search Insights
            </Label>
            <Input
              placeholder="Search by content, strategy, symbol..."
              value={filters.searchTerm}
              onChange={(e) => onChange({ ...filters, searchTerm: e.target.value })}
            />
          </div>

          {/* Quick Filters */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Quick Filters</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="winners-only"
                  checked={filters.winnersOnly}
                  onCheckedChange={(checked) =>
                    onChange({ ...filters, winnersOnly: checked as boolean })
                  }
                />
                <Label
                  htmlFor="winners-only"
                  className="text-sm font-normal cursor-pointer"
                >
                  Winners Only (Profitable Strategies)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="correlations-only"
                  checked={filters.correlationsOnly}
                  onCheckedChange={(checked) =>
                    onChange({ ...filters, correlationsOnly: checked as boolean })
                  }
                />
                <Label
                  htmlFor="correlations-only"
                  className="text-sm font-normal cursor-pointer"
                >
                  Correlations & Patterns Only
                </Label>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-2">
              <Tag className="h-3 w-3" />
              Tags
            </Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = filters.tags.includes(tag);
                return (
                  <Badge
                    key={tag}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/90"
                    onClick={() => handleTagToggle(tag)}
                  >
                    #{tag}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Active Filters Summary */}
          {activeFilterCount > 0 && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                Showing insights matching {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

