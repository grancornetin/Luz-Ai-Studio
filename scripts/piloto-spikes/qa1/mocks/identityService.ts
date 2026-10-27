export * from '@repo/modules/piloto/services/identityService?real';
import { identityService as real } from '@repo/modules/piloto/services/identityService?real';

export const identityService = {
  ...real,
  async getPilotBrand() { return null as any; },
  async saveIdentity() { return 'b1'; },
};
