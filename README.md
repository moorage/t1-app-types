# t1-app-types

The following types are used to define the structure and behavior of app configurations and authorization processes in the `t1-app-types` package. They can be imported from other applications to ensure correctness.

- **AppConfig**: A configuration object for an app, returned by the app provider as its default export. It includes properties such as the display name, icon (SVG or URL), unique identifier, provider, default scopes, and methods for handling authorization redirects and callbacks.

- **RequestAppSecretsFunction**: A callback function that retrieves the secrets for the app. The secrets are prefixed with `APP_[APP_NAME]` (e.g., `APP_FIGMA_CLIENT_ID` for "CLIENT_ID" and "APP_NAME" = "FIGMA"). It takes a record of secrets where the value is null and returns a record of secrets where the value is the secret value.

- **AuthorizeRedirect**: Represents a redirect URL to authorize the app, along with possible session storage values to pass to the callback function.

- **AuthorizationResult**: The result of an authorization callback, containing details such as the provider account ID, access token, token type, refresh token, expiration time, ID token, scope, supplemental data, and secret data.
