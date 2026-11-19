import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { UndefinedTokenError } from '@suites/types.di';
import { TestBed } from '@suites/unit';

@Injectable()
class ServiceWithMissingToken {
  constructor(@Inject(undefined) readonly dependency: unknown) {}
}

describe('UndefinedTokenError', () => {
  it('exposes ER31 when constructed from the public package', () => {
    const error = new UndefinedTokenError('A constructor dependency needs a token.');

    expect(error).toMatchObject({
      name: 'UndefinedTokenError',
      code: 'ER31',
      message: 'Undefined token (code ER31)\nA constructor dependency needs a token.',
    });
  });

  it('reports ER31 when NestJS cannot detect a declared constructor token', async () => {
    const compilation = TestBed.solitary(ServiceWithMissingToken).compile();

    await expect(compilation).rejects.toBeInstanceOf(UndefinedTokenError);
    await expect(compilation).rejects.toMatchObject({
      name: 'UndefinedTokenError',
      code: 'ER31',
      message: expect.stringMatching(
        /^Undefined token \(code ER31\)\n[\s\S]*dependency at index \[0\]/
      ),
    });
  });
});
