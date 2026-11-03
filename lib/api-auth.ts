import { getCurrentUser } from '@/lib/auth';

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return false;
  }
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const requestProtocol = forwardedProtocol
      ? `${forwardedProtocol.replace(/:$/, '')}:`
      : requestUrl.protocol;
    const requestHost = request.headers.get('host') || requestUrl.host;

    return originUrl.protocol === requestProtocol && originUrl.host.toLowerCase() === requestHost.toLowerCase();
  } catch {
    return false;
  }
}

export async function isAdminRequest() {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}
