import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <Card className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
        <Sparkles className="h-6 w-6 text-brand-500" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-ink-900">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-500">
        This module is planned for a later phase. Phase 1 focuses entirely on the Inventory module.
      </p>
    </Card>
  );
}
