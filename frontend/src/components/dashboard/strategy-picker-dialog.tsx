"use client";

import { useAtom } from "jotai";
import { Play, Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { activeStrategyIdsAtom, strategiesAtom } from "@/store";

interface StrategyPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (strategyId: string) => Promise<void>;
}

export function StrategyPickerDialog({
  open,
  onOpenChange,
  onAdd,
}: StrategyPickerDialogProps) {
  const [strategies] = useAtom(strategiesAtom);
  const [activeStrategyIds] = useAtom(activeStrategyIdsAtom);
  const [loading, setLoading] = useState<string | null>(null);

  const handleAdd = async (id: string) => {
    setLoading(id);
    try {
      await onAdd(id);
      onOpenChange(false);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Strategy</DialogTitle>
          <DialogDescription>
            Select a strategy to start running on your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-3 max-h-[60vh] overflow-y-auto">
          {strategies.map((strategy) => {
            const isActive = activeStrategyIds.includes(strategy.id);
            const isLoading = loading === strategy.id;

            return (
              <div
                key={strategy.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{strategy.name}</h3>
                      {isActive && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
                        >
                          Running
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {strategy.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={isActive || isLoading}
                    onClick={() => handleAdd(strategy.id)}
                    className="shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    <span className="ml-1.5">
                      {isActive ? "Active" : "Run"}
                    </span>
                  </Button>
                </div>
                {strategy.how_it_works && (
                  <Collapsible className="mt-2">
                    <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      How it works →
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed rounded-md bg-muted/50 p-3">
                        {strategy.how_it_works}
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            );
          })}

          {strategies.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No strategies available. Connect your Kite API first.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
