import api from './api';

const VISITOR_TOKEN_STORAGE_KEY =
  'glamour_promotion_visitor_token';

export type ResolveMasterRegistrationPayload = {
  visitorToken?: string;
  fingerprint?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

type BackendResolveResponse = {
  visitId: string;
  visitorToken: string;
  salonId: string;
  title: string;
  targetType: string;
  targetId: string | null;
  customSlug: string | null;
};

export type ResolveRegistrationResponse = {
  success: boolean;
  visitId: string;
  visitorToken: string;
  salonId: string;
  title: string;
  targetType: string;
  targetId: string | null;
  customSlug: string | null;
  salon: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
};

export type CompleteMasterRegistrationPayload = {
  visitId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  preferredLanguage?: 'ru' | 'ro' | 'en';
};

export type CompleteMasterRegistrationResponse = {
  message: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    preferredLanguage: string;
    timezone: string;
    isActive: boolean;
  };
  salon: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    id: string;
    role: string;
    status?: string;
  };
};

export async function resolveMasterRegistration(
  identifier: string,
  payload: ResolveMasterRegistrationPayload,
): Promise<ResolveRegistrationResponse> {
  const normalizedIdentifier = identifier.trim();

  if (!normalizedIdentifier) {
    throw new Error(
      'Master registration identifier is required.',
    );
  }

  const response = await api.post<BackendResolveResponse>(
    `/public/promotion-links/${encodeURIComponent(
      normalizedIdentifier,
    )}/resolve`,
    payload,
  );

  if (response.data.visitorToken) {
    localStorage.setItem(
      VISITOR_TOKEN_STORAGE_KEY,
      response.data.visitorToken,
    );
  }

  return {
    success: true,
    visitId: response.data.visitId,
    visitorToken: response.data.visitorToken,
    salonId: response.data.salonId,
    title: response.data.title,
    targetType: response.data.targetType,
    targetId: response.data.targetId,
    customSlug: response.data.customSlug,
    salon: {
      id: response.data.salonId,
      name: response.data.title,
      logoUrl: null,
    },
  };
}

export async function completeMasterRegistration(
  identifier: string,
  payload: CompleteMasterRegistrationPayload,
): Promise<CompleteMasterRegistrationResponse> {
  const normalizedIdentifier = identifier.trim();

  if (!normalizedIdentifier) {
    throw new Error(
      'Master registration identifier is required.',
    );
  }

  const response =
    await api.post<CompleteMasterRegistrationResponse>(
      `/public/promotion-links/${encodeURIComponent(
        normalizedIdentifier,
      )}/master-registration`,
      {
        identifier: normalizedIdentifier,
        ...payload,
      },
    );

  return response.data;
}
