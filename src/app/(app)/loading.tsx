import PageSkeleton from '@/components/ui/PageSkeleton'

// A loading.tsx can't cover the layout in its own folder, so the paywall check
// in (paid)/layout.tsx needs this one a level up. It shows when entering the
// paid pages from outside them, e.g. from /settings.
export default function Loading() {
  return <PageSkeleton />
}
