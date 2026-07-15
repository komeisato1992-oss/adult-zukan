export type EnvPresenceLabel = "存在する" | "存在しない";

export type GoogleEnvPresence = {
  GOOGLE_SERVICE_ACCOUNT_JSON: EnvPresenceLabel;
  GA4_PROPERTY_ID: EnvPresenceLabel;
  GSC_SITE_URL: EnvPresenceLabel;
};
