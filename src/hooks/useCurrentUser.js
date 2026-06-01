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
      // First try to find by linked user_id
      const byUserId = await base44.entities.Vendor.filter({ user_id: userId });
      if (byUserId[0]) return byUserId[0];

      // Fallback: match by email and auto-link
      const user = await base44.auth.me();
      if (!user?.email) return null;
      const byEmail = await base44.entities.Vendor.filter({ email: user.email });
      if (byEmail[0]) {
        await base44.entities.Vendor.update(byEmail[0].id, { user_id: userId });
        return { ...byEmail[0], user_id: userId };
      }
      return null;
    },
    enabled: !!userId,
  });
}