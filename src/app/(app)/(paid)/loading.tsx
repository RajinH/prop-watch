import PageSkeleton from '@/components/ui/PageSkeleton'

// Shown instantly when navigating between paid pages (Portfolio, Risk, Plan,
// Growth) while the page's server data loads.
export default function Loading() {
  return <PageSkeleton />
}
