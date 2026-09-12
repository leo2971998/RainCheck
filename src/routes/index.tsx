import { createFileRoute } from "@tanstack/react-router";
import RainCheckApp from "../raincheck/App.jsx";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RainCheck — Your Financial Forecast" },
      { name: "description", content: "A clear, friendly forecast for your cash flow, bills, savings, and financial goals." },
      { property: "og:title", content: "RainCheck — Your Financial Forecast" },
      { property: "og:description", content: "See what is ahead for your money and adjust your plan before the weather changes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RainCheckApp,
});
