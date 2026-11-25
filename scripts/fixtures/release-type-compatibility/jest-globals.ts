import { adapter, stub, type Mocked, type Stub } from '@suites/doubles.jest';

type Equal<L, R> =
  (<T>() => T extends L ? 1 : 2) extends <T>() => T extends R ? 1 : 2 ? true : false;
type Check<T extends true> = T;

type Read = (id: number) => string;
type Factory = Check<Equal<typeof stub, typeof jest.fn>>;
type AdapterStub = Check<Equal<ReturnType<typeof adapter.stub>, jest.Mock>>;
type Callback = Check<Equal<Stub<[number]>, jest.Mock<any, [number]>>>;
type MockMethod = Check<Equal<Mocked<{ read: Read }>['read'], jest.Mock<string, [number]> & Read>>;
