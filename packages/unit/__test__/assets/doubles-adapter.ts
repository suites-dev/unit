import type { DoublesAdapter } from '@suites/types.doubles';

export const adapter = { mock: jest.fn(), stub: jest.fn() } satisfies DoublesAdapter;
