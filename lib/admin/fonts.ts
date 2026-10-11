// Keep the admin dashboard independent from a build-time remote font fetch.
// The global layout already provides the optional Arabic font;
// this fallback remains usable when that font is unavailable.
export const cairo = { className: "admin-arabic-font" };
