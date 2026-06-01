import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });
}

export function useCurrentVendor(userId) {
  return useQuery({
    queryKey: ['myVendor', userId],
    queryFn: async () => {
      const results = await base44.entities.Vendor.filter({ user_id: userId });
      return results[0] || null;
    },
    enabled: !!userId,
  });
}