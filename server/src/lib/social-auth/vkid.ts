import { createHash } from 'crypto';
import {
  buildAuthSuccessForUserId,
  createUserFromAuthIdentity,
  findOauthIdentity,
  findUserByEmail,
  linkSocialIdentity,
} from '../auth-accounts.js';
import {
  consumePendingSocialAuth,
  createPendingSocialAuth,
  createSocialCompletionTicket,
} from './store.js';

const VK_AUTHORIZE_URL = 'https://id.vk.ru/authorize';
const VK_TOKEN_URL = 'https://id.vk.ru/oauth2/auth';
const VK_USER_INFO_URL = 'https://id.vk.ru/oauth2/user_info';
const DEFAULT_SITE_URL = 'https://21day.club';

interface VkTokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  user_id?: string | number;
  state?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface VkUserInfoResponse {
  user?: {
    user_id?: string | number;
    first_name?: string;
    last_name?: string;
    phone?: string;
    avatar?: string;
    email?: string;
    verified?: boolean;
  };
  error?: string;
  error_description?: string;
}

interface VkCallbackPayload {
  code: string;
  state: string;
  deviceId: string;
}

interface VkResolvedProfile {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
  rawProfileJson: string;
}

export type VkSocialProvider = 'vkid' | 'mail_ru' | 'ok_ru';

function getSiteUrl(): string {
  return (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

function getVkRedirectUri(): string {
  return process.env.VKID_REDIRECT_URI || `${getSiteUrl()}/api/auth/social/vkid/callback`;
}

export function assertVkIdConfigured(): void {
  if (!process.env.VKID_CLIENT_ID?.trim()) {
    throw new Error('VK ID не настроен на сервере');
  }
}

function getVkClientId(): string {
  const clientId = process.env.VKID_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error('VK ID не настроен на сервере');
  }
  return clientId;
}

function sha256Base64Url(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

export function buildVkStartRedirect(params: {
  accessCode?: string;
  mode?: 'login' | 'register';
  provider?: VkSocialProvider;
}): string {
  assertVkIdConfigured();

  const pending = createPendingSocialAuth({
    accessCode: params.accessCode,
    mode: params.mode,
  });

  const query = new URLSearchParams({
    response_type: 'code',
    client_id: getVkClientId(),
    redirect_uri: getVkRedirectUri(),
    scope: 'email',
    state: pending.state,
    code_challenge: sha256Base64Url(pending.codeVerifier),
    code_challenge_method: 'S256',
  });

  if (params.provider) {
    query.set('provider', params.provider);
  }

  return `${VK_AUTHORIZE_URL}?${query.toString()}`;
}

export function buildSocialCallbackSuccessRedirect(ticket: string): string {
  const query = new URLSearchParams({ ticket });
  return `${getSiteUrl()}/auth/vkid/callback?${query.toString()}`;
}

export function buildSocialCallbackErrorRedirect(message: string): string {
  const query = new URLSearchParams({ error: message });
  return `${getSiteUrl()}/auth/vkid/callback?${query.toString()}`;
}

export function parseVkCallbackPayload(input: {
  payload?: string;
  code?: string;
  state?: string;
  device_id?: string;
  deviceId?: string;
  error?: string;
  error_description?: string;
}): VkCallbackPayload {
  if (input.error) {
    throw new Error(input.error_description || 'Авторизация VK ID была отменена');
  }

  if (input.payload?.trim()) {
    const parsed = JSON.parse(input.payload);
    const code = typeof parsed.code === 'string' ? parsed.code.trim() : '';
    const state = typeof parsed.state === 'string' ? parsed.state.trim() : '';
    const deviceId = typeof parsed.device_id === 'string'
      ? parsed.device_id.trim()
      : typeof parsed.deviceId === 'string'
        ? parsed.deviceId.trim()
        : '';

    if (!code || !state || !deviceId) {
      throw new Error('VK ID вернул неполные данные авторизации');
    }

    return { code, state, deviceId };
  }

  const code = input.code?.trim() || '';
  const state = input.state?.trim() || '';
  const deviceId = input.device_id?.trim() || input.deviceId?.trim() || '';

  if (!code || !state || !deviceId) {
    throw new Error('VK ID вернул неполные данные авторизации');
  }

  return { code, state, deviceId };
}

async function postVkForm<T>(url: string, body: URLSearchParams): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) as T : ({} as T);

  if (!response.ok) {
    const error = (data as { error_description?: string; error?: string }).error_description
      || (data as { error?: string }).error
      || 'Ошибка запроса к VK ID';
    throw new Error(error);
  }

  return data;
}

