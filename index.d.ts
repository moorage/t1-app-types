/**
 * A callback function that has the secrets for this app.
 * Actual secrets end up prefixed with APP_[APP_NAME] e.g. `APP_FIGMA_CLIENT_ID`
 * given "CLIENT_ID" and "APP_NAME" = "FIGMA"
 * @param secrets - A record of secrets where the value is null
 * @returns A record of secrets where the value is the secret value
 */
export type RequestAppSecretsFunction = (secrets: Record<string, null>) => Promise<{
    [K in keyof typeof secrets]: string;
}>;
/**
 * A redirect to authorize the app with possible session storage values
 * to pass to the callback function
 */
export type AuthorizeRedirect = {
    url: string;
    sessionStorageValues: Record<string, string | null> | null;
};
/**
 * The result of an authorization callback
 */
export type AuthorizationResult = {
    providerAccountId: string;
    accessToken: string;
    /** Email of the user, if available.  Used for deduplication */
    email: string | null;
    type: "oauth" | "oidc" | string;
    tokenType: "bearer" | "apitoken" | string;
    refreshToken: string | null;
    expiresAt: number | null;
    idToken: string | null;
    /** space separated scopes */
    scope: string;
    /** non-sensitive data to pass to the app/tools, possibly in llm calls */
    supplementalData: Record<string, string | null> | null;
    /** sensitive data to use in the app/tools, but not an llm call */
    secretData: Record<string, string | null> | null;
};
/**
 * A configuration for an app, which needs to be usable on the client side and server side
 */
export type AppConfig = {
    /** The version of the app. 1 for first published release. Incremented for each version that needs to be reinstalled. */
    majorVersion: number;
    /** The minor version of the app. 0 for first published release of the minor version. */
    minorVersion: number;
    /** The display name of the app, e.g. "GitHub" used on the UI */
    displayName: string;
    /** The icon of the app, in svg format */
    iconSVG: string | null;
    /** If no svg is provided, the url of an icon */
    iconURL: string | null;
    /** Unique identifier for the app, e.g. "COM_GITHUB_ORG_APP" -- only one can exist in tier1 environment */
    tier1UniqueId: string;
    /** The provider of the app, e.g. "github" */
    provider: string;
    /** The default scopes for the app */
    defaultScopes: string[];
};
/**
 * A configuration for an app's authorization process, which is usable on the server side
 */
export type AppAuthConfig = {
    /** The app config */
    appConfig: AppConfig;
    /** Whether to use a redirect to authorize the app.  Could be false if an API key style app */
    useRedirectAndCallback: boolean;
    /**
     * Where to redirect the user to authorize the app, with possible cookie storage values
     * to pass to the callback function. Default scopes are used if null.
     */
    getAuthorizeRedirect: (redirectUri: string, getSecrets: RequestAppSecretsFunction, scopes: string[] | null) => Promise<AuthorizeRedirect>;
    /**
     * Handle an authorization callback with cookie values from `getAuthorizeRedirect`
     */
    handleAuthorizationCallback: (requestUrl: string, originalRedirectUri: string, sessionStorageValues: Record<string, string | null> | null, getSecrets: RequestAppSecretsFunction) => Promise<AuthorizationResult>;
};
//# sourceMappingURL=index.d.ts.map