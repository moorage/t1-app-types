#!/usr/bin/env node

/**
 * Doppler Secrets Management Script
 * 
 * This script allows you to easily add secrets to Doppler via the CLI
 * Usage: node add-secrets-to-doppler.js --api-key YOUR_API_KEY --project PROJECT_NAME --config CONFIG_NAME --secret KEY1=VALUE1 --secret KEY2=VALUE2
 */

const { program } = require('commander');
const fetch = require('node-fetch');
const chalk = require('chalk');

// Setup the CLI program with friendly descriptions
program
  .name('add-secrets-to-doppler')
  .description('A CLI tool to add secrets to Doppler')
  .version('1.0.0')
  .requiredOption('-k, --api-key <key>', 'Doppler API key (required)')
  .requiredOption('-p, --project <name>', 'Doppler project name (required)')
  .requiredOption('-c, --config <name>', 'Doppler config name (required)')
  .requiredOption('-s, --secret <key=value>', 'Secret key-value pair (required, can be used multiple times)', collectSecrets, {})
  .option('-v, --verbose', 'Show more detailed output')
  .helpOption('-h, --help', 'Display help information');

// Function to collect multiple --secret arguments into an object
function collectSecrets(value, previous) {
  const [key, secretValue] = value.split('=');
  
  if (!key || !secretValue) {
    console.error(chalk.red('Error: Secrets must be in the format KEY=VALUE'));
    process.exit(1);
  }
  
  return { 
    ...previous, 
    [key.trim()]: secretValue.trim() 
  };
}

// Parse arguments
program.parse(process.argv);
const options = program.opts();

// Main execution function
async function addSecretsToDoppler() {
  try {
    // Validate we have at least one secret
    if (Object.keys(options.secret).length === 0) {
      console.error(chalk.red('Error: At least one secret must be specified using --secret KEY=VALUE'));
      program.help();
      return;
    }

    if (options.verbose) {
      console.log(chalk.blue('🔐 Adding secrets to Doppler:'));
      console.log(chalk.blue(`Project: ${options.project}`));
      console.log(chalk.blue(`Config: ${options.config}`));
      console.log(chalk.blue(`Secrets: ${Object.keys(options.secret).map(key => key).join(', ')}`));
    } else {
      console.log(chalk.blue(`🔐 Adding ${Object.keys(options.secret).length} secret(s) to ${options.project}/${options.config}...`));
    }

    // Prepare API request
    const url = 'https://api.doppler.com/v3/configs/config/secrets';
    const requestOptions = {
      method: 'POST',
      headers: {
        'accept': 'application/json', 
        'content-type': 'application/json',
        'authorization': `Bearer ${options.apiKey}`
      },
      body: JSON.stringify({
        project: options.project,
        config: options.config,
        secrets: options.secret
      })
    };

    // Make API request
    const response = await fetch(url, requestOptions);
    const data = await response.json();

    // Handle response
    if (!response.ok) {
      console.error(chalk.red('Error adding secrets to Doppler:'));
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(msg => console.error(chalk.red(`- ${msg}`)));
      } else {
        console.error(chalk.red(JSON.stringify(data, null, 2)));
      }
      process.exit(1);
    }

    console.log(chalk.green('✅ Secrets successfully added to Doppler!'));
    
    if (options.verbose && data) {
      console.log(chalk.gray('Response:'));
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
    
  } catch (error) {
    console.error(chalk.red('Unexpected error:'), error.message);
    process.exit(1);
  }
}

// Execute the main function
addSecretsToDoppler();
