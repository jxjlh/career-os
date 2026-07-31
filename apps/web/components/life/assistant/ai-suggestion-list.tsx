import { CheckCircle2, Lightbulb } from "lucide-react";

export function AiSuggestionList({ suggestions }: { suggestions?: string[] }) {
  const suggestionList = suggestions || [];
  if (suggestionList.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
        <Lightbulb className="h-3.5 w-3.5" />
        AI 建议
      </p>
      {suggestionList.map((suggestion, index) => (
        <p key={index} className="flex items-start gap-2 text-[13px] text-text/80">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          {suggestion}
        </p>
      ))}
    </div>
  );
}
