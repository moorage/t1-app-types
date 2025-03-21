/* eslint-disable prefer-const, @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type */

import {
  JsonValue,
  AuthorizationServer,
  JWK,
  INVALID_RESPONSE,
  Client,
  clockSkew,
  clockTolerance,
  IDToken,
  JsonObject,
  JWEDecryptOptions,
  OAuth2Error,
  OperationProcessingError,
  PARSE_ERROR,
  RESPONSE_IS_NOT_CONFORM,
  RESPONSE_IS_NOT_JSON,
  ResponseBodyError,
  TokenEndpointResponse,
  UnsupportedOperationError,
  WWWAuthenticateChallenge,
  WWWAuthenticateChallengeError,
  jweDecrypt,
  JWT_CLAIM_COMPARISON,
  getValidatedIdTokenClaims,
  JWT_TIMESTAMP_CHECK,
  ConfirmationClaims,
  JweDecryptFunction,
} from "oauth4webapi";

/**
 * This is not part of the public API.
 *
 * @private
 *
 * @ignore
 *
 * @internal
 */
const _expectedIssuer: unique symbol = Symbol();

type Constructor<T extends {} = {}> = new (...args: any[]) => T;

function looseInstanceOf<T extends {}>(
  input: unknown,
  expected: Constructor<T>
): input is T {
  if (input == null) {
    return false;
  }

  try {
    return (
      input instanceof expected ||
      Object.getPrototypeOf(input)[Symbol.toStringTag] ===
        expected.prototype[Symbol.toStringTag]
    );
  } catch {
    return false;
  }
}

const ERR_INVALID_ARG_VALUE = "ERR_INVALID_ARG_VALUE";
const ERR_INVALID_ARG_TYPE = "ERR_INVALID_ARG_TYPE";

type codes = typeof ERR_INVALID_ARG_VALUE | typeof ERR_INVALID_ARG_TYPE;

