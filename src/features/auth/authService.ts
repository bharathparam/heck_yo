import { apiClient } from '../../services/apiClient';
import type { AuthUser, UserProfile } from '../../types';

const TOKEN_KEY = 'railbus-token';
const USER_KEY = 'railbus-user';

export const authService = {
  getToken: (): string | null => sessionStorage.getItem(TOKEN_KEY),

  getUser: (): UserProfile | AuthUser | null => {
    try {
      const data = sessionStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  login: async (email: string, password: string): Promise<AuthUser> => {
    const auth = await apiClient.login(email, password);
    sessionStorage.setItem(TOKEN_KEY, auth.access_token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(auth));
    return auth;
  },

  logout: (): void => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event('railbus-auth-expired'));
  },

  fetchProfile: async (): Promise<UserProfile> => {
    const profile = await apiClient.me();
    sessionStorage.setItem(USER_KEY, JSON.stringify(profile));
    return profile;
  },
};
