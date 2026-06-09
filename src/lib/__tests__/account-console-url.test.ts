import { describe, it, expect } from 'vitest';
import { buildAccountConsoleSecurityUrl } from '../account-console-url';

describe('buildAccountConsoleSecurityUrl', () => {
  it('builds the signing-in deep link with referrer + encoded referrer_uri', () => {
    const url = buildAccountConsoleSecurityUrl({
      keycloakUrl: 'https://auth.haiwave.ai',
      realm: 'haiwave-network',
      clientId: 'haiwave-portal',
      portalBaseUrl: 'https://console.haiwave.ai',
    });
    expect(url).toBe(
      'https://auth.haiwave.ai/realms/haiwave-network/account/' +
        '?referrer=haiwave-portal' +
        '&referrer_uri=https%3A%2F%2Fconsole.haiwave.ai%2Faccount%2Fsecurity' +
        '#/security/signing-in',
    );
  });

  it('tolerates trailing slashes on the base URLs', () => {
    const url = buildAccountConsoleSecurityUrl({
      keycloakUrl: 'https://auth.haiwave.ai/',
      realm: 'haiwave-network',
      clientId: 'haiwave-portal',
      portalBaseUrl: 'https://console.haiwave.ai/',
    });
    expect(url).toContain('https://auth.haiwave.ai/realms/haiwave-network/account/');
    expect(url).toContain('referrer_uri=https%3A%2F%2Fconsole.haiwave.ai%2Faccount%2Fsecurity');
    expect(url).not.toContain('.ai//realms');
  });
});
