import { META_PIXEL_ID } from "@/lib/meta-pixel";

// Meta's official base code, inlined as a plain script so `window.fbq` (and
// its event queue) exists before React hydrates and any tracking effect runs.
// It is skipped on /admin so staff activity never reaches Meta, and it omits
// the stock `fbq('track','PageView')` — <MetaPixelTracker /> sends that.
export function MetaPixelScript() {
  if (!META_PIXEL_ID) return null;

  const snippet = `if(!location.pathname.startsWith('/admin')){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');}`;

  return <script dangerouslySetInnerHTML={{ __html: snippet }} />;
}
