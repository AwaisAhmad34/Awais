// Isolate Firebase client calls in authenticationFlow.test.ts and execute TS tests
// with Node's native transformer (no live account creation or database writes).
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import fs from 'node:fs';
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/src/services/secureAuthentication.ts') && ['firebase/auth','firebase/firestore','../firebase'].includes(specifier)) {
      return next(new URL('./authFixture.ts', import.meta.url).href,context);
    }
    try { return next(specifier, context); }
    catch (error) {
      if (!specifier.startsWith('.')) throw error;
      for (const extension of ['.ts','.tsx','.js']) {
        try { return next(specifier+extension, context); } catch {}
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return {format:'module',source:stripTypeScriptTypes(fs.readFileSync(new URL(url),'utf8'),{mode:'transform'}),shortCircuit:true};
    if (url.endsWith('/firebase-applet-config.json')) return {format:'module',source:`export default ${fs.readFileSync(new URL(url),'utf8')}`,shortCircuit:true};
    return next(url,context);
  }
});
