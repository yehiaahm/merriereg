import Script from 'next/script';

/**
 * Better Stack JavaScript tag — frontend errors, console logs, web vitals,
 * website analytics, auto-captured clicks/forms/rage-clicks and session
 * replays. What gets collected (and sampling) is configured remotely in
 * Better Stack → Error tracking → Applications → "MERRIER website" → Frontend,
 * so it can be changed without a redeploy.
 *
 * Rendered from the root layout (server component). Renders nothing unless
 * BETTER_STACK_JS_TAG_TOKEN is set, so local dev stays clean.
 *
 * The token is a public, browser-visible identifier (like a PostHog project
 * key), not a secret — but it's still validated so a malformed value can never
 * break out of the inline script.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export default function BetterStackTag() {
  const token = process.env.BETTER_STACK_JS_TAG_TOKEN?.trim();
  if (!token || !TOKEN_PATTERN.test(token)) return null;

  const initOptions = {
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    ...(process.env.RAILWAY_GIT_COMMIT_SHA ? { release: process.env.RAILWAY_GIT_COMMIT_SHA } : {}),
  };

  // Better Stack's official loader snippet (from the Frontend tab), with the
  // token and init options injected as JSON literals.
  const snippet = `!function(b,e,t,r){
b[t]=b[t]||function(...args){(b[t].q=b[t].q||[]).push(args)};
b[t].l=+new Date;
var s=e.createElement('script'); s.async=1; s.crossOrigin='anonymous';
s.src='https://betterstack.net/b.js?t='+r;
(e.head||e.getElementsByTagName('head')[0]).appendChild(s);
}(window,document,'betterstack',${JSON.stringify(token)});
betterstack('init', ${JSON.stringify(initOptions)});`;

  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document -- this rule targets the Pages Router; in the App Router, beforeInteractive is supported for scripts rendered from the root layout (this component is only rendered there, inside <head>)
    <Script id="betterstack-tag" strategy="beforeInteractive">
      {snippet}
    </Script>
  );
}
