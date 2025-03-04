# Doppler Secrets Manager

A user-friendly CLI tool to add secrets to Doppler.

## Installation

1. Install dependencies:

```bash
cd scripts
npm install
```

1. Make the script executable (optional):

```bash
chmod +x add-secrets-to-doppler.js
```

## Usage

### Basic Usage

```bash
node add-secrets-to-doppler.js --api-key YOUR_API_KEY --project YOUR_PROJECT --config YOUR_CONFIG --secret KEY1=VALUE1 --secret KEY2=VALUE2
```

### Options

- `-k, --api-key <key>`: Your Doppler API key (required)
- `-p, --project <name>`: Doppler project name (required)
- `-c, --config <name>`: Doppler config name (required)
- `-s, --secret <key=value>`: Secret key-value pair (required, can be used multiple times)
- `-v, --verbose`: Show more detailed output
- `-h, --help`: Display help information

### Examples

Add a single secret:

```bash
node add-secrets-to-doppler.js --api-key dp.ct.xxxxxxxxxxxx --project my-project --config dev --secret DATABASE_URL=postgres://user:pass@localhost:5432/db
```

Add multiple secrets:

```bash
node add-secrets-to-doppler.js --api-key dp.ct.xxxxxxxxxxxx --project my-project --config dev --secret API_KEY=12345 --secret DEBUG=true --secret PORT=8080
```

Show verbose output:

```bash
node add-secrets-to-doppler.js --api-key dp.ct.xxxxxxxxxxxx --project my-project --config dev --secret API_KEY=12345 --verbose
```

Figma Example, with environment variables:

```bash
node add-secrets-to-doppler.js --api-key ${DOPPLER_TOKEN} --project ${DOPPLER_PROJECT} --config ${DOPPLER_CONFIG} --secret APP_FIGMA_CLIENT_ID=${APP_FIGMA_CLIENT_ID} --secret APP_FIGMA_CLIENT_SECRET=${APP_FIGMA_CLIENT_SECRET}
```

## Global Installation (Optional)

To install the script globally and use it from anywhere:

```bash
cd scripts
npm install -g .
```

Then you can run it with:

```bash
add-secrets-to-doppler --api-key YOUR_API_KEY --project YOUR_PROJECT --config YOUR_CONFIG --secret KEY1=VALUE1
```
