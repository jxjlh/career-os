import { Camera, Flag, Lightbulb, NotebookPen, Rocket, Sprout, Trophy } from "lucide-react";

import { Card } from "@/components/ui";
import type { YearReviewResponse } from "@/lib/life";

export function YearReviewContent({ review }: { review: YearReviewResponse }) {
  const skills = review.growth?.skills || [];
  const habits = review.growth?.habits || [];

  return (
    <div className="space-y-4">
      {review.achievements.length > 0 && (
        <Card className="p-5">
          <SectionTitle icon={<Trophy className="h-4 w-4 text-warning" />} title="我的成就" />
          <ul className="mt-3 space-y-2">
            {review.achievements.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-[13px] text-text/80">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(skills.length > 0 || habits.length > 0) && (
        <Card className="p-5">
          <SectionTitle icon={<Sprout className="h-4 w-4 text-success" />} title="我的成长" />
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {skills.length > 0 && (
              <div>
                <p className="text-[13px] font-medium text-muted">能力提升</p>
                <ul className="mt-2 space-y-1.5">
                  {skills.map((item, index) => (
                    <li key={index} className="text-[13px] text-text/80">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {habits.length > 0 && (
              <div>
                <p className="text-[13px] font-medium text-muted">养成的习惯</p>
                <ul className="mt-2 space-y-1.5">
                  {habits.map((item, index) => (
                    <li key={index} className="text-[13px] text-text/80">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {review.memories.length > 0 && (
        <Card className="p-5">
          <SectionTitle icon={<Camera className="h-4 w-4 text-primary" />} title="我的记忆" />
          <div className="mt-3 space-y-3">
            {review.memories.map((memory, index) => (
              <div key={index} className="rounded-[8px] bg-surface-muted p-3">
                <p className="text-sm font-medium">{memory.title}</p>
                {memory.description && <p className="mt-1 text-[13px] text-text/80">{memory.description}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {review.reflection && (
        <Card className="p-5">
          <SectionTitle icon={<NotebookPen className="h-4 w-4 text-primary" />} title="年度反思" />
          <p className="mt-3 text-sm leading-relaxed text-text/80">{review.reflection}</p>
        </Card>
      )}

      {review.nextYearPlan.length > 0 && (
        <Card className="p-5">
          <SectionTitle icon={<Rocket className="h-4 w-4 text-primary" />} title="下一年计划" />
          <ul className="mt-3 space-y-2">
            {review.nextYearPlan.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-[13px] text-text/80">
                <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      {icon}
      {title}
    </div>
  );
}
