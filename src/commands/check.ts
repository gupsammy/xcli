import type { Command } from 'commander';
import type { CliContext } from '../cli/shared.js';

export function registerCheckCommand(program: Command, ctx: CliContext): void {
  program
    .command('check')
    .description('Check credential availability')
    .option('--json', 'Output credential status as JSON (auto-enabled when piped)')
    .action(async (cmdOpts: { json?: boolean }) => {
      const opts = program.opts();
      const { cookies, warnings } = await ctx.resolveCredentialsFromOptions(opts);

      const hasAuth = Boolean(cookies.authToken);
      const hasCt0 = Boolean(cookies.ct0);
      const ready = hasAuth && hasCt0;

      const useJson = cmdOpts.json || !ctx.isTty;
      if (useJson) {
        console.log(
          JSON.stringify({
            ready,
            authToken: hasAuth,
            ct0: hasCt0,
            source: cookies.source ?? null,
            warnings,
          }),
        );
        if (!ready) {
          process.exit(1);
        }
        return;
      }

      console.log(`${ctx.p('info')}Credential check`);
      console.log('─'.repeat(40));

      if (hasAuth) {
        console.log(`${ctx.p('ok')}auth_token: ${cookies.authToken?.slice(0, 10)}...`);
      } else {
        console.log(`${ctx.p('err')}auth_token: not found`);
      }

      if (hasCt0) {
        console.log(`${ctx.p('ok')}ct0: ${cookies.ct0?.slice(0, 10)}...`);
      } else {
        console.log(`${ctx.p('err')}ct0: not found`);
      }

      if (cookies.source) {
        console.log(`${ctx.l('source')}${cookies.source}`);
      }

      if (warnings.length > 0) {
        console.log(`\n${ctx.p('warn')}Warnings:`);
        for (const warning of warnings) {
          console.log(`   - ${warning}`);
        }
      }

      if (ready) {
        console.log(`\n${ctx.p('ok')}Ready to tweet!`);
      } else {
        console.log(`\n${ctx.p('err')}Missing credentials. Options:`);
        console.log('   1. Login to x.com in Safari/Chrome/Firefox');
        console.log('   2. Set AUTH_TOKEN and CT0 environment variables');
        console.log('   3. Use --auth-token and --ct0 flags');
        process.exit(1);
      }
    });
}
