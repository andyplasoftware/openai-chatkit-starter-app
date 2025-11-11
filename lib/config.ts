import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "Explain this question in more detail",
    prompt: "Explain this question in more detail",
    icon: "circle-question",
  },
];

export const PLACEHOLDER_INPUT = "Ask anything...";

export const GREETING = "How can I help you today?";

export const getThemeConfig = (theme: ColorScheme): ThemeOption => ({
  radius: "soft", // Updated from "round" to "soft"
  density: "normal", // New from playground
  color: {
    accent: {
      primary: "#740066", // Updated to your purple color
      level: 1,
    },
    // Keep grayscale if you want, or remove it
    grayscale: {
      hue: 220,
      tint: 6,
      shade: theme === "dark" ? -1 : -4,
    },
  },
  typography: {
    baseSize: 15,
    fontFamily: "Inter, sans-serif",
    fontSources: [
      {
        family: "Inter",
        src: "https://rsms.me/inter/font-files/Inter-Regular.woff2",
        weight: 400,
        style: "normal",
      },
      // Add the other 3 font sources from your playground config here
      // (you'll need to copy those from the playground)
    ],
  },
});