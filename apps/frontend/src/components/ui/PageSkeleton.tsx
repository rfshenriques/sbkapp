import { Skeleton } from './Skeleton';

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading" role="status">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
