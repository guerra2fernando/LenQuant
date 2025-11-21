/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { useMode } from "@/lib/mode-context";

export type ForecastFilters = {
  minConfidence: number;
  direction: 'all' | 'up' | 'down' | 'neutral';
};

type Props = {
  filters: ForecastFilters;
  onFiltersChange: (filters: ForecastFilters) => void;
  activeFiltersCount: number;
};

export function ForecastFilterPanel({ filters, onFiltersChange, activeFiltersCount }: Props) {
  const { isEasyMode } = useMode();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDirectionChange = (direction: ForecastFilters['direction']) => {
    onFiltersChange({ ...filters, direction });
  };

  const handleConfidenceChange = (value: number[]) => {
    onFiltersChange({ ...filters, minConfidence: value[0] });
  };

  const handleReset = () => {
    onFiltersChange({ minConfidence: 0, direction: 'all' });
  };

  if (!isExpanded) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(true)}
        >
          Filters
          {activeFiltersCount > 0 && (
            <Badge variant="default" className="ml-2">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
          >
            Clear Filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {isEasyMode ? "Filter Predictions" : "Forecast Filters"}
            </CardTitle>
            <CardDescription>
              {isEasyMode
                ? "Show only predictions that meet your criteria"
                : "Narrow down forecasts by confidence and direction"}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Direction Filter */}
        <div className="space-y-3">
          <label className="text-sm font-medium">
            {isEasyMode ? "Price Direction" : "Prediction Direction"}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filters.direction === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDirectionChange('all')}
            >
              All
            </Button>
            <Button
              variant={filters.direction === 'up' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDirectionChange('up')}
              className="gap-1"
            >
              <TrendingUp className="h-4 w-4" />
              {isEasyMode ? "Going Up" : "Bullish"}
            </Button>
            <Button
              variant={filters.direction === 'down' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDirectionChange('down')}
              className="gap-1"
            >
              <TrendingDown className="h-4 w-4" />
              {isEasyMode ? "Going Down" : "Bearish"}
            </Button>
            <Button
              variant={filters.direction === 'neutral' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDirectionChange('neutral')}
              className="gap-1"
            >
              <Minus className="h-4 w-4" />
              Neutral
            </Button>
          </div>
        </div>

        {/* Confidence Filter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              {isEasyMode ? "Minimum Confidence" : "Min Confidence"}
            </label>
            <span className="text-sm font-semibold">
              {(filters.minConfidence * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[filters.minConfidence]}
            onValueChange={handleConfidenceChange}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Reset Button */}
        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="w-full"
          >
            Reset All Filters
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

