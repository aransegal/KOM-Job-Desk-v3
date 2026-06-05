import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });
}

// Read-only: resolves the current user's linked vendor by user_id only.
// No email fallback, no write operations. Vendor linking is an admin responsibility.
export function useCurrentVendor(userId) {
  return useQuery({
    queryKey: ['myVendor', userId],
    queryFn: async () => {
      const results = await base44.entities.Vendor.filter({ user_id: userId });
      return results[0] ?? null;
    },
    enabled: !!userId,
  });
}