function CodedTypeError(message: string, code: codes, cause?: unknown) {
  const err = new TypeError(message, { cause });
  Object.assign(err, { code });
  return err;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function buf(input: string): Uint8Array;
function buf(input: Uint8Array): string;
function buf(input: string | Uint8Array) {
  if (typeof input === "string") {
    return encoder.encode(input);
  }

  return decoder.decode(input);
}

const CHUNK_SIZE = 0x8000;
function encodeBase64Url(input: Uint8Array | ArrayBuffer) {
  if (input instanceof ArrayBuffer) {
    input = new Uint8Array(input);
  }

  const arr = [];
  for (let i = 0; i < input.byteLength; i += CHUNK_SIZE) {
    arr.push(
      // @ts-expect-error copied from oauth4webapi
      String.fromCharCode.apply(null, input.subarray(i, i + CHUNK_SIZE))
    );
  }
  return btoa(arr.join(""))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(input: string) {
  try {
    const binary = atob(
      input.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "")
    );
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (cause) {
    throw CodedTypeError(
      "The input to be decoded is not correctly encoded.",
      ERR_INVALID_ARG_VALUE,
      cause
    );
  }
}
// @ts-expect-error copied from oauth4webapi
function b64u(input: string): Uint8Array;
function b64u(input: Uint8Array | ArrayBuffer): string;
function b64u(input: string | Uint8Array | ArrayBuffer) {
  if (typeof input === "string") {
    return decodeBase64Url(input);
  }

  return encodeBase64Url(input);
}
function OPE(message: string, code?: string, cause?: unknown) {
  return new OperationProcessingError(message, { code, cause });
}

function isJsonObject<T = JsonObject>(input: unknown): input is T {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }

  return true;
}

function assertNumber(
  input: unknown,
  allow0: boolean,
  it: string,
  code?: string,
  cause?: unknown
): asserts input is number {
  try {
    if (typeof input !== "number" || !Number.isFinite(input)) {
      throw CodedTypeError(
        `${it} must be a number`,
        ERR_INVALID_ARG_TYPE,
        cause
      );
    }

    if (input > 0) return;

    if (allow0 && input !== 0) {
      throw CodedTypeError(
        `${it} must be a non-negative number`,
        ERR_INVALID_ARG_VALUE,
        cause
      );
    }

    throw CodedTypeError(
      `${it} must be a positive number`,
      ERR_INVALID_ARG_VALUE,
      cause
    );
  } catch (err) {
    if (code) {
      throw OPE((err as Error).message, code, cause);
    }

    throw err;
  }
}

function assertString(
  input: unknown,
  it: string,
  code?: string,
  cause?: unknown
): asserts input is string {
  try {
    if (typeof input !== "string") {
      throw CodedTypeError(
        `${it} must be a string`,
        ERR_INVALID_ARG_TYPE,
        cause
      );
    }

    if (input.length === 0) {
      throw CodedTypeError(
        `${it} must not be empty`,
        ERR_INVALID_ARG_VALUE,
        cause
      );
    }
  } catch (err) {
    if (code) {
      throw OPE((err as Error).message, code, cause);
    }

    throw err;
  }
}

function assertApplicationJson(response: Response): void {
  assertContentType(response, "application/json");
}

function notJson(response: Response, ...types: string[]) {
  let msg = '"response" content-type must be ';
  if (types.length > 2) {
    const last = types.pop();
    msg += `${types.join(", ")}, or ${last}`;
  } else if (types.length === 2) {
    msg += `${types[0]} or ${types[1]}`;
  } else {
    msg += types[0];
  }
  return OPE(msg, RESPONSE_IS_NOT_JSON, response);
}

function assertContentType(response: Response, contentType: string): void {
  if (getContentType(response) !== contentType) {
    throw notJson(response, contentType);
  }
}

function getClockSkew(client?: Pick<Client, typeof clockSkew>) {
  const skew = client?.[clockSkew];

  return typeof skew === "number" && Number.isFinite(skew) ? skew : 0;
}

function getClockTolerance(client?: Pick<Client, typeof clockTolerance>) {
  const tolerance = client?.[clockTolerance];

  return typeof tolerance === "number" &&
    Number.isFinite(tolerance) &&
    Math.sign(tolerance) !== -1
    ? tolerance
    : 30;
}

/**
 * Returns the current unix timestamp in seconds.
 */
function epochTime() {
  return Math.floor(Date.now() / 1000);
}

function assertAs(as: AuthorizationServer): asserts as is AuthorizationServer {
  if (typeof as !== "object" || as === null) {
    throw CodedTypeError('"as" must be an object', ERR_INVALID_ARG_TYPE);
  }

  assertString(as.issuer, '"as.issuer"');
}

function assertClient(client: Client): asserts client is Client {
  if (typeof client !== "object" || client === null) {
    throw CodedTypeError('"client" must be an object', ERR_INVALID_ARG_TYPE);
  }

  assertString(client.client_id, '"client.client_id"');
}

function unquote(value: string) {
  if (
    value.length >= 2 &&
    value[0] === '"' &&
    value[value.length - 1] === '"'
  ) {
    return value.slice(1, -1);
  }

  return value;
}

const SPLIT_REGEXP = /((?:,|, )?[0-9a-zA-Z!#$%&'*+-.^_`|~]+=)/;
const SCHEMES_REGEXP = /(?:^|, ?)([0-9a-zA-Z!#$%&'*+\-.^_`|~]+)(?=$|[ ,])/g;

function wwwAuth(scheme: string, params: string): WWWAuthenticateChallenge {
  const arr = params.split(SPLIT_REGEXP).slice(1);
  if (!arr.length) {
    return {
      scheme: scheme.toLowerCase() as Lowercase<string>,
      parameters: {},
    };
  }
  arr[arr.length - 1] = arr[arr.length - 1].replace(/,$/, "");
  const parameters: WWWAuthenticateChallenge["parameters"] = {};
  for (let i = 1; i < arr.length; i += 2) {
    const idx = i;
    if (arr[idx][0] === '"') {
      while (arr[idx].slice(-1) !== '"' && ++i < arr.length) {
        arr[idx] += arr[i];
      }
    }
    const key = arr[idx - 1]
      .replace(/^(?:, ?)|=$/g, "")
      .toLowerCase() as Lowercase<string>;
    // @ts-expect-error copied from oauth4webapi
    parameters[key] = unquote(arr[idx]);
  }

  return {
    scheme: scheme.toLowerCase() as Lowercase<string>,
    parameters,
  };
}

function parseWwwAuthenticateChallenges(
  response: Response
): WWWAuthenticateChallenge[] | undefined {
  if (!looseInstanceOf(response, Response)) {
    throw CodedTypeError(
      '"response" must be an instance of Response',
      ERR_INVALID_ARG_TYPE
    );
  }

  const header = response.headers.get("www-authenticate");
  if (header === null) {
    return undefined;
  }

  const result: [string, number][] = [];
  for (const { 1: scheme, index } of header.matchAll(SCHEMES_REGEXP)) {
    result.push([scheme, index!]);
  }

  if (!result.length) {
    return undefined;
  }

  const challenges = result.map(([scheme, indexOf], i, others) => {
    const next = others[i + 1];
    let parameters: string;
    if (next) {
      parameters = header.slice(indexOf, next[1]);
    } else {
      parameters = header.slice(indexOf);
    }
    return wwwAuth(scheme, parameters);
  });

  return challenges;
}

function getContentType(input: Response | Request) {
  return input.headers.get("content-type")?.split(";")[0];
}

const idTokenClaims = new WeakMap<TokenEndpointResponse, IDToken>();
const jwtRefs = new WeakMap<Response, string>();

async function custom_processGenericAccessTokenResponse(
  as: AuthorizationServer,
  client: Client,
  response: Response,
  additionalRequiredIdTokenClaims: (keyof typeof jwtClaimNames)[] | undefined,
  options: JWEDecryptOptions | undefined
): Promise<TokenEndpointResponse> {
  assertAs(as);
  assertClient(client);

  if (!looseInstanceOf(response, Response)) {
    throw CodedTypeError(
      '"response" must be an instance of Response',
      ERR_INVALID_ARG_TYPE
    );
  }

  let challenges: WWWAuthenticateChallenge[] | undefined;
  if ((challenges = parseWwwAuthenticateChallenges(response))) {
    throw new WWWAuthenticateChallengeError(
      "server responded with a challenge in the WWW-Authenticate HTTP Header",
      { cause: challenges, response }
    );
  }

  if (response.status !== 200) {
    let err: OAuth2Error | undefined;
    if ((err = await handleOAuthBodyError(response))) {
      await response.body?.cancel();
      throw new ResponseBodyError(
        "server responded with an error in the response body",
        {
          cause: err,
          response,
        }
      );
    }
    throw OPE(
      '"response" is not a conform Token Endpoint response (unexpected HTTP status code)',
      RESPONSE_IS_NOT_CONFORM,
      response
    );
  }

  assertReadableResponse(response);
  assertApplicationJson(response);
  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw OPE('failed to parse "response" body as JSON', PARSE_ERROR, cause);
  }

  if (!isJsonObject<Writeable<TokenEndpointResponse>>(json)) {
    throw OPE('"response" body must be a top level object', INVALID_RESPONSE, {
      body: json,
    });
  }

  assertString(
    json.access_token,
    '"response" body "access_token" property',
    INVALID_RESPONSE,
    {
      body: json,
    }
  );

  assertString(
    json.token_type,
    '"response" body "token_type" property',
    INVALID_RESPONSE,
    {
      body: json,
    }
  );

  json.token_type = json.token_type.toLowerCase() as Lowercase<string>;

  if (json.token_type !== "dpop" && json.token_type !== "bearer") {
    console.warn("typically unsupported `token_type` value", json.token_type);
    // throw new UnsupportedOperationError("unsupported `token_type` value", {
    //   cause: { body: json },
    // });
  }

  if (json.expires_in !== undefined) {
    let expiresIn: unknown =
      typeof json.expires_in !== "number"
        ? parseFloat(json.expires_in)
        : json.expires_in;
    assertNumber(
      expiresIn,
      false,
      '"response" body "expires_in" property',
      INVALID_RESPONSE,
      {
        body: json,
      }
    );
    json.expires_in = expiresIn;
  }

  if (json.refresh_token !== undefined) {
    assertString(
      json.refresh_token,
      '"response" body "refresh_token" property',
      INVALID_RESPONSE,
      {
        body: json,
      }
    );
  }

  // allows empty
  if (json.scope !== undefined && typeof json.scope !== "string") {
    throw OPE(
      '"response" body "scope" property must be a string',
      INVALID_RESPONSE,
      { body: json }
    );
  }

  if (json.id_token !== undefined) {
    assertString(
      json.id_token,
      '"response" body "id_token" property',
      INVALID_RESPONSE,
      {
        body: json,
      }
    );

    const requiredClaims: (keyof typeof jwtClaimNames)[] = [
      "aud",
      "exp",
      "iat",
      "iss",
      "sub",
    ];

    if (client.require_auth_time === true) {
      requiredClaims.push("auth_time");
    }

    if (client.default_max_age !== undefined) {
      assertNumber(client.default_max_age, false, '"client.default_max_age"');
      requiredClaims.push("auth_time");
    }

    if (additionalRequiredIdTokenClaims?.length) {
      requiredClaims.push(...additionalRequiredIdTokenClaims);
    }

    const { claims, jwt } = await validateJwt(
      json.id_token,
      checkSigningAlgorithm.bind(
        undefined,
        client.id_token_signed_response_alg,
        as.id_token_signing_alg_values_supported,
        "RS256"
      ),
      getClockSkew(client),
      getClockTolerance(client),
      options?.[jweDecrypt]
    )
      .then(validatePresence.bind(undefined, requiredClaims))
      .then(validateIssuer.bind(undefined, as))
      .then(validateAudience.bind(undefined, client.client_id));

    if (Array.isArray(claims.aud) && claims.aud.length !== 1) {
      if (claims.azp === undefined) {
        throw OPE(
          'ID Token "aud" (audience) claim includes additional untrusted audiences',
          JWT_CLAIM_COMPARISON,
          { claims, claim: "aud" }
        );
      }
      if (claims.azp !== client.client_id) {
        throw OPE(
          'unexpected ID Token "azp" (authorized party) claim value',
          JWT_CLAIM_COMPARISON,
          { expected: client.client_id, claims, claim: "azp" }
        );
      }
    }

    if (claims.auth_time !== undefined) {
      assertNumber(
        claims.auth_time,
        false,
        'ID Token "auth_time" (authentication time)',
        INVALID_RESPONSE,
        { claims }
      );
    }

    jwtRefs.set(response, jwt);
    idTokenClaims.set(json, claims as IDToken);
  }

  return json;
}

function validateAudience(
  expected: string,
  result: Awaited<ReturnType<typeof validateJwt>>
) {
  if (Array.isArray(result.claims.aud)) {
    if (!result.claims.aud.includes(expected)) {
      throw OPE(
        'unexpected JWT "aud" (audience) claim value',
        JWT_CLAIM_COMPARISON,
        {
          expected,
          claims: result.claims,
          claim: "aud",
        }
      );
    }
  } else if (result.claims.aud !== expected) {
    throw OPE(
      'unexpected JWT "aud" (audience) claim value',
      JWT_CLAIM_COMPARISON,
      {
        expected,
        claims: result.claims,
        claim: "aud",
      }
    );
  }

  return result;
}

function validateIssuer(
  as: AuthorizationServer,
  result: Awaited<ReturnType<typeof validateJwt>>
) {
  // @ts-expect-error copied from oauth4webapi
  const expected = as[_expectedIssuer]?.(result) ?? as.issuer;
  if (result.claims.iss !== expected) {
    throw OPE(
      'unexpected JWT "iss" (issuer) claim value',
      JWT_CLAIM_COMPARISON,
      {
        expected,
        claims: result.claims,
        claim: "iss",
      }
    );
  }
  return result;
}

interface JWTPayload {
  readonly iss?: string;
  readonly sub?: string;
  readonly aud?: string | string[];
  readonly jti?: string;
  readonly nbf?: number;
  readonly exp?: number;
  readonly iat?: number;
  readonly cnf?: ConfirmationClaims;

  readonly [claim: string]: JsonValue | undefined;
}

interface CompactJWSHeaderParameters {
  alg: string;
  kid?: string;
  typ?: string;
  crit?: string[];
  jwk?: JWK;

  [parameter: string]: JsonValue | undefined;
}

interface ParsedJWT {
  header: CompactJWSHeaderParameters;
  claims: JWTPayload;
  jwt: string;
}

const jwtClaimNames = {
  aud: "audience",
  c_hash: "code hash",
  client_id: "client id",
  exp: "expiration time",
  iat: "issued at",
  iss: "issuer",
  jti: "jwt id",
  nonce: "nonce",
  s_hash: "state hash",
  sub: "subject",
  ath: "access token hash",
  htm: "http method",
  htu: "http uri",
  cnf: "confirmation",
  auth_time: "authentication time",
};

function validatePresence(
  required: (keyof typeof jwtClaimNames)[],
  result: Awaited<ReturnType<typeof validateJwt>>
) {
  for (const claim of required) {
    if (result.claims[claim] === undefined) {
      throw OPE(
        `JWT "${claim}" (${jwtClaimNames[claim]}) claim missing`,
        INVALID_RESPONSE,
        {
          claims: result.claims,
        }
      );
    }
  }
  return result;
}

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export async function custom_processAuthorizationCodeOAuth2Response(
  as: AuthorizationServer,
  client: Client,
  response: Response,
  options?: JWEDecryptOptions
): Promise<TokenEndpointResponse> {
  const result = await custom_processGenericAccessTokenResponse(
    as,
    client,
    response,
    undefined,
    options
  );

  const claims = getValidatedIdTokenClaims(result);
  if (claims) {
    if (client.default_max_age !== undefined) {
      assertNumber(client.default_max_age, false, '"client.default_max_age"');
      const now = epochTime() + getClockSkew(client);
      const tolerance = getClockTolerance(client);
      if (claims.auth_time! + client.default_max_age < now - tolerance) {
        throw OPE(
          "too much time has elapsed since the last End-User authentication",
          JWT_TIMESTAMP_CHECK,
          { claims, now, tolerance, claim: "auth_time" }
        );
      }
    }

    if (claims.nonce !== undefined) {
      throw OPE(
        'unexpected ID Token "nonce" claim value',
        JWT_CLAIM_COMPARISON,
        {
          expected: undefined,
          claims,
          claim: "nonce",
        }
      );
    }
  }

  return result;
}

function assertReadableResponse(response: Response): void {
  if (response.bodyUsed) {
    throw CodedTypeError(
      '"response" body has been used already',
      ERR_INVALID_ARG_VALUE
    );
  }
}

async function handleOAuthBodyError(
  response: Response
): Promise<OAuth2Error | undefined> {
  if (response.status > 399 && response.status < 500) {
    assertReadableResponse(response);
    assertApplicationJson(response);
    try {
      const json = await response.clone().json();
      if (
        isJsonObject<OAuth2Error>(json) &&
        typeof json.error === "string" &&
        json.error.length
      ) {
        return json;
      }
    } catch {}
  }
  return undefined;
}

/**
 * Minimal JWT validation implementation.
 */
async function validateJwt(
  jws: string,
  checkAlg: (h: CompactJWSHeaderParameters) => void,
  clockSkew: number,
  clockTolerance: number,
  decryptJwt: JweDecryptFunction | undefined
): Promise<ParsedJWT> {
  let { 0: protectedHeader, 1: payload, length } = jws.split(".");

  if (length === 5) {
    if (decryptJwt !== undefined) {
      jws = await decryptJwt(jws);
      ({ 0: protectedHeader, 1: payload, length } = jws.split("."));
    } else {
      throw new UnsupportedOperationError("JWE decryption is not configured", {
        cause: jws,
      });
    }
  }

  if (length !== 3) {
    throw OPE("Invalid JWT", INVALID_RESPONSE, jws);
  }

  let header: JsonValue;
  try {
    header = JSON.parse(buf(b64u(protectedHeader)));
  } catch (cause) {
    throw OPE(
      "failed to parse JWT Header body as base64url encoded JSON",
      PARSE_ERROR,
      cause
    );
  }

  if (!isJsonObject<CompactJWSHeaderParameters>(header)) {
    throw OPE("JWT Header must be a top level object", INVALID_RESPONSE, jws);
  }

  checkAlg(header);
  if (header.crit !== undefined) {
    throw new UnsupportedOperationError(
      'no JWT "crit" header parameter extensions are supported',
      {
        cause: { header },
      }
    );
  }

  let claims: JsonValue;
  try {
    claims = JSON.parse(buf(b64u(payload)));
  } catch (cause) {
    throw OPE(
      "failed to parse JWT Payload body as base64url encoded JSON",
      PARSE_ERROR,
      cause
    );
  }

  if (!isJsonObject<JWTPayload>(claims)) {
    throw OPE("JWT Payload must be a top level object", INVALID_RESPONSE, jws);
  }

  const now = epochTime() + clockSkew;

  if (claims.exp !== undefined) {
    if (typeof claims.exp !== "number") {
      throw OPE(
        'unexpected JWT "exp" (expiration time) claim type',
        INVALID_RESPONSE,
        { claims }
      );
    }

    if (claims.exp <= now - clockTolerance) {
      throw OPE(
        'unexpected JWT "exp" (expiration time) claim value, expiration is past current timestamp',
        JWT_TIMESTAMP_CHECK,
        { claims, now, tolerance: clockTolerance, claim: "exp" }
      );
    }
  }

  if (claims.iat !== undefined) {
    if (typeof claims.iat !== "number") {
      throw OPE(
        'unexpected JWT "iat" (issued at) claim type',
        INVALID_RESPONSE,
        { claims }
      );
    }
  }

  if (claims.iss !== undefined) {
    if (typeof claims.iss !== "string") {
      throw OPE('unexpected JWT "iss" (issuer) claim type', INVALID_RESPONSE, {
        claims,
      });
    }
  }

  if (claims.nbf !== undefined) {
    if (typeof claims.nbf !== "number") {
      throw OPE(
        'unexpected JWT "nbf" (not before) claim type',
        INVALID_RESPONSE,
        { claims }
      );
    }
    if (claims.nbf > now + clockTolerance) {
      throw OPE(
        'unexpected JWT "nbf" (not before) claim value',
        JWT_TIMESTAMP_CHECK,
        {
          claims,
          now,
          tolerance: clockTolerance,
          claim: "nbf",
        }
      );
    }
  }

  if (claims.aud !== undefined) {
    if (typeof claims.aud !== "string" && !Array.isArray(claims.aud)) {
      throw OPE(
        'unexpected JWT "aud" (audience) claim type',
        INVALID_RESPONSE,
        { claims }
      );
    }
  }

  return { header, claims, jwt: jws };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function supported(alg: string) {
  switch (alg) {
    case "PS256":
    case "ES256":
    case "RS256":
    case "PS384":
    case "ES384":
    case "RS384":
    case "PS512":
    case "ES512":
    case "RS512":
    case "Ed25519":
    case "EdDSA":
      return true;
    default:
      return false;
  }
}
/**
 * If configured must be the configured one (client), if not configured must be signalled by the
 * issuer to be supported (issuer), if not signalled may be a default fallback, otherwise its a
 * failure
 */
function checkSigningAlgorithm(
  client: string | string[] | undefined,
  issuer: string[] | undefined,
  fallback: string | string[] | typeof supported | undefined,
  header: CompactJWSHeaderParameters
) {
  if (client !== undefined) {
    if (
      typeof client === "string"
        ? header.alg !== client
        : !client.includes(header.alg)
    ) {
      throw OPE('unexpected JWT "alg" header parameter', INVALID_RESPONSE, {
        header,
        expected: client,
        reason: "client configuration",
      });
    }
    return;
  }

  if (Array.isArray(issuer)) {
    if (!issuer.includes(header.alg)) {
      throw OPE('unexpected JWT "alg" header parameter', INVALID_RESPONSE, {
        header,
        expected: issuer,
        reason: "authorization server metadata",
      });
    }
    return;
  }

  if (fallback !== undefined) {
    if (
      typeof fallback === "string"
        ? header.alg !== fallback
        : typeof fallback === "function"
        ? !fallback(header.alg)
        : !fallback.includes(header.alg)
    ) {
      throw OPE('unexpected JWT "alg" header parameter', INVALID_RESPONSE, {
        header,
        expected: fallback,
        reason: "default value",
      });
    }
    return;
  }

  throw OPE(
    'missing client or server configuration to verify used JWT "alg" header parameter',
    undefined,
    { client, issuer, fallback }
  );
}
