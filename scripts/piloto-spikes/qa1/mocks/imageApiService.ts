// @ts-nocheck
export * from '@repo/services/imageApiService?real';
export const imageApiService: any = { async generateImage() { throw new Error('preview'); } };
export const newSessionId = () => 'sess_preview';
