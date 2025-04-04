import { INVALID_HANDLE } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { formatAccountStatus } from '../../../../account-manager/account-manager'
import { AuthScope } from '../../../../auth-verifier'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { resultPassthru } from '../../../proxy'
import { didDocForSession } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getSession({
    auth: ctx.authVerifier.accessStandard({
      additional: [AuthScope.SignupQueued],
    }),
    handler: async ({ auth, req }) => {
      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.server.getSession(
            undefined,
            ctx.entrywayPassthruHeaders(req),
          ),
        )
      }

      const did = auth.credentials.did
      const [user, didDoc] = await Promise.all([
        ctx.accountManager.getAccount(did, { includeDeactivated: true }),
        didDocForSession(ctx, did),
      ])
      if (!user) {
        throw new InvalidRequestError(
          `Could not find user info for account: ${did}`,
        )
      }

      const { status, active } = formatAccountStatus(user)

      return {
        encoding: 'application/json',
        body: {
          handle: user.handle ?? INVALID_HANDLE,
          did: user.did,
          email: user.email ?? undefined,
          didDoc,
          emailConfirmed: !!user.emailConfirmedAt,
          active,
          status,
        },
      }
    },
  })
}
