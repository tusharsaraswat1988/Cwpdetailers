/** Shared design tokens for customer auth screens. */

export const authPrimaryButtonClass =
  "w-full h-12 min-h-12 text-base font-semibold rounded-lg bg-primary text-secondary shadow-sm hover:bg-primary/90 active:scale-[0.985] transition-all duration-200 ease-out";

export const authGoogleButtonClass =
  "w-full h-12 min-h-12 text-base font-medium rounded-lg border border-white/15 bg-transparent text-white/85 hover:bg-white/[0.07] hover:text-white active:scale-[0.985] transition-all duration-200 ease-out";

export const authInputClass =
  "h-12 min-h-12 bg-white/[0.04] border-white/10 text-white placeholder:text-white/45 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/80 transition-all duration-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed";

export const authPhoneInputClass =
  `${authInputClass} rounded-r-lg`;

export const authLabelClass = "text-white/70 text-sm font-normal";

export const authLinkClass =
  "text-primary hover:underline font-medium transition-colors duration-200";

export const authMutedLinkClass =
  "text-white/35 hover:text-white/55 transition-colors duration-200";

export const authOtpSlotClass =
  "h-14 w-11 sm:w-12 border-white/15 bg-white/[0.04] text-white text-lg sm:text-xl rounded-xl first:rounded-xl last:rounded-xl shadow-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/80";

export const authFadeIn = "animate-in fade-in duration-500 fill-mode-both";

export const authFadeUp = "animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both";

export const authFormStagger =
  "[&>*]:animate-in [&>*]:fade-in [&>*]:slide-in-from-bottom-1 [&>*]:duration-[400ms] [&>*]:fill-mode-both";
