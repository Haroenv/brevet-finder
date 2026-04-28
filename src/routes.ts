export const ROUTES = {
  home: '/',
  login: '/auth/login',
  signup: '/auth/signup',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  account: '/account',
  detail(objectID: string) {
    return `/brevets/${encodeURIComponent(objectID)}`;
  },
};

export function getLegacyObjectID(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('objectID');
}
