import { ok } from 'node:assert/strict';
import type { StubbedInstance } from '@suites/types.doubles';
import { FakeAdapter } from './assets/integration.assets.js';
import { mock } from '../mock.static.js';
import type { Repository, User } from './assets/injectable-registry.fixture.js';
import { DataMapper } from './assets/injectable-registry.fixture.js';
import { HttpClient } from './assets/injectable-registry.fixture.js';
import {
  TestLogger,
  UserApiService,
  UserDal,
  UserService,
  UserVerificationService,
  ApiService,
  DatabaseService,
} from './assets/injectable-registry.fixture.js';
import type { UnitReference } from '../../src/index.js';
import { SociableTestBedBuilder, UnitMocker } from '../../src/index.js';
import Mock = jest.Mock;

describe('Social TestBed Builder Integration Tests', () => {
  let unitBuilder: SociableTestBedBuilder<UserService>;
  let userServiceAsIfItWasUnderTest: UserService;
  let unitRef: UnitReference;

  const loggerMock = { warn: jest.fn() } satisfies Pick<Console, 'warn'>;

  beforeAll(async () => {
    unitBuilder = new SociableTestBedBuilder(
      Promise.resolve({
        mock: mock,
        stub: jest.fn,
      }),
      new UnitMocker(Promise.resolve(mock), Promise.resolve(FakeAdapter)),
      UserService,
      loggerMock
    );

    const testBed = await unitBuilder
      .expose(UserApiService, UserDal, DatabaseService)
      .bind(DataMapper.token, DataMapper)
      .mock(UserVerificationService)
      .impl(() => ({}))
      .mock(ApiService)
      .impl(() => ({}))
      .mock<Repository>('Repository')
      .impl(() => ({}))
      .mock(TestLogger)
      .impl((stubFn: Mock) => ({ log: stubFn().mockReturnValue('overridden') }))
      .mock<string[]>('SOME_VALUE_TOKEN')
      .final(['some value'])
      .compile();

    userServiceAsIfItWasUnderTest = testBed.unit;
    unitRef = testBed.unitRef;
  });

  it('should instantiate UserService with all dependencies properly resolved', () => {
    expect(userServiceAsIfItWasUnderTest).toBeInstanceOf(UserService);
  });

  it('should log messages impl the overridden Logger.log method when UserService is initialized', () => {
    const mockedLogger: StubbedInstance<TestLogger> = unitRef.get<TestLogger>(TestLogger);

    expect(mockedLogger.log).toHaveBeenNthCalledWith(1, 'Just logging a message');
    expect(mockedLogger.log).toHaveBeenNthCalledWith(2, 'UserService initialized');
  });

  it('should throw an error indicating the dependencies cannot be retrieved as they were exposed in the testbed', () => {
    expect(() => unitRef.get(DataMapper.token)).toThrow(/exposed dependency/);
    expect(() => unitRef.get(DataMapper)).toThrow();
    expect(() => unitRef.get(DatabaseService)).toThrow();
    expect(() => unitRef.get(UserDal)).toThrow();
    expect(() => unitRef.get(UserApiService)).toThrow();
  });

  describe('creating a user with UserService', () => {
    let repository: StubbedInstance<Repository>;
    let userVerService: StubbedInstance<UserVerificationService>;
    let createdUser: User;

    const userFixture = { name: 'Test User', email: 'test@example.com' } as const;

    beforeAll(async () => {
      userVerService = unitRef.get(UserVerificationService);

      repository = unitRef.get<Repository>('Repository');

      ok(jest.isMockFunction(userVerService.verify));
      userVerService.verify.mockReturnValue(true);
      createdUser = await userServiceAsIfItWasUnderTest.create(userFixture);
    });

    it('should call the verification service to verify the user data because it is mocked', () => {
      expect(userVerService.verify).toHaveBeenCalledWith(userFixture);
    });

    it('should go through the repository because the database service is exposed', () => {
      expect(repository.create).toHaveBeenCalledWith(JSON.stringify(userFixture));
    });

    it('should successfully create and return the same user', () => {
      expect(createdUser).toEqual(userFixture);
    });
  });

  describe('getting a user info with UserService', () => {
    const userId = '12345';

    let logger: StubbedInstance<TestLogger>;
    let apiService: StubbedInstance<ApiService>;
    let result: string;

    beforeAll(async () => {
      logger = unitRef.get(TestLogger) as StubbedInstance<TestLogger>;
      apiService = unitRef.get(ApiService) as StubbedInstance<ApiService>;

      apiService.fetchData.mockResolvedValue('Data from API');

      result = await userServiceAsIfItWasUnderTest.getUserInfo(userId);
    });

    it('should not call the logger as the ApiService is mocked and not exposed', () => {
      expect(logger.log).not.toHaveBeenCalledWith('fetching data');
    });

    it('should call the mocked ApiService to fetch the user data', () => {
      const endpointUrl = `https://api.example.com/users/${userId}`;
      expect(apiService.fetchData).toHaveBeenCalledWith(endpointUrl);
    });

    it('should go through UserApiService because it is exposed and return the data', () => {
      expect(result).toEqual('User Data: Data from API');
    });

    it('should not expose the HttpClient because it is not a direct dependency', () => {
      expect(() => unitRef.get(HttpClient)).toThrow();
    });
  });

  it('rejects unused declarations when a mock cuts off their branch', async () => {
    const configure = jest.fn(() => ({}));
    await expect(
      unitBuilder
        .expose(UserApiService, HttpClient)
        .mock(ApiService)
        .impl(() => ({}))
        .mock(TestLogger)
        .final({ log: jest.fn() })
        .mock('absent')
        .impl(configure)
        .compile()
    ).rejects.toMatchObject({
      code: 'ER043',
      message: expect.stringMatching(/mock 'absent'.*exposure 'HttpClient'/),
    });
    expect(configure).not.toHaveBeenCalled();
    expect(loggerMock.warn).not.toHaveBeenCalled();
  });
});