async function exchangeVkCode(params: VkCallbackPayload & { codeVerifier: string }) {
  const response = await postVkForm<VkTokenResponse>(VK_TOKEN_URL, new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getVkClientId(),
    code: params.code,
    code_verifier: params.codeVerifier,
    device_id: params.deviceId,
    redirect_uri: getVkRedirectUri(),
    state: params.state,
  }));

  if (!response.access_token) {
    throw new Error(response.error_description || 'VK ID не выдал access token');
  }

  return response;
}

async function fetchVkUserInfo(accessToken: string): Promise<VkResolvedProfile> {
  const response = await postVkForm<VkUserInfoResponse>(VK_USER_INFO_URL, new URLSearchParams({
    access_token: accessToken,
    client_id: getVkClientId(),
  }));

  const user = response.user;
  const providerUserId = String(user?.user_id || '').trim();
  if (!providerUserId) {
    throw new Error('VK ID не вернул идентификатор пользователя');
  }

  const email = user?.email?.trim().toLowerCase() || null;
  const name = [user?.first_name?.trim(), user?.last_name?.trim()].filter(Boolean).join(' ').trim()
    || (email ? email.split('@')[0] : 'Пользователь');

  return {
    providerUserId,
    email,
    // VK user_info does not expose a separate email_verified flag.
    // In v1 we trust the email returned via granted VK OAuth scope=email.
    emailVerified: Boolean(email),
    name,
    rawProfileJson: JSON.stringify(user || {}),
  };
}

export async function resolveVkExchange(input: {
  payload?: string;
  code?: string;
  state?: string;
  device_id?: string;
  deviceId?: string;
  error?: string;
  error_description?: string;
}) {
  assertVkIdConfigured();

  const callbackPayload = parseVkCallbackPayload(input);
  const pending = consumePendingSocialAuth(callbackPayload.state);
  if (!pending) {
    throw new Error('Сессия входа через VK ID истекла. Попробуйте еще раз');
  }

  const tokenResponse = await exchangeVkCode({
    ...callbackPayload,
    codeVerifier: pending.codeVerifier,
  });
  const profile = await fetchVkUserInfo(tokenResponse.access_token as string);

  const existingIdentity = await findOauthIdentity('vkid', profile.providerUserId);
  if (existingIdentity) {
    return buildAuthSuccessForUserId(existingIdentity.userId);
  }

  if (!profile.email || !profile.emailVerified) {
    throw new Error('VK ID не передал подтвержденный email. Войдите обычным способом или зарегистрируйтесь по email');
  }

  let linkedUser = await findUserByEmail(profile.email);
  if (!linkedUser) {
    const created = await createUserFromAuthIdentity({
      email: profile.email,
      name: profile.name,
      accessCode: pending.mode === 'register' ? pending.accessCode || undefined : undefined,
    });
    linkedUser = created.user;
  }

  await linkSocialIdentity({
    userId: linkedUser.id,
    provider: 'vkid',
    providerUserId: profile.providerUserId,
    providerEmail: profile.email,
    providerEmailVerified: profile.emailVerified,
    rawProfileJson: profile.rawProfileJson,
  });

  return buildAuthSuccessForUserId(linkedUser.id);
}

export async function handleVkCallbackAndCreateTicket(input: {
  payload?: string;
  code?: string;
  state?: string;
  device_id?: string;
  deviceId?: string;
  error?: string;
  error_description?: string;
}) {
  const auth = await resolveVkExchange(input);
  return createSocialCompletionTicket(auth);
}
