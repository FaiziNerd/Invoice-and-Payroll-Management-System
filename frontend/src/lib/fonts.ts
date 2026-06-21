import { Instrument_Serif, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

export const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const fontDisplay = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif-display",
  weight: "400",
  display: "swap",
});

export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const fontVariables = `${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable}`;
