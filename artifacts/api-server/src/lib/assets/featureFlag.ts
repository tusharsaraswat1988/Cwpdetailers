export function isAssetsModuleEnabled(): boolean {
  const raw = process.env.ENABLE_ASSETS_MODULE;
  if (raw === undefined || raw === "") return true;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}
