import { Skeleton } from '../../components/ui/Skeleton';

export function MatchListSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading matches" role="status">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  );
}
